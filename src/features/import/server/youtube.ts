import type { SongInput } from '@/shared/types/song';
import { ProviderError, type SongProvider } from './provider';

const OEMBED = 'https://www.youtube.com/oembed';
const DATA_API = 'https://www.googleapis.com/youtube/v3';

interface YtOEmbed {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

/** Best-effort split of a YouTube title into "Artist - Track" when possible. */
function splitTitle(title: string, channel: string): { title: string; artist: string } {
  const m = title.match(/^\s*(.+?)\s*[-–—]\s*(.+?)\s*$/);
  if (m) return { artist: m[1]!.trim(), title: m[2]!.trim() };
  // Fall back to the channel name (often "<Artist> - Topic") as the artist.
  return { title: title.trim(), artist: channel.replace(/\s*-\s*Topic$/, '').trim() };
}

function thumbFor(videoId: string, fallback?: string): string {
  return fallback || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Parse an ISO-8601 duration (PT#M#S) to seconds. */
function isoDurationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h ?? 0) * 3600) + (Number(min ?? 0) * 60) + Number(s ?? 0);
}

export class YouTubeProvider implements SongProvider {
  readonly source = 'youtube' as const;

  constructor(private readonly apiKey = process.env.YOUTUBE_API_KEY) {}

  async fetchTrack(id: string): Promise<SongInput> {
    const watchUrl = `https://www.youtube.com/watch?v=${id}`;
    const res = await fetch(
      `${OEMBED}?url=${encodeURIComponent(watchUrl)}&format=json`,
    );
    if (!res.ok) {
      throw new ProviderError(
        'That YouTube video could not be found or is private.',
      );
    }
    const data = (await res.json()) as YtOEmbed;
    const { title, artist } = splitTitle(data.title, data.author_name ?? '');
    return {
      title,
      artist,
      source: 'youtube',
      sourceId: id,
      thumbnail: thumbFor(id, data.thumbnail_url),
      duration: 0, // oEmbed does not expose duration; enriched via Data API only
      url: watchUrl,
    };
  }

  /**
   * Import a playlist. With an API key we use the official Data API (reliable,
   * paginated). Without one we fall back to a best-effort, keyless scrape of the
   * public playlist page — so users can import a playlist in one link with no
   * setup. The scrape is unofficial and covers the first ~100 items.
   */
  async fetchPlaylist(id: string): Promise<SongInput[]> {
    if (this.apiKey) return this.fetchPlaylistViaApi(id);
    return this.fetchPlaylistKeyless(id);
  }

  private async fetchPlaylistViaApi(id: string): Promise<SongInput[]> {
    const apiKey = this.apiKey!;
    const songs: SongInput[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        maxResults: '50',
        playlistId: id,
        key: apiKey,
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`${DATA_API}/playlistItems?${params.toString()}`);
      if (!res.ok) {
        throw new ProviderError(
          'Could not read that YouTube playlist (it may be private).',
        );
      }
      const data = (await res.json()) as {
        nextPageToken?: string;
        items: Array<{
          snippet: {
            title: string;
            videoOwnerChannelTitle?: string;
            thumbnails?: Record<string, { url: string }>;
          };
          contentDetails: { videoId: string };
        }>;
      };

      for (const item of data.items) {
        const videoId = item.contentDetails.videoId;
        const rawTitle = item.snippet.title;
        // Deleted/private videos surface with placeholder titles — skip them.
        if (rawTitle === 'Private video' || rawTitle === 'Deleted video') {
          continue;
        }
        const { title, artist } = splitTitle(
          rawTitle,
          item.snippet.videoOwnerChannelTitle ?? '',
        );
        songs.push({
          title,
          artist,
          source: 'youtube',
          sourceId: videoId,
          thumbnail: thumbFor(
            videoId,
            item.snippet.thumbnails?.high?.url ??
              item.snippet.thumbnails?.default?.url,
          ),
          duration: 0,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Optionally enrich durations in batches (best-effort, non-fatal).
    await this.enrichDurations(songs).catch(() => undefined);
    return songs;
  }

  /**
   * Keyless import: fetch the public playlist page and parse the embedded
   * `ytInitialData` for its videos. Unofficial and best-effort — covers the
   * first page (~100 items) and may fail on some playlists (auto-generated
   * mixes, region/consent walls). Falls back with a clear, actionable message.
   */
  private async fetchPlaylistKeyless(id: string): Promise<SongInput[]> {
    const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}&hl=en`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          // Skip the EU consent interstitial so we get the real page.
          cookie: 'CONSENT=YES+1',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ProviderError('Could not open that YouTube playlist.');
      }
      html = await res.text();
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        'Could not reach YouTube to read that playlist. Paste individual video links instead.',
      );
    } finally {
      clearTimeout(timer);
    }

    const songs = parsePlaylistPage(html);
    if (songs.length === 0) {
      throw new ProviderError(
        'Could not read that playlist automatically (it may be private, empty, or an ' +
          'auto-generated mix). Paste individual video links, or set a YOUTUBE_API_KEY.',
      );
    }
    return songs;
  }

  /** Fill in durations via the videos endpoint (50 ids per call). */
  private async enrichDurations(songs: SongInput[]): Promise<void> {
    if (!this.apiKey) return;
    for (let i = 0; i < songs.length; i += 50) {
      const batch = songs.slice(i, i + 50);
      const params = new URLSearchParams({
        part: 'contentDetails',
        id: batch.map((s) => s.sourceId).join(','),
        key: this.apiKey,
      });
      const res = await fetch(`${DATA_API}/videos?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: Array<{ id: string; contentDetails: { duration: string } }>;
      };
      const byId = new Map(
        data.items.map((it) => [it.id, isoDurationToSeconds(it.contentDetails.duration)]),
      );
      for (const s of batch) s.duration = byId.get(s.sourceId) ?? 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Keyless playlist parsing (pure — no I/O, unit-testable).
// ---------------------------------------------------------------------------

/**
 * Extract the balanced JSON object assigned to `ytInitialData` in a YouTube
 * page's HTML, by brace-matching from the assignment (robust to nested braces
 * and string escapes). Returns null when not found or unparseable.
 */
export function extractYtInitialData(html: string): unknown | null {
  const markers = ['var ytInitialData =', 'ytInitialData"] =', 'ytInitialData =', 'ytInitialData=' ];
  for (const marker of markers) {
    const at = html.indexOf(marker);
    if (at === -1) continue;
    const start = html.indexOf('{', at);
    if (start === -1) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') {
        inStr = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(start, i + 1));
          } catch {
            break; // try the next marker
          }
        }
      }
    }
  }
  return null;
}

/** Recursively collect every value stored under `key` anywhere in a tree. */
function collectByKey(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const v of node) collectByKey(v, key, out);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === key) out.push(v);
      collectByKey(v, key, out);
    }
  }
  return out;
}

/**
 * Parse a YouTube playlist page's HTML into songs (best-effort, keyless).
 * Walks `ytInitialData` for `playlistVideoRenderer` entries.
 */
export function parsePlaylistPage(html: string): SongInput[] {
  const data = extractYtInitialData(html);
  if (!data) return [];

  const renderers = collectByKey(data, 'playlistVideoRenderer') as Array<Record<string, unknown>>;
  const seen = new Set<string>();
  const songs: SongInput[] = [];

  for (const r of renderers) {
    const videoId = typeof r.videoId === 'string' ? r.videoId : undefined;
    if (!videoId || seen.has(videoId)) continue;

    const title = readText(r.title);
    if (!title || title === 'Private video' || title === 'Deleted video') continue;

    seen.add(videoId);
    const channel = readText(r.shortBylineText) || readText(r.ownerText);
    const parsed = splitTitle(title, channel);
    songs.push({
      title: parsed.title,
      artist: parsed.artist,
      source: 'youtube',
      sourceId: videoId,
      thumbnail: thumbFor(videoId, readThumbnail(r.thumbnail)),
      duration: readLengthSeconds(r.lengthSeconds),
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  return songs;
}

/** Read YouTube's `{ runs: [{text}] }` / `{ simpleText }` text shapes. */
function readText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const obj = node as Record<string, unknown>;
  if (typeof obj.simpleText === 'string') return obj.simpleText;
  if (Array.isArray(obj.runs)) {
    return obj.runs
      .map((run) => (run && typeof run === 'object' ? String((run as Record<string, unknown>).text ?? '') : ''))
      .join('');
  }
  return '';
}

function readThumbnail(node: unknown): string | undefined {
  const thumbs =
    node && typeof node === 'object'
      ? ((node as Record<string, unknown>).thumbnails as unknown)
      : undefined;
  if (!Array.isArray(thumbs) || thumbs.length === 0) return undefined;
  const last = thumbs[thumbs.length - 1] as Record<string, unknown> | undefined;
  return last && typeof last.url === 'string' ? last.url : undefined;
}

function readLengthSeconds(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

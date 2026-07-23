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

  async fetchPlaylist(id: string): Promise<SongInput[]> {
    if (!this.apiKey) {
      throw new ProviderError(
        'Importing a full YouTube playlist requires a YOUTUBE_API_KEY. ' +
          'You can still paste individual video links.',
      );
    }

    const songs: SongInput[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        maxResults: '50',
        playlistId: id,
        key: this.apiKey,
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

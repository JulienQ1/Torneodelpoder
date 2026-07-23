import { nanoid } from 'nanoid';
import type { Song, SongInput } from '@/shared/types/song';
import { ProviderError, type SongProvider } from './provider';
import { parseMusicUrl } from './urls';
import { YouTubeProvider } from './youtube';
import { SpotifyProvider } from './spotify';

/**
 * Orchestrates imports across providers and normalises results into `Song`s.
 * The room layer talks only to this service, never to individual providers.
 */
export class ImportService {
  private readonly providers: Record<'youtube' | 'spotify', SongProvider>;

  constructor(providers?: Partial<Record<'youtube' | 'spotify', SongProvider>>) {
    this.providers = {
      youtube: providers?.youtube ?? new YouTubeProvider(),
      spotify: providers?.spotify ?? new SpotifyProvider(),
    };
  }

  /** Import a single track from a YouTube/Spotify URL. */
  async importTrack(url: string): Promise<Song> {
    const parsed = parseMusicUrl(url);
    if (!parsed) {
      throw new ProviderError('That does not look like a YouTube or Spotify link.');
    }
    if (parsed.kind !== 'track') {
      // Be forgiving: a playlist URL sent to the single-import path still works.
      const list = await this.importPlaylist(url);
      const first = list[0];
      if (!first) throw new ProviderError('That playlist appears to be empty.');
      return first;
    }
    const input = await this.providers[parsed.source].fetchTrack(parsed.id);
    return withId(input);
  }

  /** Import every track from a YouTube/Spotify playlist URL. */
  async importPlaylist(url: string): Promise<Song[]> {
    const parsed = parseMusicUrl(url);
    if (!parsed) {
      throw new ProviderError('That does not look like a playlist link.');
    }
    if (parsed.kind !== 'playlist') {
      // A single track passed to the playlist path → import it as a 1-song list.
      return [await this.importTrack(url)];
    }
    const inputs = await this.providers[parsed.source].fetchPlaylist(parsed.id);
    return inputs.map(withId);
  }
}

function withId(input: SongInput): Song {
  return { id: nanoid(10), ...input };
}

/** Stable identity key used for de-duplication (source + native id). */
export function songKey(song: Pick<Song, 'source' | 'sourceId'>): string {
  return `${song.source}:${song.sourceId}`;
}

/**
 * Merge `incoming` into `existing`, skipping any song already present (by
 * source + sourceId). Returns the songs actually added and how many were
 * skipped as duplicates. Pure — does not mutate inputs.
 */
export function mergeSongs(
  existing: readonly Song[],
  incoming: readonly Song[],
): { merged: Song[]; added: Song[]; duplicatesSkipped: number } {
  const seen = new Set(existing.map(songKey));
  const added: Song[] = [];
  for (const song of incoming) {
    const key = songKey(song);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(song);
  }
  return {
    merged: [...existing, ...added],
    added,
    duplicatesSkipped: incoming.length - added.length,
  };
}

/** Remove duplicates from a single list, keeping the first occurrence. */
export function dedupeSongs(songs: readonly Song[]): {
  deduped: Song[];
  removed: number;
} {
  const seen = new Set<string>();
  const deduped: Song[] = [];
  for (const song of songs) {
    const key = songKey(song);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(song);
  }
  return { deduped, removed: songs.length - deduped.length };
}

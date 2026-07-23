import type { SongInput } from '@/shared/types/song';

/**
 * A SongProvider knows how to turn a provider-native id into one or more
 * `SongInput`s. Adding a new music source (SoundCloud, Apple Music, …) later
 * means implementing this interface and registering it — nothing in the
 * tournament or room layers changes. This is the Open/Closed seam for imports.
 */
export interface SongProvider {
  readonly source: 'youtube' | 'spotify';
  /** Resolve a single track by its native id. */
  fetchTrack(id: string): Promise<SongInput>;
  /**
   * Resolve every track in a playlist by its native id.
   * May throw a `ProviderError` when credentials are required but missing.
   */
  fetchPlaylist(id: string): Promise<SongInput[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly userFacing = true,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

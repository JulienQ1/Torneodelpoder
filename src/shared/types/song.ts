/**
 * A Song is the universal contestant token inside a tournament.
 *
 * Design decision: songs are treated *identically* regardless of where they
 * came from (YouTube, Spotify, or anything added later). The rest of the app
 * never branches on `source` for tournament logic — it only matters for
 * playback/embedding. This keeps the domain model source-agnostic and makes
 * adding new providers (SoundCloud, Apple Music, …) a pure import concern.
 */
export type SongSource = 'youtube' | 'spotify';

export interface Song {
  /** Stable internal id (nanoid). Unique within a tournament. */
  id: string;
  title: string;
  artist: string;
  source: SongSource;
  /** The provider-native id (YouTube videoId, Spotify track id, …). */
  sourceId: string;
  /** Absolute thumbnail URL. */
  thumbnail: string;
  /** Duration in seconds (0 when unknown). */
  duration: number;
  /** Canonical URL back to the source (for playback / attribution). */
  url: string;
}

/** A song before it has been assigned an internal id (import-time shape). */
export type SongInput = Omit<Song, 'id'>;

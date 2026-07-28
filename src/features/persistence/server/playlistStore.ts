import { customAlphabet } from 'nanoid';
import type { Song } from '@/shared/types/song';
import { getPrisma, isPersistenceEnabled } from './prisma';

/** Short, unambiguous, human-shareable code (no 0/O/1/I). */
const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

export class PlaylistError extends Error {}

export interface SavedPlaylistInfo {
  code: string;
  name: string;
  songCount: number;
  songs: Song[];
}

/**
 * Minimal slice of the Prisma client this store needs. Declaring it as an
 * interface lets tests inject a fake in-memory client without a real database.
 */
export interface PlaylistDb {
  savedPlaylist: {
    create(args: {
      data: { code: string; name: string; songs: unknown; songCount: number };
    }): Promise<{ code: string }>;
    findUnique(args: {
      where: { code: string };
    }): Promise<{ code: string; name: string; songs: unknown; songCount: number } | null>;
  };
}

/** Save a playlist snapshot; returns its shareable code. Requires a database. */
export async function savePlaylist(
  songs: Song[],
  name: string,
  db: PlaylistDb | null = getPrisma() as PlaylistDb | null,
): Promise<{ code: string }> {
  if (!isPersistenceEnabled() || !db) {
    throw new PlaylistError(
      'Saving a playlist needs a database. Add PostgreSQL (set DATABASE_URL) to enable it.',
    );
  }
  if (songs.length === 0) {
    throw new PlaylistError('Add at least one song before saving the playlist.');
  }

  const cleanName = (name || 'Playlist').trim().slice(0, 80) || 'Playlist';

  // Generate a unique code (retry on the astronomically unlikely collision).
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode();
    const existing = await db.savedPlaylist.findUnique({ where: { code } });
    if (existing) continue;
    await db.savedPlaylist.create({
      data: { code, name: cleanName, songs, songCount: songs.length },
    });
    return { code };
  }
  throw new PlaylistError('Could not generate a unique code. Please try again.');
}

/** Load a saved playlist by code, or null when it does not exist. */
export async function loadPlaylist(
  code: string,
  db: PlaylistDb | null = getPrisma() as PlaylistDb | null,
): Promise<SavedPlaylistInfo | null> {
  if (!isPersistenceEnabled() || !db) return null;
  const row = await db.savedPlaylist.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    songCount: row.songCount,
    songs: (row.songs as Song[]) ?? [],
  };
}

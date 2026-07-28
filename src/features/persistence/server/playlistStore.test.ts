import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Song } from '@/shared/types/song';
import {
  loadPlaylist,
  PlaylistError,
  savePlaylist,
  type PlaylistDb,
} from './playlistStore';

/** Minimal in-memory stand-in for the Prisma client. */
function fakeDb(): PlaylistDb & { rows: Map<string, unknown> } {
  const rows = new Map<string, { code: string; name: string; songs: unknown; songCount: number }>();
  return {
    rows,
    savedPlaylist: {
      async create({ data }) {
        rows.set(data.code, { ...data });
        return { code: data.code };
      },
      async findUnique({ where }) {
        return rows.get(where.code) ?? null;
      },
    },
  };
}

function songs(n: number): Song[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    title: `Song ${i}`,
    artist: `A${i}`,
    source: 'youtube' as const,
    sourceId: `yt${i}`,
    thumbnail: `t${i}`,
    duration: 100 + i,
    url: `https://x/${i}`,
  }));
}

const original = process.env.DATABASE_URL;
beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://test'; // enable persistence gate
});
afterAll(() => {
  process.env.DATABASE_URL = original;
});

describe('playlistStore', () => {
  it('saves and loads a playlist round-trip by code', async () => {
    const db = fakeDb();
    const { code } = await savePlaylist(songs(3), 'My Mix', db);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);

    const loaded = await loadPlaylist(code, db);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('My Mix');
    expect(loaded!.songCount).toBe(3);
    expect(loaded!.songs).toHaveLength(3);
    expect(loaded!.songs[0]).toMatchObject({ sourceId: 'yt0', title: 'Song 0' });
  });

  it('loads case-insensitively and returns null for unknown codes', async () => {
    const db = fakeDb();
    const { code } = await savePlaylist(songs(2), 'X', db);
    expect(await loadPlaylist(code.toLowerCase(), db)).not.toBeNull();
    expect(await loadPlaylist('ZZZZZZZZ', db)).toBeNull();
  });

  it('defaults a blank name and rejects an empty playlist', async () => {
    const db = fakeDb();
    const { code } = await savePlaylist(songs(1), '   ', db);
    expect((await loadPlaylist(code, db))!.name).toBe('Playlist');
    await expect(savePlaylist([], 'Empty', db)).rejects.toBeInstanceOf(PlaylistError);
  });

  it('errors clearly when persistence is disabled', async () => {
    process.env.DATABASE_URL = '';
    await expect(savePlaylist(songs(2), 'X', null)).rejects.toBeInstanceOf(PlaylistError);
    expect(await loadPlaylist('ABC', null)).toBeNull();
    process.env.DATABASE_URL = 'postgres://test';
  });
});

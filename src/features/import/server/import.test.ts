import { describe, expect, it } from 'vitest';
import type { Song } from '@/shared/types/song';
import { parseMusicUrl } from './urls';
import { dedupeSongs, mergeSongs, songKey } from './importService';

describe('parseMusicUrl', () => {
  const cases: Array<[string, ReturnType<typeof parseMusicUrl>]> = [
    ['https://youtu.be/dQw4w9WgXcQ', { source: 'youtube', kind: 'track', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/watch?v=abc123', { source: 'youtube', kind: 'track', id: 'abc123' }],
    ['https://youtube.com/playlist?list=PL123', { source: 'youtube', kind: 'playlist', id: 'PL123' }],
    ['https://www.youtube.com/watch?v=abc&list=PL999', { source: 'youtube', kind: 'track', id: 'abc' }],
    ['https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh', { source: 'spotify', kind: 'track', id: '4iV5W9uYEdYUVa79Axb7Rh' }],
    ['https://open.spotify.com/intl-de/track/xyz', { source: 'spotify', kind: 'track', id: 'xyz' }],
    ['https://open.spotify.com/playlist/37i9dQZF1DX', { source: 'spotify', kind: 'playlist', id: '37i9dQZF1DX' }],
    ['https://example.com/foo', null],
    ['not a url', null],
  ];
  it.each(cases)('parses %s', (input, expected) => {
    expect(parseMusicUrl(input)).toEqual(expected);
  });
});

function song(source: Song['source'], sourceId: string): Song {
  return {
    id: Math.random().toString(36).slice(2),
    title: 't',
    artist: 'a',
    source,
    sourceId,
    thumbnail: '',
    duration: 0,
    url: '',
  };
}

describe('songKey', () => {
  it('keys on source + native id, not internal id', () => {
    expect(songKey(song('youtube', 'x'))).toBe('youtube:x');
    expect(songKey(song('spotify', 'x'))).toBe('spotify:x');
  });
});

describe('mergeSongs', () => {
  it('adds only new songs and reports duplicates', () => {
    const existing = [song('youtube', 'a')];
    const incoming = [song('youtube', 'a'), song('youtube', 'b'), song('spotify', 'a')];
    const res = mergeSongs(existing, incoming);
    expect(res.merged).toHaveLength(3);
    expect(res.added).toHaveLength(2);
    expect(res.duplicatesSkipped).toBe(1);
  });
});

describe('dedupeSongs', () => {
  it('removes duplicates keeping first occurrence', () => {
    const list = [song('youtube', 'a'), song('youtube', 'a'), song('youtube', 'b')];
    const res = dedupeSongs(list);
    expect(res.deduped).toHaveLength(2);
    expect(res.removed).toBe(1);
  });
});

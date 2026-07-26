import { describe, expect, it } from 'vitest';
import { extractYtInitialData, parsePlaylistPage } from './youtube';

/** Minimal ytInitialData shaped like a real playlist page. */
function fakePlaylistHtml(): string {
  const data = {
    contents: {
      x: {
        contents: [
          {
            playlistVideoRenderer: {
              videoId: 'aaa111',
              title: { runs: [{ text: 'Daft Punk - Around the World' }] },
              shortBylineText: { runs: [{ text: 'Daft Punk' }] },
              lengthSeconds: '428',
              thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/aaa111/hq.jpg' }] },
            },
          },
          {
            playlistVideoRenderer: {
              videoId: 'bbb222',
              title: { simpleText: 'Just A Title' },
              lengthSeconds: '200',
              thumbnail: { thumbnails: [] },
            },
          },
          // Deleted video should be skipped.
          {
            playlistVideoRenderer: {
              videoId: 'ccc333',
              title: { simpleText: 'Deleted video' },
            },
          },
          // Duplicate of the first — should be de-duped.
          {
            playlistVideoRenderer: {
              videoId: 'aaa111',
              title: { runs: [{ text: 'dup' }] },
            },
          },
        ],
      },
    },
  };
  return `<!doctype html><html><script>var ytInitialData = ${JSON.stringify(
    data,
  )};</script></html>`;
}

describe('extractYtInitialData', () => {
  it('extracts a balanced JSON object even with nested braces/strings', () => {
    const html = fakePlaylistHtml();
    const data = extractYtInitialData(html) as { contents?: unknown };
    expect(data).not.toBeNull();
    expect(data.contents).toBeDefined();
  });

  it('returns null when absent', () => {
    expect(extractYtInitialData('<html>nothing here</html>')).toBeNull();
  });
});

describe('parsePlaylistPage', () => {
  it('parses videos, splits "Artist - Title", dedupes, and skips deleted', () => {
    const songs = parsePlaylistPage(fakePlaylistHtml());
    expect(songs).toHaveLength(2); // deleted skipped, duplicate removed

    expect(songs[0]).toMatchObject({
      source: 'youtube',
      sourceId: 'aaa111',
      artist: 'Daft Punk',
      title: 'Around the World',
      duration: 428,
      thumbnail: 'https://i.ytimg.com/vi/aaa111/hq.jpg',
    });

    // No thumbnail in data → falls back to the predictable ytimg URL.
    expect(songs[1]!.sourceId).toBe('bbb222');
    expect(songs[1]!.title).toBe('Just A Title');
    expect(songs[1]!.thumbnail).toContain('bbb222');
  });

  it('returns [] for HTML without playlist data', () => {
    expect(parsePlaylistPage('<html></html>')).toEqual([]);
  });
});

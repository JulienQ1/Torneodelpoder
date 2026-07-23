/** Pure URL parsing helpers for the supported providers. No I/O. */

export interface ParsedUrl {
  source: 'youtube' | 'spotify';
  kind: 'track' | 'playlist';
  id: string;
}

/**
 * Identify a YouTube or Spotify URL and extract the relevant id.
 * Returns null when the URL is not a recognised music resource.
 */
export function parseMusicUrl(raw: string): ParsedUrl | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');

  // --- YouTube ---
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return id ? { source: 'youtube', kind: 'track', id } : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const list = url.searchParams.get('list');
    const v = url.searchParams.get('v');
    // A watch URL that also carries a playlist: prefer explicit playlist paths,
    // but a bare `list` without a video id means "import the playlist".
    if (url.pathname === '/playlist' && list) {
      return { source: 'youtube', kind: 'playlist', id: list };
    }
    if (v) return { source: 'youtube', kind: 'track', id: v };
    if (list) return { source: 'youtube', kind: 'playlist', id: list };
    return null;
  }

  // --- Spotify ---
  if (host === 'open.spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    // Handle locale-prefixed paths like /intl-de/track/<id>
    const typeIdx = parts.findIndex((p) => p === 'track' || p === 'playlist');
    if (typeIdx !== -1 && parts[typeIdx + 1]) {
      const kind = parts[typeIdx] === 'playlist' ? 'playlist' : 'track';
      return { source: 'spotify', kind, id: parts[typeIdx + 1]! };
    }
    return null;
  }

  return null;
}

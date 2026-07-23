import type { SongInput } from '@/shared/types/song';
import { ProviderError, type SongProvider } from './provider';

const OEMBED = 'https://open.spotify.com/oembed';
const ACCOUNTS = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

interface SpotifyOEmbed {
  title: string;
  thumbnail_url: string;
}

export class SpotifyProvider implements SongProvider {
  readonly source = 'spotify' as const;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly clientId = process.env.SPOTIFY_CLIENT_ID,
    private readonly clientSecret = process.env.SPOTIFY_CLIENT_SECRET,
  ) {}

  /**
   * Single track import. Works without credentials via the public oEmbed
   * endpoint; enriched with proper artist metadata when the Web API is
   * configured (oEmbed alone does not expose the artist separately).
   */
  async fetchTrack(id: string): Promise<SongInput> {
    if (this.hasCredentials()) {
      return this.fetchTrackViaApi(id);
    }
    const trackUrl = `https://open.spotify.com/track/${id}`;
    const res = await fetch(
      `${OEMBED}?url=${encodeURIComponent(trackUrl)}`,
    );
    if (!res.ok) {
      throw new ProviderError('That Spotify track could not be found.');
    }
    const data = (await res.json()) as SpotifyOEmbed;
    return {
      title: data.title,
      artist: '', // oEmbed does not separate the artist; enriched via Web API
      source: 'spotify',
      sourceId: id,
      thumbnail: data.thumbnail_url,
      duration: 0,
      url: trackUrl,
    };
  }

  async fetchPlaylist(id: string): Promise<SongInput[]> {
    if (!this.hasCredentials()) {
      throw new ProviderError(
        'Importing a Spotify playlist requires SPOTIFY_CLIENT_ID and ' +
          'SPOTIFY_CLIENT_SECRET. Individual track links work without them.',
      );
    }
    const token = await this.getToken();
    const songs: SongInput[] = [];
    let next: string | null =
      `${API}/playlists/${id}/tracks?limit=100&fields=next,items(track(id,name,duration_ms,artists(name),album(images)))`;

    while (next) {
      const res: Response = await fetch(next, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new ProviderError('Could not read that Spotify playlist.');
      }
      const data = (await res.json()) as {
        next: string | null;
        items: Array<{ track: SpotifyTrack | null }>;
      };
      for (const item of data.items) {
        if (item.track) songs.push(this.toSong(item.track));
      }
      next = data.next;
    }
    return songs;
  }

  private hasCredentials(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private async fetchTrackViaApi(id: string): Promise<SongInput> {
    const token = await this.getToken();
    const res = await fetch(`${API}/tracks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new ProviderError('That Spotify track could not be found.');
    }
    return this.toSong((await res.json()) as SpotifyTrack);
  }

  private toSong(track: SpotifyTrack): SongInput {
    return {
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      source: 'spotify',
      sourceId: track.id,
      thumbnail: track.album?.images?.[0]?.url ?? '',
      duration: Math.round((track.duration_ms ?? 0) / 1000),
      url: `https://open.spotify.com/track/${track.id}`,
    };
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 5_000) {
      return this.token.value;
    }
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const res = await fetch(ACCOUNTS, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      throw new ProviderError('Spotify authentication failed.', false);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return this.token.value;
  }
}

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: Array<{ name: string }>;
  album?: { images?: Array<{ url: string }> };
}

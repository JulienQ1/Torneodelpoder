'use client';

import type { Song } from '@/shared/types/song';

/**
 * Inline preview player so voters can actually hear a song before voting.
 * Uses each provider's official embed iframe:
 *  - YouTube → 16:9 video embed (autoplays muted-safe on user action).
 *  - Spotify → the compact track widget (30s preview when available).
 * Fully client-rendered; no API keys required for embeds.
 */
export function AudioPreview({ song }: { song: Song }) {
  if (song.source === 'youtube') {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
        <div className="aspect-video w-full">
          <iframe
            title={`Preview: ${song.title}`}
            src={`https://www.youtube.com/embed/${song.sourceId}?autoplay=1&rel=0&modestbranding=1`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // Spotify
  return (
    <div className="overflow-hidden rounded-xl">
      <iframe
        title={`Preview: ${song.title}`}
        src={`https://open.spotify.com/embed/track/${song.sourceId}?utm_source=torneo`}
        className="w-full"
        height={152}
        frameBorder={0}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}

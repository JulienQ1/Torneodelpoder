import type { Song } from '@/shared/types/song';
import { formatDuration, sourceLabel } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

/** A source badge (YouTube / Spotify) in the provider's accent colour. */
export function SourceBadge({ source }: { source: Song['source'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        source === 'youtube'
          ? 'bg-red-950/60 text-red-300'
          : 'bg-emerald-950/60 text-emerald-300',
      )}
    >
      {sourceLabel(source)}
    </span>
  );
}

/** A thumbnail with a graceful fallback when the image is missing. */
export function Thumb({
  song,
  className,
}: {
  song: Song;
  className?: string;
}) {
  if (!song.thumbnail) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-slate-800 text-slate-500',
          className,
        )}
      >
        <MusicIcon />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={song.thumbnail}
      alt=""
      loading="lazy"
      className={cn('object-cover', className)}
    />
  );
}

export function DurationBadge({ seconds }: { seconds: number }) {
  const label = formatDuration(seconds);
  if (!label) return null;
  return (
    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-200">
      {label}
    </span>
  );
}

function MusicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

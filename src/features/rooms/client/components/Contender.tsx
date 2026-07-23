'use client';

import type { Song } from '@/shared/types/song';
import { cn } from '@/shared/lib/cn';
import { DurationBadge, SourceBadge, Thumb } from './SongThumb';

/** One side of a matchup: artwork, metadata, vote button, and live share. */
export function Contender({
  song,
  side,
  votes,
  totalVotes,
  myVote,
  disabled,
  onVote,
  accent,
}: {
  song: Song;
  side: 'A' | 'B';
  votes: number;
  totalVotes: number;
  myVote: 'A' | 'B' | null;
  disabled: boolean;
  onVote: (side: 'A' | 'B') => void;
  accent: 'brand' | 'pink';
}) {
  const picked = myVote === side;
  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
  const ring = accent === 'brand' ? 'ring-brand-500' : 'ring-pink-500';
  const bar = accent === 'brand' ? 'bg-brand-500' : 'bg-pink-500';

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 transition',
        picked && `ring-2 ${ring}`,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
        <Thumb song={song} className="h-full w-full transition duration-300 group-hover:scale-105" />
        <div className="absolute bottom-2 right-2">
          <DurationBadge seconds={song.duration} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center gap-2">
          <SourceBadge source={song.source} />
          {song.artist && (
            <span className="truncate text-xs text-slate-400">{song.artist}</span>
          )}
        </div>
        <h3 className="line-clamp-2 text-base font-semibold text-slate-100">{song.title}</h3>

        {/* Live vote share */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {votes} vote{votes === 1 ? '' : 's'}
            </span>
            <span className="font-semibold text-slate-200">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={cn('h-full rounded-full transition-all duration-500', bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => onVote(side)}
          disabled={disabled}
          className={cn(
            'mt-4 h-11 rounded-xl font-semibold transition',
            'disabled:cursor-not-allowed disabled:opacity-50',
            picked
              ? accent === 'brand'
                ? 'bg-brand-600 text-white'
                : 'bg-pink-600 text-white'
              : 'bg-slate-800 text-slate-100 hover:bg-slate-700',
          )}
        >
          {picked ? 'Your pick ✓' : 'Vote'}
        </button>
      </div>
    </div>
  );
}

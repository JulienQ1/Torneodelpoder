'use client';

import type { Song } from '@/shared/types/song';
import { cn } from '@/shared/lib/cn';
import { DurationBadge, SourceBadge, Thumb } from './SongThumb';
import { AudioPreview } from './AudioPreview';

/** One side of a matchup: artwork, metadata, vote button, and live share. */
export function Contender({
  song,
  side,
  votes,
  totalVotes,
  showVotes,
  myVote,
  disabled,
  onVote,
  accent,
  outcome,
  mediaHidden,
  onRevealMedia,
  previewOpen,
  onTogglePreview,
}: {
  song: Song;
  side: 'A' | 'B';
  votes: number;
  totalVotes: number;
  /** Whether the A/B split may be shown (false = hidden for suspense). */
  showVotes: boolean;
  myVote: 'A' | 'B' | null;
  disabled: boolean;
  onVote: (side: 'A' | 'B') => void;
  accent: 'brand' | 'pink';
  /** Set once revealed: this side won or lost (drives the animation). */
  outcome: 'winner' | 'loser' | null;
  /** Blur the artwork for participants until they click to reveal it. */
  mediaHidden: boolean;
  onRevealMedia: () => void;
  previewOpen: boolean;
  onTogglePreview: () => void;
}) {
  const picked = myVote === side;
  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
  const ring = accent === 'brand' ? 'ring-brand-500' : 'ring-pink-500';
  const bar = accent === 'brand' ? 'bg-brand-500' : 'bg-pink-500';

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-slate-900/70 transition',
        outcome === 'winner'
          ? 'animate-pop border-emerald-500 ring-2 ring-emerald-500'
          : outcome === 'loser'
            ? 'border-slate-800 opacity-50 grayscale'
            : picked
              ? `border-slate-800 ring-2 ${ring}`
              : 'border-slate-800',
      )}
    >
      {outcome === 'winner' && (
        <div className="absolute left-2 top-2 z-10 animate-fade-in rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white shadow-lg">
          🏆 Gagnant
        </div>
      )}

      <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
        <Thumb
          song={song}
          className={cn(
            'h-full w-full transition duration-300 group-hover:scale-105',
            mediaHidden && 'scale-110 blur-2xl',
          )}
        />
        {mediaHidden ? (
          <button
            onClick={onRevealMedia}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-slate-100"
            aria-label="Révéler la pochette"
          >
            <EyeIcon />
            <span className="text-xs font-medium">Cliquer pour révéler</span>
          </button>
        ) : (
          <button
            onClick={onTogglePreview}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
            aria-label={previewOpen ? 'Masquer l’aperçu' : `Écouter ${song.title}`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
              {previewOpen ? <PauseIcon /> : <PlayIcon />}
            </span>
          </button>
        )}
        {!mediaHidden && (
          <div className="absolute bottom-2 right-2">
            <DurationBadge seconds={song.duration} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center gap-2">
          <SourceBadge source={song.source} />
          {song.artist && (
            <span
              className={cn(
                'truncate text-xs text-slate-400',
                mediaHidden && 'select-none blur-sm',
              )}
            >
              {song.artist}
            </span>
          )}
        </div>
        <h3
          className={cn(
            'line-clamp-2 text-base font-semibold text-slate-100',
            mediaHidden && 'select-none blur-sm',
          )}
        >
          {song.title}
        </h3>

        {/* Vote share — hidden for participants during suspense voting */}
        {showVotes && (
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
        )}

        {previewOpen && !mediaHidden && (
          <div className="mt-3 animate-fade-in">
            <AudioPreview song={song} />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {!mediaHidden && (
            <button
              onClick={onTogglePreview}
              className="flex h-11 flex-none items-center gap-1.5 rounded-xl bg-slate-800 px-3 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              {previewOpen ? <PauseIcon /> : <PlayIcon />}
              {previewOpen ? 'Masquer' : 'Écouter'}
            </button>
          )}
          <button
            onClick={() => onVote(side)}
            disabled={disabled}
            className={cn(
              'h-11 flex-1 rounded-xl font-semibold transition',
              'disabled:cursor-not-allowed disabled:opacity-50',
              picked
                ? accent === 'brand'
                  ? 'bg-brand-600 text-white'
                  : 'bg-pink-600 text-white'
                : 'bg-slate-800 text-slate-100 hover:bg-slate-700',
            )}
          >
            {picked ? 'Ton choix ✓' : 'Voter'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

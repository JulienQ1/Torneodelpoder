'use client';

import type { Match, Tournament } from '@/shared/types/tournament';
import { cn } from '@/shared/lib/cn';

/**
 * A read-only, horizontally-scrolling bracket that updates live as matches
 * complete. Sudden Death is rendered as the first column with a distinct look.
 */
export function Bracket({ tournament }: { tournament: Tournament }) {
  return (
    <div className="scroll-slim overflow-x-auto pb-2">
      <div className="flex min-w-max gap-6">
        {tournament.rounds.map((round) => (
          <div key={round.index} className="flex flex-col justify-around gap-3">
            <div className="sticky top-0 mb-1 text-center">
              <span
                className={cn(
                  'text-xs font-semibold uppercase tracking-wide',
                  round.isSuddenDeath ? 'text-amber-300' : 'text-brand-300',
                )}
              >
                {round.isSuddenDeath ? '⚡ Sudden Death' : round.name}
              </span>
            </div>
            {round.matchIds.map((id) => (
              <BracketMatch
                key={id}
                tournament={tournament}
                match={tournament.matches[id]!}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({ tournament, match }: { tournament: Tournament; match: Match }) {
  const isCurrent = tournament.currentMatchId === match.id;
  return (
    <div
      className={cn(
        'w-52 rounded-lg border bg-slate-900/70 text-sm',
        isCurrent ? 'border-brand-500 ring-1 ring-brand-500/50' : 'border-slate-800',
      )}
    >
      <Slot tournament={tournament} match={match} side="A" />
      <div className="border-t border-slate-800" />
      <Slot tournament={tournament} match={match} side="B" />
    </div>
  );
}

function Slot({
  tournament,
  match,
  side,
}: {
  tournament: Tournament;
  match: Match;
  side: 'A' | 'B';
}) {
  const songId = side === 'A' ? match.songAId : match.songBId;
  const votes = side === 'A' ? match.votesA : match.votesB;
  const song = songId ? tournament.songs[songId] : null;
  const isWinner = match.winnerId !== null && match.winnerId === songId;
  const isLoser = match.status === 'completed' && !isWinner;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5',
        isWinner && 'bg-brand-950/40',
        isLoser && 'opacity-40',
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          isWinner ? 'font-semibold text-brand-200' : 'text-slate-300',
        )}
      >
        {song?.title ?? <span className="text-slate-600">TBD</span>}
      </span>
      {match.status === 'completed' && (
        <span className="flex-none text-xs text-slate-500">{votes}</span>
      )}
      {isWinner && match.tieBreak && (
        <span
          className="flex-none text-[10px] text-amber-300"
          title={match.tieBreak === 'coin-flip' ? 'Won by coin flip' : 'Awarded by admin'}
        >
          {match.tieBreak === 'coin-flip' ? '🪙' : '⚖️'}
        </span>
      )}
    </div>
  );
}

'use client';

import type { Tournament } from '@/shared/types/tournament';
import { Button, Card } from '@/shared/components/ui';
import { Thumb, SourceBadge } from './SongThumb';

export function WinnerScreen({
  tournament,
  isAdmin,
  onNewRoom,
}: {
  tournament: Tournament;
  isAdmin: boolean;
  onNewRoom: () => void;
}) {
  const champion = tournament.championId ? tournament.songs[tournament.championId] : null;
  if (!champion) return null;

  return (
    <Card className="animate-fade-in overflow-hidden">
      <div className="bg-gradient-to-b from-brand-900/50 to-transparent p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">
          🏆 Champion
        </p>
        <div className="mx-auto mt-5 max-w-sm animate-pop">
          <div className="overflow-hidden rounded-2xl border border-brand-600/50 shadow-2xl shadow-brand-900/40">
            <Thumb song={champion} className="aspect-video w-full" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <SourceBadge source={champion.source} />
            {champion.artist && (
              <span className="text-sm text-slate-400">{champion.artist}</span>
            )}
          </div>
          <h2 className="mt-1 text-2xl font-black text-white">{champion.title}</h2>
        </div>

        <p className="mx-auto mt-4 max-w-md text-sm text-slate-400">
          Crowned from {tournament.entrantCount} songs across{' '}
          {Object.keys(tournament.matches).length} matches
          {tournament.suddenDeathMatchCount > 0 &&
            ` (including ${tournament.suddenDeathMatchCount} Sudden Death duel${
              tournament.suddenDeathMatchCount === 1 ? '' : 's'
            })`}
          .
        </p>

        {isAdmin && (
          <Button className="mt-6" size="lg" onClick={onNewRoom}>
            Start a new tournament
          </Button>
        )}
      </div>
    </Card>
  );
}

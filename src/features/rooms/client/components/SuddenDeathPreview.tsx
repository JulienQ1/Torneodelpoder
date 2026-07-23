'use client';

import { MIN_ENTRANTS, planSuddenDeath } from '@/features/tournament/domain/suddenDeath';
import { Card } from '@/shared/components/ui';

/**
 * Explains, before the tournament starts, exactly how the current song count
 * will be balanced — the headline "no random byes" feature, made transparent.
 */
export function SuddenDeathPreview({ songCount }: { songCount: number }) {
  if (songCount < MIN_ENTRANTS) {
    return (
      <Card className="p-4 text-sm text-slate-400">
        Add at least {MIN_ENTRANTS} songs to preview the bracket.
      </Card>
    );
  }

  const plan = planSuddenDeath(songCount);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Bracket preview</h3>
        <span className="text-xs text-slate-500">{songCount} songs</span>
      </div>

      {plan.isPerfectBracket ? (
        <p className="mt-2 text-sm text-emerald-300">
          Perfect bracket of {plan.bracketSize} — no Sudden Death needed.
        </p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <Row label="Main bracket size" value={`${plan.bracketSize}`} />
          <Row
            label="Sudden Death duels"
            value={`${plan.suddenDeathMatches} (${plan.songsInSuddenDeath} songs)`}
            accent
          />
          <Row label="Byes into main bracket" value={`${plan.byes}`} />
          <p className="pt-1 text-xs text-slate-500">
            {plan.songsInSuddenDeath} songs fight in {plan.suddenDeathMatches}{' '}
            Sudden Death duels; {plan.eliminations} lose and are eliminated,
            leaving a clean bracket of {plan.bracketSize}.
          </p>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={accent ? 'font-semibold text-brand-300' : 'font-medium text-slate-200'}>
        {value}
      </span>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { RoomSnapshot } from '@/shared/types/room';
import type { RoomController } from '../useRoomSocket';
import { Button, Card } from '@/shared/components/ui';
import { currentMatch, currentRound, progress, song } from '@/features/tournament/client/selectors';
import { Contender } from './Contender';
import { TieBreakPanel } from './TieBreakPanel';
import { CountdownTimer } from './CountdownTimer';

export function MatchStage({
  snapshot,
  controller,
  isAdmin,
}: {
  snapshot: RoomSnapshot;
  controller: RoomController;
  isAdmin: boolean;
}) {
  const t = snapshot.tournament!;
  const match = currentMatch(t);
  const round = currentRound(t);
  const [myVote, setMyVote] = useState<'A' | 'B' | null>(null);
  const [busy, setBusy] = useState(false);

  if (!match) {
    return <Card className="p-8 text-center text-slate-400">Preparing the next match…</Card>;
  }

  const songA = song(t, match.songAId);
  const songB = song(t, match.songBId);
  if (!songA || !songB) {
    return <Card className="p-8 text-center text-slate-400">Loading contenders…</Card>;
  }

  const { a, b, total } = snapshot.voteTally;
  const tied = snapshot.awaitingTieBreak;
  const prog = progress(t);

  async function vote(side: 'A' | 'B') {
    setMyVote(side); // optimistic highlight
    try {
      await controller.actions.vote(side);
    } catch {
      setMyVote(null);
    }
  }

  async function next() {
    setBusy(true);
    try {
      await controller.actions.next();
      setMyVote(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-300">
            {round?.isSuddenDeath ? '⚡ Sudden Death' : round?.name}
          </p>
          <h2 className="text-lg font-semibold text-slate-100">
            {round?.isSuddenDeath ? 'Win or go home' : 'Cast your vote'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {snapshot.deadline && !tied && <CountdownTimer deadline={snapshot.deadline} />}
          <div className="text-right text-xs text-slate-500">
            Match {prog.done + 1} of {prog.total}
            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${(prog.done / prog.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid items-stretch gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <Contender
          song={songA}
          side="A"
          votes={a}
          totalVotes={total}
          myVote={myVote}
          disabled={tied}
          onVote={vote}
          accent="brand"
        />
        <div className="flex items-center justify-center">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm font-black text-slate-400">
            VS
          </span>
        </div>
        <Contender
          song={songB}
          side="B"
          votes={b}
          totalVotes={total}
          myVote={myVote}
          disabled={tied}
          onVote={vote}
          accent="pink"
        />
      </div>

      {tied && isAdmin && (
        <TieBreakPanel songA={songA} songB={songB} onResolve={controller.actions.resolveTie} />
      )}
      {tied && !isAdmin && (
        <Card className="border-amber-700/40 bg-amber-950/20 p-4 text-center text-sm text-amber-200">
          It’s a tie — the admin is deciding the winner.
        </Card>
      )}

      {isAdmin && !tied && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {total} vote{total === 1 ? '' : 's'} cast. Lock it in when everyone’s ready.
          </p>
          <Button size="lg" onClick={next} loading={busy}>
            Reveal &amp; next →
          </Button>
        </div>
      )}
      {!isAdmin && !tied && (
        <p className="text-center text-xs text-slate-500">
          You can change your vote until the admin locks in the result.
        </p>
      )}
    </div>
  );
}

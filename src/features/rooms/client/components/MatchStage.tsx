'use client';

import { useEffect, useState } from 'react';
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
  const [previewSide, setPreviewSide] = useState<'A' | 'B' | null>(null);
  // Participant-side local reveal of blurred artwork ("click to reveal").
  const [mediaRevealed, setMediaRevealed] = useState<{ A: boolean; B: boolean }>({
    A: false,
    B: false,
  });
  const matchId = match?.id;
  useEffect(() => {
    setPreviewSide(null);
    setMyVote(null);
    setMediaRevealed({ A: false, B: false });
  }, [matchId]);

  if (!match) {
    return <Card className="p-8 text-center text-slate-400">Préparation du prochain duel…</Card>;
  }

  const songA = song(t, match.songAId);
  const songB = song(t, match.songBId);
  if (!songA || !songB) {
    return <Card className="p-8 text-center text-slate-400">Chargement des concurrents…</Card>;
  }

  const { a, b, votedCount, voters, hidden: votesHidden } = snapshot.voteTally;
  const revealed = snapshot.revealed;
  const tied = snapshot.awaitingTieBreak;
  const prog = progress(t);
  const allVoted = snapshot.allVoted;

  // Winner side once revealed and not a tie.
  const winnerSide: 'A' | 'B' | null = revealed && !tied ? (a >= b ? 'A' : 'B') : null;

  // Artwork blurred for participants until they reveal it (or the admin reveals
  // the match). The admin always sees the artwork.
  const mediaHidden = snapshot.settings.hideMedia && !isAdmin && !revealed;
  const showVotes = !votesHidden; // server already redacted for participants

  async function vote(side: 'A' | 'B') {
    if (revealed) return;
    setMyVote(side);
    try {
      await controller.actions.vote(side);
    } catch {
      setMyVote(null);
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
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
            {revealed ? 'Résultat' : round?.isSuddenDeath ? 'Élimination directe' : 'À vous de voter'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {snapshot.deadline && !revealed && !tied && (
            <CountdownTimer deadline={snapshot.deadline} />
          )}
          <div className="text-right text-xs text-slate-500">
            Duel {prog.done + 1} / {prog.total}
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
          totalVotes={a + b}
          showVotes={showVotes}
          myVote={myVote}
          disabled={revealed}
          onVote={vote}
          accent="brand"
          outcome={winnerSide === null ? null : winnerSide === 'A' ? 'winner' : 'loser'}
          mediaHidden={mediaHidden && !mediaRevealed.A}
          onRevealMedia={() => setMediaRevealed((s) => ({ ...s, A: true }))}
          previewOpen={previewSide === 'A'}
          onTogglePreview={() => setPreviewSide((s) => (s === 'A' ? null : 'A'))}
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
          totalVotes={a + b}
          showVotes={showVotes}
          myVote={myVote}
          disabled={revealed}
          onVote={vote}
          accent="pink"
          outcome={winnerSide === null ? null : winnerSide === 'B' ? 'winner' : 'loser'}
          mediaHidden={mediaHidden && !mediaRevealed.B}
          onRevealMedia={() => setMediaRevealed((s) => ({ ...s, B: true }))}
          previewOpen={previewSide === 'B'}
          onTogglePreview={() => setPreviewSide((s) => (s === 'B' ? null : 'B'))}
        />
      </div>

      {/* Who has voted (progress, never reveals the choice). */}
      {!revealed && (
        <VoterStatus
          participants={snapshot.participants}
          votedIds={snapshot.votedParticipantIds}
          votedCount={votedCount}
          voters={voters}
        />
      )}

      {/* Tie handling */}
      {tied && isAdmin && (
        <TieBreakPanel songA={songA} songB={songB} onResolve={controller.actions.resolveTie} />
      )}
      {tied && !isAdmin && (
        <Card className="border-amber-700/40 bg-amber-950/20 p-4 text-center text-sm text-amber-200">
          Égalité — l’admin choisit le gagnant.
        </Card>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {snapshot.canGoBack && (
              <Button
                size="md"
                variant="ghost"
                onClick={() => run(controller.actions.goBack)}
                loading={busy}
              >
                ← Revenir
              </Button>
            )}
          </div>

          {!revealed && (
            <div className="flex items-center gap-2">
              {!allVoted && (
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => run(() => controller.actions.reveal(true))}
                  loading={busy}
                >
                  Révéler quand même
                </Button>
              )}
              <Button
                size="lg"
                onClick={() => run(() => controller.actions.reveal(false))}
                loading={busy}
                disabled={!allVoted}
                title={!allVoted ? 'En attente de tous les votes' : undefined}
              >
                Révéler les votes ({votedCount}/{voters})
              </Button>
            </div>
          )}

          {revealed && !tied && (
            <Button size="lg" onClick={() => run(controller.actions.next)} loading={busy}>
              Duel suivant →
            </Button>
          )}
        </div>
      )}

      {/* Participant hints */}
      {!isAdmin && !revealed && (
        <p className="text-center text-xs text-slate-500">
          {myVote
            ? 'Vote enregistré — tu peux encore changer jusqu’à la révélation.'
            : 'Choisis ta musique préférée.'}
        </p>
      )}
      {!isAdmin && revealed && !tied && (
        <p className="text-center text-xs text-slate-500">
          Résultat révélé — en attente du prochain duel…
        </p>
      )}
    </div>
  );
}

function VoterStatus({
  participants,
  votedIds,
  votedCount,
  voters,
}: {
  participants: RoomSnapshot['participants'];
  votedIds: string[];
  votedCount: number;
  voters: number;
}) {
  const voted = new Set(votedIds);
  const connected = participants.filter((p) => p.connected);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
      <span className="text-xs font-medium text-slate-400">
        Votes : {votedCount}/{voters}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {connected.map((p) => (
          <span
            key={p.id}
            className={
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ' +
              (voted.has(p.id)
                ? 'bg-emerald-950/50 text-emerald-300'
                : 'bg-slate-800 text-slate-400')
            }
            title={voted.has(p.id) ? 'A voté' : 'Pas encore voté'}
          >
            <span
              className={
                'h-1.5 w-1.5 rounded-full ' +
                (voted.has(p.id) ? 'bg-emerald-400' : 'bg-slate-500')
              }
            />
            {p.nickname}
          </span>
        ))}
      </div>
    </div>
  );
}

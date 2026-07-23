'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/shared/components/ui';
import { Spinner } from '@/shared/components/ui';
import { useRoomSocket } from '../useRoomSocket';
import { clearSession } from '../session';
import { emitAck } from '../socket';
import { RoomHeader } from './RoomHeader';
import { Lobby } from './Lobby';
import { MatchStage } from './MatchStage';
import { Bracket } from './Bracket';
import { WinnerScreen } from './WinnerScreen';

export function RoomView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const controller = useRoomSocket(roomId);
  const { snapshot, participantId, connected, closed, notices, dismissNotice } = controller;

  const leave = () => {
    emitAck('room:leave', { roomId }).catch(() => undefined);
    clearSession();
    router.push('/');
  };

  if (closed) {
    return (
      <Centered>
        <Card className="max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold">Room closed</h2>
          <p className="mt-2 text-sm text-slate-400">{closed}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-5 text-sm font-medium text-brand-300 hover:text-brand-200"
          >
            ← Back home
          </button>
        </Card>
      </Centered>
    );
  }

  if (!snapshot) {
    return (
      <Centered>
        <div className="flex items-center gap-3 text-slate-400">
          <Spinner className="h-5 w-5" />
          {connected ? 'Joining room…' : 'Connecting…'}
        </div>
      </Centered>
    );
  }

  const isAdmin = snapshot.adminId === participantId;

  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      <RoomHeader snapshot={snapshot} connected={connected} onLeave={leave} />

      {notices.length > 0 && (
        <div className="mt-4 space-y-2">
          {notices.map((n) => (
            <button
              key={n.id}
              onClick={() => dismissNotice(n.id)}
              className={
                n.level === 'error'
                  ? 'block w-full rounded-lg border border-rose-800/50 bg-rose-950/40 px-4 py-2 text-left text-sm text-rose-200'
                  : 'block w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-left text-sm text-slate-300'
              }
            >
              {n.message}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-8">
        {snapshot.phase === 'lobby' && (
          <Lobby snapshot={snapshot} controller={controller} isAdmin={isAdmin} />
        )}

        {snapshot.phase === 'in-progress' && snapshot.tournament && (
          <>
            <MatchStage snapshot={snapshot} controller={controller} isAdmin={isAdmin} />
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-300">Bracket</h3>
              <Bracket tournament={snapshot.tournament} />
            </section>
          </>
        )}

        {snapshot.phase === 'finished' && snapshot.tournament && (
          <>
            <WinnerScreen
              tournament={snapshot.tournament}
              isAdmin={isAdmin}
              onNewRoom={() => {
                clearSession();
                router.push('/');
              }}
            />
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-300">Final bracket</h3>
              <Bracket tournament={snapshot.tournament} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">{children}</main>
  );
}

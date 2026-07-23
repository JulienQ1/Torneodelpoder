'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input } from '@/shared/components/ui';
import { emitAck } from '@/features/rooms/client/socket';
import { saveSession } from '@/features/rooms/client/session';

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    if (!nickname.trim()) return setError('Enter a nickname first.');
    setBusy('create');
    setError(null);
    try {
      const { roomId, participantId } = await emitAck<
        [{ nickname: string; title?: string }],
        { roomId: string; participantId: string }
      >('room:create', { nickname: nickname.trim(), title: title.trim() || undefined });
      saveSession({ roomId, participantId, nickname: nickname.trim() });
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function joinRoom() {
    if (!nickname.trim()) return setError('Enter a nickname first.');
    if (!code.trim()) return setError('Enter a room code.');
    setBusy('join');
    setError(null);
    try {
      const { roomId, participantId } = await emitAck<
        [{ code: string; nickname: string }],
        { roomId: string; participantId: string }
      >('room:join', { code: code.trim(), nickname: nickname.trim() });
      saveSession({ roomId, participantId, nickname: nickname.trim() });
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-4 py-10 sm:py-16">
      <header className="mb-10 text-center">
        <p className="mb-3 inline-block rounded-full border border-brand-700/50 bg-brand-900/30 px-3 py-1 text-xs font-medium text-brand-200">
          Real-time music tournaments
        </p>
        <h1 className="bg-gradient-to-r from-white via-brand-100 to-brand-300 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
          Torneo del Poder
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-slate-300 sm:text-lg">
          Turn any YouTube or Spotify playlist into a live, vote-driven bracket.
          Any number of songs is welcome — a fair{' '}
          <span className="font-semibold text-brand-300">Sudden Death</span> round
          balances the field, so there are never random byes.
        </p>
      </header>

      <div className="grid w-full gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create a room</h2>
          <p className="mt-1 text-sm text-slate-400">
            You’ll be the admin: import songs and run the tournament.
          </p>
          <div className="mt-5 space-y-3">
            <Input
              placeholder="Your nickname"
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Input
              placeholder="Tournament name (optional)"
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button
              className="w-full"
              size="lg"
              onClick={createRoom}
              loading={busy === 'create'}
            >
              Create room
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Join a room</h2>
          <p className="mt-1 text-sm text-slate-400">
            Got a code from a friend? Hop in and vote.
          </p>
          <div className="mt-5 space-y-3">
            <Input
              placeholder="Your nickname"
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Input
              placeholder="Room code (e.g. Q7X2)"
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="uppercase tracking-widest"
            />
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              onClick={joinRoom}
              loading={busy === 'join'}
            >
              Join room
            </Button>
          </div>
        </Card>
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-rose-800/50 bg-rose-950/40 px-4 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <section className="mt-16 grid w-full gap-4 sm:grid-cols-3">
        {[
          {
            title: 'Any playlist size',
            body: '36 songs? The bracket drops to 32 with exactly 4 Sudden Death duels — no unfair byes.',
          },
          {
            title: 'Vote together, live',
            body: 'Everyone in the room votes at once. Tallies update instantly over WebSockets.',
          },
          {
            title: 'Fair tie-breaks',
            body: 'On a draw the admin chooses: a coin flip, or a manual call. Never silent.',
          },
        ].map((f) => (
          <Card key={f.title} className="p-5">
            <h3 className="font-semibold text-brand-200">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{f.body}</p>
          </Card>
        ))}
      </section>

      <a
        href="/history"
        className="mt-10 text-sm font-medium text-slate-400 underline-offset-4 transition hover:text-brand-200 hover:underline"
      >
        View tournament history →
      </a>

      <footer className="mt-10 text-xs text-slate-600">
        Built with Next.js, Socket.IO & a provably fair bracket engine.
      </footer>
    </main>
  );
}

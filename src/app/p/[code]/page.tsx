'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Song } from '@/shared/types/song';
import type { ImportResult } from '@/shared/types/socket';
import { Button, Card, Input, Spinner } from '@/shared/components/ui';
import { emitAck } from '@/features/rooms/client/socket';
import { saveSession } from '@/features/rooms/client/session';

interface Preview {
  code: string;
  name: string;
  songCount: number;
  songs: Song[];
}

export default function PlaylistPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/playlist/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Preview) => {
        setPreview(data);
        setStatus('ready');
      })
      .catch(() => setStatus('missing'));
  }, [code]);

  async function startWithPlaylist() {
    if (!nickname.trim()) return setError('Entre un pseudo pour commencer.');
    setBusy(true);
    setError(null);
    try {
      const { roomId, participantId } = await emitAck<
        [{ nickname: string; title?: string }],
        { roomId: string; participantId: string }
      >('room:create', { nickname: nickname.trim(), title: preview?.name });
      saveSession({ roomId, participantId, nickname: nickname.trim() });
      // Load the saved playlist into the fresh room.
      await emitAck<[{ roomId: string; code: string }], ImportResult>('playlist:load', {
        roomId,
        code,
      });
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <button
          onClick={() => router.push('/')}
          className="text-sm font-bold tracking-tight text-slate-300 transition hover:text-white"
        >
          Torneo del Poder
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-3 text-slate-400">
          <Spinner className="h-5 w-5" /> Chargement de la playlist…
        </div>
      )}

      {status === 'missing' && (
        <Card className="w-full p-8 text-center">
          <h1 className="text-lg font-semibold">Playlist introuvable</h1>
          <p className="mt-2 text-sm text-slate-400">
            Ce lien n’existe pas ou a expiré.
          </p>
          <Button className="mt-5" onClick={() => router.push('/')}>
            Retour à l’accueil
          </Button>
        </Card>
      )}

      {status === 'ready' && preview && (
        <Card className="w-full p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-300">
            Playlist partagée
          </p>
          <h1 className="mt-1 text-2xl font-bold">{preview.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {preview.songCount} musique{preview.songCount === 1 ? '' : 's'}
          </p>

          <ul className="scroll-slim mt-4 max-h-48 space-y-1 overflow-y-auto text-sm">
            {preview.songs.slice(0, 40).map((s) => (
              <li key={s.id} className="truncate text-slate-300">
                <span className="text-slate-500">•</span> {s.artist ? `${s.artist} — ` : ''}
                {s.title}
              </li>
            ))}
            {preview.songs.length > 40 && (
              <li className="text-slate-500">… et {preview.songs.length - 40} de plus</li>
            )}
          </ul>

          <div className="mt-5 space-y-3">
            <Input
              placeholder="Ton pseudo"
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') startWithPlaylist();
              }}
            />
            <Button className="w-full" size="lg" onClick={startWithPlaylist} loading={busy}>
              Créer une room avec cette playlist
            </Button>
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </div>
        </Card>
      )}
    </main>
  );
}

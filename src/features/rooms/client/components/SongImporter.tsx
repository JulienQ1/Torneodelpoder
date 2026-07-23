'use client';

import { useState } from 'react';
import { Button, Input } from '@/shared/components/ui';
import type { ImportResult } from '@/shared/types/socket';

interface Props {
  onAddManual: (url: string) => Promise<ImportResult>;
  onAddPlaylist: (url: string) => Promise<ImportResult>;
}

/** Admin control for importing songs from a link or a full playlist. */
export function SongImporter({ onAddManual, onAddPlaylist }: Props) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: (u: string) => Promise<ImportResult>) {
    const value = url.trim();
    if (!value) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn(value);
      const dupText =
        res.duplicatesSkipped > 0 ? ` (${res.duplicatesSkipped} duplicate skipped)` : '';
      setMessage({
        ok: true,
        text:
          res.added.length > 0
            ? `Added ${res.added.length} song${res.added.length === 1 ? '' : 's'}${dupText}.`
            : `Nothing new to add${dupText}.`,
      });
      setUrl('');
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Paste a YouTube or Spotify link…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') run(onAddManual);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run(onAddManual)} loading={busy}>
          Add track
        </Button>
        <Button size="sm" variant="secondary" onClick={() => run(onAddPlaylist)} loading={busy}>
          Import playlist
        </Button>
      </div>
      {message && (
        <p className={message.ok ? 'text-sm text-emerald-300' : 'text-sm text-rose-300'}>
          {message.text}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Single tracks work with no setup. Full playlist import uses the provider
        API keys when configured.
      </p>
    </div>
  );
}

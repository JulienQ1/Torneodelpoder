'use client';

import { useState } from 'react';
import type { Song } from '@/shared/types/song';
import type { TieBreakRequest } from '@/shared/types/room';
import { Button, Card } from '@/shared/components/ui';

/**
 * Shown to the admin when a match is tied. Never auto-resolves: the admin
 * explicitly chooses a coin flip or manually awards the win.
 */
export function TieBreakPanel({
  songA,
  songB,
  onResolve,
}: {
  songA: Song;
  songB: Song;
  onResolve: (r: TieBreakRequest) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function resolve(r: TieBreakRequest) {
    setBusy(true);
    try {
      await onResolve(r);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-amber-700/40 bg-amber-950/20 p-4">
      <h3 className="text-sm font-semibold text-amber-200">It’s a tie!</h3>
      <p className="mt-1 text-xs text-amber-100/70">
        As the admin, choose how to break it. Nothing is decided automatically.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Button variant="secondary" loading={busy} onClick={() => resolve({ method: 'coin-flip' })}>
          🪙 Coin flip
        </Button>
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => resolve({ method: 'admin-choice', side: 'A' })}
          className="truncate"
          title={songA.title}
        >
          Pick A
        </Button>
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => resolve({ method: 'admin-choice', side: 'B' })}
          className="truncate"
          title={songB.title}
        >
          Pick B
        </Button>
      </div>
    </Card>
  );
}

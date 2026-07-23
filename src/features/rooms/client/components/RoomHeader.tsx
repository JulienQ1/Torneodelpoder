'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RoomSnapshot } from '@/shared/types/room';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib/cn';

export function RoomHeader({
  snapshot,
  connected,
  onLeave,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  onLeave: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(snapshot.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-4">
      <button
        onClick={() => router.push('/')}
        className="text-sm font-bold tracking-tight text-slate-300 transition hover:text-white"
      >
        Torneo del Poder
      </button>

      <button
        onClick={copyCode}
        className="group flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5"
        title="Copy room code"
      >
        <span className="text-xs text-slate-500">CODE</span>
        <span className="font-mono text-lg font-bold tracking-widest text-brand-200">
          {snapshot.code}
        </span>
        <span className="text-xs text-slate-500 group-hover:text-slate-300">
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            connected ? 'text-emerald-300' : 'text-amber-300',
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              connected ? 'bg-emerald-400' : 'animate-pulse bg-amber-400',
            )}
          />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
        <Button size="sm" variant="ghost" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </header>
  );
}

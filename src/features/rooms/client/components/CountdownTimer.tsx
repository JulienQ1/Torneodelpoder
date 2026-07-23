'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * A lightweight per-match countdown. Purely presentational — the server is
 * authoritative and auto-advances when the deadline passes; this just shows the
 * remaining time and turns urgent in the final seconds.
 */
export function CountdownTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, deadline - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = remainingMs <= 5000;
  const expired = remainingMs <= 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums transition',
        expired
          ? 'border-slate-700 bg-slate-800 text-slate-400'
          : urgent
            ? 'animate-pulse border-rose-700/50 bg-rose-950/40 text-rose-200'
            : 'border-slate-700 bg-slate-900 text-slate-200',
      )}
      aria-live="polite"
    >
      <ClockIcon />
      {expired ? 'Time!' : `${seconds}s`}
    </span>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

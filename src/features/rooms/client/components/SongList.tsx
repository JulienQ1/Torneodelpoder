'use client';

import type { Song } from '@/shared/types/song';
import { Card } from '@/shared/components/ui';
import { DurationBadge, SourceBadge, Thumb } from './SongThumb';

export function SongList({
  songs,
  canEdit,
  onRemove,
}: {
  songs: Song[];
  canEdit: boolean;
  onRemove: (songId: string) => void;
}) {
  return (
    <Card className="flex max-h-[28rem] flex-col p-0">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-200">Songs</h3>
        <span className="text-xs text-slate-500">{songs.length}</span>
      </div>
      {songs.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No songs yet. Paste a link above to get started.
        </p>
      ) : (
        <ul className="scroll-slim divide-y divide-slate-800/70 overflow-y-auto">
          {songs.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <Thumb song={s} className="h-10 w-16 flex-none rounded-md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{s.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <SourceBadge source={s.source} />
                  {s.artist && (
                    <span className="truncate text-xs text-slate-400">{s.artist}</span>
                  )}
                  <DurationBadge seconds={s.duration} />
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => onRemove(s.id)}
                  className="flex-none rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-950/50 hover:text-rose-300"
                  aria-label={`Remove ${s.title}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

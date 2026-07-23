import type { Participant } from '@/shared/types/room';
import { Card } from '@/shared/components/ui';
import { cn } from '@/shared/lib/cn';

export function ParticipantList({
  participants,
  adminId,
  meId,
}: {
  participants: Participant[];
  adminId: string;
  meId: string | null;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Players</h3>
        <span className="text-xs text-slate-500">{participants.length}</span>
      </div>
      <ul className="space-y-1.5">
        {participants.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                p.connected ? 'bg-emerald-400' : 'bg-slate-600',
              )}
              title={p.connected ? 'Online' : 'Offline'}
            />
            <span className="truncate text-slate-200">
              {p.nickname}
              {p.id === meId && <span className="text-slate-500"> (you)</span>}
            </span>
            {p.id === adminId && (
              <span className="ml-auto rounded bg-brand-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-200">
                ADMIN
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

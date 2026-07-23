'use client';

import { useState } from 'react';
import type { RoomSnapshot } from '@/shared/types/room';
import type { RoomController } from '../useRoomSocket';
import { Button, Card } from '@/shared/components/ui';
import { SongImporter } from './SongImporter';
import { SongList } from './SongList';
import { ParticipantList } from './ParticipantList';
import { SuddenDeathPreview } from './SuddenDeathPreview';

export function Lobby({
  snapshot,
  controller,
  isAdmin,
}: {
  snapshot: RoomSnapshot;
  controller: RoomController;
  isAdmin: boolean;
}) {
  const { actions } = controller;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      await actions.start();
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        {isAdmin ? (
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold">Build your playlist</h2>
            <SongImporter
              onAddManual={actions.addManual}
              onAddPlaylist={actions.addPlaylist}
            />
          </Card>
        ) : (
          <Card className="p-5 text-sm text-slate-400">
            Waiting for the admin to add songs and start the tournament. Sit
            tight — you’ll vote live once it begins.
          </Card>
        )}

        <SongList
          songs={snapshot.songs}
          canEdit={isAdmin}
          onRemove={(id) => actions.removeSong(id).catch(() => undefined)}
        />
      </div>

      <div className="space-y-6">
        <ParticipantList
          participants={snapshot.participants}
          adminId={snapshot.adminId}
          meId={controller.participantId}
        />

        <SuddenDeathPreview songCount={snapshot.songs.length} />

        {isAdmin && (
          <Card className="space-y-3 p-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Vote timer
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { label: 'Off', value: null },
                    { label: '15s', value: 15 },
                    { label: '30s', value: 30 },
                    { label: '60s', value: 60 },
                  ] as const
                ).map((opt) => {
                  const active = snapshot.voteDurationSeconds === opt.value;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => actions.setVoteTimer(opt.value).catch(() => undefined)}
                      className={
                        active
                          ? 'rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white'
                          : 'rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700'
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                When set, each match auto-advances when the timer runs out.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  actions
                    .dedupe()
                    .catch(() => undefined)
                }
              >
                Remove duplicates
              </Button>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={start}
              loading={starting}
              disabled={snapshot.songs.length < 2}
            >
              Start tournament
            </Button>
            {snapshot.songs.length < 2 && (
              <p className="text-xs text-slate-500">Add at least 2 songs to start.</p>
            )}
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </Card>
        )}
      </div>
    </div>
  );
}

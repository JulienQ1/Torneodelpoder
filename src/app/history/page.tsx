import Link from 'next/link';
import { isPersistenceEnabled } from '@/features/persistence/server/prisma';
import { listArchivedTournaments } from '@/features/persistence/server/tournamentArchive';

// Always render fresh — history changes as tournaments finish.
export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const enabled = isPersistenceEnabled();
  const tournaments = enabled ? await listArchivedTournaments(30) : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournament history</h1>
          <p className="mt-1 text-sm text-slate-400">Champions crowned in past tournaments.</p>
        </div>
        <Link href="/" className="text-sm font-medium text-brand-300 hover:text-brand-200">
          ← Home
        </Link>
      </div>

      {!enabled ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <p className="text-slate-300">History is not enabled.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Set <code className="rounded bg-slate-800 px-1.5 py-0.5">DATABASE_URL</code> and run{' '}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">npm run db:push</code> to persist
            finished tournaments. The live game works without it.
          </p>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
          No finished tournaments yet. Run one and it’ll show up here.
        </div>
      ) : (
        <ul className="space-y-3">
          {tournaments.map((t) => (
            <li
              key={t.roomId}
              className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              {t.champion?.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.champion.thumbnail}
                  alt=""
                  className="h-14 w-24 flex-none rounded-lg object-cover"
                />
              ) : (
                <div className="h-14 w-24 flex-none rounded-lg bg-slate-800" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-100">{t.title}</p>
                <p className="truncate text-sm text-brand-200">
                  🏆 {t.champion ? t.champion.title : 'Unknown'}
                  {t.champion?.artist && (
                    <span className="text-slate-500"> — {t.champion.artist}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.entrantCount} songs · bracket of {t.bracketSize}
                  {t.suddenDeathMatches > 0 && ` · ${t.suddenDeathMatches} sudden death`}
                  {t.finishedAt && ` · ${new Date(t.finishedAt).toLocaleDateString()}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

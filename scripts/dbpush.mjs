// Applies the Prisma schema to the database on startup, so deployers never have
// to run `prisma db push` by hand. It's a no-op when no DATABASE_URL is set, and
// non-fatal on failure (the app still starts, just without persistence).
import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  console.log('ℹ  No DATABASE_URL set — skipping schema push (running without persistence).');
  process.exit(0);
}

console.log('▶  Applying database schema (prisma db push)…');
const res = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (res.status !== 0) {
  console.warn('⚠  prisma db push did not succeed — starting the server anyway.');
}
// Always succeed so the server still boots even if the DB is briefly unreachable.
process.exit(0);

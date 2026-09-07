# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Torneo del Poder** — real-time music tournament app. Import songs from
YouTube/Spotify, gather players in a room, vote head-to-head until one song
wins, with a Sudden Death preliminary round so any playlist size works.

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 3.4, a custom
Socket.IO server (`server/index.ts`), Prisma for persistence.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before changing tournament
logic — the Sudden Death algorithm and its fairness guarantees are specified
there and covered by tests.

## Commands

```bash
npm run dev        # tsx watch server/index.ts (Next + Socket.IO on one port)
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # vitest run
npm run build      # prisma generate && next build
```

Run `typecheck` and `test` before committing; the domain logic under
`src/features/tournament/domain/` is where the tests live.

## Layout

- `src/app/` — routes (App Router). Pages are client components.
- `src/features/<feature>/{domain,server,client}/` — feature code. `domain/` is
  pure and framework-free, `server/` is Node-only, `client/` is browser-only.
- `src/shared/` — cross-feature `components/`, `lib/`, `types/`.
- `server/` — Socket.IO + Next custom server.

## UI/UX

Design and component sources are catalogued in
[`docs/UI-RESOURCES.md`](docs/UI-RESOURCES.md) — Julien's running bank of UI/UX
sites. **When he sends a new one, add it there** rather than only answering in
chat; that file is what survives between sessions.

[React Bits](https://reactbits.dev) is installed: 27 vendored components under
[`src/shared/components/reactbits/`](src/shared/components/reactbits/README.md),
browsable live at **`/ui`**, with the shadcn CLI configured in
`components.json` for adding more. That README also lists the three fixes any
freshly-pulled component needs here (`'use client'`, Tailwind v3 classes,
`noUncheckedIndexedAccess`) and the local edits already made to upstream.

House constraints for anything visual:

- Dark theme, `brand-*` purple scale, `slate-950` background.
- Tailwind **v3.4** — most copy-paste sources ship v4 syntax; port it.
- `strict` + `noUncheckedIndexedAccess` are on.
- Animation runtimes already available: `motion`, `gsap` (+ `@gsap/react`),
  `ogl`. Don't add another one without a reason.

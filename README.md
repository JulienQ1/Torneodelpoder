# 🏆 Torneo del Poder

A modern, real-time web app for running **music tournaments**. Import songs from
YouTube or Spotify, gather friends in a room, and vote head-to-head until one
song is crowned champion — with a fair **Sudden Death** round that balances any
playlist size, so there are never random byes.

Inspired by the gameplay of UwUFUFU and the shared-room feel of SyncTube, but
built from scratch with its own architecture and UI.

---

## ✨ Features

- **Sudden Death balancing** — any number of songs works. The bracket drops to
  the nearest lower power of two and exactly the right number of preliminary
  duels eliminate the excess. No random byes. _(36 → 4 duels → 32; 70 → 6 duels
  → 64.)_
- **Real-time multiplayer rooms** — create a room, share the 4-character code,
  and everyone votes live over WebSockets. Tallies update instantly.
- **One vote per participant**, changeable until the admin locks the match.
- **Fair tie-breaks** — on a draw the admin explicitly chooses a 🪙 coin flip or
  awards the win manually. Never silent, never automatic.
- **Music import** — paste a YouTube/Spotify track link (works with zero setup),
  or import a whole playlist (uses provider API keys when configured).
- **Source-agnostic** — YouTube and Spotify songs are treated identically once
  imported; the tournament never cares where a song came from.
- **Live bracket view** — a horizontally-scrolling bracket updates after every
  match, with Sudden Death shown as a distinct first column.
- **Responsive** — designed mobile-first; works on phones and desktop.

---

## 🚀 Quick start

```bash
# 1. Install
npm install

# 2. (optional) configure keys — the app runs fully without them
cp .env.example .env

# 3. Run in dev (Next.js + Socket.IO on one process, hot-reloaded)
npm run dev
#   ▶ http://localhost:3000

# Production
npm run build && npm start
```

**No API keys are required** to play: single-track import works through public
oEmbed endpoints. Keys unlock full *playlist* import:

| Variable | Needed for |
| --- | --- |
| `YOUTUBE_API_KEY` | Importing full YouTube playlists |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Importing Spotify playlists + richer track metadata |

---

## 🧪 Tests

The tournament engine — the heart of the product — is pure and exhaustively
tested. The room/multiplayer flow and import helpers are covered too.

```bash
npm test          # 100+ unit tests
npm run typecheck # strict TypeScript, no errors
```

Highlights:
- Every spec example verified (36→4, 18→2, 22→6, 37→5, 70→6).
- Conservation invariants across **2…512 entrants**: total matches == `n − 1`,
  exactly one champion, every song enters exactly once.
- Full multiplayer flow including admin-only guards and both tie-break paths.

---

## 🏗️ How it works (short version)

```
Playlist (any size N)
        │  fair shuffle
        ▼
┌───────────────────────────┐
│  Sudden Death (if needed) │   D = N − floorPow2(N) duels, 2 songs each,
│  loser eliminated         │   winners + byes = a clean power of two
└───────────────────────────┘
        ▼
   Main single-elimination bracket  ──►  Champion
```

The full design — architecture, the bracket algorithm, the database schema, and
the reasoning behind each technical decision — lives in
**[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

---

## 📁 Project structure

Feature-based, with a strict dependency direction (domain never imports
transport or UI):

```
server/                     Custom Node server: Next.js + Socket.IO
prisma/schema.prisma        Persistence design (future features)
src/
  app/                      Next.js App Router (landing + room pages)
  shared/
    types/                  Song, Tournament, Room, Socket contract
    lib/ components/        cn(), formatters, reusable UI kit
  features/
    tournament/
      domain/               ⭐ Pure engine: suddenDeath, bracket, random (+tests)
      client/               UI-side selectors
    import/server/          SongProvider abstraction, YouTube/Spotify, dedupe
    rooms/
      server/               RoomManager (in-memory) + Socket.IO handlers
      client/               socket, useRoomSocket hook, all room components
```

---

## 🧰 Tech stack & why

| Layer | Choice | Why |
| --- | --- | --- |
| UI | Next.js (App Router), React, TypeScript, Tailwind | Modern, fast, strongly typed |
| Realtime | Socket.IO on a custom Node server | Persistent WebSockets + acks; serverless routes can't hold sockets |
| Live state | In-memory `RoomManager` | Ephemeral, vote-heavy rooms want instant, race-free updates |
| Persistence | PostgreSQL + Prisma (schema included) | Additive home for accounts, history, stats — never in the vote loop |
| Tests | Vitest | Fast, TS-native, great for the pure engine |

---

## 🔮 Designed for what's next

The architecture leaves clean seams for: Spotify playlist import, user accounts
& OAuth/Discord login, public tournaments, history, favourites, statistics,
custom rules, double elimination, and seeding algorithms. See the
[architecture doc](docs/ARCHITECTURE.md#extensibility) for exactly where each one
plugs in.

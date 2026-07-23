# Architecture

This document explains the design of Torneo del Poder: the layers, the Sudden
Death tournament algorithm, the data model, and the reasoning behind the main
technical decisions.

## 1. Design goals

1. **Fairness first.** The tournament must be provably fair for _any_ playlist
   size — no random byes, unbiased shuffles, transparent tie-breaks.
2. **Instant, shared realtime.** Everyone in a room sees votes, matches and the
   bracket update live without refreshing.
3. **Source-agnostic.** A song is a song, whether it came from YouTube or
   Spotify. Nothing downstream branches on its origin.
4. **Extensible by construction.** The listed future features (accounts, public
   tournaments, double elimination, seeding, Discord…) should slot in without
   rewrites.

## 2. Layered architecture

The codebase follows a strict dependency direction. Inner layers never import
outer ones.

```
        ┌─────────────────────────────────────────────┐
        │  UI (React components, App Router pages)      │  src/app, features/*/client
        └──────────────────────┬──────────────────────┘
                               │ typed Socket.IO contract (shared/types/socket)
        ┌──────────────────────▼──────────────────────┐
        │  Transport (Socket.IO handlers, HTTP server) │  server/, features/rooms/server/socketHandlers
        └──────────────────────┬──────────────────────┘
        ┌──────────────────────▼──────────────────────┐
        │  Application (RoomManager, ImportService)     │  features/rooms/server, features/import/server
        └──────────────────────┬──────────────────────┘
        ┌──────────────────────▼──────────────────────┐
        │  Domain (pure): bracket engine, Sudden Death  │  features/tournament/domain
        └─────────────────────────────────────────────┘
```

- The **domain** (`features/tournament/domain`) is pure TypeScript with no I/O,
  no framework, no transport. It is the part that _must_ be correct, so it is
  the part that is exhaustively unit-tested.
- The **application** layer holds mutable orchestration: the `RoomManager`
  (authoritative live state) and the `ImportService` (fetch + normalise songs).
  It depends on the domain but knows nothing about Socket.IO.
- The **transport** layer is a thin adapter: it validates/deserialises socket
  events, calls application methods, and broadcasts snapshots. Swapping
  Socket.IO for raw WebSockets would touch only this layer.
- The **UI** talks to the server exclusively through the shared, strongly-typed
  event contract in `shared/types/socket.ts`, so client and server cannot drift.

This is Clean Architecture in spirit: the business rules (a fair bracket) are
independent of delivery mechanism (WebSockets) and framework (Next.js).

## 3. The tournament algorithm

### 3.1 Sudden Death — the core idea

A single-elimination bracket is only clean when the number of entrants is a
power of two (2, 4, 8, 16, 32…). Playlists are arbitrary. The usual fix — random
byes — is unfair: some songs advance for free.

Instead we compute the **nearest lower power of two** and eliminate exactly the
excess through preliminary duels.

```
bracketSize   = floorPowerOfTwo(N)          // 36 → 32
eliminations  = N − bracketSize             // 36 → 4
```

Each Sudden Death duel has **2 songs and removes exactly 1** (winner advances,
loser is out). So we need `eliminations` duels, involving `2 × eliminations`
songs. The remaining songs get a bye straight into the main bracket:

```
songsInSuddenDeath = 2 × eliminations        // 36 → 8
byes               = N − songsInSuddenDeath   // 36 → 28
byes + eliminations = bracketSize             // 28 + 4 = 32  ✓
```

**Worked spec examples** (all verified in `suddenDeath.test.ts`):

| Songs | Bracket | Eliminations (duels) | Songs in Sudden Death | Byes |
| ----: | ------: | -------------------: | --------------------: | ---: |
| 36 | 32 | 4 | 8 | 28 |
| 18 | 16 | 2 | 4 | 14 |
| 22 | 16 | 6 | 12 | 10 |
| 37 | 32 | 5 | 10 | 27 |
| 70 | 64 | 6 | 12 | 58 |

A powerful invariant falls out of this: the **total number of matches is always
`N − 1`** (`eliminations` Sudden Death + `bracketSize − 1` main), because every
match eliminates exactly one song and we must remove `N − 1` songs to leave one
champion. The tests assert this across 2…512 entrants.

### 3.2 Generation (`bracket.ts`)

1. **Fair shuffle.** All songs are shuffled with an unbiased Fisher–Yates
   shuffle (`random.ts`). The RNG is seedable (mulberry32) — real games use
   crypto-seeded entropy; tests pass a fixed seed for reproducibility.
2. **Split.** The last `2 × eliminations` shuffled songs go to Sudden Death; the
   rest are byes. Because the list was shuffled, this selection is itself random
   and fair.
3. **Wire the bracket with lazy slots.** Each match has two `Slot`s, which are
   one of:
   - `{ kind: 'song' }` — a concrete seed or bye,
   - `{ kind: 'match' }` — "the winner of match X", resolved when X completes.
   Sudden Death winners feed the main bracket through `match` slots. Later
   rounds reference earlier rounds the same way. This single mechanism cleanly
   expresses the entire dependency graph.
4. **Distribute Sudden Death winners.** The main bracket's first-round seed
   order (byes + Sudden Death-winner placeholders) is shuffled again, so Sudden
   Death winners are spread across different matches rather than clustered.
   (Deliberately random rather than seeded — competitive _seeding_ is a listed
   future feature.)

### 3.3 Progression

`completeMatch(tournament, matchId, winnerId, tieBreak?)` is a pure function that
returns a new tournament: it records the winner, propagates it into any slot
referencing that match (readying the next match when both competitors are
known), and activates the next playable match — or crowns the champion when the
final resolves. Because Sudden Death is round 0, the "earliest ready match"
pointer naturally plays all Sudden Death duels before the main bracket.

## 4. Realtime & state

### 4.1 Why in-memory live state

A room is **ephemeral and vote-heavy**: every vote is a tiny mutation that must
be reflected to everyone immediately. Round-tripping each vote to a database
would add latency and contention for no benefit, since the data's useful life is
the length of one game.

So the **`RoomManager` holds the authoritative state in memory** (a singleton in
the server process). It is deliberately **transport-agnostic** — it never imports
Socket.IO. The socket layer calls its methods and broadcasts the resulting
`RoomSnapshot` to the room. This separation is what lets us:

- unit-test the entire multiplayer flow with no server running, and
- later scale horizontally by swapping the in-memory store for Redis and adding
  a Socket.IO Redis adapter — an additive change, not a rewrite.

### 4.2 Why a custom server (not Next API routes)

Next.js route handlers are request/response and (on serverless) short-lived;
they can't host a persistent WebSocket server. `server/index.ts` runs **Next.js
and Socket.IO in one long-lived Node process**, which is exactly what shared
realtime state needs. Next still renders all pages and assets normally.

### 4.3 The event contract

All socket events live in one file (`shared/types/socket.ts`) as strongly-typed
`ClientToServerEvents` / `ServerToClientEvents` interfaces, with a uniform
`Ack<T>` result union. A renamed event or changed payload is a **compile error on
both client and server**. Errors are surfaced through the ack as safe,
user-facing messages; unexpected errors are logged server-side and genericised.

### 4.4 Voting & tie-breaks

- One vote per participant per match (a later vote overwrites the earlier one).
- The admin "locks" a match. If the tally is tied (including 0–0), the room
  enters an explicit **pending-tie** state; voting is closed and no winner is
  chosen until the admin picks a **coin flip** or **awards the win**. This is the
  product's "never silent" tie rule, enforced in the domain layer.
- Admin controls (start, next, resolve tie, remove songs) are guarded server-
  side — the UI hiding a button is convenience, not security.

## 5. Music import

`SongProvider` is the Open/Closed seam:

```ts
interface SongProvider {
  fetchTrack(id): Promise<SongInput>;
  fetchPlaylist(id): Promise<SongInput[]>;
}
```

`YouTubeProvider` and `SpotifyProvider` implement it. Adding SoundCloud or Apple
Music later means writing one class and registering it — nothing in the
tournament or room layers changes.

- **No keys needed for single tracks:** both providers resolve individual tracks
  via public **oEmbed** endpoints.
- **Playlists** use the provider APIs (YouTube Data API, Spotify Web API) and
  degrade gracefully with a clear message when keys are absent.
- `ImportService` normalises everything to the internal `Song` (assigning a
  nanoid), and `mergeSongs`/`dedupeSongs` remove duplicates by
  `source + sourceId` — so the same track from two links is caught.

## 6. Data model

The live game is in-memory; **`prisma/schema.prisma` is the persistence design**
for durable, additive features. Key choices:

- A global, de-duplicated **`Song`** catalogue (`@@unique([source, sourceId])`)
  so cross-tournament **statistics** and **favourites** are possible.
- **`User`** supports both anonymous guests (nickname only) and registered
  accounts, with **`OAuthAccount`** for Google/Discord login.
- **`Room` → `Tournament` → `Round` → `Match`**, plus a **`TournamentSong`** join
  table carrying a `seed` (for future seeding) — mirrors the in-memory domain so
  a finished room can be snapshotted 1:1.
- **`Vote`** is the durable audit trail (unique per participant+match) feeding
  statistics; the live tally stays in memory.
- Forward-looking fields kept flexible: `Room.format` (single/double
  elimination), `Room.isPublic` (public tournaments), and a `Room.rules` JSON bag
  for custom rules without a migration per rule.

## 7. Extensibility

Where each listed future feature plugs in, with no rewrite:

| Future feature | Where it lands |
| --- | --- |
| Spotify playlist import | Already stubbed in `SpotifyProvider.fetchPlaylist` (needs creds) |
| New sources (SoundCloud…) | New `SongProvider` implementation |
| User accounts / OAuth / Discord | `User`, `OAuthAccount` models + an auth adapter in transport |
| Public tournaments / history | `Room.isPublic`, snapshot finished rooms to the DB |
| Favourites / statistics | `FavoriteSong`, `Vote` audit trail, `Song` catalogue |
| Custom rules | `Room.rules` JSON + rule strategies in the domain |
| Double elimination | `Room.format` + a second bracket generator alongside `bracket.ts` |
| Seeding algorithms | Replace the random seed distribution in `generateTournament` |
| Horizontal scaling | Redis-backed `RoomManager` + Socket.IO Redis adapter |

## 8. Testing strategy

- **Domain** (`suddenDeath`, `bracket`): exhaustive — spec examples, conservation
  invariants across many sizes, full playthroughs to a champion, determinism.
- **Application** (`RoomManager`): the full multiplayer lifecycle, admin guards,
  both tie-break paths, admin hand-off, room close.
- **Import** (`urls`, dedupe): URL parsing matrix and de-duplication.
- **End-to-end**: a two-client Socket.IO run drives a whole tournament (verified
  during development) to confirm the transport and broadcasts agree.
```

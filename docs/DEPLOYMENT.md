# Deployment

Torneo del Poder runs **Next.js + Socket.IO in one long-lived Node process**
(`server/index.ts`). It needs a host that keeps a persistent server with
WebSocket support — **not** a serverless platform.

| Platform | Works? | Why |
| --- | --- | --- |
| Railway, Render, Fly.io, any VPS | ✅ | Persistent Node process + WebSockets |
| Netlify, Vercel | ❌ (as-is) | Serverless: no long-lived WebSocket server or shared in-memory room state. Would require moving realtime to a managed service (Ably/Pusher) or a separate socket server + Redis. |

The repo ships a production **`Dockerfile`** that any of the supported hosts can
build, plus a **`railway.json`** for Railway.

---

## Deploy to Railway (recommended)

1. **Create the project**
   - Push this repo to GitHub (already done).
   - On [railway.app](https://railway.app): **New Project → Deploy from GitHub repo** → pick `Torneodelpoder`.
   - Railway detects the `Dockerfile` and `railway.json` and builds automatically.

2. **Networking**
   - In the service’s **Settings → Networking**, click **Generate Domain**.
   - Railway injects `PORT`; the server already reads `process.env.PORT` and binds `0.0.0.0`, so no change is needed.
   - WebSockets work over the generated HTTPS domain out of the box.

3. **(Optional) Postgres for history**
   - **New → Database → Add PostgreSQL**.
   - Railway exposes `DATABASE_URL` to the service automatically. On first boot run the schema push once (Railway shell or a one-off command):
     ```bash
     npm run db:push
     ```
   - Without `DATABASE_URL` the app runs fine; `/history` simply shows an empty state.

4. **(Optional) Playlist import keys** — set as service variables:
   - `YOUTUBE_API_KEY` (full YouTube playlist import)
   - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (Spotify playlist import)

That’s it — open the generated domain, create a room, and share the **invite
link** (the room header’s “Copy invite link” button) so others join with one
click.

---

## Deploy anywhere with Docker

```bash
docker build -t torneo .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  # -e DATABASE_URL=postgres://...        # optional: enables /history
  # -e YOUTUBE_API_KEY=...                # optional: YouTube playlist import
  # -e SPOTIFY_CLIENT_ID=... -e SPOTIFY_CLIENT_SECRET=...
  torneo
# ▶ http://localhost:3000
```

The same image runs on Render (Web Service → Docker), Fly.io (`fly launch`
against the Dockerfile), or any container host / VPS.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | provided by host | Port to listen on (defaults to 3000) |
| `DATABASE_URL` | optional | Enables tournament history persistence |
| `YOUTUBE_API_KEY` | optional | Full YouTube playlist import |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | optional | Spotify playlist import + richer metadata |

Single-track import (YouTube/Spotify) and the entire live tournament work with
**no keys and no database**.

## Scaling note

Live room state is in-memory in a single process, so run **one instance** (no
horizontal autoscaling) until state is externalised. To scale out later: move
room state to Redis and add the Socket.IO Redis adapter — the transport-agnostic
`RoomManager` makes that an additive change (see `docs/ARCHITECTURE.md`).

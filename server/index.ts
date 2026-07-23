import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../src/shared/types/socket';
import { registerRoomHandlers } from '../src/features/rooms/server/socketHandlers';
import { roomManager } from '../src/features/rooms/server/roomManager';

/**
 * Custom Node server hosting BOTH Next.js and Socket.IO in one process.
 *
 * Why not Next API routes? Serverless/route handlers don't hold a persistent
 * WebSocket server. A single long-lived process keeps the authoritative room
 * state (RoomManager) and the socket layer together, which is exactly what a
 * realtime voting app needs. For horizontal scaling later, swap the in-memory
 * manager for Redis-backed state and add a Socket.IO Redis adapter — the
 * transport-agnostic manager makes that an additive change.
 */
const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? '0.0.0.0';

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    path: '/api/socket',
    cors: { origin: dev ? '*' : false },
  });

  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
  });

  // Periodically evict idle rooms so memory stays bounded.
  const sweepTimer = setInterval(() => {
    const closed = roomManager.sweep();
    for (const id of closed) io.to(id).emit('room:closed', { reason: 'Room expired.' });
  }, 1000 * 60 * 5);
  sweepTimer.unref?.();

  httpServer.listen(port, hostname, () => {
    console.log(`\n▶  Torneo del Poder ready at http://localhost:${port}\n`);
  });
}

main().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});

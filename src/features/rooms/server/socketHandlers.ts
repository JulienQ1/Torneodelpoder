import type { Server, Socket } from 'socket.io';
import type {
  Ack,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@/shared/types/socket';
import { ImportService } from '@/features/import/server/importService';
import { ProviderError } from '@/features/import/server/provider';
import { RoomError, roomManager } from './roomManager';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const importService = new ImportService();

/** Turn any thrown value into a safe user-facing message. */
function toMessage(err: unknown): string {
  if (err instanceof RoomError || err instanceof ProviderError) return err.message;
  if (err instanceof Error) {
    // Log the real error server-side; show a generic message to users.
    console.error('[socket] unexpected error:', err);
    return 'Something went wrong. Please try again.';
  }
  return 'Unexpected error.';
}

/** Run a handler, broadcast the room snapshot, and always answer the ack. */
async function guard<T>(
  io: IO,
  roomId: string | undefined,
  ack: (res: Ack<T>) => void,
  fn: () => Promise<T> | T,
  broadcast = true,
): Promise<void> {
  try {
    const data = await fn();
    if (broadcast && roomId) emitState(io, roomId);
    ack({ ok: true, data });
  } catch (err) {
    ack({ ok: false, error: toMessage(err) });
  }
}

/** Broadcast the authoritative snapshot to everyone in a room. */
export function emitState(io: IO, roomId: string): void {
  const room = roomManager.getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit('room:state', roomManager.snapshot(roomId));
}

export function registerRoomHandlers(io: IO, socket: IOSocket): void {
  const join = async (roomId: string, participantId: string) => {
    socket.data.roomId = roomId;
    socket.data.participantId = participantId;
    await socket.join(roomId);
  };

  socket.on('room:create', (payload, ack) =>
    guard(io, undefined, ack, async () => {
      const { room, participantId } = roomManager.createRoom(
        payload.nickname,
        payload.title,
      );
      await join(room.id, participantId);
      emitState(io, room.id);
      return { roomId: room.id, participantId };
    }, false),
  );

  socket.on('room:join', (payload, ack) =>
    guard(io, undefined, ack, async () => {
      const { room, participantId } = roomManager.joinRoom(
        payload.code,
        payload.nickname,
      );
      await join(room.id, participantId);
      emitState(io, room.id);
      return { roomId: room.id, participantId };
    }, false),
  );

  socket.on('room:resume', (payload, ack) =>
    guard(io, undefined, ack, async () => {
      roomManager.resume(payload.roomId, payload.participantId);
      await join(payload.roomId, payload.participantId);
      emitState(io, payload.roomId);
      return { roomId: payload.roomId, participantId: payload.participantId };
    }, false),
  );

  socket.on('room:leave', (payload, ack) =>
    guard(io, undefined, ack, async () => {
      const pid = socket.data.participantId;
      if (pid) {
        const room = roomManager.leaveRoom(payload.roomId, pid);
        await socket.leave(payload.roomId);
        if (room) emitState(io, payload.roomId);
        else io.to(payload.roomId).emit('room:closed', { reason: 'Room closed.' });
      }
      socket.data.roomId = undefined;
      socket.data.participantId = undefined;
    }),
  );

  // ---- Song management ----------------------------------------------------

  socket.on('songs:addManual', (payload, ack) =>
    guard(io, payload.roomId, ack, async () => {
      const song = await importService.importTrack(payload.url);
      const res = roomManager.addSongs(payload.roomId, actor(socket), [song]);
      return { added: res.added, duplicatesSkipped: res.duplicatesSkipped };
    }),
  );

  socket.on('songs:addPlaylist', (payload, ack) =>
    guard(io, payload.roomId, ack, async () => {
      const list = await importService.importPlaylist(payload.url);
      const res = roomManager.addSongs(payload.roomId, actor(socket), list);
      return { added: res.added, duplicatesSkipped: res.duplicatesSkipped };
    }),
  );

  socket.on('songs:addRaw', (payload, ack) =>
    guard(io, payload.roomId, ack, () => {
      const song = { id: cryptoId(), ...payload.song };
      const res = roomManager.addSongs(payload.roomId, actor(socket), [song]);
      return { added: res.added, duplicatesSkipped: res.duplicatesSkipped };
    }),
  );

  socket.on('songs:remove', (payload, ack) =>
    guard(io, payload.roomId, ack, () => {
      roomManager.removeSong(payload.roomId, actor(socket), payload.songId);
    }),
  );

  socket.on('songs:dedupe', (payload, ack) =>
    guard(io, payload.roomId, ack, () =>
      roomManager.dedupe(payload.roomId, actor(socket)),
    ),
  );

  // ---- Tournament control -------------------------------------------------

  socket.on('tournament:start', (payload, ack) =>
    guard(io, payload.roomId, ack, () => {
      roomManager.start(payload.roomId, actor(socket));
    }),
  );

  socket.on('tournament:next', (payload, ack) =>
    guard(io, payload.roomId, ack, () => {
      const { completed } = roomManager.advance(payload.roomId, actor(socket));
      if (completed) announceCompletion(io, payload.roomId, completed);
    }),
  );

  socket.on('tournament:resolveTie', (payload, ack) =>
    guard(io, payload.roomId, ack, () => {
      const { completed } = roomManager.resolveTie(
        payload.roomId,
        actor(socket),
        payload.resolution,
      );
      announceCompletion(io, payload.roomId, completed);
    }),
  );

  // ---- Voting -------------------------------------------------------------

  socket.on('vote:cast', (payload, ack) =>
    guard(io, payload.roomId, ack, () => {
      const pid = socket.data.participantId;
      if (!pid) throw new RoomError('You are not in this room.');
      roomManager.castVote(payload.roomId, pid, payload.side);
    }),
  );

  // ---- Disconnect ---------------------------------------------------------

  socket.on('disconnect', () => {
    const { roomId, participantId } = socket.data;
    if (roomId && participantId) {
      const room = roomManager.markDisconnected(roomId, participantId);
      if (room) emitState(io, roomId);
    }
  });
}

function announceCompletion(
  io: IO,
  roomId: string,
  completed: { matchId: string; winnerId: string },
): void {
  io.to(roomId).emit('match:completed', completed);
  const room = roomManager.getRoom(roomId);
  if (room?.tournament?.status === 'completed' && room.tournament.championId) {
    io.to(roomId).emit('tournament:completed', {
      championId: room.tournament.championId,
    });
  }
}

function actor(socket: IOSocket): string {
  const pid = socket.data.participantId;
  if (!pid) throw new RoomError('You are not part of a room.');
  return pid;
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 12);
}

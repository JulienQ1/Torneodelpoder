import { customAlphabet, nanoid } from 'nanoid';
import type { Song } from '@/shared/types/song';
import type {
  Participant,
  Room,
  RoomSnapshot,
  TieBreakRequest,
} from '@/shared/types/room';
import {
  completeMatch,
  generateTournament,
  startTournament,
} from '@/features/tournament/domain/bracket';
import { dedupeSongs, mergeSongs } from '@/features/import/server/importService';

/** Unambiguous alphabet (no 0/O/1/I) for human-typeable join codes. */
const codeAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

/** Rooms with no activity for this long are swept away. */
const ROOM_TTL_MS = 1000 * 60 * 60 * 3; // 3 hours

/** A domain error whose message is safe to show the user. */
export class RoomError extends Error {}

/**
 * Authoritative, in-memory store of all live rooms.
 *
 * Why in-memory? A tournament room is ephemeral and vote-heavy: every vote is a
 * tiny state mutation broadcast to everyone. Keeping the canonical state in a
 * single process makes those updates instant and race-free, and matches the
 * lifecycle of a game room. Persistence (history, accounts) is a separate,
 * additive concern handled by the database layer — see prisma/schema.prisma.
 *
 * The manager is transport-agnostic: it never imports Socket.IO. The socket
 * layer calls these methods and broadcasts the resulting snapshots.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly codeIndex = new Map<string, string>(); // code → roomId

  // ---- Lifecycle ---------------------------------------------------------

  createRoom(nickname: string, title?: string): { room: Room; participantId: string } {
    const roomId = nanoid(12);
    const participantId = nanoid(12);
    const code = this.uniqueCode();

    const admin: Participant = {
      id: participantId,
      nickname: cleanNickname(nickname),
      isAdmin: true,
      connected: true,
    };

    const now = Date.now();
    const room: Room = {
      id: roomId,
      code,
      phase: 'lobby',
      adminId: participantId,
      participants: { [participantId]: admin },
      songs: [],
      tournament: null,
      createdAt: now,
      lastActivityAt: now,
      currentVotes: {},
      pendingTie: false,
    };

    this.rooms.set(roomId, room);
    this.codeIndex.set(code, roomId);
    return { room, participantId };
  }

  joinRoom(code: string, nickname: string): { room: Room; participantId: string } {
    const roomId = this.codeIndex.get(code.trim().toUpperCase());
    const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room) throw new RoomError('No room found for that code.');

    const participantId = nanoid(12);
    room.participants[participantId] = {
      id: participantId,
      nickname: cleanNickname(nickname),
      isAdmin: false,
      connected: true,
    };
    this.touch(room);
    return { room, participantId };
  }

  /** Re-attach a participant after a reconnect/refresh. */
  resume(roomId: string, participantId: string): Room {
    const room = this.requireRoom(roomId);
    const p = room.participants[participantId];
    if (!p) throw new RoomError('Your session is no longer part of this room.');
    p.connected = true;
    this.touch(room);
    return room;
  }

  /** Mark a participant disconnected (socket dropped) without removing them. */
  markDisconnected(roomId: string, participantId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const p = room.participants[participantId];
    if (p) p.connected = false;
    return room;
  }

  /** Permanently remove a participant. Returns the room, or null if closed. */
  leaveRoom(roomId: string, participantId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    delete room.participants[participantId];
    delete room.currentVotes[participantId];

    const remaining = Object.values(room.participants);
    if (remaining.length === 0) {
      this.closeRoom(roomId);
      return null;
    }
    // Promote a new admin if the admin left.
    if (participantId === room.adminId) {
      const next = remaining.find((p) => p.connected) ?? remaining[0]!;
      next.isAdmin = true;
      room.adminId = next.id;
    }
    this.touch(room);
    return room;
  }

  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.codeIndex.delete(room.code);
    this.rooms.delete(roomId);
  }

  // ---- Songs (lobby) -----------------------------------------------------

  addSongs(roomId: string, actorId: string, songs: Song[]): {
    added: Song[];
    duplicatesSkipped: number;
  } {
    const room = this.requireAdmin(roomId, actorId);
    if (room.phase !== 'lobby') {
      throw new RoomError('Songs can only be changed before the tournament starts.');
    }
    const { merged, added, duplicatesSkipped } = mergeSongs(room.songs, songs);
    room.songs = merged;
    this.touch(room);
    return { added, duplicatesSkipped };
  }

  removeSong(roomId: string, actorId: string, songId: string): Room {
    const room = this.requireAdmin(roomId, actorId);
    if (room.phase !== 'lobby') {
      throw new RoomError('Songs can only be changed before the tournament starts.');
    }
    room.songs = room.songs.filter((s) => s.id !== songId);
    this.touch(room);
    return room;
  }

  dedupe(roomId: string, actorId: string): { removed: number } {
    const room = this.requireAdmin(roomId, actorId);
    const { deduped, removed } = dedupeSongs(room.songs);
    room.songs = deduped;
    this.touch(room);
    return { removed };
  }

  // ---- Tournament control ------------------------------------------------

  start(roomId: string, actorId: string): Room {
    const room = this.requireAdmin(roomId, actorId);
    if (room.phase !== 'lobby') {
      throw new RoomError('The tournament has already started.');
    }
    if (room.songs.length < 2) {
      throw new RoomError('Add at least 2 songs to start a tournament.');
    }
    const generated = generateTournament(room.songs, {
      id: room.id,
      title: 'Music Tournament',
    });
    room.tournament = startTournament(generated);
    room.phase = 'in-progress';
    room.currentVotes = {};
    room.pendingTie = false;
    this.touch(room);
    return room;
  }

  castVote(roomId: string, participantId: string, side: 'A' | 'B'): Room {
    const room = this.requireRoom(roomId);
    if (room.phase !== 'in-progress' || !room.tournament) {
      throw new RoomError('There is no active match to vote on.');
    }
    if (room.pendingTie) {
      throw new RoomError('Voting is closed — waiting for the tie to be resolved.');
    }
    if (!room.participants[participantId]) {
      throw new RoomError('You are not a participant of this room.');
    }
    const current = room.tournament.currentMatchId;
    if (!current) throw new RoomError('No match is currently open for voting.');

    room.currentVotes[participantId] = side; // one vote per participant (overwrites)
    this.touch(room);
    return room;
  }

  /**
   * Admin locks in the current match. If the vote is tied, the room enters a
   * pending-tie state and no winner is chosen until `resolveTie` is called.
   * Returns the completed match info when a winner was decided.
   */
  advance(roomId: string, actorId: string): {
    room: Room;
    completed: { matchId: string; winnerId: string } | null;
  } {
    const room = this.requireAdmin(roomId, actorId);
    const match = this.requireActiveMatch(room);

    const { a, b } = this.tally(room);
    if (a === b) {
      room.pendingTie = true;
      this.touch(room);
      return { room, completed: null };
    }
    const winnerId = (a > b ? match.songAId : match.songBId)!;
    return this.finishMatch(room, match.id, winnerId, null);
  }

  resolveTie(roomId: string, actorId: string, resolution: TieBreakRequest): {
    room: Room;
    completed: { matchId: string; winnerId: string };
  } {
    const room = this.requireAdmin(roomId, actorId);
    const match = this.requireActiveMatch(room);

    let winnerSide: 'A' | 'B';
    if (resolution.method === 'coin-flip') {
      winnerSide = Math.random() < 0.5 ? 'A' : 'B';
    } else {
      if (resolution.side !== 'A' && resolution.side !== 'B') {
        throw new RoomError('Pick a side to award the win to.');
      }
      winnerSide = resolution.side;
    }
    const winnerId = (winnerSide === 'A' ? match.songAId : match.songBId)!;
    const result = this.finishMatch(room, match.id, winnerId, resolution.method);
    return { room, completed: result.completed! };
  }

  // ---- Snapshots ---------------------------------------------------------

  snapshot(roomId: string): RoomSnapshot {
    const room = this.requireRoom(roomId);
    const { a, b } = this.tally(room);
    return {
      id: room.id,
      code: room.code,
      phase: room.phase,
      adminId: room.adminId,
      participants: Object.values(room.participants),
      songs: room.songs,
      tournament: room.tournament,
      voteTally: {
        a,
        b,
        total: a + b,
        voters: Object.keys(room.participants).length,
      },
      awaitingTieBreak: room.pendingTie,
    };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /** Remove rooms that have been idle past the TTL. Returns closed room ids. */
  sweep(now = Date.now()): string[] {
    const closed: string[] = [];
    for (const [id, room] of this.rooms) {
      if (now - room.lastActivityAt > ROOM_TTL_MS) {
        this.closeRoom(id);
        closed.push(id);
      }
    }
    return closed;
  }

  // ---- Internals ---------------------------------------------------------

  private finishMatch(
    room: Room,
    matchId: string,
    winnerId: string,
    tieBreak: TieBreakRequest['method'] | null,
  ): { room: Room; completed: { matchId: string; winnerId: string } } {
    room.tournament = completeMatch(room.tournament!, matchId, winnerId, tieBreak);
    room.currentVotes = {};
    room.pendingTie = false;
    if (room.tournament.status === 'completed') {
      room.phase = 'finished';
    }
    this.touch(room);
    return { room, completed: { matchId, winnerId } };
  }

  private tally(room: Room): { a: number; b: number } {
    let a = 0;
    let b = 0;
    for (const side of Object.values(room.currentVotes)) {
      if (side === 'A') a++;
      else b++;
    }
    return { a, b };
  }

  private requireActiveMatch(room: Room) {
    if (room.phase !== 'in-progress' || !room.tournament) {
      throw new RoomError('There is no match in progress.');
    }
    const id = room.tournament.currentMatchId;
    const match = id ? room.tournament.matches[id] : undefined;
    if (!match) throw new RoomError('No match is currently active.');
    return match;
  }

  private requireRoom(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new RoomError('This room no longer exists.');
    return room;
  }

  private requireAdmin(roomId: string, actorId: string): Room {
    const room = this.requireRoom(roomId);
    if (room.adminId !== actorId) {
      throw new RoomError('Only the room admin can do that.');
    }
    return room;
  }

  private uniqueCode(): string {
    for (let i = 0; i < 10; i++) {
      const code = codeAlphabet();
      if (!this.codeIndex.has(code)) return code;
    }
    // Extremely unlikely fallback: extend length until unique.
    let code = codeAlphabet() + codeAlphabet();
    while (this.codeIndex.has(code)) code = codeAlphabet() + codeAlphabet();
    return code;
  }

  private touch(room: Room): void {
    room.lastActivityAt = Date.now();
  }
}

function cleanNickname(raw: string): string {
  const trimmed = (raw ?? '').trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : 'Guest';
}

/** Process-wide singleton (survives Next.js hot reloads in dev). */
const globalForRooms = globalThis as unknown as { __roomManager?: RoomManager };
export const roomManager: RoomManager =
  globalForRooms.__roomManager ?? (globalForRooms.__roomManager = new RoomManager());

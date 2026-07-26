import { customAlphabet, nanoid } from 'nanoid';
import type { Song } from '@/shared/types/song';
import type {
  Participant,
  Room,
  RoomSettings,
  RoomSnapshot,
  TieBreakRequest,
} from '@/shared/types/room';
import { DEFAULT_ROOM_SETTINGS } from '@/shared/types/room';
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
      revealed: false,
      settings: { ...DEFAULT_ROOM_SETTINGS },
      history: [],
      voteDurationSeconds: null,
      currentDeadline: null,
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

  /** Configure the per-match vote timer (lobby only). null disables it. */
  setVoteTimer(roomId: string, actorId: string, seconds: number | null): Room {
    const room = this.requireAdmin(roomId, actorId);
    if (room.phase !== 'lobby') {
      throw new RoomError('The timer can only be changed before the tournament starts.');
    }
    if (seconds !== null && (!Number.isFinite(seconds) || seconds < 5 || seconds > 600)) {
      throw new RoomError('Pick a timer between 5 and 600 seconds, or turn it off.');
    }
    room.voteDurationSeconds = seconds;
    this.touch(room);
    return room;
  }

  /** Update presentation settings (admin, any time). */
  setSettings(roomId: string, actorId: string, partial: Partial<RoomSettings>): Room {
    const room = this.requireAdmin(roomId, actorId);
    const next = { ...room.settings };
    if (typeof partial.hideVotes === 'boolean') next.hideVotes = partial.hideVotes;
    if (typeof partial.hideMedia === 'boolean') next.hideMedia = partial.hideMedia;
    if (typeof partial.bracketVisibleToAll === 'boolean') {
      next.bracketVisibleToAll = partial.bracketVisibleToAll;
    }
    room.settings = next;
    this.touch(room);
    return room;
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
    room.revealed = false;
    room.history = [];
    this.refreshDeadline(room);
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
    if (room.revealed) {
      throw new RoomError('Voting is closed — the result has been revealed.');
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
   * Step 1 of resolving a match: reveal the votes (closes voting, shows the
   * result to everyone). A tie parks the room in pending-tie for resolution.
   * `force` bypasses the "everyone has voted" guard (admin override / timer).
   */
  reveal(roomId: string, actorId: string, force = false): { room: Room; tie: boolean } {
    const room = this.requireAdmin(roomId, actorId);
    this.doReveal(room, force);
    return { room, tie: room.pendingTie };
  }

  /** Reveal driven by the vote timer expiring (no admin action). */
  autoReveal(roomId: string): { room: Room; revealed: boolean } {
    const room = this.requireRoom(roomId);
    if (
      room.phase !== 'in-progress' ||
      !room.tournament?.currentMatchId ||
      room.revealed
    ) {
      return { room, revealed: false };
    }
    this.doReveal(room, true);
    return { room, revealed: true };
  }

  private doReveal(room: Room, force: boolean): void {
    this.requireActiveMatch(room);
    if (room.revealed) throw new RoomError('The result is already revealed.');
    if (!force && !this.allVoted(room)) {
      throw new RoomError('Not everyone has voted yet.');
    }
    room.revealed = true;
    room.currentDeadline = null; // voting is closed
    const { a, b } = this.tally(room);
    if (a === b) room.pendingTie = true;
    this.touch(room);
  }

  /**
   * Step 2: advance to the next match after a reveal, using the majority vote.
   * Requires a prior `reveal` and a non-tied result.
   */
  next(roomId: string, actorId: string): {
    room: Room;
    completed: { matchId: string; winnerId: string };
  } {
    const room = this.requireAdmin(roomId, actorId);
    const match = this.requireActiveMatch(room);
    if (!room.revealed) throw new RoomError('Reveal the votes first.');
    if (room.pendingTie) throw new RoomError('Resolve the tie first.');
    const { a, b } = this.tally(room);
    const winnerId = (a > b ? match.songAId : match.songBId)!;
    this.pushHistory(room);
    return this.finishMatch(room, match.id, winnerId, null) as {
      room: Room;
      completed: { matchId: string; winnerId: string };
    };
  }

  resolveTie(roomId: string, actorId: string, resolution: TieBreakRequest): {
    room: Room;
    completed: { matchId: string; winnerId: string };
  } {
    const room = this.requireAdmin(roomId, actorId);
    const match = this.requireActiveMatch(room);
    if (!room.revealed || !room.pendingTie) {
      throw new RoomError('This match is not awaiting a tie-break.');
    }

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
    this.pushHistory(room);
    return this.finishMatch(room, match.id, winnerId, resolution.method);
  }

  /**
   * Admin "go back": un-reveal the current match, or (if not revealed) restore
   * the previous match from history so a mistaken result can be redone.
   */
  goBack(roomId: string, actorId: string): Room {
    const room = this.requireAdmin(roomId, actorId);
    if (room.revealed) {
      // Simply return to the voting state of the current match.
      room.revealed = false;
      room.pendingTie = false;
      this.refreshDeadline(room);
      this.touch(room);
      return room;
    }
    const previous = room.history.pop();
    if (!previous) throw new RoomError('There is nothing to undo.');
    room.tournament = previous;
    room.phase = 'in-progress';
    room.currentVotes = {};
    room.revealed = false;
    room.pendingTie = false;
    this.refreshDeadline(room);
    this.touch(room);
    return room;
  }

  // ---- Snapshots ---------------------------------------------------------

  /**
   * Build a snapshot tailored to a viewer. When votes are hidden and not yet
   * revealed, the A/B split is redacted server-side for non-admins (so it can't
   * be read from the wire) — but the number of votes cast stays visible.
   */
  snapshot(roomId: string, viewerId?: string): RoomSnapshot {
    const room = this.requireRoom(roomId);
    const isAdmin = viewerId === room.adminId;
    const { a, b } = this.tally(room);
    const votedIds = Object.keys(room.currentVotes);
    const connected = Object.values(room.participants).filter((p) => p.connected);
    const votesHidden = room.settings.hideVotes && !room.revealed && !isAdmin;

    return {
      id: room.id,
      code: room.code,
      phase: room.phase,
      adminId: room.adminId,
      participants: Object.values(room.participants),
      songs: room.songs,
      tournament: room.tournament,
      settings: room.settings,
      voteTally: {
        a: votesHidden ? 0 : a,
        b: votesHidden ? 0 : b,
        votedCount: votedIds.length,
        voters: connected.length,
        hidden: votesHidden,
      },
      votedParticipantIds: votedIds,
      allVoted: this.allVoted(room),
      revealed: room.revealed,
      canGoBack: room.revealed || room.history.length > 0,
      awaitingTieBreak: room.pendingTie,
      voteDurationSeconds: room.voteDurationSeconds,
      deadline: room.currentDeadline,
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
    // Freeze the vote tally onto the match record before clearing it, so the
    // bracket and final ranking can show real per-match vote counts.
    const { a, b } = this.tally(room);
    room.tournament = completeMatch(room.tournament!, matchId, winnerId, tieBreak);
    const finished = room.tournament.matches[matchId];
    if (finished) {
      finished.votesA = a;
      finished.votesB = b;
    }
    room.currentVotes = {};
    room.pendingTie = false;
    room.revealed = false;
    if (room.tournament.status === 'completed') {
      room.phase = 'finished';
    }
    this.refreshDeadline(room);
    this.touch(room);
    return { room, completed: { matchId, winnerId } };
  }

  /**
   * Set the current match's voting deadline based on the configured timer.
   * Cleared whenever voting isn't open (finished / tie / revealed / no timer).
   */
  private refreshDeadline(room: Room): void {
    const votingOpen =
      room.phase === 'in-progress' &&
      !room.pendingTie &&
      !room.revealed &&
      Boolean(room.tournament?.currentMatchId);
    room.currentDeadline =
      votingOpen && room.voteDurationSeconds
        ? Date.now() + room.voteDurationSeconds * 1000
        : null;
  }

  /** True when every connected participant has cast a vote this match. */
  private allVoted(room: Room): boolean {
    const connected = Object.values(room.participants).filter((p) => p.connected);
    if (connected.length === 0) return false;
    return connected.every((p) => room.currentVotes[p.id] !== undefined);
  }

  /** Save the current tournament state so the admin can "go back". */
  private pushHistory(room: Room): void {
    if (!room.tournament) return;
    room.history.push(structuredClone(room.tournament));
    if (room.history.length > 100) room.history.shift();
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

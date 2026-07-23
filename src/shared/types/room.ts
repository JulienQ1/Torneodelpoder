import type { Song } from './song';
import type { TieBreakMethod, Tournament } from './tournament';

export interface Participant {
  id: string;
  nickname: string;
  isAdmin: boolean;
  connected: boolean;
}

export type RoomPhase = 'lobby' | 'in-progress' | 'finished';

/**
 * A Room is the multiplayer container. It owns a set of participants, the songs
 * being imported during the lobby, and — once started — a live Tournament.
 *
 * The authoritative Room lives in memory on the server (see RoomManager). The
 * client only ever receives a serialisable `RoomSnapshot`.
 */
export interface Room {
  id: string;
  code: string; // short, shareable join code (e.g. "PLAY-7Q2X")
  phase: RoomPhase;
  adminId: string;
  participants: Record<string, Participant>;
  songs: Song[]; // lobby staging area before the tournament is generated
  tournament: Tournament | null;
  createdAt: number;
  /** Last time any activity touched the room (for TTL cleanup). */
  lastActivityAt: number;
  /** Votes for the current match, keyed by participantId → 'A' | 'B'. */
  currentVotes: Record<string, 'A' | 'B'>;
  /** True when the admin tried to advance a tied match and must resolve it. */
  pendingTie: boolean;
}

/** What a client is allowed to see. Excludes nothing sensitive today, but the
 *  seam exists so we can redact server-only fields later. */
export interface RoomSnapshot {
  id: string;
  code: string;
  phase: RoomPhase;
  adminId: string;
  participants: Participant[];
  songs: Song[];
  tournament: Tournament | null;
  /** Tally for the current match (never reveals *who* voted for what). */
  voteTally: { a: number; b: number; total: number; voters: number };
  /** Whether the current match is tied and awaiting admin resolution. */
  awaitingTieBreak: boolean;
}

export interface TieBreakRequest {
  method: TieBreakMethod;
  /** For 'admin-choice', which side the admin picked. */
  side?: 'A' | 'B';
}

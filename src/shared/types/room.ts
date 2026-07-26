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
 * Admin-configurable presentation options. Defaults favour a suspenseful
 * "reveal" experience; the admin can relax any of them from the lobby.
 */
export interface RoomSettings {
  /** Hide the live vote split from participants until the admin reveals it. */
  hideVotes: boolean;
  /** Blur song artwork for participants until they click to reveal it. */
  hideMedia: boolean;
  /** Whether participants (not just the admin) can see the bracket. */
  bracketVisibleToAll: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  hideVotes: true,
  hideMedia: true,
  bracketVisibleToAll: false,
};

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
  /**
   * True once the current match's votes have been revealed (voting closed,
   * winner shown). The admin then advances with `next` / resolves a tie.
   */
  revealed: boolean;
  /** Presentation options controlled by the admin. */
  settings: RoomSettings;
  /**
   * Stack of pre-completion tournament states, enabling the admin to "go back"
   * and redo a match. Most recent last.
   */
  history: Tournament[];
  /** Optional per-match voting time limit in seconds (null = no timer). */
  voteDurationSeconds: number | null;
  /** Epoch-ms deadline for the current match (null when no timer is running). */
  currentDeadline: number | null;
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
  settings: RoomSettings;
  /**
   * Tally for the current match. When votes are hidden and not yet revealed,
   * `a`/`b` are redacted to 0 for non-admin viewers and `hidden` is true — but
   * `votedCount` (how many have voted) is always visible so everyone sees
   * progress. Never reveals *who* voted for which side.
   */
  voteTally: {
    a: number;
    b: number;
    votedCount: number;
    voters: number;
    hidden: boolean;
  };
  /** Participant ids who have cast a vote this match (not their choice). */
  votedParticipantIds: string[];
  /** True when every connected participant has voted. */
  allVoted: boolean;
  /** Whether the current match's result has been revealed. */
  revealed: boolean;
  /** Whether the admin can undo (go back to the previous match / un-reveal). */
  canGoBack: boolean;
  /** Whether the current match is tied and awaiting admin resolution. */
  awaitingTieBreak: boolean;
  /** Configured per-match time limit in seconds (null = disabled). */
  voteDurationSeconds: number | null;
  /** Epoch-ms deadline for the current match (null when no timer is running). */
  deadline: number | null;
}

export interface TieBreakRequest {
  method: TieBreakMethod;
  /** For 'admin-choice', which side the admin picked. */
  side?: 'A' | 'B';
}

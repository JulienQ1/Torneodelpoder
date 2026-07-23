import type { Song } from './song';

/**
 * A Slot is one of the two competitors of a match. It is resolved lazily:
 * - `song`  → a concrete song occupies the slot (a seed or a bye).
 * - `match` → "the winner of match <matchId>" fills this slot once that
 *              match completes. This is how later rounds are wired to earlier
 *              ones, and how Sudden Death winners flow into the main bracket.
 */
export type Slot =
  | { kind: 'song'; songId: string }
  | { kind: 'match'; matchId: string }
  | { kind: 'empty' };

export type MatchStatus = 'pending' | 'ready' | 'active' | 'completed';

export type TieBreakMethod = 'coin-flip' | 'admin-choice';

export interface Match {
  id: string;
  /** 0-based index of the round this match belongs to. */
  roundIndex: number;
  /** Position of the match within its round (top → bottom). */
  matchIndex: number;
  slotA: Slot;
  slotB: Slot;
  /** Resolved competitor song ids (null until the feeding slot resolves). */
  songAId: string | null;
  songBId: string | null;
  votesA: number;
  votesB: number;
  status: MatchStatus;
  /** Winning song id once completed. */
  winnerId: string | null;
  /** How a tie (if any) was resolved. */
  tieBreak: TieBreakMethod | null;
}

export interface Round {
  index: number;
  name: string;
  isSuddenDeath: boolean;
  matchIds: string[];
}

export type TournamentStatus =
  | 'setup' // collecting songs, not yet started
  | 'running' // matches in progress
  | 'completed'; // champion decided

export interface Tournament {
  id: string;
  title: string;
  status: TournamentStatus;
  songs: Record<string, Song>;
  matches: Record<string, Match>;
  rounds: Round[];
  /** Number of entrants that reach the main bracket (a power of two). */
  bracketSize: number;
  /** Total entrants before Sudden Death. */
  entrantCount: number;
  /** Number of Sudden Death matches (0 when entrants are a power of two). */
  suddenDeathMatchCount: number;
  championId: string | null;
  /** Pointer to the match currently being voted on. */
  currentMatchId: string | null;
}

/** Lightweight plan produced before a tournament is materialised. */
export interface SuddenDeathPlan {
  entrantCount: number;
  bracketSize: number;
  /** entrantCount - bracketSize; how many songs must be eliminated. */
  eliminations: number;
  /** Number of Sudden Death matches (== eliminations). */
  suddenDeathMatches: number;
  /** Songs that must fight in Sudden Death (== eliminations * 2). */
  songsInSuddenDeath: number;
  /** Songs that skip Sudden Death and go straight to the main bracket. */
  byes: number;
  /** True when no Sudden Death is required (entrants already a power of two). */
  isPerfectBracket: boolean;
}

import type { Song } from '@/shared/types/song';
import type {
  Match,
  Round,
  Slot,
  TieBreakMethod,
  Tournament,
} from '@/shared/types/tournament';
import { createRng, shuffle, type Rng } from './random';
import { MIN_ENTRANTS, planSuddenDeath } from './suddenDeath';

export interface GenerateOptions {
  id?: string;
  title?: string;
  /** Optional seed for reproducible brackets (tests/debugging). */
  seed?: number;
}

/** Human-friendly name for a main-bracket round given its competitor count. */
function mainRoundName(competitors: number): string {
  switch (competitors) {
    case 2:
      return 'Final';
    case 4:
      return 'Semifinals';
    case 8:
      return 'Quarterfinals';
    default:
      return `Round of ${competitors}`;
  }
}

function makeMatch(roundIndex: number, matchIndex: number): Match {
  return {
    id: `m-r${roundIndex}-${matchIndex}`,
    roundIndex,
    matchIndex,
    slotA: { kind: 'empty' },
    slotB: { kind: 'empty' },
    songAId: null,
    songBId: null,
    votesA: 0,
    votesB: 0,
    status: 'pending',
    winnerId: null,
    tieBreak: null,
  };
}

function slotSongId(slot: Slot): string | null {
  return slot.kind === 'song' ? slot.songId : null;
}

/**
 * Generate a complete, wired single-elimination tournament — including the
 * preliminary Sudden Death round when the entrant count is not a power of two.
 *
 * Guarantees (verified by unit tests):
 *  - Works for any entrant count >= 2.
 *  - Total matches == entrants - 1 (each match eliminates exactly one song).
 *  - Sudden Death winners are randomly distributed across the first main round
 *    (no clustering, no fixed positional bias).
 *  - Exactly one champion emerges.
 */
export function generateTournament(
  songsInput: readonly Song[],
  opts: GenerateOptions = {},
): Tournament {
  if (songsInput.length < MIN_ENTRANTS) {
    throw new Error(
      `A tournament needs at least ${MIN_ENTRANTS} songs, got ${songsInput.length}`,
    );
  }

  const rng: Rng = createRng(opts.seed);
  const plan = planSuddenDeath(songsInput.length);

  // Fair shuffle up front so byes and Sudden Death participants are random.
  const songs = shuffle(songsInput, rng);
  const songMap: Record<string, Song> = {};
  for (const s of songs) songMap[s.id] = s;

  const rounds: Round[] = [];
  const matches: Record<string, Match> = {};

  // ----- Round 0: Sudden Death (only when needed) --------------------------
  // The last `songsInSuddenDeath` shuffled songs fight; the rest get byes.
  const byeSongs = songs.slice(0, plan.byes);
  const suddenDeathSongs = songs.slice(plan.byes); // length == eliminations * 2

  const mainStart = plan.isPerfectBracket ? 0 : 1;

  // Seeds feeding the first main round: bye songs + Sudden Death winners.
  const seedSlots: Slot[] = byeSongs.map((s) => ({
    kind: 'song',
    songId: s.id,
  }));

  if (!plan.isPerfectBracket) {
    const sdMatchIds: string[] = [];
    for (let i = 0; i < plan.suddenDeathMatches; i++) {
      const match = makeMatch(0, i);
      const a = suddenDeathSongs[i * 2]!;
      const b = suddenDeathSongs[i * 2 + 1]!;
      match.slotA = { kind: 'song', songId: a.id };
      match.slotB = { kind: 'song', songId: b.id };
      match.songAId = a.id;
      match.songBId = b.id;
      match.status = 'ready';
      matches[match.id] = match;
      sdMatchIds.push(match.id);
      // The winner of this Sudden Death match becomes a main-bracket seed.
      seedSlots.push({ kind: 'match', matchId: match.id });
    }
    rounds.push({
      index: 0,
      name: 'Sudden Death',
      isSuddenDeath: true,
      matchIds: sdMatchIds,
    });
  }

  // Distribute the seeds randomly so Sudden Death winners are not clustered.
  const shuffledSeeds = shuffle(seedSlots, rng);

  // ----- Main bracket ------------------------------------------------------
  let competitors = plan.bracketSize;
  let roundIndex = mainStart;
  let previousRoundMatchIds: string[] = [];

  while (competitors >= 2) {
    const matchCount = competitors / 2;
    const roundMatchIds: string[] = [];

    for (let m = 0; m < matchCount; m++) {
      const match = makeMatch(roundIndex, m);

      if (roundIndex === mainStart) {
        // First main round is fed by the shuffled seed slots.
        match.slotA = shuffledSeeds[m * 2]!;
        match.slotB = shuffledSeeds[m * 2 + 1]!;
      } else {
        // Later rounds are fed by the winners of the previous round.
        match.slotA = { kind: 'match', matchId: previousRoundMatchIds[m * 2]! };
        match.slotB = {
          kind: 'match',
          matchId: previousRoundMatchIds[m * 2 + 1]!,
        };
      }

      match.songAId = slotSongId(match.slotA);
      match.songBId = slotSongId(match.slotB);
      match.status =
        match.songAId !== null && match.songBId !== null ? 'ready' : 'pending';

      matches[match.id] = match;
      roundMatchIds.push(match.id);
    }

    rounds.push({
      index: roundIndex,
      name: mainRoundName(competitors),
      isSuddenDeath: false,
      matchIds: roundMatchIds,
    });

    previousRoundMatchIds = roundMatchIds;
    competitors = matchCount;
    roundIndex += 1;
  }

  const tournament: Tournament = {
    id: opts.id ?? 'tournament',
    title: opts.title ?? 'Untitled Tournament',
    status: 'setup',
    songs: songMap,
    matches,
    rounds,
    bracketSize: plan.bracketSize,
    entrantCount: plan.entrantCount,
    suddenDeathMatchCount: plan.suddenDeathMatches,
    championId: null,
    currentMatchId: null,
  };

  return tournament;
}

/** All matches in play order (round, then position within round). */
export function matchesInPlayOrder(t: Tournament): Match[] {
  const out: Match[] = [];
  for (const round of t.rounds) {
    for (const id of round.matchIds) out.push(t.matches[id]!);
  }
  return out;
}

/** The earliest match that is ready to be played but not yet completed. */
export function nextPlayableMatch(t: Tournament): Match | null {
  for (const match of matchesInPlayOrder(t)) {
    if (match.status === 'ready') return match;
  }
  return null;
}

/** The single match that decides the champion (the last round's only match). */
export function finalMatch(t: Tournament): Match {
  const lastRound = t.rounds[t.rounds.length - 1]!;
  return t.matches[lastRound.matchIds[0]!]!;
}

/**
 * Begin the tournament: activate the first playable match.
 * Returns a new tournament (does not mutate the input).
 */
export function startTournament(input: Tournament): Tournament {
  const t = structuredClone(input);
  t.status = 'running';
  const next = nextPlayableMatch(t);
  if (next) {
    next.status = 'active';
    t.currentMatchId = next.id;
  }
  return t;
}

/**
 * Complete the currently-active match with the given winner, propagate the
 * winner into the next round, and activate the next playable match (or crown
 * the champion). Pure: returns a new tournament.
 */
export function completeMatch(
  input: Tournament,
  matchId: string,
  winnerId: string,
  tieBreak: TieBreakMethod | null = null,
): Tournament {
  const t = structuredClone(input);
  const match = t.matches[matchId];
  if (!match) throw new Error(`Unknown match ${matchId}`);
  if (match.status === 'completed') {
    throw new Error(`Match ${matchId} is already completed`);
  }
  if (winnerId !== match.songAId && winnerId !== match.songBId) {
    throw new Error(`Winner ${winnerId} is not a competitor in ${matchId}`);
  }

  match.winnerId = winnerId;
  match.tieBreak = tieBreak;
  match.status = 'completed';

  // Propagate the winner into any slot that references this match.
  for (const other of Object.values(t.matches)) {
    if (other.slotA.kind === 'match' && other.slotA.matchId === matchId) {
      other.songAId = winnerId;
    }
    if (other.slotB.kind === 'match' && other.slotB.matchId === matchId) {
      other.songBId = winnerId;
    }
    if (
      other.status === 'pending' &&
      other.songAId !== null &&
      other.songBId !== null
    ) {
      other.status = 'ready';
    }
  }

  // Activate the next match or finish the tournament.
  const next = nextPlayableMatch(t);
  if (next) {
    next.status = 'active';
    t.currentMatchId = next.id;
  } else {
    t.status = 'completed';
    t.currentMatchId = null;
    t.championId = finalMatch(t).winnerId;
  }

  return t;
}

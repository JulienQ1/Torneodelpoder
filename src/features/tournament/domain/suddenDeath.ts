import type { SuddenDeathPlan } from '@/shared/types/tournament';

/** Smallest number of entrants that can form a real bracket. */
export const MIN_ENTRANTS = 2;

/** True when `n` is an exact power of two (n > 0). */
export function isPowerOfTwo(n: number): boolean {
  return n >= 1 && (n & (n - 1)) === 0;
}

/**
 * Nearest power of two that is <= n. (a.k.a. "floor power of two")
 * 36 → 32, 18 → 16, 22 → 16, 37 → 32, 70 → 64, 32 → 32.
 */
export function floorPowerOfTwo(n: number): number {
  if (n < 1) return 0;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

/**
 * Compute the Sudden Death plan for a given number of entrants.
 *
 * The rule (as specified):
 *   bracketSize   = floorPowerOfTwo(entrants)
 *   eliminations  = entrants - bracketSize
 *   Each Sudden Death match removes exactly one song (2 enter, 1 advances),
 *   so we need `eliminations` matches involving `2 * eliminations` songs.
 *   The remaining `entrants - 2 * eliminations` songs get a bye straight into
 *   the main bracket. Byes + Sudden Death winners == bracketSize.
 *
 * Invariant: byes + eliminations == bracketSize, and every entrant is
 * accounted for exactly once.
 *
 * @throws if entrants < MIN_ENTRANTS.
 */
export function planSuddenDeath(entrants: number): SuddenDeathPlan {
  if (!Number.isInteger(entrants)) {
    throw new Error(`Entrant count must be an integer, got ${entrants}`);
  }
  if (entrants < MIN_ENTRANTS) {
    throw new Error(
      `A tournament needs at least ${MIN_ENTRANTS} songs, got ${entrants}`,
    );
  }

  const bracketSize = floorPowerOfTwo(entrants);
  const eliminations = entrants - bracketSize;
  const songsInSuddenDeath = eliminations * 2;
  const byes = entrants - songsInSuddenDeath;

  return {
    entrantCount: entrants,
    bracketSize,
    eliminations,
    suddenDeathMatches: eliminations,
    songsInSuddenDeath,
    byes,
    isPerfectBracket: eliminations === 0,
  };
}

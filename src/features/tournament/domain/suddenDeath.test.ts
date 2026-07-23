import { describe, expect, it } from 'vitest';
import {
  floorPowerOfTwo,
  isPowerOfTwo,
  MIN_ENTRANTS,
  planSuddenDeath,
} from './suddenDeath';

describe('isPowerOfTwo', () => {
  it('recognises powers of two', () => {
    for (const n of [1, 2, 4, 8, 16, 32, 64, 128, 256]) {
      expect(isPowerOfTwo(n)).toBe(true);
    }
  });
  it('rejects non-powers of two', () => {
    for (const n of [0, 3, 5, 6, 7, 9, 18, 36, 37, 70]) {
      expect(isPowerOfTwo(n)).toBe(false);
    }
  });
});

describe('floorPowerOfTwo', () => {
  const cases: Array<[number, number]> = [
    [36, 32],
    [18, 16],
    [22, 16],
    [37, 32],
    [70, 64],
    [32, 32],
    [2, 2],
    [3, 2],
    [129, 128],
  ];
  it.each(cases)('floorPowerOfTwo(%i) === %i', (n, expected) => {
    expect(floorPowerOfTwo(n)).toBe(expected);
  });
});

describe('planSuddenDeath — specified examples', () => {
  // [entrants, expectedEliminations] straight from the product spec.
  const specCases: Array<[number, number, number]> = [
    // entrants, bracketSize, eliminations
    [36, 32, 4],
    [18, 16, 2],
    [22, 16, 6],
    [37, 32, 5],
    [70, 64, 6],
  ];

  it.each(specCases)(
    '%i songs → bracket %i, %i eliminations',
    (entrants, bracketSize, eliminations) => {
      const plan = planSuddenDeath(entrants);
      expect(plan.bracketSize).toBe(bracketSize);
      expect(plan.eliminations).toBe(eliminations);
      expect(plan.suddenDeathMatches).toBe(eliminations);
      expect(plan.songsInSuddenDeath).toBe(eliminations * 2);
    },
  );

  it('36 songs matches the worked example exactly', () => {
    const plan = planSuddenDeath(36);
    expect(plan).toMatchObject({
      entrantCount: 36,
      bracketSize: 32,
      eliminations: 4,
      suddenDeathMatches: 4,
      songsInSuddenDeath: 8,
      byes: 28, // 36 - 8
      isPerfectBracket: false,
    });
    // byes + winners == bracket size
    expect(plan.byes + plan.eliminations).toBe(plan.bracketSize);
  });
});

describe('planSuddenDeath — invariants for all sizes', () => {
  it('holds every conservation invariant for 2..512 entrants', () => {
    for (let n = MIN_ENTRANTS; n <= 512; n++) {
      const p = planSuddenDeath(n);
      // Every entrant accounted for exactly once.
      expect(p.byes + p.songsInSuddenDeath).toBe(n);
      // Survivors form the bracket.
      expect(p.byes + p.eliminations).toBe(p.bracketSize);
      // Bracket is a power of two, no larger than n.
      expect(isPowerOfTwo(p.bracketSize)).toBe(true);
      expect(p.bracketSize).toBeLessThanOrEqual(n);
      // Perfect brackets need no Sudden Death.
      expect(p.isPerfectBracket).toBe(isPowerOfTwo(n));
    }
  });
});

describe('planSuddenDeath — guards', () => {
  it('rejects fewer than 2 entrants', () => {
    expect(() => planSuddenDeath(1)).toThrow();
    expect(() => planSuddenDeath(0)).toThrow();
  });
  it('rejects non-integers', () => {
    expect(() => planSuddenDeath(3.5)).toThrow();
  });
});

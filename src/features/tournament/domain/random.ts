/**
 * Deterministic randomness utilities.
 *
 * Why seedable? Tournament generation must be *fair* (uniform shuffles) but
 * also *reproducible* for tests and for debugging a specific bracket. We use a
 * small, fast, well-distributed PRNG (mulberry32) plus a Fisher–Yates shuffle,
 * which is the unbiased shuffle algorithm. Passing no seed uses crypto-strong
 * entropy so real tournaments are genuinely unpredictable.
 */

export type Rng = () => number;

/** mulberry32 — tiny deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build an RNG from an optional seed. Undefined → non-deterministic. */
export function createRng(seed?: number): Rng {
  if (seed === undefined) {
    // Non-deterministic seed from the best available entropy source.
    const s = Math.floor(Math.random() * 0xffffffff);
    return mulberry32(s ^ (Date.now() & 0xffffffff));
  }
  return mulberry32(seed);
}

/**
 * Unbiased Fisher–Yates shuffle. Returns a new array; does not mutate input.
 * Every permutation is equally likely given a uniform RNG.
 */
export function shuffle<T>(input: readonly T[], rng: Rng): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

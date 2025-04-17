import seedrandom from 'seedrandom';
import type { GameState } from './types';

/**
 * Returns a PRNG and the next seed based on current state.seed
 */
export function makeRng(state: GameState): { rng: () => number; nextSeed: number } {
  const prng = seedrandom(String(state.seed), { global: false });
  prng(); // warm up
  const nextSeed = Math.floor(prng() * Number.MAX_SAFE_INTEGER);
  return { rng: prng, nextSeed };
}
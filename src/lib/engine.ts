import type { GameState, Choice } from './types';
import { makeRng } from './rng';

export function applyChoice(state: GameState, choice: Choice): GameState {
  const { rng, nextSeed } = makeRng(state);
  const newResources = { ...state.resources };

  for (const [meter, effect] of Object.entries(choice.effects)) {
    const [minStr, maxStr] = (effect as string).split('..');
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    const delta = Math.floor(rng() * (max - min + 1)) + min;
    // @ts-ignore
    newResources[meter] += delta;
  }

  // advance quarter and possibly year
  const newQuarter = state.quarter === 4 ? 1 : state.quarter + 1;
  const newYear    = state.quarter === 4 ? state.year + 1 : state.year;

  return {
    ...state,
    year: newYear,
    quarter: newQuarter,
    resources: newResources,
    log: [...state.log, choice.label],
    seed: nextSeed
  };
}
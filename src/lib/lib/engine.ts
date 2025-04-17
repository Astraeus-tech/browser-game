import type { Event, GameState, Choice } from './types';
import { makeRng } from './rng';

export function applyChoice(state: GameState, choice: Choice): GameState {
  const { rng, nextSeed } = makeRng(state);
  const newResources = { ...state.resources };

  for (const [meter, effect] of Object.entries(choice.effects)) {
    const [minStr, maxStr] = effect.split('..');
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    const delta = Math.floor(rng() * (max - min + 1)) + min;
    newResources[meter as keyof typeof newResources] += delta;
  }

  return {
    ...state,
    resources: newResources,
    log: [...state.log, choice.label],
    seed: nextSeed
  };
}
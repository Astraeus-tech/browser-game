import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { GameState } from '../types';

export const defaultState: GameState = {
  year: 2025,
  quarter: 3,
  resources: {
    ai_cap: 0,
    social_trust: 50,
    env_health: 50,
    economic_stability: 50,
    compute_power: 0
  },
  log: [],
  seed: Date.now()
};

function createGameStore() {
  let initial: GameState = defaultState;
  if (browser) {
    const raw = localStorage.getItem('game');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<GameState>;
        initial = { ...defaultState, ...parsed };
      } catch {
        initial = defaultState;
      }
    }
  }

  // Ensure all default fields are present
  initial = { ...defaultState, ...initial };

  const { subscribe, set, update } = writable<GameState>(initial);

  return {
    subscribe,
    set: (v: GameState) => {
      set(v);
      if (browser) {
        localStorage.setItem('game', JSON.stringify(v));
      }
    },
    update: (fn: (s: GameState) => GameState) => {
      update((current) => {
        const next = fn(current);
        if (browser) {
          localStorage.setItem('game', JSON.stringify(next));
        }
        return next;
      });
    }
  };
}

export const game = createGameStore();
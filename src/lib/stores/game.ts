// src/lib/stores/game.ts
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { GameState } from '../types';

export const defaultState: GameState = {
  year: 2024,
  resources: {
    ai_cap: 0,
    social_trust: 50,
    env_health: 50,
    economic_stability: 50
  },
  log: [],
  seed: Date.now()
};

function createGameStore() {
  // initialize from localStorage if running in browser
  const initial: GameState = browser && localStorage.getItem('game')
    ? JSON.parse(localStorage.getItem('game')!)
    : defaultState;

  const { subscribe, set, update } = writable<GameState>(initial);

  return {
    subscribe,
    set: (v: GameState) => {
      set(v);
      if (browser) localStorage.setItem('game', JSON.stringify(v));
    },
    update: (fn: (s: GameState) => GameState) => {
      update((current) => {
        const next = fn(current);
        if (browser) localStorage.setItem('game', JSON.stringify(next));
        return next;
      });
    }
  };
}

export const game = createGameStore();
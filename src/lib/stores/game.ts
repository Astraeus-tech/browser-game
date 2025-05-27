import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { GameState, MeterGroup, Meters, MeterRanges, Ending } from '../types';
import meterRanges from '$lib/content/meters.json';
import { calculateEndingDetails } from '$lib/engine';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function initMeters(ranges: MeterRanges): Meters {
  const out = {} as Meters;
  for (const groupKey in ranges) {
    const group = groupKey as MeterGroup;
    const metersForGroup = ranges[group];
    out[group] = {} as Record<string, number>;
    for (const meterKey in metersForGroup) {
      const range = metersForGroup[meterKey];
      out[group][meterKey] = randInt(range.min, range.max);
    }
  }
  // After initializing all meters, recalc initial valuation:
  const aiValues = Object.values(out.ai_capability);
  const aiAvg    = aiValues.reduce((sum, v) => sum + v, 0) / aiValues.length;
  out.company.valuation = aiAvg * out.company.revenue;
  return out;
}

// Convert from constant to function to get fresh values each time
export function getDefaultState(): GameState {
  return {
    year: 2025,
    quarter: 3,
    meters: initMeters(meterRanges as MeterRanges),
    metersHistory: [],
    log: [],
    seed: Date.now(),
    gameOver: 'playing',
    currentEventId: undefined
  };
}

// Keep a reference for initial load
const defaultState = getDefaultState();

function createGameStore() {
  let initial: GameState = defaultState;
  if (browser) {
    const raw = localStorage.getItem('game');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<GameState>;
        initial = { ...defaultState, ...parsed };

        // Patch for older saved games: if gameOver is an Ending but lacks scoreDetails, calculate them.
        if (initial.gameOver && initial.gameOver !== 'playing' && !(initial.gameOver as Ending).scoreDetails) {
         
          const endingState = initial.gameOver as Ending;
          // We need to provide the full GameState to calculateEndingDetails.
          // The `initial` object here IS the full GameState loaded from localStorage.
          initial.gameOver = calculateEndingDetails(endingState, initial as GameState);
        }

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
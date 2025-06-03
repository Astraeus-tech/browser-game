import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { GameState, MeterGroup, Meters, MeterRanges } from '../types';
import meterRanges from '$lib/content/meters.json';

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
    gameOver: 'intro',
    currentEventId: undefined
  };
}

/**
 * Pure Reactive Game Store
 * 
 * Simple reactive store for UI updates only.
 * All game logic and persistence is handled by the secure client.
 * No localStorage - server is the single source of truth.
 */
function createGameStore() {
  const defaultState = getDefaultState();
  
  // Simple reactive store - no persistence, no loading
  const { subscribe, set, update } = writable<GameState>(defaultState);

  return {
    subscribe,
    set: async (v: GameState) => {
      set(v);
    },
    update: async (fn: (s: GameState) => GameState) => {
      update(fn);
    }
  };
}

export const game = createGameStore();
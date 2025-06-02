import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { GameState, MeterGroup, Meters, MeterRanges, Ending } from '../types';
import meterRanges from '$lib/content/meters.json';
import { calculateEndingDetails } from '$lib/engine';
import { loadServerGameState, startServerGame } from '$lib/gameClient';
import { gameStateManager } from '$lib/gameStateManager';

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

// Keep a reference for initial load
const defaultState = getDefaultState();

// With simplified architecture, we save every state change for complete audit trail
function shouldSaveToDatabase(oldState: GameState, newState: GameState): boolean {
  // Skip saves if state hasn't actually changed
  if (JSON.stringify(oldState) === JSON.stringify(newState)) {
    return false;
  }
  
  // Skip saves during intro phase (no active game yet)
  if (newState.gameOver === 'intro') {
    return false;
  }
  
  // Save all other changes - complete audit trail
  return true;
}

function createGameStore() {
  let initial: GameState = defaultState;
  let isLoading = true;

  // Initialize with default state first
  const { subscribe, set, update } = writable<GameState>(initial);

  // Async function to load initial state with server-authoritative support
  async function loadInitialState() {
    if (!browser) {
      isLoading = false;
      return;
    }

    try {
      // Try server-authoritative loading first if in remote mode
      if (import.meta.env.VITE_DATABASE_MODE === 'remote') {
        console.log('Attempting to load from server-authoritative system...');
        const serverResponse = await loadServerGameState();
        if (serverResponse.success && serverResponse.gameState) {
          let loadedState = { ...defaultState, ...serverResponse.gameState };

          // Patch for older saved games: if gameOver is an Ending but lacks scoreDetails, calculate them.
          if (loadedState.gameOver && loadedState.gameOver !== 'playing' && loadedState.gameOver !== 'intro' && !(loadedState.gameOver as Ending).scoreDetails) {
            const endingState = loadedState.gameOver as Ending;
            loadedState.gameOver = calculateEndingDetails(endingState, loadedState);
          }

          set(loadedState);
          console.log('Game state loaded from server-authoritative system');
          return;
        } else {
          console.log('No server game state found, checking localStorage...');
        }
      }

      // Fallback to localStorage
      const savedState = await gameStateManager.loadGameState();
      if (savedState) {
        let loadedState = { ...defaultState, ...savedState };

        // Patch for older saved games: if gameOver is an Ending but lacks scoreDetails, calculate them.
        if (loadedState.gameOver && loadedState.gameOver !== 'playing' && loadedState.gameOver !== 'intro' && !(loadedState.gameOver as Ending).scoreDetails) {
          const endingState = loadedState.gameOver as Ending;
          loadedState.gameOver = calculateEndingDetails(endingState, loadedState);
        }

        set(loadedState);
        console.log('Game state loaded from localStorage');
      } else {
        console.log('No saved game state found, using default');
      }
    } catch (error) {
      console.error('Error loading game state:', error);
    } finally {
      isLoading = false;
    }
  }

  // Load initial state
  loadInitialState();

  return {
    subscribe,
    set: async (v: GameState) => {
      let previousState: GameState;
      const unsubscribe = subscribe(state => previousState = state);
      unsubscribe();
      
      set(v);
      if (browser && !isLoading) {
        // Always save to localStorage immediately
        try {
          localStorage.setItem('game', JSON.stringify(v));
        } catch (e) {
          console.warn('localStorage save failed:', e);
        }
        
        // Save all game state changes to database for complete audit trail
        const shouldSave = shouldSaveToDatabase(previousState!, v);
        if (shouldSave) {
          console.log('[GameStore] Saving state to database');
          gameStateManager.saveGameState(v).catch((err: any) => console.warn('Background save failed:', err));
        }
      }
    },
    update: async (fn: (s: GameState) => GameState) => {
      let nextState: GameState;
      let previousState: GameState;
      update((current) => {
        previousState = current;
        nextState = fn(current);
        return nextState;
      });
      if (browser && !isLoading) {
        // Always save to localStorage immediately
        try {
          localStorage.setItem('game', JSON.stringify(nextState!));
        } catch (e) {
          console.warn('localStorage save failed:', e);
        }
        
        // Save all game state changes to database for complete audit trail
        const shouldSave = shouldSaveToDatabase(previousState!, nextState!);
        if (shouldSave) {
          console.log('[GameStore] Saving state to database');
          gameStateManager.saveGameState(nextState!).catch((err: any) => console.warn('Background save failed:', err));
        }
      }
    },
    // Expose loading state for UI
    isLoading: () => isLoading,
    // Force save and wait for completion - used before score submission
    forceSave: async () => {
      if (browser && !isLoading) {
        let currentState: GameState;
        const unsubscribe = subscribe(state => currentState = state);
        unsubscribe();
        await gameStateManager.saveGameState(currentState!);
      }
    }
  };
}

export const game = createGameStore();
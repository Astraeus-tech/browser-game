import type { GameState, Choice, MeterGroup, Ending, MeterRanges } from './types';
import { makeRng } from './rng';
import meterRanges from '$lib/content/meters.json';
import endings from '$lib/content/endings.json';

function checkEnding(meters: any, year: number, quarter: number): { id: string } | null {
  function compare(op: string, actual: number, expected: number): boolean {
    switch (op) {
      case 'gte': return actual >= expected;
      case 'gt': return actual > expected;
      case 'lte': return actual <= expected;
      case 'lt': return actual < expected;
      case 'eq': return actual === expected;
      default: return false;
    }
  }

  function check(cond: Record<string, Record<string, number>>): boolean {
    return Object.entries(cond).every(([path, rule]) => {
      const [group, key] = path.split('.');
      const actual = meters?.[group]?.[key];
      const op = Object.keys(rule)[0];
      const expected = rule[op];
      return compare(op, actual, expected);
    });
  }

  // 1. Check hard losses (can happen any time)
  for (const ending of endings) {
    const e = ending as Ending;

    if (e.type === 'loss' && e.conditions && check(e.conditions)) {
      return { id: e.id };
    }
  }

  // 2. Check win/draw conditions only in Q4 2027
  if (year === 2027 && quarter === 4) {
    for (const ending of endings) {
      const e = ending as Ending;

      if ((e.type === 'win' || e.type === 'draw')) {
        if (e.conditions && check(e.conditions)) {
          return { id: e.id };
        }
        if (e.conditions_any && e.conditions_any.some(check)) {
          return { id: e.id };
        }
      }
    }
  }

  return null;
}

export function applyChoice(state: GameState, choice: Choice): GameState {
  const { rng, nextSeed } = makeRng(state);
  const ranges = meterRanges as MeterRanges;

  // clone meters
  const newMeters = {
    company: { ...state.meters.company },
    environment: { ...state.meters.environment },
    ai_capability: { ...state.meters.ai_capability }
  };

  // 1) apply and clamp
  for (const group of (Object.keys(choice.effects) as MeterGroup[])) {
    const groupEffects = choice.effects[group];
    if (!groupEffects) continue;
    for (const key of Object.keys(groupEffects)) {
      const effectString = choice.effects[group]?.[key];
      if (!effectString) continue;
      const [lo, hi] = effectString.split('..').map(Number);
      const delta = Math.floor(rng() * (hi - lo + 1)) + lo;
      const current = newMeters[group][key] ?? 0;
      const { min, max } = ranges[group][key];
      newMeters[group][key] = Math.min(Math.max(current + delta, min), max);
    }
  }

  // 2) check for hard losses immediately (before advancing time)
  const lossEnding = checkEnding(newMeters, state.year, state.quarter);
  if (lossEnding) {
    const endingData = endings.find(e => e.id === lossEnding.id) as Ending;
    return {
      ...state,
      meters: newMeters,
      log: [...state.log, choice.label],
      seed: nextSeed,
      gameOver: endingData
    };
  }

  // 3) if we're already in Q4 2027, check for win/draw endings
  if (state.year === 2027 && state.quarter === 4) {
    const finalEnding = checkEnding(newMeters, state.year, state.quarter);
    if (finalEnding) {
      const endingData = endings.find(e => e.id === finalEnding.id) as Ending;
      return {
        ...state,
        meters: newMeters,
        log: [...state.log, choice.label],
        seed: nextSeed,
        gameOver: endingData
      };
    }
  }
  if (state.year === 2027 && state.quarter === 4) {
    const draw = endings.find(e => e.id === 'draw‑survival') as Ending;
    return {
      ...state,
      meters: newMeters,
      log: [...state.log, choice.label],
      seed: nextSeed,
      gameOver: draw
    };
  }
  // 4) advance time only if no ending has triggered
  const newQuarter = state.quarter === 4 ? 1 : state.quarter + 1;
  const newYear = state.quarter === 4 ? state.year + 1 : state.year;

  return {
    ...state,
    year: newYear,
    quarter: newQuarter,
    meters: newMeters,
    log: [...state.log, choice.label],
    seed: nextSeed,
    gameOver: 'playing'
  };
}
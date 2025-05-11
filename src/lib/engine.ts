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

// Centralize credit scaling logic
export function getCreditScaleFactor(year: number, quarter: number): number {
  const deltaQuarters = (year - 2025) * 4 + (quarter - 3);
  return Math.pow(1.5, deltaQuarters);
}

export function scaleCreditRange(effect: string, year: number, quarter: number): [number, number] {
  const [lo, hi] = effect.split('..').map(Number);
  const scale = getCreditScaleFactor(year, quarter);
  return [Math.floor(lo * scale), Math.ceil(hi * scale)];
}

export function applyChoice(state: GameState, choice: Choice): GameState {
  const { rng, nextSeed } = makeRng(state);
  const ranges = meterRanges as MeterRanges;

  // Save current meters to history before applying the new choice
  const currentMetersRecord = {
    year: state.year,
    quarter: state.quarter,
    meters: {
      company: { ...state.meters.company },
      environment: { ...state.meters.environment },
      ai_capability: { ...state.meters.ai_capability }
    }
  };
  
  // clone meters
  const newMeters = {
    company: { ...state.meters.company },
    environment: { ...state.meters.environment },
    ai_capability: { ...state.meters.ai_capability }
  };

  // Capture last round's credits and revenue, initialize creditDelta
  const oldCredits = state.meters.company.credits;
  const oldRevenue = state.meters.company.revenue;
  let creditDelta = 0;

  // 1) apply and clamp
  for (const group of (Object.keys(choice.effects) as MeterGroup[])) {
    const groupEffects = choice.effects[group];
    if (!groupEffects) continue;
    for (const key of Object.keys(groupEffects)) {
      const effectString = choice.effects[group]?.[key];
      if (!effectString) continue;
      const [lo, hi] = effectString.split('..').map(Number);
      // Ramping company credits & revenue impacts by quarter progression (1.5^n multiplier)
      // Base JSON files should remain unchanged — scaling applied at runtime only
      let scaledLo = lo;
      let scaledHi = hi;
      if (group === 'company' && (key === 'credits' || key === 'revenue')) {
        [scaledLo, scaledHi] = scaleCreditRange(effectString, state.year, state.quarter);
      }
      const delta = Math.floor(rng() * (scaledHi - scaledLo + 1)) + scaledLo;
      const current = newMeters[group][key] ?? 0;
      // no longer using predefined ranges; we'll clamp to 0–100 below
      // Handle credits separately (no clamp)
      if (group === 'company' && key === 'credits') {
        creditDelta = delta;
        continue;
      }
      // Handle revenue separately (no clamp)
      if (group === 'company' && key === 'revenue') {
        newMeters.company.revenue = current + delta;
        continue;
      }
      // Skip direct effects on valuation; we'll recalc it below
      if (group === 'company' && key === 'valuation') {
        continue;
      }
      newMeters[group][key] = Math.min(Math.max(current + delta, 0), 100);
    }
  }

  // After applying all deltas, accumulate credits without clamp
  newMeters.company.credits = oldCredits + (oldRevenue / 4) + creditDelta;
  // Recalculate valuation: average AI capability * current annual revenue
  const aiValues = Object.values(newMeters.ai_capability);
  const aiAvg = aiValues.reduce((sum, v) => sum + v, 0) / aiValues.length;
  const revenueForVal = newMeters.company.revenue;
  newMeters.company.valuation = aiAvg * revenueForVal;

  // 2) check for hard losses immediately (before advancing time)
  const lossEnding = checkEnding(newMeters, state.year, state.quarter);
  if (lossEnding) {
    const endingData = endings.find(e => e.id === lossEnding.id) as Ending;
    return {
      ...state,
      meters: newMeters,
      metersHistory: [...state.metersHistory, currentMetersRecord],
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
        metersHistory: [...state.metersHistory, currentMetersRecord],
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
      metersHistory: [...state.metersHistory, currentMetersRecord],
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
    metersHistory: [...state.metersHistory, currentMetersRecord],
    log: [...state.log, choice.label],
    seed: nextSeed,
    gameOver: 'playing'
  };
}
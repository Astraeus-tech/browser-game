import { describe, it, expect } from 'vitest';
import { getDefaultState } from './stores/game';
import { applyChoice } from './engine';
import type { Choice } from './types';

describe('applyChoice', () => {
  it('applies a fixed effect correctly', () => {
    const defaultState = getDefaultState();
    const choice: Choice = {
      label: 'Test +2',
      effects: { ai_capability: { progress: '2..2' } }
    };
    const result = applyChoice(defaultState, choice);
    expect(result.meters.ai_capability.progress).toBe(defaultState.meters.ai_capability.progress + 2);
    expect(result.log).toContain('Test +2');
    expect(result.seed).not.toBe(defaultState.seed);
  });
});
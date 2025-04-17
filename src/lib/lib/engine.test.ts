import { describe, it, expect } from 'vitest';
import { defaultState } from './stores/game';
import { applyChoice } from './engine';
import type { Choice } from './types';

describe('applyChoice', () => {
  it('applies a fixed effect correctly', () => {
    const choice: Choice = {
      label: 'Test +2',
      effects: { ai_cap: '2..2' }
    };
    const result = applyChoice(defaultState, choice);
    expect(result.resources.ai_cap).toBe(defaultState.resources.ai_cap + 2);
    expect(result.log).toContain('Test +2');
    expect(result.seed).not.toBe(defaultState.seed);
  });
});
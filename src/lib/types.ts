export type MeterGroup = 'company' | 'environment' | 'ai_capability';

/** A numeric range for initializing meters */
export interface Range {
  min: number;
  max: number;
}

/** Specification of all meter ranges for initialization */
export type MeterRanges = Record<
  MeterGroup,
  Record<string, Range>
>;

/** All in‐game meters, organized by group */
export type Meters = Record<
  MeterGroup,
  Record<string, number>
>;

export interface Choice {
  label: string;
  /** effects on each meter group/key, expressed as "min..max" */
  effects: Partial<
    Record<
      MeterGroup,
      Record<string, string>
    >
  >;
}

export interface Event {
  id: string;
  headline: string;
  description: string;
  choices: Choice[];
  year: number;
  quarter: number;
}

export interface GameState {
  year: number;
  quarter: number;
  /** current meter values */
  meters: Meters;
  log: string[];
  seed: number;
  gameOver: 'playing' | Ending | null;
}
export type Ending = {
  id: string;
  type: 'win' | 'loss' | 'draw';
  rank?: 'S' | 'A' | 'B';
  title: string;
  description: string;
  conditions?: Record<string, { gte?: number; gt?: number; lte?: number; lt?: number; eq?: number }>;
  conditions_any?: Record<string, { gte?: number; gt?: number; lte?: number; lt?: number; eq?: number }>[];
};
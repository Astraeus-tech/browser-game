export type Meters =
  | 'ai_cap'
  | 'social_trust'
  | 'env_health'
  | 'economic_stability';

export type Resources = Record<Meters, number>;

export interface Choice {
  label: string;
  effects: Partial<Record<Meters, string>>; // e.g. "+1..+3"
}

export interface Event {
  id: string;
  headline: string;
  description: string;
  choices: Choice[];
  condition?: string;        // a JS expression you’ll eval against state
}

export interface GameState {
  year: number;
  resources: Resources;
  log: string[];
  seed: number;              // for RNG
}
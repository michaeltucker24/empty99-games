// The heat meter: adaptive difficulty with flair.
// Streaks heat it up (harder problems), misses cool it down.

export const MAX_HEAT = 10;

export const HEAT_STAGES = [
  { min: 0, name: 'Cold', color: '#378ADD' },
  { min: 2, name: 'Warm', color: '#1D9E75' },
  { min: 4, name: 'Hot', color: '#EF9F27' },
  { min: 6, name: 'Blazing', color: '#D85A30' },
  { min: 8, name: 'Inferno', color: '#E24B4A' },
] as const;

export type HeatStage = (typeof HEAT_STAGES)[number];

export function stageFor(heat: number): HeatStage {
  let stage: HeatStage = HEAT_STAGES[0];
  for (const s of HEAT_STAGES) if (heat >= s.min) stage = s;
  return stage;
}

export interface HeatState {
  heat: number; // 0..MAX_HEAT, may be fractional
  combo: number; // correct answers in a row
}

export const initialHeat = (start = 0): HeatState => ({ heat: start, combo: 0 });

/** Right answer: +1 heat, with a small bonus once a combo gets going. */
export function onCorrect(s: HeatState): HeatState {
  const combo = s.combo + 1;
  const gain = combo >= 3 ? 1.25 : 1;
  return { heat: Math.min(MAX_HEAT, s.heat + gain), combo };
}

/** Miss: lose 1.5 heat and the combo. */
export function onMiss(s: HeatState): HeatState {
  return { heat: Math.max(0, s.heat - 1.5), combo: 0 };
}

/** Difficulty level used by problem generators (0..10, integer). */
export const levelOf = (s: HeatState) => Math.floor(s.heat);

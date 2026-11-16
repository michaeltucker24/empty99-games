// The game contract: every game fills in this shape; the shared core does the rest.

import type { Rng } from './seed';

export interface Problem {
  prompt: string; // what the player sees, e.g. "17 × 6"
  answer: number; // always a whole number in V1
  topic: string; // sub-topic id, e.g. "multiplication"
  context?: string; // optional story line for real-life problems
}

export interface Topic {
  id: string;
  name: string; // shown in UI
  path: string; // sub-topic page slug
  blurb: string; // one line for cards and "Try next"
}

export interface GameDefinition {
  slug: string; // URL path, e.g. "mental-math"
  name: string;
  accent: string; // signature color
  topics: Topic[];
  /** Make one problem for a topic at a difficulty level (0..10). Pure function. */
  generate(rng: Rng, level: number, topicId: string): Problem;
  /** Text for the share button, given a result. */
  shareText(result: { mode: string; score: number; extra?: string; day?: number }): string;
}

// Per-game progress kept in the player's browser: streaks, bests, badges, misses.
// No accounts in V1; the shape is kept simple so phase-2 sign-in can sync it later.

import { readJSON, writeJSON } from './storage';
import { todayKey } from './seed';

export interface Miss {
  prompt: string;
  answer: number;
  topic: string;
}

export interface Progress {
  version: 1;
  dailyStreak: number;
  bestDailyStreak: number;
  lastDailyDay: string | null;
  dailyResults: Record<string, number>; // day -> score
  bests: Record<string, number>; // mode key -> best score
  badges: string[];
  misses: Miss[]; // most recent first, capped
  plays: number;
}

const empty = (): Progress => ({
  version: 1,
  dailyStreak: 0,
  bestDailyStreak: 0,
  lastDailyDay: null,
  dailyResults: {},
  bests: {},
  badges: [],
  misses: [],
  plays: 0,
});

const keyFor = (game: string) => `e99:${game}:progress`;

export function loadProgress(game: string): Progress {
  return { ...empty(), ...readJSON<Partial<Progress>>(keyFor(game), {}) };
}

export function saveProgress(game: string, p: Progress): void {
  writeJSON(keyFor(game), p);
}

function dayBefore(key: string): string {
  return new Date(Date.parse(key) - 86_400_000).toISOString().slice(0, 10);
}

/** Record today's daily result. Returns the updated progress and whether it set a new best. */
export function recordDaily(p: Progress, score: number, day = todayKey()): Progress {
  const already = p.dailyResults[day] !== undefined;
  let streak = p.dailyStreak;
  if (!already) {
    streak = p.lastDailyDay === dayBefore(day) ? p.dailyStreak + 1 : 1;
  }
  return {
    ...p,
    dailyStreak: streak,
    bestDailyStreak: Math.max(p.bestDailyStreak, streak),
    lastDailyDay: day,
    // First attempt counts for the daily; replays don't overwrite it.
    dailyResults: already ? p.dailyResults : { ...p.dailyResults, [day]: score },
  };
}

/** Streak still alive? (played today or yesterday) */
export function liveStreak(p: Progress, day = todayKey()): number {
  if (!p.lastDailyDay) return 0;
  return p.lastDailyDay === day || p.lastDailyDay === dayBefore(day) ? p.dailyStreak : 0;
}

export function recordBest(p: Progress, mode: string, score: number): { progress: Progress; isBest: boolean } {
  const prev = p.bests[mode] ?? 0;
  const isBest = score > prev;
  return { progress: { ...p, bests: { ...p.bests, [mode]: Math.max(prev, score) } }, isBest };
}

export function addMisses(p: Progress, misses: Miss[]): Progress {
  const merged = [...misses, ...p.misses.filter((m) => !misses.some((n) => n.prompt === m.prompt))];
  return { ...p, misses: merged.slice(0, 40) };
}

export function removeMiss(p: Progress, prompt: string): Progress {
  return { ...p, misses: p.misses.filter((m) => m.prompt !== prompt) };
}

export function awardBadges(p: Progress, ids: string[]): { progress: Progress; earned: string[] } {
  const earned = ids.filter((id) => !p.badges.includes(id));
  return { progress: { ...p, badges: [...p.badges, ...earned] }, earned };
}

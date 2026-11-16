// Per-game progress kept in the player's browser: streaks, bests, badges, misses,
// plus the progression layer (XP, fuel, shields, missions, path stages, shop items).
// No accounts in V1; the shape is kept simple so phase-2 sign-in can sync it later.
// New fields always get defaults in `empty()`, so older saves load without migration.

import { readJSON, writeJSON } from './storage';
import { todayKey } from './seed';

export interface Miss {
  prompt: string;
  answer: number;
  topic: string;
}

export interface MissionState {
  day: string | null;
  progress: Record<string, number>; // mission id -> progress
  claimed: string[];
}

export interface Progress {
  version: number;
  dailyStreak: number; // consecutive days with at least one finished round
  bestDailyStreak: number;
  lastDailyDay: string | null; // last day a round was finished
  dailyResults: Record<string, number>; // day -> Daily Launch score (first attempt)
  bests: Record<string, number>; // mode key -> best score
  badges: string[]; // shown to players as "mission patches"
  misses: Miss[]; // most recent first, capped
  plays: number;
  // Progression (added Nov 2026)
  xp: number;
  fuel: number;
  shields: number; // streak shields owned (max 2)
  shieldDays: string[]; // days a shield saved the streak
  playDays: string[]; // recent days with a finished round (capped)
  stages: Record<string, number>; // path stage id -> stars (1..3)
  missions: MissionState;
  weeksClaimed: string[]; // week keys whose weekly challenge was claimed
  skins: string[]; // rocket skins owned
  skin: string; // equipped skin
  boostUntil: number; // Afterburner (double XP) active until this time (ms)
  timeBoosts: number; // +10 s boosts for the next practice run
}

const empty = (): Progress => ({
  version: 2,
  dailyStreak: 0,
  bestDailyStreak: 0,
  lastDailyDay: null,
  dailyResults: {},
  bests: {},
  badges: [],
  misses: [],
  plays: 0,
  xp: 0,
  fuel: 0,
  shields: 0,
  shieldDays: [],
  playDays: [],
  stages: {},
  missions: { day: null, progress: {}, claimed: [] },
  weeksClaimed: [],
  skins: ['classic'],
  skin: 'classic',
  boostUntil: 0,
  timeBoosts: 0,
});

export const emptyProgress = empty;

const keyFor = (game: string) => `e99:${game}:progress`;

export function loadProgress(game: string): Progress {
  const saved = readJSON<Partial<Progress>>(keyFor(game), {});
  const base = empty();
  return { ...base, ...saved, missions: { ...base.missions, ...(saved.missions ?? {}) }, version: 2 };
}

export function saveProgress(game: string, p: Progress): void {
  writeJSON(keyFor(game), p);
}

const DAY = 86_400_000;
export const addDays = (key: string, n: number) => new Date(Date.parse(key) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

export const MAX_SHIELDS = 2;

/**
 * Record that the player finished a round today. Extends the streak; if days were
 * missed and the player owns enough streak shields, the shields are spent to save it.
 */
export function recordPlay(p: Progress, day = todayKey()): Progress {
  const playDays = p.playDays.includes(day) ? p.playDays : [...p.playDays, day].slice(-90);
  if (p.lastDailyDay === day) return { ...p, playDays };
  let streak = 1;
  let shields = p.shields;
  let shieldDays = p.shieldDays;
  if (p.lastDailyDay) {
    const gap = daysBetween(p.lastDailyDay, day);
    const missed = gap - 1;
    if (gap === 1) streak = p.dailyStreak + 1;
    else if (missed > 0 && missed <= shields) {
      shields -= missed;
      shieldDays = [...shieldDays, ...Array.from({ length: missed }, (_, i) => addDays(p.lastDailyDay!, i + 1))].slice(-60);
      streak = p.dailyStreak + 1;
    }
  }
  return {
    ...p,
    playDays,
    shields,
    shieldDays,
    dailyStreak: streak,
    bestDailyStreak: Math.max(p.bestDailyStreak, streak),
    lastDailyDay: day,
  };
}

/** Record today's Daily Launch score (first attempt counts) and the play for the streak. */
export function recordDaily(p: Progress, score: number, day = todayKey()): Progress {
  const already = p.dailyResults[day] !== undefined;
  const withScore = already ? p : { ...p, dailyResults: { ...p.dailyResults, [day]: score } };
  return recordPlay(withScore, day);
}

/** Streak still alive? Played today or yesterday, or the gap is covered by shields. */
export function liveStreak(p: Progress, day = todayKey()): number {
  if (!p.lastDailyDay) return 0;
  const missed = daysBetween(p.lastDailyDay, day) - 1;
  return missed <= 0 || missed <= p.shields ? p.dailyStreak : 0;
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

// The progression layer shared by every game: XP and levels, fuel (the in-game
// currency), daily missions with supply crates, the weekly challenge, the fuel
// shop and the flight path (a game's lessons laid out as stages).
// Pure functions over `Progress`; games supply their own path and mission pool.

import { addDays, daysBetween, MAX_SHIELDS, type Progress } from './progress';
import { hashSeed, makeRng, todayKey } from './seed';

// ---------- XP and levels ----------

/** Total XP needed to reach a level: 0, 50, 150, 300, 500, 750 ... */
export const levelStart = (level: number) => 25 * level * (level - 1);

export function levelInfo(xp: number) {
  let level = 1;
  while (levelStart(level + 1) <= xp) level++;
  const start = levelStart(level);
  const need = levelStart(level + 1) - start;
  return { level, into: xp - start, need };
}

export const LEVEL_UP_FUEL = 50;
export const isBoosted = (p: Progress, now = Date.now()) => p.boostUntil > now;

export interface RoundEvent {
  baseXp: number; // XP before boosts
  maxHeat: number; // top heat reached (0..10)
  daily?: boolean; // was this today's Daily Launch?
  mode: string; // mode key, e.g. "launch", "defuse", "stage"
}

export interface Grant {
  xp: number;
  fuel: number;
  boosted: boolean;
  levelUp: number | null; // new level, if one was reached
}

/** Fuel for a round: about one per two XP, never zero for a finished round. */
export const fuelFor = (xp: number) => Math.max(1, Math.round(xp / 2));

/** Pay out a finished round: XP (doubled while Afterburner is on), fuel, level-up bonus, mission progress. */
export function grantRound(
  p: Progress,
  ev: RoundEvent,
  missions: MissionDef[],
  now = Date.now(),
  day = todayKey(new Date(now)),
): { progress: Progress; grant: Grant } {
  const boosted = isBoosted(p, now);
  const xp = Math.max(0, Math.round(ev.baseXp)) * (boosted ? 2 : 1);
  const before = levelInfo(p.xp).level;
  const after = levelInfo(p.xp + xp).level;
  const levelUp = after > before ? after : null;
  const fuel = fuelFor(xp) + (levelUp ? (after - before) * LEVEL_UP_FUEL : 0);
  let next: Progress = { ...p, xp: p.xp + xp, fuel: p.fuel + fuel };
  next = applyMissionEvent(next, missions, { ...ev, xp }, day);
  return { progress: next, grant: { xp, fuel, boosted, levelUp } };
}

// ---------- Daily missions ----------

export type MissionMetric = 'xp' | 'rounds' | 'heat' | 'daily' | 'mode';

export interface MissionDef {
  id: string;
  label: string;
  metric: MissionMetric;
  target: number;
  mode?: string; // for metric "mode": which mode counts
}

export const CRATE_FUEL = 30;
export const MISSIONS_PER_DAY = 3;

/** Today's 3 missions: always one XP mission, plus two others picked by the day's seed. */
export function dailyMissions(pool: MissionDef[], day = todayKey()): MissionDef[] {
  const rng = makeRng(hashSeed(`missions:${day}`));
  const xp = pool.filter((m) => m.metric === 'xp');
  const rest = pool.filter((m) => m.metric !== 'xp');
  const picked: MissionDef[] = [];
  if (xp.length) picked.push(xp[Math.floor(rng() * xp.length)]);
  const bag = [...rest];
  while (picked.length < MISSIONS_PER_DAY && bag.length) {
    const m = bag.splice(Math.floor(rng() * bag.length), 1)[0];
    // One mission per metric+mode, so two missions never ask for the same thing.
    if (!picked.some((x) => x.metric === m.metric && x.mode === m.mode)) picked.push(m);
  }
  return picked;
}

function missionsToday(p: Progress, day: string) {
  return p.missions.day === day ? p.missions : { day, progress: {}, claimed: [] };
}

export function applyMissionEvent(p: Progress, defs: MissionDef[], ev: RoundEvent & { xp: number }, day = todayKey()): Progress {
  const m = missionsToday(p, day);
  const progress = { ...m.progress };
  for (const d of defs) {
    const cur = progress[d.id] ?? 0;
    if (d.metric === 'xp') progress[d.id] = cur + ev.xp;
    else if (d.metric === 'rounds') progress[d.id] = cur + 1;
    else if (d.metric === 'heat') progress[d.id] = Math.max(cur, Math.floor(ev.maxHeat));
    else if (d.metric === 'daily') progress[d.id] = ev.daily ? 1 : cur;
    else if (d.metric === 'mode') progress[d.id] = cur + (ev.mode === d.mode ? 1 : 0);
  }
  return { ...p, missions: { day, progress, claimed: m.claimed } };
}

export function missionStatus(p: Progress, d: MissionDef, day = todayKey()) {
  const m = missionsToday(p, day);
  const value = Math.min(d.target, m.progress[d.id] ?? 0);
  return { value, done: value >= d.target, claimed: m.claimed.includes(d.id) };
}

/** Open a finished mission's supply crate. */
export function claimMission(p: Progress, d: MissionDef, day = todayKey()): { progress: Progress; fuel: number } {
  const s = missionStatus(p, d, day);
  if (!s.done || s.claimed) return { progress: p, fuel: 0 };
  const m = missionsToday(p, day);
  return {
    progress: { ...p, fuel: p.fuel + CRATE_FUEL, missions: { ...m, claimed: [...m.claimed, d.id] } },
    fuel: CRATE_FUEL,
  };
}

// ---------- Weekly challenge: play on 5 days in a week (Mon–Sun, UTC) ----------

export const WEEKLY_DAYS = 5;
export const WEEKLY_FUEL = 100;

export function weekStart(day = todayKey()): string {
  const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

export function weeklyStatus(p: Progress, day = todayKey()) {
  const start = weekStart(day);
  const days = p.playDays.filter((d) => d >= start && daysBetween(start, d) < 7).length;
  return { days: Math.min(days, WEEKLY_DAYS), done: days >= WEEKLY_DAYS, claimed: p.weeksClaimed.includes(start), start };
}

export function claimWeekly(p: Progress, day = todayKey()): { progress: Progress; fuel: number } {
  const s = weeklyStatus(p, day);
  if (!s.done || s.claimed) return { progress: p, fuel: 0 };
  return { progress: { ...p, fuel: p.fuel + WEEKLY_FUEL, weeksClaimed: [...p.weeksClaimed, s.start].slice(-20) }, fuel: WEEKLY_FUEL };
}

// ---------- Fuel shop ----------

export const AFTERBURNER_MS = 15 * 60_000;
export const TIME_BOOST_SECONDS = 10;

export interface ShopItem {
  id: string;
  name: string;
  blurb: string;
  price: number;
  kind: 'shield' | 'afterburner' | 'timeboost' | 'skin';
  /** Skins unlocked by a streak instead of fuel. */
  streakUnlock?: number;
}

export const SHOP: ShopItem[] = [
  { id: 'shield', name: 'Streak shield', blurb: 'Miss a day, keep your streak', price: 200, kind: 'shield' },
  { id: 'afterburner', name: 'Afterburner', blurb: '2× XP for 15 minutes', price: 150, kind: 'afterburner' },
  { id: 'timeboost', name: 'Time boost', blurb: `+${TIME_BOOST_SECONDS} s on your next practice run`, price: 80, kind: 'timeboost' },
];

export interface Skin {
  id: string;
  name: string;
  body: string;
  trim: string;
  price: number; // fuel; 0 = free or streak unlock
  streakUnlock?: number;
}

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', body: '#FFFFFF', trim: '#FFD23F', price: 0 },
  { id: 'comet', name: 'Comet', body: '#FFD23F', trim: '#16161A', price: 500 },
  { id: 'neon', name: 'Neon', body: '#5DCAA5', trim: '#FFFFFF', price: 800 },
  { id: 'golden', name: 'Golden', body: '#EF9F27', trim: '#FFD23F', price: 0, streakUnlock: 30 },
];

export type BuyResult = { ok: true; progress: Progress } | { ok: false; reason: string };

export function buy(p: Progress, itemId: string, now = Date.now()): BuyResult {
  const item = SHOP.find((s) => s.id === itemId);
  if (item) {
    if (p.fuel < item.price) return { ok: false, reason: `You need ${item.price - p.fuel} more fuel` };
    const paid = { ...p, fuel: p.fuel - item.price };
    if (item.kind === 'shield') {
      if (p.shields >= MAX_SHIELDS) return { ok: false, reason: 'You already have 2 shields' };
      return { ok: true, progress: { ...paid, shields: p.shields + 1 } };
    }
    if (item.kind === 'afterburner') {
      return { ok: true, progress: { ...paid, boostUntil: Math.max(p.boostUntil, now) + AFTERBURNER_MS } };
    }
    return { ok: true, progress: { ...paid, timeBoosts: p.timeBoosts + 1 } };
  }
  const skin = SKINS.find((s) => s.id === itemId);
  if (!skin) return { ok: false, reason: 'Unknown item' };
  if (p.skins.includes(skin.id)) return { ok: true, progress: { ...p, skin: skin.id } }; // owned: equip
  if (skin.streakUnlock) {
    if (p.bestDailyStreak < skin.streakUnlock) return { ok: false, reason: `Unlocks at a ${skin.streakUnlock}-day streak` };
    return { ok: true, progress: { ...p, skins: [...p.skins, skin.id], skin: skin.id } };
  }
  if (p.fuel < skin.price) return { ok: false, reason: `You need ${skin.price - p.fuel} more fuel` };
  return { ok: true, progress: { ...p, fuel: p.fuel - skin.price, skins: [...p.skins, skin.id], skin: skin.id } };
}

/** Use one +10 s boost, if the player has one. */
export function spendTimeBoost(p: Progress): { progress: Progress; seconds: number } {
  if (p.timeBoosts <= 0) return { progress: p, seconds: 0 };
  return { progress: { ...p, timeBoosts: p.timeBoosts - 1 }, seconds: TIME_BOOST_SECONDS };
}

// ---------- Flight path ----------

export type StageKind = 'lesson' | 'crate' | 'boss';

export interface StageDef {
  id: string;
  kind: StageKind;
  label: string;
  level: number; // difficulty 0..10
}

export interface SectorDef {
  id: string;
  name: string;
  topic: string; // problem topic for this sector's stages
  stages: StageDef[];
}

export type StageState = 'done' | 'current' | 'locked';

/** Stages unlock one after another inside a sector; every sector is open from the start. */
export function sectorNodes(sector: SectorDef, p: Progress): { stage: StageDef; state: StageState; stars: number }[] {
  let open = true;
  return sector.stages.map((stage) => {
    const stars = p.stages[stage.id] ?? 0;
    const state: StageState = stars > 0 ? 'done' : open ? 'current' : 'locked';
    if (stars === 0) open = false;
    return { stage, state, stars };
  });
}

export const sectorDone = (sector: SectorDef, p: Progress) => sector.stages.filter((s) => (p.stages[s.id] ?? 0) > 0).length;

export function completeStage(p: Progress, stageId: string, stars: number): Progress {
  const best = Math.max(p.stages[stageId] ?? 0, Math.max(1, Math.min(3, stars)));
  return { ...p, stages: { ...p.stages, [stageId]: best } };
}

/** Stars for a 10-problem lesson: no misses = 3, up to 2 = 2, otherwise 1. */
export const lessonStars = (misses: number) => (misses === 0 ? 3 : misses <= 2 ? 2 : 1);

/** Boss round (60 s): pass at 15 correct; 20 = 2 stars, 25 = 3 stars. */
export const BOSS_PASS = 15;
export const bossStars = (score: number) => (score >= 25 ? 3 : score >= 20 ? 2 : score >= BOSS_PASS ? 1 : 0);

/** The next stage to play in a sector, or null when the sector is finished. */
export const nextStage = (sector: SectorDef, p: Progress) => sectorNodes(sector, p).find((n) => n.state === 'current') ?? null;

// Deterministic random numbers so the daily puzzle is the same for everyone.

export type Rng = () => number;

/** mulberry32: small, fast, good enough for games. Returns floats in [0, 1). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max], inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Hash a string to a 32-bit seed (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Today's date in UTC as YYYY-MM-DD, so everyone worldwide shares one daily puzzle. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Daily puzzle number, counted from launch day (#1). */
export const LAUNCH_DAY = '2026-11-16';
export function dayNumber(key: string = todayKey()): number {
  const ms = Date.parse(key) - Date.parse(LAUNCH_DAY);
  return Math.floor(ms / 86_400_000) + 1;
}

export function dailySeed(gameSlug: string, key: string = todayKey()): number {
  return hashSeed(`${gameSlug}:${key}`);
}

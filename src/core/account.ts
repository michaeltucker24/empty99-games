// Optional player accounts (Supabase). Accounts are opt-in: the game works fully
// without one, and the Supabase library only loads once a player starts saving
// or already has a saved session. Email sign-in uses a one-time code typed into
// the game (works even when the email opens on another device).

import type { SupabaseClient } from '@supabase/supabase-js';
import { readJSON, writeJSON } from './storage';
import type { Progress } from './progress';

// Public values (safe to ship): the project URL and its publishable key.
// Row-level security in the database decides what each player can touch.
const SUPABASE_URL: string = import.meta.env.PUBLIC_SUPABASE_URL ?? 'https://cohifrxwezbzowtonqkv.supabase.co';
const SUPABASE_KEY: string = import.meta.env.PUBLIC_SUPABASE_KEY ?? 'sb_publishable_gctldXhrrdD7FqyKL0rPQg_vn1az1Cn';
const AUTH_KEY = 'e99:auth';

export const accountsEnabled = () => Boolean(SUPABASE_URL && SUPABASE_KEY);

let clientPromise: Promise<SupabaseClient> | null = null;
function client(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_KEY },
    }),
  );
  return clientPromise;
}

/** True if this browser holds a saved sign-in (checked without loading the library). */
export const hasStoredSession = () => {
  try {
    return accountsEnabled() && !!globalThis.localStorage?.getItem(AUTH_KEY);
  } catch {
    return false;
  }
};

export interface Account {
  id: string;
  email: string | null;
  nickname: string | null;
}

export async function currentAccount(): Promise<Account | null> {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const { data: prof } = await sb.from('profiles').select('nickname').eq('id', user.id).maybeSingle();
  return { id: user.id, email: user.email ?? null, nickname: prof?.nickname ?? null };
}

export async function sendCode(email: string): Promise<string | null> {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? friendly(error.message) : null;
}

export async function verifyCode(email: string, code: string): Promise<{ account: Account | null; error: string | null }> {
  const sb = await client();
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) return { account: null, error: friendly(error.message) };
  return { account: await currentAccount(), error: null };
}

export async function saveNickname(nickname: string): Promise<string | null> {
  const sb = await client();
  const { data } = await sb.auth.getUser();
  if (!data.user) return 'You are not signed in';
  const { error } = await sb.from('profiles').upsert({ id: data.user.id, nickname, age_confirmed: true });
  return error ? friendly(error.message) : null;
}

export async function pullProgress(game: string): Promise<Partial<Progress> | null> {
  const sb = await client();
  const { data } = await sb.from('game_progress').select('data').eq('game', game).maybeSingle();
  return (data?.data as Partial<Progress>) ?? null;
}

export async function pushProgress(game: string, progress: Progress): Promise<boolean> {
  const sb = await client();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return false;
  const { error } = await sb.from('game_progress').upsert({ user_id: u.user.id, game, data: progress });
  return !error;
}

export async function signOut(): Promise<void> {
  const sb = await client();
  await sb.auth.signOut();
}

export async function deleteAccount(): Promise<string | null> {
  const sb = await client();
  const { error } = await sb.rpc('delete_my_account');
  if (error) return friendly(error.message);
  await sb.auth.signOut({ scope: 'local' });
  return null;
}

function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('expired') || m.includes('invalid')) return 'That code didn’t work. Check it or send a new one.';
  if (m.includes('rate') || m.includes('security purposes')) return 'Too many tries. Wait a minute, then try again.';
  if (m.includes('nickname') || m.includes('check constraint')) return 'Nicknames are 3–16 letters, numbers or _.';
  return 'Something went wrong. Try again in a moment.';
}

// ---------- Nicknames ----------

const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'porn', 'sex', 'dick', 'cock', 'pussy', 'slut', 'whore', 'retard', 'kys'];

export function nicknameProblem(name: string): string | null {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return 'Use 3–16 letters, numbers or _';
  const flat = name.toLowerCase().replace(/[_0-9]/g, (c) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', _: '' })[c] ?? '');
  if (BLOCKED.some((w) => flat.includes(w))) return 'Pick a different nickname';
  return null;
}

export function suggestNickname(rand = Math.random): string {
  const a = ['Speedy', 'Swift', 'Clever', 'Rapid', 'Turbo', 'Sharp', 'Lucky', 'Cosmic', 'Quick', 'Bright'];
  const b = ['Comet', 'Rocket', 'Pilot', 'Orbit', 'Nova', 'Meteor', 'Astro', 'Quasar', 'Pulsar', 'Zenith'];
  return `${a[Math.floor(rand() * a.length)]}${b[Math.floor(rand() * b.length)]}${Math.floor(rand() * 90 + 10)}`;
}

// ---------- Age check (13+) ----------

export type AgeStatus = 'ok' | 'under' | null;
export const ageStatus = (): AgeStatus => readJSON<AgeStatus>('e99:age', null);
export const setAgeStatus = (s: Exclude<AgeStatus, null>) => writeJSON('e99:age', s);

/** Conservative: anyone who might still be 12 this year counts as under 13. */
export const isUnder13 = (birthYear: number, thisYear = new Date().getUTCFullYear()) => birthYear > thisYear - 14;

// ---------- When to show the "save your progress" pop-up ----------

interface PromptMemo {
  lastShown: number;
  snoozeUntil: number;
}
const DAY_MS = 86_400_000;
const memo = () => readJSON<PromptMemo>('e99:save-prompt', { lastShown: 0, snoozeUntil: 0 });

/**
 * Show the pop-up on a result screen only when there is something to lose
 * (a 2+ day streak, level 2+, or about 15 minutes of play), at most once a day,
 * and never within 3 days of "Not now". (Callers also skip it when accounts are
 * off, the player is signed in, or the age check said under 13.)
 */
export function shouldPromptSave(
  p: Pick<Progress, 'dailyStreak' | 'plays'>,
  level: number,
  now = Date.now(),
  m: PromptMemo = memo(),
): boolean {
  const worthSaving = p.dailyStreak >= 2 || level >= 2 || p.plays >= 8;
  return worthSaving && now >= m.snoozeUntil && now - m.lastShown >= DAY_MS;
}

export const markPromptShown = (now = Date.now()) => writeJSON('e99:save-prompt', { ...memo(), lastShown: now });
export const snoozePrompt = (now = Date.now()) => writeJSON('e99:save-prompt', { lastShown: now, snoozeUntil: now + 3 * DAY_MS });

import { describe, expect, it } from 'vitest';
import { isUnder13, nicknameProblem, shouldPromptSave, suggestNickname } from './account';
import { emptyProgress, mergeProgress } from './progress';

describe('age check', () => {
  it('treats anyone who could still be 12 as under 13', () => {
    expect(isUnder13(2013, 2026)).toBe(true);
    expect(isUnder13(2012, 2026)).toBe(false);
    expect(isUnder13(1990, 2026)).toBe(false);
  });
});

describe('nicknames', () => {
  it('allows simple names and blocks bad ones', () => {
    expect(nicknameProblem('SpeedyComet42')).toBeNull();
    expect(nicknameProblem('ab')).not.toBeNull();
    expect(nicknameProblem('has space')).not.toBeNull();
    expect(nicknameProblem('sh1t_lord')).not.toBeNull();
    for (let i = 0; i < 50; i++) expect(nicknameProblem(suggestNickname())).toBeNull();
  });
});

describe('save prompt', () => {
  const day = 86_400_000;
  const now = 100 * day;
  const fresh = { lastShown: 0, snoozeUntil: 0 };
  it('waits until there is something to lose', () => {
    expect(shouldPromptSave({ dailyStreak: 1, plays: 2 }, 1, now, fresh)).toBe(false);
    expect(shouldPromptSave({ dailyStreak: 2, plays: 2 }, 1, now, fresh)).toBe(true);
    expect(shouldPromptSave({ dailyStreak: 0, plays: 1 }, 2, now, fresh)).toBe(true);
    expect(shouldPromptSave({ dailyStreak: 0, plays: 8 }, 1, now, fresh)).toBe(true);
  });
  it('shows at most once a day and respects "Not now"', () => {
    const p = { dailyStreak: 3, plays: 10 };
    expect(shouldPromptSave(p, 3, now, { lastShown: now - day / 2, snoozeUntil: 0 })).toBe(false);
    expect(shouldPromptSave(p, 3, now, { lastShown: now - 2 * day, snoozeUntil: now + day })).toBe(false);
    expect(shouldPromptSave(p, 3, now, { lastShown: now - 4 * day, snoozeUntil: now - 1 })).toBe(true);
  });
});

describe('mergeProgress', () => {
  it('keeps the best of both copies', () => {
    const local = {
      ...emptyProgress(),
      xp: 120,
      fuel: 40,
      badges: ['first-launch'],
      stages: { 'add-1': 2 },
      bests: { launch: 20 },
      dailyStreak: 1,
      lastDailyDay: '2026-11-17',
      playDays: ['2026-11-17'],
      skins: ['classic'],
    };
    const remote = {
      ...emptyProgress(),
      xp: 300,
      fuel: 10,
      badges: ['inferno'],
      stages: { 'add-1': 3, 'add-2': 1 },
      bests: { launch: 25, defuse: 110 },
      dailyStreak: 6,
      lastDailyDay: '2026-11-16',
      playDays: ['2026-11-15', '2026-11-16'],
      skins: ['classic', 'comet'],
      dailyResults: { '2026-11-16': 18 },
    };
    const m = mergeProgress(local, remote);
    expect(m.xp).toBe(300);
    expect(m.fuel).toBe(40);
    expect(m.badges.sort()).toEqual(['first-launch', 'inferno']);
    expect(m.stages).toEqual({ 'add-1': 3, 'add-2': 1 });
    expect(m.bests).toEqual({ launch: 25, defuse: 110 });
    expect(m.lastDailyDay).toBe('2026-11-17'); // streak from the copy that played last
    expect(m.dailyStreak).toBe(7); // 6 days on one device + today on another join up
    expect(m.playDays).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
    expect(m.skins).toEqual(['classic', 'comet']);
    expect(m.dailyResults['2026-11-16']).toBe(18);
  });
  it('does not join streaks with a gap between them', () => {
    const a = { ...emptyProgress(), dailyStreak: 2, lastDailyDay: '2026-11-17' };
    const b = { ...emptyProgress(), dailyStreak: 5, lastDailyDay: '2026-11-10' };
    expect(mergeProgress(a, b).dailyStreak).toBe(2);
  });
  it('handles an empty or old remote copy', () => {
    const local = { ...emptyProgress(), xp: 50 };
    expect(mergeProgress(local, {}).xp).toBe(50);
  });
});

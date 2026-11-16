import { describe, expect, it } from 'vitest';
import { emptyProgress, liveStreak, loadProgress, recordPlay, type Progress } from './progress';
import {
  BOSS_PASS,
  CRATE_FUEL,
  bossStars,
  buy,
  claimMission,
  claimWeekly,
  completeStage,
  dailyMissions,
  grantRound,
  lessonStars,
  levelInfo,
  levelStart,
  missionStatus,
  nextStage,
  sectorNodes,
  spendTimeBoost,
  weekStart,
  weeklyStatus,
  type MissionDef,
  type SectorDef,
} from './progression';

const POOL: MissionDef[] = [
  { id: 'xp30', label: 'Earn 30 XP', metric: 'xp', target: 30 },
  { id: 'xp50', label: 'Earn 50 XP', metric: 'xp', target: 50 },
  { id: 'r2', label: 'Finish 2 rounds', metric: 'rounds', target: 2 },
  { id: 'r3', label: 'Finish 3 rounds', metric: 'rounds', target: 3 },
  { id: 'hot', label: 'Reach Blazing heat', metric: 'heat', target: 6 },
  { id: 'daily', label: "Play today's Daily Launch", metric: 'daily', target: 1 },
  { id: 'defuse', label: 'Finish a Defuse', metric: 'mode', target: 1, mode: 'defuse' },
];

const fresh = (over: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), ...over });

describe('levels', () => {
  it('uses a growing XP curve', () => {
    expect([1, 2, 3, 4, 5].map(levelStart)).toEqual([0, 50, 150, 300, 500]);
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, need: 50 });
    expect(levelInfo(49).level).toBe(1);
    expect(levelInfo(50)).toEqual({ level: 2, into: 0, need: 100 });
    expect(levelInfo(320)).toEqual({ level: 4, into: 20, need: 200 });
  });
});

describe('grantRound', () => {
  const day = '2026-11-20';
  const now = Date.parse(`${day}T12:00:00Z`);
  it('pays XP, fuel and a level-up bonus', () => {
    const { progress, grant } = grantRound(fresh({ xp: 40 }), { baseXp: 20, maxHeat: 3, mode: 'launch' }, POOL, now, day);
    expect(grant).toEqual({ xp: 20, fuel: 10 + 50, boosted: false, levelUp: 2 });
    expect(progress.xp).toBe(60);
    expect(progress.fuel).toBe(60);
  });
  it('doubles XP while Afterburner is on', () => {
    const { grant } = grantRound(fresh({ boostUntil: now + 1000 }), { baseXp: 10, maxHeat: 0, mode: 'launch' }, POOL, now, day);
    expect(grant.xp).toBe(20);
    expect(grant.boosted).toBe(true);
  });
});

describe('missions', () => {
  const day = '2026-11-20';
  it('picks 3 missions per day, one of them XP, deterministically', () => {
    const a = dailyMissions(POOL, day);
    expect(a).toHaveLength(3);
    expect(a[0].metric).toBe('xp');
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
    expect(dailyMissions(POOL, day)).toEqual(a);
  });
  it('tracks progress and pays a crate once', () => {
    const now = Date.parse(`${day}T12:00:00Z`);
    let p = fresh();
    p = grantRound(p, { baseXp: 20, maxHeat: 7, mode: 'defuse' }, POOL, now, day).progress;
    p = grantRound(p, { baseXp: 15, maxHeat: 2, daily: true, mode: 'launch' }, POOL, now, day).progress;
    const get = (id: string) => missionStatus(p, POOL.find((m) => m.id === id)!, day);
    expect(get('xp30').done).toBe(true);
    expect(get('xp50').value).toBe(35);
    expect(get('r2').done).toBe(true);
    expect(get('hot').done).toBe(true);
    expect(get('daily').done).toBe(true);
    expect(get('defuse').done).toBe(true);
    const fuel = p.fuel;
    const c = claimMission(p, POOL[0], day);
    expect(c.fuel).toBe(CRATE_FUEL);
    expect(c.progress.fuel).toBe(fuel + CRATE_FUEL);
    expect(claimMission(c.progress, POOL[0], day).fuel).toBe(0); // only once
    expect(claimMission(p, POOL[1], day).fuel).toBe(0); // not finished
  });
  it('resets the next day', () => {
    const now = Date.parse(`${day}T12:00:00Z`);
    const p = grantRound(fresh(), { baseXp: 40, maxHeat: 0, mode: 'launch' }, POOL, now, day).progress;
    expect(missionStatus(p, POOL[0], '2026-11-21').value).toBe(0);
  });
});

describe('streak shields', () => {
  it('spends shields to cover missed days', () => {
    let p = fresh({ shields: 2 });
    p = recordPlay(p, '2026-11-20');
    p = recordPlay(p, '2026-11-21');
    expect(liveStreak(p, '2026-11-24')).toBe(2); // 2 missed days, 2 shields: still alive
    p = recordPlay(p, '2026-11-24');
    expect(p.dailyStreak).toBe(3);
    expect(p.shields).toBe(0);
    expect(p.shieldDays).toEqual(['2026-11-22', '2026-11-23']);
  });
  it('resets when the gap is bigger than the shields', () => {
    let p = fresh({ shields: 1 });
    p = recordPlay(p, '2026-11-20');
    expect(liveStreak(p, '2026-11-23')).toBe(0);
    p = recordPlay(p, '2026-11-23');
    expect(p.dailyStreak).toBe(1);
    expect(p.shields).toBe(1); // not spent on a lost streak
  });
  it('counts a day once', () => {
    let p = recordPlay(fresh(), '2026-11-20');
    p = recordPlay(p, '2026-11-20');
    expect(p.dailyStreak).toBe(1);
    expect(p.playDays).toEqual(['2026-11-20']);
  });
});

describe('weekly challenge', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
  });
  it('pays once after 5 play days in the week', () => {
    let p = fresh();
    for (const d of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']) p = recordPlay(p, d);
    expect(weeklyStatus(p, '2026-11-19').days).toBe(4);
    expect(claimWeekly(p, '2026-11-19').fuel).toBe(0);
    p = recordPlay(p, '2026-11-21');
    const c = claimWeekly(p, '2026-11-21');
    expect(c.fuel).toBe(100);
    expect(claimWeekly(c.progress, '2026-11-22').fuel).toBe(0);
    expect(weeklyStatus(c.progress, '2026-11-23').days).toBe(0); // new week
  });
});

describe('shop', () => {
  it('sells shields up to 2', () => {
    let r = buy(fresh({ fuel: 450 }), 'shield');
    expect(r.ok && r.progress.shields).toBe(1);
    r = buy(r.ok ? r.progress : fresh(), 'shield');
    expect(r.ok && r.progress.fuel).toBe(50);
    const third = buy(fresh({ fuel: 999, shields: 2 }), 'shield');
    expect(third.ok).toBe(false);
  });
  it('refuses when fuel is short', () => {
    const r = buy(fresh({ fuel: 10 }), 'afterburner');
    expect(r.ok).toBe(false);
  });
  it('starts or extends Afterburner', () => {
    const now = 1_000_000;
    const r = buy(fresh({ fuel: 300 }), 'afterburner', now);
    expect(r.ok && r.progress.boostUntil).toBe(now + 15 * 60_000);
  });
  it('buys, equips and streak-unlocks skins', () => {
    const r = buy(fresh({ fuel: 600 }), 'comet');
    expect(r.ok && r.progress.skin).toBe('comet');
    expect(r.ok && r.progress.fuel).toBe(100);
    const back = buy(r.ok ? r.progress : fresh(), 'classic');
    expect(back.ok && back.progress.skin).toBe('classic');
    expect(buy(fresh({ bestDailyStreak: 5 }), 'golden').ok).toBe(false);
    expect(buy(fresh({ bestDailyStreak: 30 }), 'golden').ok).toBe(true);
  });
  it('spends time boosts one at a time', () => {
    const r = spendTimeBoost(fresh({ timeBoosts: 1 }));
    expect(r.seconds).toBe(10);
    expect(spendTimeBoost(r.progress).seconds).toBe(0);
  });
});

describe('flight path', () => {
  const sector: SectorDef = {
    id: 'add',
    name: 'Addition',
    topic: 'addition',
    stages: [
      { id: 'add-1', kind: 'lesson', label: 'Warm-up', level: 1 },
      { id: 'add-2', kind: 'crate', label: 'Crate', level: 0 },
      { id: 'add-3', kind: 'boss', label: 'Boss', level: 5 },
    ],
  };
  it('unlocks stages in order', () => {
    let p = fresh();
    expect(sectorNodes(sector, p).map((n) => n.state)).toEqual(['current', 'locked', 'locked']);
    p = completeStage(p, 'add-1', 2);
    expect(sectorNodes(sector, p).map((n) => n.state)).toEqual(['done', 'current', 'locked']);
    expect(nextStage(sector, p)?.stage.id).toBe('add-2');
    p = completeStage(p, 'add-1', 1); // replays keep the best stars
    expect(p.stages['add-1']).toBe(2);
  });
  it('scores lessons and bosses', () => {
    expect([0, 1, 2, 3, 9].map(lessonStars)).toEqual([3, 2, 2, 1, 1]);
    expect(bossStars(BOSS_PASS - 1)).toBe(0);
    expect([15, 20, 25].map(bossStars)).toEqual([1, 2, 3]);
  });
});

describe('old saves', () => {
  it('load with progression defaults', () => {
    const p = loadProgress('nothing-saved');
    expect(p.xp).toBe(0);
    expect(p.skin).toBe('classic');
    expect(p.missions.claimed).toEqual([]);
  });
});

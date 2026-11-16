import { describe, expect, it } from 'vitest';
import { makeRng, dailySeed, dayNumber } from '../../core/seed';
import { generate, dailyProblem, TOPICS } from './logic';
import { initialHeat, onCorrect, onMiss, levelOf, stageFor } from '../../core/heat';
import { recordDaily, liveStreak, loadProgress } from '../../core/progress';

// Evaluate a prompt independently of the generator to check answers.
function evaluate(prompt: string): number {
  let m;
  if ((m = prompt.match(/^(\d+) \+ (\d+)$/))) return +m[1] + +m[2];
  if ((m = prompt.match(/^(\d+) − (\d+)$/))) return +m[1] - +m[2];
  if ((m = prompt.match(/^(\d+) × (\d+)$/))) return +m[1] * +m[2];
  if ((m = prompt.match(/^(\d+) ÷ (\d+)$/))) return +m[1] / +m[2];
  if ((m = prompt.match(/^(\d+)% of (\d+)$/))) return (+m[1] * +m[2]) / 100;
  if ((m = prompt.match(/^(\d+)% tip on \$(\d+)$/))) return (+m[1] * +m[2]) / 100;
  if ((m = prompt.match(/^\$(\d+) split (\d+) ways$/))) return +m[1] / +m[2];
  if ((m = prompt.match(/^\$(\d+) with (\d+)% off$/))) return +m[1] - (+m[1] * +m[2]) / 100;
  if ((m = prompt.match(/^Pay \$(\d+) for \$(\d+)$/))) return +m[1] - +m[2];
  throw new Error(`Unparsed prompt: ${prompt}`);
}

describe('mental math generator', () => {
  const topics = TOPICS.map((t) => t.id);
  it('every answer is correct, whole and positive, across all topics and levels', () => {
    const rng = makeRng(42);
    for (const topic of topics) {
      for (let level = 0; level <= 10; level++) {
        for (let i = 0; i < 300; i++) {
          const p = generate(rng, level, topic);
          expect(Number.isInteger(p.answer), p.prompt).toBe(true);
          expect(p.answer, p.prompt).toBeGreaterThan(0);
          expect(evaluate(p.prompt), p.prompt).toBe(p.answer);
        }
      }
    }
  });

  it('higher levels give bigger numbers on average', () => {
    const avg = (level: number) => {
      const rng = makeRng(7);
      let sum = 0;
      for (let i = 0; i < 500; i++) sum += generate(rng, level, 'multiplication').answer;
      return sum / 500;
    };
    expect(avg(10)).toBeGreaterThan(avg(0) * 3);
  });

  it('daily problems are identical for everyone on the same day', () => {
    const a = makeRng(dailySeed('mental-math', '2026-11-20'));
    const b = makeRng(dailySeed('mental-math', '2026-11-20'));
    for (let i = 0; i < 50; i++) expect(dailyProblem(a, i)).toEqual(dailyProblem(b, i));
  });

  it('different days give different daily problems', () => {
    const a = makeRng(dailySeed('mental-math', '2026-11-20'));
    const b = makeRng(dailySeed('mental-math', '2026-11-21'));
    const pa = Array.from({ length: 10 }, (_, i) => dailyProblem(a, i).prompt).join();
    const pb = Array.from({ length: 10 }, (_, i) => dailyProblem(b, i).prompt).join();
    expect(pa).not.toBe(pb);
  });

  it('day numbers start at 1 on launch day', () => {
    expect(dayNumber('2026-11-16')).toBe(1);
    expect(dayNumber('2026-11-26')).toBe(11);
  });
});

describe('heat meter', () => {
  it('heats up with streaks and cools on misses, within bounds', () => {
    let s = initialHeat();
    for (let i = 0; i < 20; i++) s = onCorrect(s);
    expect(s.heat).toBe(10);
    expect(stageFor(s.heat).name).toBe('Inferno');
    s = onMiss(s);
    expect(s.heat).toBe(8.5);
    expect(s.combo).toBe(0);
    for (let i = 0; i < 20; i++) s = onMiss(s);
    expect(s.heat).toBe(0);
    expect(levelOf(s)).toBe(0);
  });
});

describe('daily streaks', () => {
  it('counts consecutive days and resets after a gap', () => {
    let p = loadProgress('test');
    p = recordDaily(p, 20, '2026-11-20');
    p = recordDaily(p, 25, '2026-11-21');
    expect(p.dailyStreak).toBe(2);
    p = recordDaily(p, 30, '2026-11-21'); // replay same day: no change
    expect(p.dailyStreak).toBe(2);
    expect(p.dailyResults['2026-11-21']).toBe(25);
    expect(liveStreak(p, '2026-11-23')).toBe(0);
    p = recordDaily(p, 10, '2026-11-24');
    expect(p.dailyStreak).toBe(1);
    expect(p.bestDailyStreak).toBe(2);
  });
});

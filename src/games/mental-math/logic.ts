// Mental Math Sprint: problem generation. Pure functions, fully tested.
// Every answer is a whole number so it can be typed fast on a keypad.

import type { Problem, Topic, GameDefinition } from '../../core/contract';
import { pick, randInt, type Rng } from '../../core/seed';

export const TOPICS: Topic[] = [
  { id: 'mixed', name: 'Mixed', path: '', blurb: 'A bit of everything' },
  { id: 'addition', name: 'Addition', path: 'addition', blurb: 'Add big numbers in your head' },
  { id: 'subtraction', name: 'Subtraction', path: 'subtraction', blurb: 'Fast, clean take-aways' },
  { id: 'multiplication', name: 'Multiplication', path: 'multiplication', blurb: 'Times tables and beyond' },
  { id: 'division', name: 'Division', path: 'division', blurb: 'Split numbers without a calculator' },
  { id: 'percentages', name: 'Percentages', path: 'percentages', blurb: 'Percent of anything, fast' },
  { id: 'real-life', name: 'Real Life Math', path: 'real-life-math', blurb: 'Tips, bill splits and sale prices' },
];

const ARITH = ['addition', 'subtraction', 'multiplication', 'division'] as const;
const L = (level: number) => Math.max(0, Math.min(10, Math.floor(level)));

export function addition(rng: Rng, level: number): Problem {
  const hi = 9 + L(level) * 12; // 9 .. 129
  const a = randInt(rng, 2, hi);
  const b = randInt(rng, 2, hi);
  return { prompt: `${a} + ${b}`, answer: a + b, topic: 'addition' };
}

export function subtraction(rng: Rng, level: number): Problem {
  const hi = 12 + L(level) * 12;
  const a = randInt(rng, 4, hi);
  const b = randInt(rng, 2, a - 1);
  return { prompt: `${a} − ${b}`, answer: a - b, topic: 'subtraction' };
}

export function multiplication(rng: Rng, level: number): Problem {
  const l = L(level);
  const a = randInt(rng, 2, 5 + l); // 2..15
  const b = randInt(rng, 2, 9 + Math.ceil(l * 1.6)); // 2..25
  return { prompt: `${a} × ${b}`, answer: a * b, topic: 'multiplication' };
}

export function division(rng: Rng, level: number): Problem {
  const l = L(level);
  const d = randInt(rng, 2, 5 + l);
  const q = randInt(rng, 2, 9 + Math.ceil(l * 1.6));
  return { prompt: `${d * q} ÷ ${d}`, answer: q, topic: 'division' };
}

/** Percent of a number, chosen so the answer is whole. */
export function percentages(rng: Rng, level: number): Problem {
  const l = L(level);
  const easy = [10, 50, 25, 20];
  const mid = [5, 15, 30, 40, 75];
  const hard = [12, 35, 45, 60, 80, 120];
  const pool = l < 3 ? easy : l < 7 ? [...easy, ...mid] : [...mid, ...hard];
  const p = pick(rng, pool);
  // base must make p% whole: base multiple of 100/gcd(p,100)
  const step = 100 / gcd(p, 100);
  const maxMult = Math.max(2, Math.floor((40 + l * 40) / step));
  const base = step * randInt(rng, 1, maxMult);
  return { prompt: `${p}% of ${base}`, answer: (p * base) / 100, topic: 'percentages' };
}

/** Everyday money math: tips, splits, sale prices. Answers in whole dollars. */
export function realLife(rng: Rng, level: number): Problem {
  const l = L(level);
  const kind = pick(rng, ['tip', 'split', 'sale', 'change'] as const);
  if (kind === 'tip') {
    const pct = pick(rng, l < 4 ? [10, 20] : [15, 18, 20, 25]);
    const step = 100 / gcd(pct, 100);
    const bill = step * randInt(rng, 1, Math.max(2, Math.floor((40 + l * 12) / step)));
    return {
      prompt: `${pct}% tip on $${bill}`,
      answer: (pct * bill) / 100,
      topic: 'real-life',
      context: `Dinner came to $${bill}. You leave a ${pct}% tip. How much is the tip?`,
    };
  }
  if (kind === 'split') {
    const people = randInt(rng, 2, l < 4 ? 4 : 6);
    const each = randInt(rng, 8, 20 + l * 6);
    return {
      prompt: `$${people * each} split ${people} ways`,
      answer: each,
      topic: 'real-life',
      context: `The bill is $${people * each} for ${people} friends. Each pays the same. How much each?`,
    };
  }
  if (kind === 'sale') {
    const off = pick(rng, l < 4 ? [10, 25, 50] : [15, 20, 30, 40, 60]);
    const step = 100 / gcd(off, 100);
    const price = step * randInt(rng, 1, Math.max(2, Math.floor((60 + l * 20) / step)));
    return {
      prompt: `$${price} with ${off}% off`,
      answer: price - (off * price) / 100,
      topic: 'real-life',
      context: `A jacket costs $${price}. It's ${off}% off today. What do you pay?`,
    };
  }
  const cost = randInt(rng, 3, Math.min(99, 30 + l * 10));
  const paid = [20, 50, 100].find((n) => n > cost) ?? 100;
  return {
    prompt: `Pay $${paid} for $${cost}`,
    answer: paid - cost,
    topic: 'real-life',
    context: `Your total is $${cost}. You hand over $${paid}. How much change?`,
  };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

const BY_TOPIC: Record<string, (rng: Rng, level: number) => Problem> = {
  addition,
  subtraction,
  multiplication,
  division,
  percentages,
  'real-life': realLife,
};

export function generate(rng: Rng, level: number, topicId: string): Problem {
  if (topicId === 'mixed') {
    // Percentages join the mix once the player is warmed up.
    const pool: string[] = L(level) >= 4 ? [...ARITH, 'percentages'] : [...ARITH];
    return BY_TOPIC[pick(rng, pool)](rng, level);
  }
  const fn = BY_TOPIC[topicId];
  if (!fn) throw new Error(`Unknown topic: ${topicId}`);
  return fn(rng, level);
}

/** The daily Launch: same problems for everyone. Difficulty ramps by question number, not by player. */
export function dailyProblem(rng: Rng, index: number): Problem {
  const level = Math.min(10, Math.floor(index / 4));
  return generate(rng, level, 'mixed');
}

export const mentalMath: GameDefinition = {
  slug: 'mental-math',
  name: 'Mental Math Sprint',
  accent: '#2D6BFF',
  topics: TOPICS,
  generate,
  shareText: ({ mode, score, extra, day }) => {
    if (mode === 'launch') return `Mental Math Sprint #${day} 🚀 ${score} correct in 60s${extra ? ` · ${extra}` : ''}`;
    if (mode === 'defuse') return `I defused the math bomb 💣 ${extra ?? ''}`.trim();
    return `Mental Math Sprint: ${score} correct${extra ? ` · ${extra}` : ''}`;
  },
};

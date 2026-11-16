// Shared round engine: current problem, typed input, heat meter, score, misses.
// Answers auto-submit the moment they're right (no Enter key), Zetamac-style.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Problem } from '../core/contract';
import { initialHeat, levelOf, onCorrect, onMiss, type HeatState } from '../core/heat';
import { sfx } from '../core/sound';

export type Flash = 'good' | 'bad' | null;

export interface RoundOptions {
  /** Next problem for this question number at this difficulty level. */
  next: (index: number, level: number) => Problem;
  startHeat?: number;
  active: boolean;
  onCorrect?: (p: Problem, combo: number) => void;
  onMiss?: (p: Problem) => void;
}

export function useRound({ next, startHeat = 0, active, onCorrect: hc, onMiss: hm }: RoundOptions) {
  const [heat, setHeat] = useState<HeatState>(() => initialHeat(startHeat));
  const [index, setIndex] = useState(0);
  const [problem, setProblem] = useState<Problem>(() => next(0, Math.floor(startHeat)));
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<Problem[]>([]);
  const [flash, setFlash] = useState<{ kind: Flash; id: number }>({ kind: null, id: 0 });
  const missedThis = useRef(false);
  const state = useRef({ heat, index, problem, input });
  state.current = { heat, index, problem, input };

  const advance = useCallback(
    (h: HeatState) => {
      const i = state.current.index + 1;
      setIndex(i);
      setProblem(next(i, levelOf(h)));
      setInput('');
      missedThis.current = false;
    },
    [next],
  );

  const registerMiss = useCallback(() => {
    const p = state.current.problem;
    const h = onMiss(state.current.heat);
    setHeat(h);
    setFlash((f) => ({ kind: 'bad', id: f.id + 1 }));
    sfx.miss();
    if (!missedThis.current) {
      missedThis.current = true;
      setMissed((m) => [...m, p]);
    }
    hm?.(p);
    return h;
  }, [hm]);

  const press = useCallback(
    (key: string) => {
      if (!active) return;
      const { problem: p, input: cur } = state.current;
      if (key === 'back') return setInput(cur.slice(0, -1));
      if (key === 'skip') {
        const h = registerMiss();
        return advance(h);
      }
      if (!/^\d$/.test(key)) return;
      const nextInput = (cur + key).slice(0, 7);
      const target = String(p.answer);
      if (nextInput === target) {
        const h = onCorrect(state.current.heat);
        setHeat(h);
        setScore((s) => s + 1);
        setFlash((f) => ({ kind: 'good', id: f.id + 1 }));
        sfx.correct(h.combo);
        hc?.(p, h.combo);
        advance(h);
      } else if (nextInput.length >= target.length) {
        registerMiss();
        setInput('');
      } else {
        setInput(nextInput);
      }
    },
    [active, advance, registerMiss, hc],
  );

  // Physical keyboard support.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter' && state.current.input === '') press('skip');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, press]);

  return { heat, index, problem, input, score, missed, flash, press };
}

/** Countdown in tenths of a second. `adjust` adds/removes time (negative = burn faster). */
export function useCountdown(seconds: number, running: boolean, onEnd: () => void) {
  const [left, setLeft] = useState(seconds * 10);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id);
          setTimeout(() => endRef.current(), 0);
          return 0;
        }
        return l - 1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [running]);
  const adjust = useCallback((deltaSeconds: number) => setLeft((l) => Math.max(1, l + deltaSeconds * 10)), []);
  return { tenths: left, seconds: Math.ceil(left / 10), adjust };
}

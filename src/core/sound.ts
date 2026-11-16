// Tiny synthesized sound effects (no audio files to load). Muted state is remembered.

import { readJSON, writeJSON } from './storage';

let ctx: AudioContext | null = null;
let muted = readJSON<boolean>('e99:muted', false);

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  writeJSON('e99:muted', m);
}

function tone(freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.08, slideTo?: number) {
  if (muted || typeof window === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + ms / 1000);
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* audio blocked; play silently */
  }
}

export const sfx = {
  correct: (combo = 1) => tone(520 + Math.min(combo, 8) * 40, 110, 'triangle'),
  miss: () => tone(180, 220, 'sawtooth', 0.05, 90),
  boom: () => tone(120, 600, 'square', 0.07, 40),
  win: () => {
    tone(523, 120, 'triangle');
    setTimeout(() => tone(659, 120, 'triangle'), 110);
    setTimeout(() => tone(784, 220, 'triangle'), 220);
  },
  tick: () => tone(900, 30, 'square', 0.02),
};

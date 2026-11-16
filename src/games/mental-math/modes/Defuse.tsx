// Defuse: each right answer cuts a wire. Misses burn 5 seconds off the fuse.

import { useMemo, useRef, useState } from 'react';
import { makeRng } from '../../../core/seed';
import { generate } from '../logic';
import { useCountdown, useRound } from '../../../components/useRound';
import { ComboPop, HeatMeter, Keypad, useAnim } from '../../../components/Pieces';
import { sfx } from '../../../core/sound';
import type { RoundResult } from './Launch';

const WIRES = 10;
const FUSE = 45;
const COLORS = ['#E24B4A', '#2D6BFF', '#FFD23F', '#1D9E75', '#D4537E', '#EF9F27', '#7F77DD', '#16161A', '#5DCAA5', '#D85A30'];

export function Defuse({ topic, onDone }: { topic: string; onDone: (r: RoundResult & { won: boolean }) => void }) {
  const next = useMemo(() => {
    const rng = makeRng((Math.random() * 2 ** 32) >>> 0);
    return (_i: number, level: number) => generate(rng, Math.max(1, level), topic);
  }, [topic]);
  const [running, setRunning] = useState(true);
  const [burn, setBurn] = useState(0);
  const maxHeat = useRef(0);
  const finished = useRef(false);

  const finish = (won: boolean, score: number) => {
    if (finished.current) return;
    finished.current = true;
    setRunning(false);
    won ? sfx.win() : sfx.boom();
    setTimeout(
      () => onDone({ score, missed: round.missed, maxHeat: maxHeat.current, won, extra: { timeLeft: timer.seconds } }),
      won ? 700 : 900,
    );
  };

  const round = useRound({
    next,
    active: running,
    onCorrect: () => {
      if (round.score + 1 >= WIRES) finish(true, WIRES);
    },
    onMiss: () => {
      timer.adjust(-5);
      setBurn((b) => b + 1);
    },
  });
  maxHeat.current = Math.max(maxHeat.current, round.heat.heat);
  const timer = useCountdown(FUSE, running, () => finish(false, round.score));
  const burnAnim = useAnim(burn);
  const anim = useAnim(round.flash.id);
  const exploded = !running && round.score < WIRES;
  const fusePct = (timer.tenths / (FUSE * 10)) * 100;

  return (
    <div className={`stage ${anim ? (round.flash.kind === 'good' ? 'flash-good' : 'flash-bad') : ''}`}>
      <div className="hud">
        <span>💣 Defuse</span>
        <span className={`timer ${timer.seconds <= 10 ? 'low' : ''}`}>{timer.seconds}s</span>
        <span>✂️ {round.score}/{WIRES}</span>
      </div>
      <div className={`bomb ${exploded ? 'boom' : ''}`} aria-hidden="true">
        <div className="fuse">
          <div className="fuse-left" style={{ width: `${fusePct}%` }} />
          <span className="spark" style={{ left: `${fusePct}%` }}>✨</span>
        </div>
        {burnAnim && <span key={burn} className="minus floatup">−5s</span>}
        <div className="wires">
          {Array.from({ length: WIRES }, (_, i) => (
            <div key={i} className={`wire ${i < round.score ? 'cut' : ''}`} style={{ background: COLORS[i] }}>
              <span />
            </div>
          ))}
        </div>
        {exploded && <div className="boomtext">BOOM!</div>}
      </div>
      <ComboPop combo={round.heat.combo} id={round.flash.kind === 'good' ? round.flash.id : 0} />
      <div className="problem">
        <div className="q">{round.problem.prompt}</div>
      </div>
      <div className={`answer caret ${anim && round.flash.kind === 'bad' ? 'shake' : ''}`}>{round.input}</div>
      <HeatMeter heat={round.heat} flashKind={round.flash.kind} flashId={round.flash.id} />
      <Keypad onKey={round.press} />
    </div>
  );
}

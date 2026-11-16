// A flight path lesson: 10 problems, no clock. Stars come from how few misses you make.

import { useEffect, useMemo, useRef, useState } from 'react';
import { makeRng } from '../../../core/seed';
import { generate } from '../logic';
import { useRound } from '../../../components/useRound';
import { ComboPop, HeatMeter, Keypad, useAnim } from '../../../components/Pieces';
import { Bar } from '../../../components/Chrome';
import { LESSON_PROBLEMS } from '../path';
import type { RoundResult } from './Launch';

interface Props {
  topic: string;
  level: number;
  title: string;
  onDone: (r: RoundResult) => void;
}

export function Stage({ topic, level, title, onDone }: Props) {
  const next = useMemo(() => {
    const rng = makeRng((Math.random() * 2 ** 32) >>> 0);
    // Stay near the stage's level; a hot streak nudges it up by one at most.
    return (_i: number, heatLevel: number) => generate(rng, level + (heatLevel >= 6 ? 1 : 0), topic);
  }, [topic, level]);
  const [running, setRunning] = useState(true);
  const maxHeat = useRef(0);
  const round = useRound({ next, active: running });
  maxHeat.current = Math.max(maxHeat.current, round.heat.heat);
  const done = Math.min(round.index, LESSON_PROBLEMS);

  const finished = useRef(false);
  useEffect(() => {
    if (finished.current || round.index < LESSON_PROBLEMS) return;
    finished.current = true;
    setRunning(false);
    // Not cleared on re-render: stopping the round re-renders, and the finish must still fire.
    setTimeout(() => onDone({ score: round.score, missed: round.missed, maxHeat: maxHeat.current }), 450);
  }, [round.index]); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnim(round.flash.id);
  const flashCls = anim ? (round.flash.kind === 'good' ? 'flash-good' : 'flash-bad') : '';

  return (
    <div className={`stage ${flashCls}`}>
      <div className="hud">
        <span>{title}</span>
        <span>
          {done}/{LESSON_PROBLEMS}
        </span>
      </div>
      <div style={{ padding: '0 14px 6px' }}>
        <Bar value={done} max={LESSON_PROBLEMS} color="var(--ink)" label="Lesson progress" />
      </div>
      <ComboPop combo={round.heat.combo} id={round.flash.kind === 'good' ? round.flash.id : 0} />
      <div className="problem">
        <div className="q">{round.problem.prompt}</div>
        {round.problem.context && <p className="ctx">{round.problem.context}</p>}
      </div>
      <div className={`answer caret ${anim && round.flash.kind === 'bad' ? 'shake' : ''}`}>{round.input}</div>
      <HeatMeter heat={round.heat} flashKind={round.flash.kind} flashId={round.flash.id} />
      <Keypad onKey={round.press} />
    </div>
  );
}

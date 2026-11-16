// Launch: answer fast to fuel the rocket. Daily version = same problems for everyone.

import { useMemo, useRef, useState } from 'react';
import type { Problem } from '../../../core/contract';
import { dailySeed, makeRng } from '../../../core/seed';
import { dailyProblem, generate } from '../logic';
import { useCountdown, useRound } from '../../../components/useRound';
import { ComboPop, HeatMeter, Keypad, useAnim } from '../../../components/Pieces';
import { Rocket } from '../../../components/Rocket';

export interface RoundResult {
  score: number;
  missed: Problem[];
  maxHeat: number;
  extra?: Record<string, number>;
}

interface Props {
  daily: boolean;
  seconds: number;
  topic: string;
  title?: string;
  skin?: string;
  onDone: (r: RoundResult) => void;
}

export function Launch({ daily, seconds, topic, title, skin, onDone }: Props) {
  const next = useMemo(() => {
    if (daily) {
      const rng = makeRng(dailySeed('mental-math'));
      const list = Array.from({ length: 300 }, (_, i) => dailyProblem(rng, i));
      return (i: number) => list[i % list.length];
    }
    const rng = makeRng((Math.random() * 2 ** 32) >>> 0);
    return (_i: number, level: number) => generate(rng, level, topic);
  }, [daily, topic]);

  const [altitude, setAltitude] = useState(0);
  const maxHeat = useRef(0);
  const [running, setRunning] = useState(true);

  const round = useRound({
    next,
    active: running,
    onCorrect: (_p, combo) => setAltitude((a) => a + 100 + 25 * Math.min(combo, 8)),
  });
  maxHeat.current = Math.max(maxHeat.current, round.heat.heat);

  const timer = useCountdown(seconds, running, () => {
    setRunning(false);
    onDone({ score: round.score, missed: round.missed, maxHeat: maxHeat.current, extra: { altitude } });
  });

  const anim = useAnim(round.flash.id);
  const flashCls = anim ? (round.flash.kind === 'good' ? 'flash-good' : 'flash-bad') : '';
  const boosting = round.heat.combo >= 3;
  const rocketBottom = Math.min(62, 6 + altitude / 90);

  return (
    <div className={`stage ${flashCls}`}>
      <div className="hud">
        <span>{title ?? (daily ? 'Daily Launch' : 'Launch')}</span>
        <span className={`timer ${timer.seconds <= 10 ? 'low' : ''}`}>{timer.seconds}s</span>
        <span>✅ {round.score}</span>
      </div>
      <div className="sky" aria-hidden="true">
        <div className="stars" style={{ backgroundPositionY: `${altitude / 4}px` }} />
        <div className="rocket" style={{ bottom: `${rocketBottom}%` }}>
          <span className={`ship ${boosting ? 'boost' : ''}`}>
            <Rocket skin={skin} size={30} flame={boosting} />
          </span>
        </div>
        <div className="alt">{altitude.toLocaleString()} m</div>
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

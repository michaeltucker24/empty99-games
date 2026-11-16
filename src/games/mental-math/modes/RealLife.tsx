// Real Life Math: tips, bill splits, sale prices and change, on a receipt, against the clock.

import { useMemo, useRef, useState } from 'react';
import { makeRng } from '../../../core/seed';
import { realLife } from '../logic';
import { useCountdown, useRound } from '../../../components/useRound';
import { ComboPop, HeatMeter, Keypad, useAnim } from '../../../components/Pieces';
import type { RoundResult } from './Launch';

export function RealLife({ seconds, onDone }: { seconds: number; onDone: (r: RoundResult) => void }) {
  const next = useMemo(() => {
    const rng = makeRng((Math.random() * 2 ** 32) >>> 0);
    return (_i: number, level: number) => realLife(rng, level);
  }, []);
  const [running, setRunning] = useState(true);
  const maxHeat = useRef(0);
  const round = useRound({ next, active: running });
  maxHeat.current = Math.max(maxHeat.current, round.heat.heat);
  const timer = useCountdown(seconds, running, () => {
    setRunning(false);
    onDone({ score: round.score, missed: round.missed, maxHeat: maxHeat.current });
  });
  const anim = useAnim(round.flash.id);

  return (
    <div className={`stage ${anim ? (round.flash.kind === 'good' ? 'flash-good' : 'flash-bad') : ''}`}>
      <div className="hud">
        <span>🧾 Real Life Math</span>
        <span className={`timer ${timer.seconds <= 10 ? 'low' : ''}`}>{timer.seconds}s</span>
        <span>✅ {round.score}</span>
      </div>
      <div className="receipt" key={round.index}>
        <div className="receipt-head">RECEIPT #{String(round.index + 1).padStart(3, '0')}</div>
        <p className="receipt-ctx">{round.problem.context}</p>
        <div className="receipt-q">{round.problem.prompt}</div>
      </div>
      <ComboPop combo={round.heat.combo} id={round.flash.kind === 'good' ? round.flash.id : 0} />
      <div className={`answer caret ${anim && round.flash.kind === 'bad' ? 'shake' : ''}`}>
        {round.input ? `$${round.input}` : ''}
      </div>
      <HeatMeter heat={round.heat} flashKind={round.flash.kind} flashId={round.flash.id} />
      <Keypad onKey={round.press} />
    </div>
  );
}

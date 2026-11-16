// Small shared UI pieces: keypad, heat meter, answer line, confetti.

import { useEffect, useState } from 'react';
import { MAX_HEAT, stageFor, type HeatState } from '../core/heat';

export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', '0', 'back'];
  return (
    <div className="keypad optional" role="group" aria-label="Number keypad">
      {keys.map((k) => (
        <button
          key={k}
          className="key"
          style={k === 'skip' ? { fontSize: 15 } : undefined}
          onPointerDown={(e) => {
            e.preventDefault();
            onKey(k);
          }}
          aria-label={k === 'back' ? 'Delete' : k === 'skip' ? 'Skip' : k}
        >
          {k === 'back' ? '⌫' : k === 'skip' ? 'Skip' : k}
        </button>
      ))}
    </div>
  );
}

/** Re-triggers a CSS animation class whenever `id` changes. */
export function useAnim(id: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!id) return;
    setOn(false);
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, [id]);
  return on;
}

export function HeatMeter({ heat, flashKind, flashId }: { heat: HeatState; flashKind: 'good' | 'bad' | null; flashId: number }) {
  const stage = stageFor(heat.heat);
  const anim = useAnim(flashId);
  const cls = anim ? (flashKind === 'good' ? 'pop' : flashKind === 'bad' ? 'shake' : '') : '';
  return (
    <div className="heat" aria-live="polite">
      <div className="heat-track">
        <div className="heat-fill" style={{ width: `${(heat.heat / MAX_HEAT) * 100}%`, backgroundColor: stage.color }} />
      </div>
      <div className="heat-row">
        <span>🔥 Heat: problems get harder as you streak</span>
        <span className={`heat-name ${cls}`} style={{ color: stage.color, display: 'inline-block' }}>
          {stage.name}
        </span>
      </div>
    </div>
  );
}

export function ComboPop({ combo, id }: { combo: number; id: number }) {
  const anim = useAnim(id);
  if (combo < 3 || !anim) return null;
  return (
    <span key={id} className="combo floatup" style={{ color: stageFor(combo).color }}>
      Combo ×{combo}!
    </span>
  );
}

export function Confetti({ go }: { go: boolean }) {
  if (!go) return null;
  const colors = ['#FFD23F', '#2D6BFF', '#E24B4A', '#1D9E75', '#D4537E'];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 10) * 0.06}s`,
          }}
        />
      ))}
    </div>
  );
}

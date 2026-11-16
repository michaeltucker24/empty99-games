// Quiz (10 auto-scored questions) and Flashcards (review misses or a fresh deck).

import { useMemo, useState } from 'react';
import type { Problem } from '../../core/contract';
import { makeRng, randInt, type Rng } from '../../core/seed';
import { generate } from './logic';
import type { Miss } from '../../core/progress';
import { sfx } from '../../core/sound';

function options(rng: Rng, answer: number): number[] {
  const set = new Set<number>([answer]);
  const spread = Math.max(3, Math.round(answer * 0.15));
  while (set.size < 4) {
    const d = randInt(rng, 1, spread) * (rng() < 0.5 ? -1 : 1);
    const v = answer + d;
    if (v > 0) set.add(v);
  }
  return [...set].sort(() => rng() - 0.5);
}

export function Quiz({ topic, onDone }: { topic: string; onDone: (score: number, missed: Problem[]) => void }) {
  const qs = useMemo(() => {
    const rng = makeRng((Math.random() * 2 ** 32) >>> 0);
    return Array.from({ length: 10 }, (_, i) => {
      const p = generate(rng, 2 + Math.floor(i / 2), topic);
      return { p, opts: options(rng, p.answer) };
    });
  }, [topic]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<Problem[]>([]);
  const q = qs[i];

  const choose = (v: number) => {
    if (picked !== null) return;
    setPicked(v);
    const right = v === q.p.answer;
    right ? sfx.correct() : sfx.miss();
    const s = score + (right ? 1 : 0);
    const m = right ? missed : [...missed, q.p];
    setScore(s);
    setMissed(m);
    setTimeout(() => {
      if (i === qs.length - 1) onDone(s, m);
      else {
        setI(i + 1);
        setPicked(null);
      }
    }, right ? 550 : 1100);
  };

  return (
    <div className="stage">
      <div className="hud">
        <span>📝 Quiz</span>
        <span>
          {i + 1} / {qs.length}
        </span>
        <span>✅ {score}</span>
      </div>
      <div className="quizbar">
        <div style={{ width: `${(i / qs.length) * 100}%` }} />
      </div>
      <div className="problem" key={i}>
        {q.p.context && <p className="ctx">{q.p.context}</p>}
        <div className="q">{q.p.prompt}</div>
      </div>
      <div className="opts">
        {q.opts.map((o) => {
          const state = picked === null ? '' : o === q.p.answer ? 'right' : o === picked ? 'wrong' : 'dim';
          return (
            <button key={o} className={`opt ${state}`} onClick={() => choose(o)}>
              {q.p.topic === 'real-life' ? `$${o}` : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Flashcards({ misses, topic, onKnown, onExit }: { misses: Miss[]; topic: string; onKnown: (prompt: string) => void; onExit: () => void }) {
  const initial = useMemo(() => {
    const own = misses.filter((m) => topic === 'mixed' || m.topic === topic);
    if (own.length) return { deck: own.map((m) => ({ prompt: m.prompt, answer: m.answer, topic: m.topic })), fromMisses: true };
    const rng = makeRng((Math.random() * 2 ** 32) >>> 0);
    return { deck: Array.from({ length: 10 }, () => generate(rng, 4, topic)), fromMisses: false };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [deck, setDeck] = useState<Problem[]>(initial.deck);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const card = deck[0];

  const known = () => {
    sfx.correct();
    onKnown(card.prompt);
    setDone((d) => d + 1);
    setFlipped(false);
    setDeck((d) => d.slice(1));
  };
  const again = () => {
    setFlipped(false);
    setDeck((d) => [...d.slice(1), d[0]]);
  };

  if (!card)
    return (
      <div className="stage result">
        <div className="big">🎉</div>
        <h2>Deck cleared</h2>
        <p>You reviewed {done} cards.</p>
        <button className="btn primary" onClick={onExit}>
          Back to menu
        </button>
      </div>
    );

  return (
    <div className="stage" style={{ padding: '0 0 16px' }}>
      <div className="hud">
        <span>🃏 Flashcards</span>
        <span>{deck.length} left</span>
        <button className="btn small" onClick={onExit}>
          Done
        </button>
      </div>
      <p style={{ textAlign: 'center', margin: '0 16px 8px', color: 'var(--ink-2)', fontSize: 14 }}>
        {initial.fromMisses ? 'These are problems you missed. Clear them!' : 'No misses saved yet. Here is a fresh deck.'}
      </p>
      <button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label="Flip card">
        <span className="face front">
          <span className="q">{card.prompt}</span>
          <small>Tap to flip</small>
        </span>
        <span className="face back">
          <span className="q">{card.topic === 'real-life' ? `$${card.answer}` : card.answer}</span>
          <small>{card.prompt}</small>
        </span>
      </button>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={again}>
          🔁 Again
        </button>
        <button className="btn primary" onClick={known} disabled={!flipped}>
          ✅ Knew it
        </button>
      </div>
    </div>
  );
}

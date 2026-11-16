// Printable worksheets: new numbers every time, answer key on page 2.

import { useMemo, useState } from 'react';
import { makeRng } from '../../core/seed';
import { generate, TOPICS } from './logic';
import { track } from '../../core/analytics';

const LEVELS = [
  { id: 'easy', name: 'Easy', level: 2 },
  { id: 'medium', name: 'Medium', level: 5 },
  { id: 'hard', name: 'Hard', level: 8 },
];

export default function Worksheet({ initialTopic = 'mixed' }: { initialTopic?: string }) {
  const [topic, setTopic] = useState(initialTopic);
  const [level, setLevel] = useState('medium');
  const [seed, setSeed] = useState(() => (Math.random() * 2 ** 32) >>> 0);
  const lvl = LEVELS.find((l) => l.id === level)!.level;
  const problems = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: 30 }, () => generate(rng, lvl, topic));
  }, [seed, lvl, topic]);
  const topicName = TOPICS.find((t) => t.id === topic)?.name ?? 'Mixed';
  const money = topic === 'real-life';

  return (
    <div>
      <div className="no-print sheet-controls">
        <label>
          Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn" onClick={() => setSeed((Math.random() * 2 ** 32) >>> 0)}>
            🔀 New numbers
          </button>
          <button
            className="btn primary"
            onClick={() => {
              track('mental-math', 'printable_made', { topic, level });
              window.print();
            }}
          >
            🖨️ Print or save PDF
          </button>
        </div>
      </div>

      <div className="sheet">
        <div className="sheet-head">
          <div>
            <strong>Mental Math Worksheet: {topicName}</strong>
            <span>{LEVELS.find((l) => l.id === level)!.name} · 30 problems</span>
          </div>
          <div className="sheet-name">Name: ____________ Time: ______</div>
        </div>
        <ol className={`sheet-grid ${money ? 'wide' : ''}`}>
          {problems.map((p, i) => (
            <li key={i}>
              {money ? p.context : `${p.prompt} =`} <span className="blank" />
            </li>
          ))}
        </ol>
        <div className="sheet-foot">empty99studios.com/mental-math · free printable</div>
      </div>

      <div className="sheet page-break">
        <div className="sheet-head">
          <strong>Answer key: {topicName}</strong>
        </div>
        <ol className="sheet-grid key">
          {problems.map((p, i) => (
            <li key={i}>
              {money ? `$${p.answer}` : `${p.prompt} = ${p.answer}`}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// Mental Math Sprint: menu, onboarding, modes, session, results.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Problem } from '../../core/contract';
import { dayNumber, todayKey } from '../../core/seed';
import { stageFor } from '../../core/heat';
import { readJSON, writeJSON } from '../../core/storage';
import { track } from '../../core/analytics';
import { isMuted, setMuted, sfx } from '../../core/sound';
import {
  addMisses,
  awardBadges,
  liveStreak,
  loadProgress,
  recordBest,
  recordDaily,
  removeMiss,
  saveProgress,
  type Progress,
} from '../../core/progress';
import { Confetti, Keypad } from '../../components/Pieces';
import { ShareMenu, type ShareData } from '../../components/ShareMenu';
import { useRound } from '../../components/useRound';
import { Launch, type RoundResult } from './modes/Launch';
import { Defuse } from './modes/Defuse';
import { RealLife } from './modes/RealLife';
import { Flashcards, Quiz } from './Study';
import { BADGES } from './badges';
import { mentalMath, TOPICS } from './logic';

const GAME = 'mental-math';
const URL_BASE = 'empty99studios.com/mental-math';
const pageUrl = () =>
  (document.querySelector('link[rel=canonical]') as HTMLLinkElement | null)?.href ?? `https://${URL_BASE}`;

type Screen =
  | { name: 'home' }
  | { name: 'onboard' }
  | { name: 'launch'; daily: boolean; seconds: number }
  | { name: 'defuse' }
  | { name: 'reallife' }
  | { name: 'practice-setup' }
  | { name: 'session'; step: number; total: number; earned: string[] }
  | { name: 'session-break'; step: number; total: number; earned: string[]; last: number }
  | { name: 'quiz' }
  | { name: 'flash' }
  | { name: 'result'; r: ResultView };

interface ResultView {
  emoji: string;
  title: string;
  big: string;
  sub: string;
  stats: { n: string; l: string }[];
  earned: string[];
  best: boolean;
  share: string;
  card: { title: string; big: string; sub: string };
  again: Screen;
  againLabel: string;
}

const SESSION_STEPS = ['Defuse', 'Real Life Math', 'Launch'];

export default function MentalMathApp({ topic = 'mixed' }: { topic?: string }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress(GAME));
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [muted, setMutedState] = useState(false);
  const [toast, setToast] = useState('');
  const [sharing, setSharing] = useState<ShareData | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };
  const topicInfo = TOPICS.find((t) => t.id === topic) ?? TOPICS[0];
  const day = dayNumber();
  const today = todayKey();
  const playedToday = progress.dailyResults[today];
  const runKey = useMemo(() => Math.random(), [screen]);
  const appRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  // When a game or result opens, bring the whole play area into view on phones.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    appRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [screen.name]);

  useEffect(() => {
    setMutedState(isMuted());
    if (progress.plays > 0) track(GAME, 'return_visit');
    if (!readJSON('e99:mental-math:onboarded', false)) setScreen({ name: 'onboard' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (p: Progress) => {
    setProgress(p);
    saveProgress(GAME, p);
  };

  const missesOf = (ps: Problem[]) => ps.map((m) => ({ prompt: m.prompt, answer: m.answer, topic: m.topic }));

  // Shared bookkeeping after any round. Returns updated progress + badges earned + best flag.
  function settle(mode: string, r: RoundResult, extraBadges: string[] = []) {
    let p = { ...progress, plays: progress.plays + 1 };
    p = addMisses(p, missesOf(r.missed));
    const b = recordBest(p, mode, r.score);
    p = b.progress;
    const ids = [...extraBadges];
    if (r.maxHeat >= 8) ids.push('inferno');
    const a = awardBadges(p, ids);
    track(GAME, 'round_end', { mode, score: r.score, maxHeat: r.maxHeat });
    return { p: a.progress, earned: a.earned, best: b.isBest && r.score > 0 };
  }

  function start(s: Screen, mode: string) {
    track(GAME, 'round_start', { mode, topic });
    setScreen(s);
  }

  // ---------- Round handlers ----------
  const onLaunchDone = (daily: boolean, seconds: number) => (r: RoundResult) => {
    const mode = daily ? 'launch' : `practice-${topic}-${seconds}`;
    const extra: string[] = [];
    if (r.score >= 30) extra.push('sharp-30');
    let { p, earned, best } = settle(mode, r, extra);
    if (daily) {
      p = recordDaily(p, r.score);
      const streakBadges = ['first-launch'];
      if (p.dailyStreak >= 3) streakBadges.push('streak-3');
      if (p.dailyStreak >= 7) streakBadges.push('streak-7');
      const a = awardBadges(p, streakBadges);
      p = a.progress;
      earned = [...earned, ...a.earned];
    }
    commit(p);
    const alt = (r.extra?.altitude ?? 0).toLocaleString();
    const streak = liveStreak(p);
    const sub = daily ? `${alt} m altitude · ${streak}-day streak` : `${alt} m altitude`;
    setScreen({
      name: 'result',
      r: {
        emoji: '🚀',
        title: daily ? `Daily Launch #${day}` : `${topicInfo.name} practice · ${seconds}s`,
        big: `${r.score}`,
        sub: `correct · ${sub}`,
        stats: [
          { n: alt, l: 'meters' },
          { n: stageFor(r.maxHeat).name, l: 'top heat' },
          { n: String(p.bests[mode] ?? r.score), l: 'best' },
        ],
        earned,
        best,
        share: mentalMath.shareText({ mode: daily ? 'launch' : 'practice', score: r.score, day, extra: `${alt} m` }),
        card: { title: daily ? `Mental Math Sprint #${day}` : 'Mental Math Sprint', big: `${r.score} correct`, sub },
        again: daily ? { name: 'launch', daily: false, seconds: 60 } : { name: 'launch', daily: false, seconds },
        againLabel: daily ? 'Practice round' : 'Play again',
      },
    });
  };

  const onDefuseDone = (r: RoundResult & { won: boolean }) => {
    const badges = r.won ? ['defused', ...(r.missed.length === 0 ? ['clean-defuse'] : [])] : [];
    const { p, earned, best } = settle('defuse', { ...r, score: r.won ? 100 + (r.extra?.timeLeft ?? 0) : r.score }, badges);
    commit(p);
    setScreen({
      name: 'result',
      r: {
        emoji: r.won ? '😎' : '💥',
        title: r.won ? 'Bomb defused!' : 'Boom.',
        big: r.won ? `${r.extra?.timeLeft ?? 0}s` : `${r.score}/10`,
        sub: r.won ? 'left on the fuse' : 'wires cut before it blew',
        stats: [
          { n: `${r.score}/10`, l: 'wires' },
          { n: String(r.missed.length), l: 'misses' },
          { n: stageFor(r.maxHeat).name, l: 'top heat' },
        ],
        earned,
        best: best && r.won,
        share: r.won
          ? `I defused the math bomb with ${r.extra?.timeLeft ?? 0}s left 💣 Mental Math Sprint`
          : `The math bomb got me at ${r.score}/10 wires 💥 Can you defuse it?`,
        card: { title: 'Defuse · Mental Math', big: r.won ? `${r.extra?.timeLeft}s left` : 'BOOM', sub: `${r.score}/10 wires cut` },
        again: { name: 'defuse' },
        againLabel: 'Try again',
      },
    });
  };

  const onRealLifeDone = (r: RoundResult) => {
    const { p, earned, best } = settle('real-life', r, r.score >= 10 ? ['real-life'] : []);
    commit(p);
    setScreen({
      name: 'result',
      r: {
        emoji: '🧾',
        title: 'Real Life Math',
        big: `${r.score}`,
        sub: 'receipts solved in 90 seconds',
        stats: [
          { n: String(r.score), l: 'solved' },
          { n: String(r.missed.length), l: 'misses' },
          { n: String(p.bests['real-life'] ?? r.score), l: 'best' },
        ],
        earned,
        best,
        share: `I solved ${r.score} real-life money problems in 90s 🧾 tips, splits, sales. Your turn:`,
        card: { title: 'Real Life Math', big: `${r.score} solved`, sub: 'tips · bill splits · sale prices' },
        again: { name: 'reallife' },
        againLabel: 'Play again',
      },
    });
  };

  const onSessionStep = (step: number, total: number, earned: string[]) => (r: RoundResult & { won?: boolean }) => {
    const gained = step === 0 ? (r.won ? 10 + Math.floor((r.extra?.timeLeft ?? 0) / 3) : r.score) : r.score;
    const extraBadges = step === 0 && r.won ? ['defused'] : step === 1 && r.score >= 10 ? ['real-life'] : [];
    const s = settle(`session-${step}`, r, extraBadges);
    commit(s.p);
    const newTotal = total + gained;
    const allEarned = [...earned, ...s.earned];
    if (step < 2) return setScreen({ name: 'session-break', step: step + 1, total: newTotal, earned: allEarned, last: gained });
    const fin = awardBadges(s.p, ['session']);
    const fb = recordBest(fin.progress, 'session', newTotal);
    commit(fb.progress);
    sfx.win();
    setScreen({
      name: 'result',
      r: {
        emoji: '🏆',
        title: 'Session complete',
        big: `${newTotal}`,
        sub: 'session points across 3 games',
        stats: [
          { n: '3/3', l: 'games' },
          { n: String(fb.progress.bests['session'] ?? newTotal), l: 'best' },
          { n: String(liveStreak(fb.progress)), l: 'day streak' },
        ],
        earned: [...allEarned, ...fin.earned],
        best: fb.isBest,
        share: `I scored ${newTotal} in a Mental Math Sprint session 🏆 bomb, receipts and rocket. Beat me:`,
        card: { title: 'Mental Math Session', big: `${newTotal} pts`, sub: 'Defuse · Real Life · Launch' },
        again: { name: 'session', step: 0, total: 0, earned: [] },
        againLabel: 'New session',
      },
    });
  };

  // ---------- Render ----------
  const back = () => setScreen({ name: 'home' });

  const body = (() => {
    switch (screen.name) {
      case 'onboard':
        return (
          <Onboarding
            onDone={() => {
              writeJSON('e99:mental-math:onboarded', true);
              start({ name: 'launch', daily: !playedToday, seconds: 60 }, playedToday ? 'practice' : 'launch');
            }}
            onSkip={() => {
              writeJSON('e99:mental-math:onboarded', true);
              back();
            }}
          />
        );
      case 'launch':
        return <Launch key={runKey} daily={screen.daily} seconds={screen.seconds} topic={topic} onDone={onLaunchDone(screen.daily, screen.seconds)} />;
      case 'defuse':
        return <Defuse key={runKey} topic={topic} onDone={onDefuseDone} />;
      case 'reallife':
        return <RealLife key={runKey} seconds={90} onDone={onRealLifeDone} />;
      case 'session': {
        const done = onSessionStep(screen.step, screen.total, screen.earned);
        if (screen.step === 0) return <Defuse key={runKey} topic="mixed" onDone={done} />;
        if (screen.step === 1) return <RealLife key={runKey} seconds={60} onDone={done} />;
        return <Launch key={runKey} daily={false} seconds={60} topic="mixed" title="Session · Launch" onDone={done} />;
      }
      case 'session-break':
        return (
          <div className="stage result">
            <div className="pill">Game {screen.step} of 3 done</div>
            <div className="big" style={{ marginTop: 12 }}>+{screen.last}</div>
            <p>
              Session total: <strong>{screen.total}</strong>
            </p>
            <p>Next up: {SESSION_STEPS[screen.step]}</p>
            <button
              className="btn primary block"
              onClick={() => setScreen({ name: 'session', step: screen.step, total: screen.total, earned: screen.earned })}
            >
              Go ▶
            </button>
          </div>
        );
      case 'practice-setup':
        return <PracticeSetup topicName={topicInfo.name} onPick={(seconds) => start({ name: 'launch', daily: false, seconds }, 'practice')} onBack={back} />;
      case 'quiz':
        return (
          <Quiz
            topic={topic}
            onDone={(score, missed) => {
              let p = addMisses({ ...progress, plays: progress.plays + 1 }, missesOf(missed));
              const b = recordBest(p, `quiz-${topic}`, score);
              p = b.progress;
              const a = awardBadges(p, score === 10 ? ['quiz-perfect'] : []);
              commit(a.progress);
              track(GAME, 'quiz_end', { topic, score });
              if (score >= 8) sfx.win();
              setScreen({
                name: 'result',
                r: {
                  emoji: score === 10 ? '💯' : '📝',
                  title: `${topicInfo.name} quiz`,
                  big: `${score}/10`,
                  sub: missed.length ? `${missed.length} saved to your flashcards` : 'perfect run',
                  stats: [
                    { n: `${score * 10}%`, l: 'score' },
                    { n: String(missed.length), l: 'to review' },
                    { n: `${b.progress.bests[`quiz-${topic}`] ?? score}/10`, l: 'best' },
                  ],
                  earned: a.earned,
                  best: b.isBest && score >= 6,
                  share: `I scored ${score}/10 on the ${topicInfo.name} mental math quiz 📝`,
                  card: { title: `${topicInfo.name} quiz`, big: `${score}/10`, sub: 'Mental Math Sprint' },
                  again: { name: 'quiz' },
                  againLabel: 'New quiz',
                },
              });
            }}
          />
        );
      case 'flash':
        return <Flashcards misses={progress.misses} topic={topic} onKnown={(prompt) => commit(removeMiss(progress, prompt))} onExit={back} />;
      case 'result':
        return (
          <Result
            r={screen.r}
            onAgain={() => setScreen(screen.r.again)}
            onHome={back}
            onShare={() =>
              setSharing({
                game: GAME,
                text: screen.r.share,
                url: pageUrl(),
                card: { ...screen.r.card, accent: mentalMath.accent, footer: URL_BASE },
                fileName: 'mental-math-score.png',
              })
            }
          />
        );
      default:
        return (
          <Home
            progress={progress}
            topicName={topicInfo.name}
            topic={topic}
            day={day}
            playedToday={playedToday}
            go={(s, mode) => start(s, mode)}
            onHow={() => setScreen({ name: 'onboard' })}
          />
        );
    }
  })();

  return (
    <div className="app" ref={appRef}>
      <div className="appbar">
        {screen.name !== 'home' ? (
          <button className="btn small" onClick={back}>
            ← Menu
          </button>
        ) : (
          <span className="pill">🔥 {liveStreak(progress)}-day streak</span>
        )}
        <button
          className="iconbtn"
          aria-label={muted ? 'Turn sound on' : 'Mute sound'}
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
      {body}
      {sharing && <ShareMenu data={sharing} onClose={() => setSharing(null)} toast={showToast} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ---------- Screens ----------

function Home({
  progress,
  topic,
  topicName,
  day,
  playedToday,
  go,
  onHow,
}: {
  progress: Progress;
  topic: string;
  topicName: string;
  day: number;
  playedToday: number | undefined;
  go: (s: Screen, mode: string) => void;
  onHow: () => void;
}) {
  const misses = progress.misses.filter((m) => topic === 'mixed' || m.topic === topic).length;
  return (
    <div className="cards">
      <button className="mode hero" onClick={() => go({ name: 'launch', daily: playedToday === undefined, seconds: 60 }, 'launch')}>
        <span className="ico" style={{ background: '#FFD23F' }}>🚀</span>
        <span>
          <span className="t">Daily Launch #{day}</span>
          <span className="d">
            {playedToday === undefined ? '60 seconds. Same problems for everyone today.' : `Done today: ${playedToday} correct. Tap for a practice run.`}
          </span>
        </span>
      </button>
      {topic !== 'mixed' && (
        <button className="mode" onClick={() => go({ name: 'practice-setup' }, 'practice')}>
          <span className="ico" style={{ background: '#E6EEFF' }}>🎯</span>
          <span>
            <span className="t">Practice {topicName}</span>
            <span className="d">Pick 30, 60 or 120 seconds. Heat meter adapts to you.</span>
          </span>
        </button>
      )}
      <button className="mode" onClick={() => go({ name: 'session', step: 0, total: 0, earned: [] }, 'session')}>
        <span className="ico" style={{ background: '#FAEEDA' }}>🏆</span>
        <span>
          <span className="t">5-minute session</span>
          <span className="d">Defuse → Real Life Math → Launch, then your reward.</span>
        </span>
      </button>
      <button className="mode" onClick={() => go({ name: 'defuse' }, 'defuse')}>
        <span className="ico" style={{ background: '#FCEBEB' }}>💣</span>
        <span>
          <span className="t">Defuse</span>
          <span className="d">Cut 10 wires. Every miss burns 5 seconds off the fuse.</span>
        </span>
      </button>
      <button className="mode" onClick={() => go({ name: 'reallife' }, 'real-life')}>
        <span className="ico" style={{ background: '#E1F5EE' }}>🧾</span>
        <span>
          <span className="t">Real Life Math</span>
          <span className="d">Tips, bill splits, sale prices. 90 seconds.</span>
        </span>
      </button>
      {topic === 'mixed' && (
        <button className="mode" onClick={() => go({ name: 'practice-setup' }, 'practice')}>
          <span className="ico" style={{ background: '#E6EEFF' }}>🎯</span>
          <span>
            <span className="t">Practice</span>
            <span className="d">Pick 30, 60 or 120 seconds. Heat meter adapts to you.</span>
          </span>
        </button>
      )}
      <div className="minirow">
        <button className="mode mini" onClick={() => go({ name: 'quiz' }, 'quiz')}>
          <span className="ico">📝</span>
          <span className="t">Quiz</span>
        </button>
        <button className="mode mini" onClick={() => go({ name: 'flash' }, 'flash')}>
          <span className="ico">🃏</span>
          <span className="t">Flashcards{misses ? ` (${misses})` : ''}</span>
        </button>
        <a className="mode mini" href="/mental-math/worksheets">
          <span className="ico">🖨️</span>
          <span className="t">Worksheets</span>
        </a>
      </div>
      {progress.badges.length > 0 && (
        <div className="shelf">
          <h3>Your badges</h3>
          <div>
            {Object.entries(BADGES).map(([id, b]) => (
              <span key={id} className={`shelf-badge ${progress.badges.includes(id) ? 'got' : ''}`} title={`${b.name}: ${b.how}`}>
                {b.icon}
              </span>
            ))}
          </div>
        </div>
      )}
      <button className="linkbtn" onClick={onHow}>
        How it works
      </button>
    </div>
  );
}

function PracticeSetup({ topicName, onPick, onBack }: { topicName: string; onPick: (s: number) => void; onBack: () => void }) {
  return (
    <div className="stage result">
      <div className="big">🎯</div>
      <h2>Practice {topicName}</h2>
      <p>How long?</p>
      <div className="cards">
        {[30, 60, 120].map((s) => (
          <button key={s} className={`btn block ${s === 60 ? 'primary' : ''}`} onClick={() => onPick(s)}>
            {s} seconds
          </button>
        ))}
        <button className="linkbtn" onClick={onBack}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Result({ r, onAgain, onHome, onShare }: { r: ResultView; onAgain: () => void; onHome: () => void; onShare: () => void }) {
  return (
    <div className="stage result" style={{ position: 'relative' }}>
      <Confetti go={r.best || r.earned.length > 0} />
      <div style={{ fontSize: 44 }}>{r.emoji}</div>
      <h2>{r.title}</h2>
      {r.best && <div className="pill" style={{ marginBottom: 8 }}>New personal best!</div>}
      <div className="big pop">{r.big}</div>
      <p style={{ marginTop: 6 }}>{r.sub}</p>
      <div className="stats">
        {r.stats.map((s) => (
          <div className="stat" key={s.l}>
            <div className="n">{s.n}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>
      {r.earned.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {r.earned.map((id) => (
            <span key={id} className="badge">
              {BADGES[id]?.icon} {BADGES[id]?.name}
            </span>
          ))}
        </div>
      )}
      <div className="cards">
        <button className="btn yellow block" onClick={onShare}>
          📤 Share score
        </button>
        <button className="btn primary block" onClick={onAgain}>
          {r.againLabel}
        </button>
        <button className="linkbtn" onClick={onHome}>
          Back to menu
        </button>
      </div>
    </div>
  );
}

function Onboarding({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const warmups = useMemo<Problem[]>(
    () => [
      { prompt: '3 + 4', answer: 7, topic: 'addition' },
      { prompt: '6 × 2', answer: 12, topic: 'multiplication' },
    ],
    [],
  );
  const [step, setStep] = useState<'intro' | 'warm' | 'ready'>('intro');
  const [hint, setHint] = useState(false);
  const round = useRound({
    next: (i) => warmups[Math.min(i, 1)],
    active: step === 'warm',
    onCorrect: () => {
      setHint(false);
      if (round.score + 1 >= 2) setTimeout(() => setStep('ready'), 400);
    },
  });
  useEffect(() => {
    if (step !== 'warm') return;
    setHint(false);
    const t = setTimeout(() => setHint(true), 3000);
    return () => clearTimeout(t);
  }, [step, round.index]);

  if (step === 'intro')
    return (
      <div className="stage result">
        <div className="demo" aria-hidden="true">
          <div className="demo-q">7 × 8</div>
          <div className="demo-a" />
          <div className="demo-heat" />
        </div>
        <h2>Answer fast. Heat up.</h2>
        <p>Type the answer and it submits by itself. Streaks heat the meter and the problems get harder. Misses cool it down.</p>
        <div className="cards">
          <button className="btn primary block" onClick={() => setStep('warm')}>
            Try 2 warm-ups
          </button>
          <button className="linkbtn" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    );

  if (step === 'ready')
    return (
      <div className="stage result">
        <div className="big pop">🔥</div>
        <h2>You've got it.</h2>
        <p>Play the Daily Launch every day to build your streak. Everyone gets the same problems, so you can compare scores.</p>
        <button className="btn primary block" onClick={onDone}>
          Start today's Launch
        </button>
      </div>
    );

  return (
    <div className="stage">
      <div className="hud">
        <span>Warm-up {Math.min(round.index + 1, 2)} of 2</span>
      </div>
      <div className="problem">
        <div className="q">{round.problem.prompt}</div>
        <p className="ctx" style={{ minHeight: 24 }}>{hint ? `Hint: it's ${round.problem.answer}` : 'Just type the answer'}</p>
      </div>
      <div className="answer caret">{round.input}</div>
      <Keypad onKey={round.press} />
    </div>
  );
}

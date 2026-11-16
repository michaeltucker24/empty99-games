// Mental Math Sprint: tabs (Path, Play, Missions, Shop, Profile), onboarding,
// modes, flight path stages, session, results. Progression lives in core/.

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
  recordPlay,
  removeMiss,
  saveProgress,
  type Progress,
} from '../../core/progress';
import {
  BOSS_PASS,
  bossStars,
  buy,
  claimMission,
  claimWeekly,
  completeStage,
  dailyMissions,
  grantRound,
  isBoosted,
  lessonStars,
  levelInfo,
  missionStatus,
  nextStage,
  sectorDone,
  spendTimeBoost,
  type Grant,
  type SectorDef,
  type StageDef,
} from '../../core/progression';
import { Confetti, Keypad } from '../../components/Pieces';
import { ShareMenu, type ShareData } from '../../components/ShareMenu';
import { useRound } from '../../components/useRound';
import { CalcBot, CalcSays, type Mood } from '../../components/CalcBot';
import { Bar, StatBar, TabBar, type Stat, type Tab } from '../../components/Chrome';
import { Glyph, Icon } from '../../components/Icons';
import { Rocket } from '../../components/Rocket';
import { LevelBar, MissionsPanel, PathPanel, RewardStrip, ShopPanel } from '../../components/ProgressionPanels';
import { Launch, type RoundResult } from './modes/Launch';
import { Defuse } from './modes/Defuse';
import { RealLife } from './modes/RealLife';
import { Stage } from './modes/Stage';
import { Flashcards, Quiz } from './Study';
import { BADGES } from './badges';
import { mentalMath, TOPICS } from './logic';
import { CRATE_STAGE_FUEL, MISSIONS, SECTORS, XP, sectorForTopic } from './path';

const GAME = 'mental-math';
const URL_BASE = 'empty99studios.com/mental-math';
const pageUrl = () =>
  (document.querySelector('link[rel=canonical]') as HTMLLinkElement | null)?.href ?? `https://${URL_BASE}`;

type TabId = 'path' | 'play' | 'missions' | 'shop' | 'profile';

const TABS: Tab[] = [
  { id: 'path', label: 'Path', icon: { glyph: '÷' } },
  { id: 'play', label: 'Play', icon: 'play' },
  { id: 'missions', label: 'Missions', icon: { glyph: '√' } },
  { id: 'shop', label: 'Shop', icon: 'store' },
  { id: 'profile', label: 'Profile', icon: { glyph: 'π' } },
];

type Screen =
  | { name: 'home' }
  | { name: 'onboard' }
  | { name: 'launch'; daily: boolean; seconds: number; bonus?: number }
  | { name: 'defuse' }
  | { name: 'reallife' }
  | { name: 'stage'; sectorId: string; stageId: string }
  | { name: 'practice-setup' }
  | { name: 'session'; step: number; total: number; earned: string[] }
  | { name: 'session-break'; step: number; total: number; earned: string[]; last: number }
  | { name: 'quiz' }
  | { name: 'flash' }
  | { name: 'result'; r: ResultView };

interface ResultView {
  mood: Mood;
  title: string;
  big: string;
  sub: string;
  stars?: number;
  stats: { n: string; l: string }[];
  earned: string[];
  best: boolean;
  grant?: Grant;
  share: string;
  card: { title: string; big: string; sub: string };
  again: Screen;
  againLabel: string;
  home: TabId;
}

const SESSION_STEPS = ['Defuse', 'Real Life Math', 'Launch'];

function untilMidnightUTC(now: number) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((next.getTime() - now) / 60_000));
  return mins >= 60 ? `${Math.floor(mins / 60)} h` : `${mins} min`;
}

const findStage = (sectorId: string, stageId: string) => {
  const sector = SECTORS.find((s) => s.id === sectorId)!;
  return { sector, stage: sector.stages.find((s) => s.id === stageId)! };
};

export default function MentalMathApp({ topic = 'mixed' }: { topic?: string }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress(GAME));
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [tab, setTab] = useState<TabId>('path');
  const [sectorId, setSectorId] = useState<string>(() => {
    const p = loadProgress(GAME);
    return sectorForTopic(topic)?.id ?? (SECTORS.find((s) => nextStage(s, p)) ?? SECTORS[0]).id;
  });
  const [muted, setMutedState] = useState(false);
  const [toast, setToast] = useState('');
  const [sharing, setSharing] = useState<ShareData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };
  const topicInfo = TOPICS.find((t) => t.id === topic) ?? TOPICS[0];
  const day = dayNumber();
  const today = todayKey(new Date(now));
  const playedToday = progress.dailyResults[today];
  const missions = useMemo(() => dailyMissions(MISSIONS, today), [today]);
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
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (p: Progress) => {
    setProgress(p);
    saveProgress(GAME, p);
  };

  const missesOf = (ps: Problem[]) => ps.map((m) => ({ prompt: m.prompt, answer: m.answer, topic: m.topic }));

  /**
   * Shared bookkeeping after any finished round: misses, best, streak, patches,
   * XP, fuel and mission progress. Returns the new progress (not yet saved).
   */
  function settle(
    mode: string,
    r: RoundResult,
    opts: { badges?: string[]; xp: number; missionMode: string; daily?: boolean; base?: Progress },
  ) {
    let p = { ...(opts.base ?? progress) };
    p.plays += 1;
    p = addMisses(p, missesOf(r.missed));
    const b = recordBest(p, mode, r.score);
    p = recordPlay(b.progress);
    const ids = [...(opts.badges ?? [])];
    if (r.maxHeat >= 8) ids.push('inferno');
    if (p.dailyStreak >= 3) ids.push('streak-3');
    if (p.dailyStreak >= 7) ids.push('streak-7');
    const a = awardBadges(p, ids);
    const g = grantRound(a.progress, { baseXp: opts.xp, maxHeat: r.maxHeat, daily: opts.daily, mode: opts.missionMode }, missions);
    track(GAME, 'round_end', { mode, score: r.score, maxHeat: r.maxHeat, xp: g.grant.xp });
    if (g.grant.levelUp) track(GAME, 'level_up', { level: g.grant.levelUp });
    return { p: g.progress, earned: a.earned, best: b.isBest && r.score > 0, grant: g.grant };
  }

  const moodFor = (best: boolean, earned: string[], grant: Grant): Mood =>
    best || earned.length > 0 || grant.levelUp ? 'cheer' : 'happy';

  function start(s: Screen, mode: string) {
    track(GAME, 'round_start', { mode, topic });
    setScreen(s);
  }

  // ---------- Round handlers ----------
  const onLaunchDone = (daily: boolean, seconds: number) => (r: RoundResult) => {
    const mode = daily ? 'launch' : `practice-${topic}-${seconds}`;
    const badges = r.score >= 30 ? ['sharp-30'] : [];
    if (daily) badges.push('first-launch');
    let { p, earned, best, grant } = settle(mode, r, { badges, xp: XP.launch(r), missionMode: daily ? 'launch' : 'practice', daily });
    if (daily) p = recordDaily(p, r.score);
    commit(p);
    const alt = (r.extra?.altitude ?? 0).toLocaleString();
    const streak = liveStreak(p);
    const sub = daily ? `${alt} m altitude · ${streak}-day streak` : `${alt} m altitude`;
    setScreen({
      name: 'result',
      r: {
        mood: moodFor(best, earned, grant),
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
        grant,
        share: mentalMath.shareText({ mode: daily ? 'launch' : 'practice', score: r.score, day, extra: `${alt} m` }),
        card: { title: daily ? `Mental Math Sprint #${day}` : 'Mental Math Sprint', big: `${r.score} correct`, sub },
        again: { name: 'launch', daily: false, seconds: daily ? 60 : seconds },
        againLabel: daily ? 'Practice round' : 'Play again',
        home: 'play',
      },
    });
  };

  const onDefuseDone = (r: RoundResult & { won: boolean }) => {
    const badges = r.won ? ['defused', ...(r.missed.length === 0 ? ['clean-defuse'] : [])] : [];
    const { p, earned, best, grant } = settle('defuse', { ...r, score: r.won ? 100 + (r.extra?.timeLeft ?? 0) : r.score }, {
      badges,
      xp: XP.defuse(r),
      missionMode: 'defuse',
    });
    commit(p);
    setScreen({
      name: 'result',
      r: {
        mood: r.won ? moodFor(best, earned, grant) : 'worried',
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
        grant,
        share: r.won
          ? `I defused the math bomb with ${r.extra?.timeLeft ?? 0}s left 💣 Mental Math Sprint`
          : `The math bomb got me at ${r.score}/10 wires 💥 Can you defuse it?`,
        card: { title: 'Defuse · Mental Math', big: r.won ? `${r.extra?.timeLeft}s left` : 'BOOM', sub: `${r.score}/10 wires cut` },
        again: { name: 'defuse' },
        againLabel: 'Try again',
        home: 'play',
      },
    });
  };

  const onRealLifeDone = (r: RoundResult) => {
    const { p, earned, best, grant } = settle('real-life', r, {
      badges: r.score >= 10 ? ['real-life'] : [],
      xp: XP.realLife(r),
      missionMode: 'real-life',
    });
    commit(p);
    setScreen({
      name: 'result',
      r: {
        mood: moodFor(best, earned, grant),
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
        grant,
        share: `I solved ${r.score} real-life money problems in 90s 🧾 tips, splits, sales. Your turn:`,
        card: { title: 'Real Life Math', big: `${r.score} solved`, sub: 'tips · bill splits · sale prices' },
        again: { name: 'reallife' },
        againLabel: 'Play again',
        home: 'play',
      },
    });
  };

  const onStageDone = (sector: SectorDef, stage: StageDef) => (r: RoundResult) => {
    const isBoss = stage.kind === 'boss';
    const stars = isBoss ? bossStars(r.score) : lessonStars(r.missed.length);
    const passed = stars > 0;
    const base = passed ? completeStage(progress, stage.id, stars) : progress;
    const badges: string[] = [];
    if (passed) badges.push('first-stage');
    if (passed && isBoss) badges.push('boss');
    if (passed && sectorDone(sector, base) === sector.stages.length) badges.push('sector-clear');
    const { p, earned, best, grant } = settle(`stage-${stage.id}`, r, {
      base,
      badges,
      xp: isBoss ? XP.boss(r.score, stars) : XP.lesson(stars),
      missionMode: passed ? 'stage' : 'stage-fail',
    });
    commit(p);
    track(GAME, 'stage_end', { stage: stage.id, stars, passed });
    if (passed) sfx.win();
    const following = nextStage(sector, p);
    setScreen({
      name: 'result',
      r: {
        mood: passed ? (stars === 3 || earned.length ? 'cheer' : 'happy') : 'worried',
        title: `${sector.name}: ${stage.label}`,
        big: isBoss ? `${r.score}` : `${r.score}/10`,
        sub: isBoss
          ? passed
            ? 'correct in 60 seconds. Boss beaten!'
            : `correct. You need ${BOSS_PASS} to beat the boss.`
          : r.missed.length === 0
            ? 'correct with zero misses'
            : `correct · ${r.missed.length} saved to your flashcards`,
        stars: passed ? stars : undefined,
        stats: [
          { n: String(r.missed.length), l: 'misses' },
          { n: stageFor(r.maxHeat).name, l: 'top heat' },
          { n: `${sectorDone(sector, p)}/${sector.stages.length}`, l: 'sector' },
        ],
        earned,
        best: false,
        grant,
        share: `I cleared "${stage.label}" in ${sector.name} on Mental Math Sprint ${'★'.repeat(stars)}`,
        card: { title: `${sector.name} · ${stage.label}`, big: passed ? '★'.repeat(stars) : `${r.score}`, sub: 'Mental Math Sprint' },
        again:
          passed && following
            ? { name: 'stage', sectorId: sector.id, stageId: following.stage.id }
            : { name: 'stage', sectorId: sector.id, stageId: stage.id },
        againLabel: passed && following ? (following.stage.kind === 'crate' ? 'Back to path' : `Next: ${following.stage.label}`) : 'Try again',
        home: 'path',
      },
    });
  };

  const onSessionStep = (step: number, total: number, earned: string[]) => (r: RoundResult & { won?: boolean }) => {
    const gained = step === 0 ? (r.won ? 10 + Math.floor((r.extra?.timeLeft ?? 0) / 3) : r.score) : r.score;
    const badges = step === 0 && r.won ? ['defused'] : step === 1 && r.score >= 10 ? ['real-life'] : [];
    const xp = step === 0 ? XP.defuse(r) : step === 1 ? XP.realLife(r) : XP.launch(r);
    const s = settle(`session-${step}`, r, { badges, xp: xp + (step === 2 ? XP.sessionBonus : 0), missionMode: ['defuse', 'real-life', 'launch'][step] });
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
        mood: 'cheer',
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
        grant: s.grant,
        share: `I scored ${newTotal} in a Mental Math Sprint session 🏆 bomb, receipts and rocket. Beat me:`,
        card: { title: 'Mental Math Session', big: `${newTotal} pts`, sub: 'Defuse · Real Life · Launch' },
        again: { name: 'session', step: 0, total: 0, earned: [] },
        againLabel: 'New session',
        home: 'play',
      },
    });
  };

  const onQuizDone = (score: number, missed: Problem[]) => {
    const { p, earned, best, grant } = settle(`quiz-${topic}`, { score, missed, maxHeat: 0 }, {
      badges: score === 10 ? ['quiz-perfect'] : [],
      xp: XP.quiz(score),
      missionMode: 'quiz',
    });
    commit(p);
    track(GAME, 'quiz_end', { topic, score });
    if (score >= 8) sfx.win();
    setScreen({
      name: 'result',
      r: {
        mood: score >= 8 ? 'cheer' : score >= 5 ? 'happy' : 'worried',
        title: `${topicInfo.name} quiz`,
        big: `${score}/10`,
        sub: missed.length ? `${missed.length} saved to your flashcards` : 'perfect run',
        stats: [
          { n: `${score * 10}%`, l: 'score' },
          { n: String(missed.length), l: 'to review' },
          { n: `${p.bests[`quiz-${topic}`] ?? score}/10`, l: 'best' },
        ],
        earned,
        best: best && score >= 6,
        grant,
        share: `I scored ${score}/10 on the ${topicInfo.name} mental math quiz 📝`,
        card: { title: `${topicInfo.name} quiz`, big: `${score}/10`, sub: 'Mental Math Sprint' },
        again: { name: 'quiz' },
        againLabel: 'New quiz',
        home: 'play',
      },
    });
  };

  // ---------- Progression actions ----------
  const openStage = (stage: StageDef, sector: SectorDef) => {
    const state = progress.stages[stage.id] ? 'done' : nextStage(sector, progress)?.stage.id === stage.id ? 'current' : 'locked';
    if (state === 'locked') return;
    if (stage.kind === 'crate') {
      if (state === 'done') return showToast('This crate is already open');
      const p = completeStage({ ...progress, fuel: progress.fuel + CRATE_STAGE_FUEL }, stage.id, 1);
      commit(p);
      sfx.win();
      track(GAME, 'stage_end', { stage: stage.id, stars: 1, passed: true });
      return showToast(`Supply crate opened: +${CRATE_STAGE_FUEL} fuel`);
    }
    start({ name: 'stage', sectorId: sector.id, stageId: stage.id }, stage.kind === 'boss' ? 'boss' : 'stage');
  };

  const startPractice = (seconds: number) => {
    const tb = spendTimeBoost(progress);
    if (tb.seconds) {
      commit(tb.progress);
      showToast(`Time boost used: +${tb.seconds} s`);
    }
    start({ name: 'launch', daily: false, seconds, bonus: tb.seconds }, 'practice');
  };

  const onBuy = (id: string) => {
    const res = buy(progress, id);
    if (!res.ok) {
      sfx.miss();
      return showToast(res.reason);
    }
    commit(res.progress);
    sfx.correct(4);
    track(GAME, 'shop_buy', { item: id });
    const msg: Record<string, string> = {
      shield: 'Streak shield ready',
      afterburner: 'Afterburner on: 2× XP for 15 minutes',
      timeboost: 'Time boost saved for your next practice run',
    };
    showToast(msg[id] ?? (res.progress.skin === id ? 'Rocket skin equipped' : 'Done'));
    setNow(Date.now());
  };

  // ---------- Render ----------
  const back = () => setScreen({ name: 'home' });
  const backTo = (t: TabId) => {
    setTab(t);
    setScreen({ name: 'home' });
  };

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
        return (
          <Launch
            key={runKey}
            daily={screen.daily}
            seconds={screen.seconds + (screen.bonus ?? 0)}
            topic={topic}
            skin={progress.skin}
            onDone={onLaunchDone(screen.daily, screen.seconds)}
          />
        );
      case 'defuse':
        return <Defuse key={runKey} topic={topic} onDone={onDefuseDone} />;
      case 'reallife':
        return <RealLife key={runKey} seconds={90} onDone={onRealLifeDone} />;
      case 'stage': {
        const { sector, stage } = findStage(screen.sectorId, screen.stageId);
        if (stage.kind === 'crate') {
          return (
            <div className="stage result">
              <CalcBot mood="wow" size={110} />
              <h2>Supply crate ahead</h2>
              <p>Open it on the flight path for +{CRATE_STAGE_FUEL} fuel.</p>
              <button className="btn primary block" onClick={() => backTo('path')}>
                Back to path
              </button>
            </div>
          );
        }
        if (stage.kind === 'boss')
          return (
            <Launch
              key={runKey}
              daily={false}
              seconds={60}
              topic={sector.topic}
              skin={progress.skin}
              title={`Boss · ${sector.name}`}
              onDone={onStageDone(sector, stage)}
            />
          );
        return <Stage key={runKey} topic={sector.topic} level={stage.level} title={`${sector.name} · ${stage.label}`} onDone={onStageDone(sector, stage)} />;
      }
      case 'session': {
        const done = onSessionStep(screen.step, screen.total, screen.earned);
        if (screen.step === 0) return <Defuse key={runKey} topic="mixed" onDone={done} />;
        if (screen.step === 1) return <RealLife key={runKey} seconds={60} onDone={done} />;
        return <Launch key={runKey} daily={false} seconds={60} topic="mixed" skin={progress.skin} title="Session · Launch" onDone={done} />;
      }
      case 'session-break':
        return (
          <div className="stage result">
            <CalcBot mood="happy" size={96} />
            <div className="pill" style={{ marginTop: 8 }}>
              Game {screen.step} of 3 done
            </div>
            <div className="big" style={{ marginTop: 12 }}>
              +{screen.last}
            </div>
            <p>
              Session total: <strong>{screen.total}</strong>
            </p>
            <p>Next up: {SESSION_STEPS[screen.step]}</p>
            <button
              className="btn primary block"
              onClick={() => setScreen({ name: 'session', step: screen.step, total: screen.total, earned: screen.earned })}
            >
              Go
            </button>
          </div>
        );
      case 'practice-setup':
        return <PracticeSetup topicName={topicInfo.name} boosts={progress.timeBoosts} onPick={startPractice} onBack={back} />;
      case 'quiz':
        return <Quiz topic={topic} onDone={onQuizDone} />;
      case 'flash':
        return <Flashcards misses={progress.misses} topic={topic} onKnown={(prompt) => commit(removeMiss(progress, prompt))} onExit={back} />;
      case 'result':
        return (
          <Result
            r={screen.r}
            xp={progress.xp}
            onAgain={() => {
              const a = screen.r.again;
              if (a.name === 'stage') {
                const { sector, stage } = findStage(a.sectorId, a.stageId);
                if (stage.kind === 'crate') return backTo('path');
                return openStage(stage, sector);
              }
              setScreen(a);
            }}
            onHome={() => backTo(screen.r.home)}
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
        return null;
    }
  })();

  // ---------- Tabs ----------
  const level = levelInfo(progress.xp);
  const boosted = isBoosted(progress, now);
  const streak = liveStreak(progress, today);
  const stats: Stat[] = [
    {
      id: 'streak',
      icon: 'flame',
      value: String(streak),
      color: 'var(--streak)',
      explain: `Day streak: ${streak} ${streak === 1 ? 'day' : 'days'}. Finish at least one round every day to keep it going.`,
    },
    {
      id: 'fuel',
      icon: 'fuel',
      value: String(progress.fuel),
      color: 'var(--ink)',
      explain: 'Fuel: you earn it from every round, supply crates and level-ups. Spend it in the Shop.',
    },
    {
      id: 'level',
      icon: { glyph: '+' },
      value: `Lv ${level.level}`,
      color: '#8A6200',
      explain: `Level ${level.level}: ${level.into}/${level.need} XP to level ${level.level + 1}. Every round earns XP.${boosted ? ' Afterburner is on: 2× XP.' : ''}`,
    },
    {
      id: 'shields',
      icon: 'shield',
      value: String(progress.shields),
      color: 'var(--teal)',
      explain: 'Streak shields: each one saves your streak if you miss a day. Get them in the Shop.',
    },
  ];
  const muteBtn = (
    <button
      className="iconbtn"
      aria-label={muted ? 'Turn sound on' : 'Mute sound'}
      onClick={() => {
        setMuted(!muted);
        setMutedState(!muted);
      }}
    >
      <Icon name={muted ? 'mute' : 'sound'} size={20} />
    </button>
  );

  const xpMission = missions.find((m) => m.metric === 'xp');
  const xpToday = xpMission ? missionStatus(progress, xpMission, today) : null;
  const dailyCard = (
    <div className="today">
      <button className="mode hero" onClick={() => start({ name: 'launch', daily: playedToday === undefined, seconds: 60 }, 'launch')}>
        <span className="ico" style={{ background: 'var(--yellow)' }}>
          <Rocket skin={progress.skin} size={30} />
        </span>
        <span>
          <span className="t">Daily Launch #{day}</span>
          <span className="d">
            {playedToday === undefined ? '60 seconds. Same problems for everyone today.' : `Done today: ${playedToday} correct. Tap for a practice run.`}
          </span>
        </span>
      </button>
      {xpMission && xpToday && (
        <div className="goal">
          <div className="goal-row">
            <span>Daily goal</span>
            <span>
              {xpToday.value} / {xpMission.target} XP{boosted ? ' · 2× on' : ''}
            </span>
          </div>
          <Bar value={xpToday.value} max={xpMission.target} label="Daily XP goal" />
        </div>
      )}
    </div>
  );

  const tabBody = (() => {
    switch (tab) {
      case 'play':
        return <PlayTab progress={progress} topicName={topicInfo.name} topic={topic} day={day} playedToday={playedToday} go={start} onHow={() => setScreen({ name: 'onboard' })} />;
      case 'missions':
        return (
          <MissionsPanel
            missions={missions}
            progress={progress}
            resetsIn={untilMidnightUTC(now)}
            patches={{ got: progress.badges.filter((b) => BADGES[b]).length, total: Object.keys(BADGES).length }}
            onClaim={(m) => {
              const c = claimMission(progress, m, today);
              if (!c.fuel) return;
              commit(c.progress);
              sfx.win();
              track(GAME, 'mission_claim', { mission: m.id });
              showToast(`Supply crate: +${c.fuel} fuel`);
            }}
            onClaimWeekly={() => {
              const c = claimWeekly(progress, today);
              if (!c.fuel) return;
              commit(c.progress);
              sfx.win();
              track(GAME, 'mission_claim', { mission: 'weekly' });
              showToast(`Weekly challenge: +${c.fuel} fuel`);
            }}
          />
        );
      case 'shop':
        return <ShopPanel progress={progress} onBuy={onBuy} now={now} />;
      case 'profile':
        return <ProfileTab progress={progress} streak={streak} onHow={() => setScreen({ name: 'onboard' })} />;
      default:
        return (
          <PathPanel
            sectors={SECTORS}
            progress={progress}
            selected={sectorId}
            onSelect={setSectorId}
            onStage={openStage}
            header={dailyCard}
          />
        );
    }
  })();

  const home = screen.name === 'home';
  return (
    <div className="app" ref={appRef}>
      {home ? (
        <StatBar stats={stats} right={muteBtn} />
      ) : (
        <div className="appbar">
          <button className="btn small" onClick={back}>
            <Icon name="back" size={16} /> Menu
          </button>
          {muteBtn}
        </div>
      )}
      {home ? (
        <>
          <div className="tabbody">{tabBody}</div>
          <TabBar tabs={TABS} active={tab} onPick={(id) => setTab(id as TabId)} />
        </>
      ) : (
        body
      )}
      {sharing && <ShareMenu data={sharing} onClose={() => setSharing(null)} toast={showToast} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ---------- Tabs and screens ----------

function PlayTab({
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
        <span className="ico" style={{ background: 'var(--yellow)' }}>
          <Rocket skin={progress.skin} size={30} />
        </span>
        <span>
          <span className="t">Daily Launch #{day}</span>
          <span className="d">
            {playedToday === undefined ? '60 seconds. Same problems for everyone today.' : `Done today: ${playedToday} correct. Tap for a practice run.`}
          </span>
        </span>
      </button>
      <button className="mode" onClick={() => go({ name: 'practice-setup' }, 'practice')}>
        <span className="ico" style={{ background: 'var(--accent-soft)' }}>🎯</span>
        <span>
          <span className="t">Practice {topic === 'mixed' ? '' : topicName}</span>
          <span className="d">Pick 30, 60 or 120 seconds. The heat meter adapts to you.</span>
        </span>
      </button>
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
      <button className="linkbtn" onClick={onHow}>
        How it works
      </button>
    </div>
  );
}

function ProfileTab({ progress, streak, onHow }: { progress: Progress; streak: number; onHow: () => void }) {
  const totalStages = SECTORS.reduce((n, s) => n + s.stages.length, 0);
  const cleared = SECTORS.reduce((n, s) => n + sectorDone(s, progress), 0);
  const got = Object.keys(BADGES).filter((id) => progress.badges.includes(id)).length;
  return (
    <div className="panel">
      <div className="profile-head">
        <span className="avatar">
          <Rocket skin={progress.skin} size={40} />
        </span>
        <div>
          <p className="eyebrow">Pilot</p>
          <h2 style={{ margin: 0 }}>Your flight log</h2>
          <p className="hint" style={{ margin: 0 }}>
            Best streak: {progress.bestDailyStreak} {progress.bestDailyStreak === 1 ? 'day' : 'days'}
          </p>
        </div>
      </div>
      <LevelBar xp={progress.xp} />
      <div className="logrid">
        <div className="logcell">
          <span style={{ color: 'var(--streak)' }}>
            <Icon name="flame" size={24} />
          </span>
          <div>
            <b>{streak}</b>
            <small>Day streak</small>
          </div>
        </div>
        <div className="logcell">
          <span style={{ color: '#8A6200' }}>
            <Glyph char="Σ" size={24} />
          </span>
          <div>
            <b>{progress.xp.toLocaleString()}</b>
            <small>Total XP</small>
          </div>
        </div>
        <div className="logcell">
          <span>
            <Icon name="star" size={24} />
          </span>
          <div>
            <b>{progress.bests['launch'] ?? 0}</b>
            <small>Best Launch</small>
          </div>
        </div>
        <div className="logcell">
          <span style={{ color: 'var(--teal)' }}>
            <Glyph char="÷" size={24} />
          </span>
          <div>
            <b>
              {cleared}/{totalStages}
            </b>
            <small>Stages cleared</small>
          </div>
        </div>
      </div>
      <div className="panel-head" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Mission patches</h3>
        <span className="eyebrow">
          {got} / {Object.keys(BADGES).length}
        </span>
      </div>
      <div className="patches">
        {Object.entries(BADGES).map(([id, b]) => {
          const has = progress.badges.includes(id);
          return (
            <div key={id} className={`patch ${has ? 'got' : ''}`} title={b.how}>
              <span className="patch-disc">{has ? b.icon : <Icon name="lock" size={20} />}</span>
              <span className="patch-name">{b.name}</span>
              <span className="patch-how">{b.how}</span>
            </div>
          );
        })}
      </div>
      <p className="device-note">Your progress is saved on this device. Sign-in to keep it everywhere is coming later.</p>
      <button className="linkbtn" onClick={onHow}>
        How it works
      </button>
    </div>
  );
}

function PracticeSetup({ topicName, boosts, onPick, onBack }: { topicName: string; boosts: number; onPick: (s: number) => void; onBack: () => void }) {
  return (
    <div className="stage result">
      <CalcBot mood="happy" size={88} />
      <h2>Practice {topicName}</h2>
      <p>How long?{boosts > 0 ? ` You have ${boosts} time boost${boosts > 1 ? 's' : ''}: +10 s gets added.` : ''}</p>
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

function Result({ r, xp, onAgain, onHome, onShare }: { r: ResultView; xp: number; onAgain: () => void; onHome: () => void; onShare: () => void }) {
  return (
    <div className="stage result" style={{ position: 'relative' }}>
      <Confetti go={r.best || r.earned.length > 0 || !!r.grant?.levelUp || (r.stars ?? 0) === 3} />
      <CalcBot mood={r.mood} size={104} />
      <h2>{r.title}</h2>
      {r.best && <div className="pill" style={{ marginBottom: 8 }}>New personal best!</div>}
      {r.stars !== undefined && (
        <div className="stars-big" aria-label={`${r.stars} of 3 stars`}>
          {[1, 2, 3].map((k) => (
            <span key={k} className={k <= (r.stars ?? 0) ? 'on pop' : ''}>
              <Icon name="star" size={34} fill={k <= (r.stars ?? 0)} />
            </span>
          ))}
        </div>
      )}
      <div className="big pop">{r.big}</div>
      <p style={{ marginTop: 6 }}>{r.sub}</p>
      {r.grant && <RewardStrip grant={r.grant} />}
      <LevelBar xp={xp} />
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
        <button className="btn primary block" onClick={onAgain}>
          {r.againLabel}
        </button>
        <button className="btn yellow block" onClick={onShare}>
          Share score
        </button>
        {!r.againLabel.startsWith('Back') && (
          <button className="linkbtn" onClick={onHome}>
            {r.home === 'path' ? 'Back to flight path' : 'Back to menu'}
          </button>
        )}
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
        <CalcSays mood="wave" size={80}>
          Hi, I'm Calc. Answer fast and the problems heat up.
        </CalcSays>
        <div className="demo" aria-hidden="true">
          <div className="demo-q">7 × 8</div>
          <div className="demo-a" />
          <div className="demo-heat" />
        </div>
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
        <CalcBot mood="cheer" size={110} />
        <h2>You've got it.</h2>
        <p>
          Every round earns XP and fuel. Play once a day to build your streak, clear stages on the flight path, and spend fuel on streak shields and
          rocket skins.
        </p>
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
        <p className="ctx" style={{ minHeight: 24 }}>
          {hint ? `Hint: it's ${round.problem.answer}` : 'Just type the answer'}
        </p>
      </div>
      <div className="answer caret">{round.input}</div>
      <Keypad onKey={round.press} />
    </div>
  );
}

// Mental Math Sprint's flight path and mission pool, fed to the shared progression core.

import type { MissionDef, SectorDef, StageDef } from '../../core/progression';
import type { RoundResult } from './modes/Launch';

function sector(id: string, name: string, topic: string): SectorDef {
  const s = (n: number, kind: StageDef['kind'], label: string, level: number): StageDef => ({ id: `${id}-${n}`, kind, label, level });
  return {
    id,
    name,
    topic,
    stages: [
      s(1, 'lesson', 'Warm-up', 1),
      s(2, 'lesson', 'Build speed', 3),
      s(3, 'lesson', 'Bigger numbers', 5),
      s(4, 'crate', 'Supply crate', 0),
      s(5, 'lesson', 'Pro numbers', 7),
      s(6, 'boss', 'Boss round', 6),
    ],
  };
}

export const SECTORS: SectorDef[] = [
  sector('add', 'Addition', 'addition'),
  sector('sub', 'Subtraction', 'subtraction'),
  sector('mul', 'Times tables', 'multiplication'),
  sector('div', 'Division', 'division'),
  sector('pct', 'Percentages', 'percentages'),
  sector('real', 'Real Life Math', 'real-life'),
];

export const LESSON_PROBLEMS = 10;
export const CRATE_STAGE_FUEL = 40;

export const MISSIONS: MissionDef[] = [
  { id: 'xp30', label: 'Earn 30 XP', metric: 'xp', target: 30 },
  { id: 'xp50', label: 'Earn 50 XP', metric: 'xp', target: 50 },
  { id: 'xp80', label: 'Earn 80 XP', metric: 'xp', target: 80 },
  { id: 'rounds2', label: 'Finish 2 rounds', metric: 'rounds', target: 2 },
  { id: 'rounds3', label: 'Finish 3 rounds', metric: 'rounds', target: 3 },
  { id: 'blazing', label: 'Reach Blazing heat', metric: 'heat', target: 6 },
  { id: 'daily', label: "Play today's Daily Launch", metric: 'daily', target: 1 },
  { id: 'stage', label: 'Clear a flight path stage', metric: 'mode', target: 1, mode: 'stage' },
  { id: 'defuse', label: 'Finish a Defuse round', metric: 'mode', target: 1, mode: 'defuse' },
  { id: 'reallife', label: 'Finish Real Life Math', metric: 'mode', target: 1, mode: 'real-life' },
  { id: 'quiz', label: 'Finish a quiz', metric: 'mode', target: 1, mode: 'quiz' },
];

/** Base XP per finished round, before Afterburner. */
export const XP = {
  launch: (r: RoundResult) => r.score + 5,
  defuse: (r: RoundResult & { won?: boolean }) => (r.won ? 15 + Math.floor((r.extra?.timeLeft ?? 0) / 3) : r.score),
  realLife: (r: RoundResult) => r.score * 2 + 5,
  lesson: (stars: number) => 10 + stars * 5,
  boss: (score: number, stars: number) => score + stars * 10,
  quiz: (score: number) => score + (score === 10 ? 10 : 0),
  sessionBonus: 10,
};

/** Which sector a sub-topic page should open on. */
export const sectorForTopic = (topic: string) => SECTORS.find((s) => s.topic === topic);

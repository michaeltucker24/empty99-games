// Screens for the shared progression layer: flight path, missions, fuel shop,
// level bar and the reward strip on result screens. Game-agnostic: each game
// passes its own sectors and mission pool.

import { useEffect, useRef } from 'react';
import { MAX_SHIELDS, type Progress } from '../core/progress';
import {
  CRATE_FUEL,
  SHOP,
  SKINS,
  WEEKLY_DAYS,
  WEEKLY_FUEL,
  isBoosted,
  levelInfo,
  missionStatus,
  sectorDone,
  sectorNodes,
  weeklyStatus,
  type Grant,
  type MissionDef,
  type SectorDef,
  type StageDef,
} from '../core/progression';
import { Bar } from './Chrome';
import { CalcSays } from './CalcBot';
import { Glyph, Icon, type IconName } from './Icons';
import { Rocket } from './Rocket';

// ---------- Level bar and reward strip ----------

export function LevelBar({ xp }: { xp: number }) {
  const l = levelInfo(xp);
  return (
    <div className="levelbar">
      <div className="levelbar-row">
        <span>Level {l.level}</span>
        <span>
          {l.into} / {l.need} XP
        </span>
      </div>
      <Bar value={l.into} max={l.need} color="var(--ink)" label={`Level ${l.level} progress`} />
    </div>
  );
}

export function RewardStrip({ grant }: { grant: Grant }) {
  return (
    <div className="rewards">
      <span className="reward xp">
        <Glyph char="+" size={18} />
        {grant.xp} XP{grant.boosted ? ' (2×)' : ''}
      </span>
      <span className="reward fuel">
        <Icon name="fuel" size={16} />+{grant.fuel} fuel
      </span>
      {grant.levelUp && <span className="reward up pop">Level {grant.levelUp}!</span>}
    </div>
  );
}

// ---------- Flight path ----------

const OFFSETS = [0, 58, 84, 58, 0, -58, -84, -58];

function nodeIcon(stage: StageDef, state: string): IconName {
  if (state === 'locked') return 'lock';
  if (stage.kind === 'crate') return 'crate';
  if (stage.kind === 'boss') return 'crown';
  if (state === 'done') return 'check';
  return 'play';
}

export function PathPanel({
  sectors,
  progress,
  selected,
  onSelect,
  onStage,
  header,
}: {
  sectors: SectorDef[];
  progress: Progress;
  selected: string;
  onSelect: (id: string) => void;
  onStage: (stage: StageDef, sector: SectorDef) => void;
  header?: React.ReactNode;
}) {
  const sector = sectors.find((s) => s.id === selected) ?? sectors[0];
  const nodes = sectorNodes(sector, progress);
  const doneCount = sectorDone(sector, progress);
  const current = nodes.find((n) => n.state === 'current');
  const chips = useRef<HTMLDivElement>(null);
  // Keep the selected sector chip visible (sub-topic pages open on a later sector).
  useEffect(() => {
    const el = chips.current?.querySelector<HTMLElement>('.sector-chip.on');
    if (el && chips.current) chips.current.scrollLeft = el.offsetLeft - chips.current.offsetLeft - 8;
  }, [sector.id]);
  return (
    <div className="pathpanel">
      {header}
      <div className="sector-chips" role="tablist" aria-label="Sectors" ref={chips}>
        {sectors.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === sector.id}
            className={`sector-chip ${s.id === sector.id ? 'on' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            {s.name}
            <small>
              {sectorDone(s, progress)}/{s.stages.length}
            </small>
          </button>
        ))}
      </div>
      <div className="sector-head">
        <div>
          <p className="eyebrow">
            Sector {sectors.indexOf(sector) + 1} · {doneCount}/{sector.stages.length} stages
          </p>
          <h3>{sector.name}</h3>
        </div>
        <Bar value={doneCount} max={sector.stages.length} label={`${sector.name} progress`} />
      </div>
      <div className="flight">
        <div className="flight-calc">
          <CalcSays mood={current ? 'wave' : 'cheer'} size={64}>
            {current ? `Next up: ${current.stage.label}` : 'Sector cleared! Pick another one.'}
          </CalcSays>
        </div>
        {nodes.map((n, i) => {
          const x = OFFSETS[i % OFFSETS.length];
          const midX = (x + OFFSETS[(i + 1) % OFFSETS.length]) / 2;
          const isCurrent = n.state === 'current';
          return (
            <div key={n.stage.id} className="flight-step">
              <div className="flight-node-wrap" style={{ transform: `translateX(${x}px)` }}>
                {isCurrent && <span className="node-label">{n.stage.label}</span>}
                <button
                  className={`node ${n.state} ${n.stage.kind}`}
                  disabled={n.state === 'locked'}
                  onClick={() => onStage(n.stage, sector)}
                  aria-label={`${n.stage.label}: ${n.state === 'done' ? `done, ${n.stars} stars` : n.state === 'current' ? 'start' : 'locked'}`}
                >
                  <Icon name={nodeIcon(n.stage, n.state)} size={isCurrent ? 32 : 26} stroke={2.4} fill={isCurrent && n.stage.kind === 'lesson'} />
                </button>
                {n.state === 'done' && n.stage.kind !== 'crate' && (
                  <span className="node-stars" aria-hidden="true">
                    {[1, 2, 3].map((k) => (
                      <i key={k} className={k <= n.stars ? 'on' : ''} />
                    ))}
                  </span>
                )}
                {n.stage.kind === 'boss' && n.state !== 'current' && <span className="node-cap">Boss round</span>}
              </div>
              {i < nodes.length - 1 && (
                <div className="trail" style={{ transform: `translateX(${midX}px)` }} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Missions ----------

export function MissionsPanel({
  missions,
  progress,
  onClaim,
  onClaimWeekly,
  resetsIn,
  patches,
}: {
  missions: MissionDef[];
  progress: Progress;
  onClaim: (m: MissionDef) => void;
  onClaimWeekly: () => void;
  resetsIn: string;
  patches: { got: number; total: number };
}) {
  const weekly = weeklyStatus(progress);
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Daily missions</h2>
        <span className="eyebrow warn">Resets in {resetsIn}</span>
      </div>
      <div className="list">
        {missions.map((m) => {
          const s = missionStatus(progress, m);
          return (
            <div key={m.id} className="list-row">
              <div className="grow">
                <p className="row-title">{m.label}</p>
                <div className="bar-label">
                  <Bar value={s.value} max={m.target} color={s.done ? '#5DCAA5' : 'var(--yellow)'} label={m.label} />
                  <span>
                    {s.value}/{m.target}
                  </span>
                </div>
              </div>
              {s.claimed ? (
                <span className="crate-slot open" aria-label="Crate opened">
                  <Icon name="check" size={22} />
                </span>
              ) : s.done ? (
                <button className="btn yellow small" onClick={() => onClaim(m)}>
                  Open +{CRATE_FUEL}
                </button>
              ) : (
                <span className="crate-slot" aria-label="Crate locked">
                  <Icon name="crate" size={22} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="section-title">Weekly challenge</h3>
      <div className="card ink">
        <div className="card-row">
          <p className="row-title">Play on {WEEKLY_DAYS} days this week</p>
          <span className="fuel-tag">
            <Icon name="fuel" size={16} />
            {WEEKLY_FUEL}
          </span>
        </div>
        <Bar value={weekly.days} max={WEEKLY_DAYS} label="Weekly challenge" />
        <div className="card-row" style={{ marginTop: 8 }}>
          <span className="muted-on-ink">
            {weekly.days} of {WEEKLY_DAYS} days
          </span>
          {weekly.done && !weekly.claimed && (
            <button className="btn yellow small" onClick={onClaimWeekly}>
              Claim
            </button>
          )}
          {weekly.claimed && <span className="muted-on-ink">Claimed</span>}
        </div>
      </div>

      <h3 className="section-title">Mission patches</h3>
      <div className="card">
        <div className="card-row">
          <p className="row-title">
            {patches.got} of {patches.total} patches earned
          </p>
          <span className="eyebrow">See Profile</span>
        </div>
        <Bar value={patches.got} max={patches.total} label="Patches earned" />
      </div>
    </div>
  );
}

// ---------- Fuel shop ----------

const SHOP_ICONS: Record<string, IconName> = { shield: 'shield', afterburner: 'bolt', timeboost: 'clock' };
const SHOP_COLORS: Record<string, string> = { shield: '#5DCAA5', afterburner: 'var(--yellow)', timeboost: 'var(--ink)' };

export function ShopPanel({ progress, onBuy, now }: { progress: Progress; onBuy: (id: string) => void; now: number }) {
  const boostLeft = Math.max(0, Math.ceil((progress.boostUntil - now) / 60_000));
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Fuel shop</h2>
        <span className="fuel-balance">
          <Icon name="fuel" size={18} />
          {progress.fuel}
        </span>
      </div>
      <p className="hint">Earn fuel from every round, supply crates and level-ups.</p>
      <h3 className="section-title">Power-ups</h3>
      <div className="list">
        {SHOP.map((item) => {
          const owned =
            item.kind === 'shield'
              ? `${progress.shields}/${MAX_SHIELDS} owned`
              : item.kind === 'afterburner' && isBoosted(progress, now)
                ? `On: ${boostLeft} min left`
                : item.kind === 'timeboost' && progress.timeBoosts > 0
                  ? `${progress.timeBoosts} ready`
                  : '';
          const full = item.kind === 'shield' && progress.shields >= MAX_SHIELDS;
          return (
            <div key={item.id} className="list-row">
              <span className="shop-ico" style={{ background: SHOP_COLORS[item.kind], color: item.kind === 'timeboost' ? '#fff' : 'var(--ink)' }}>
                <Icon name={SHOP_ICONS[item.kind]} size={22} />
              </span>
              <div className="grow">
                <p className="row-title">{item.name}</p>
                <p className="row-sub">
                  {item.blurb}
                  {owned ? ` · ${owned}` : ''}
                </p>
              </div>
              {full ? (
                <span className="tag-full">Full</span>
              ) : (
                <button className="btn small price" onClick={() => onBuy(item.id)} aria-label={`Buy ${item.name} for ${item.price} fuel`}>
                  <Icon name="fuel" size={15} />
                  {item.price}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <h3 className="section-title">Rocket skins</h3>
      <div className="skins">
        {SKINS.map((s) => {
          const owned = progress.skins.includes(s.id);
          const on = progress.skin === s.id;
          const locked = !owned && s.streakUnlock !== undefined && progress.bestDailyStreak < s.streakUnlock;
          const tag = on ? 'Equipped' : owned ? 'Tap to equip' : s.streakUnlock ? `${s.streakUnlock}-day streak` : `${s.price} fuel`;
          return (
            <button key={s.id} className={`skin ${on ? 'on' : ''} ${locked ? 'locked' : ''}`} onClick={() => onBuy(s.id)} aria-label={`${s.name} rocket: ${tag}`}>
              <span className="skin-disc">
                <Rocket skin={s.id} size={34} />
              </span>
              <span className="row-title">{s.name}</span>
              <span className="skin-tag">{tag}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

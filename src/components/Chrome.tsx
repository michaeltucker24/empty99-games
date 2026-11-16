// App chrome shared by every game: the stat bar (streak, fuel, level, shields)
// with tap-to-explain, and the bottom tab bar (icon + word under it).

import { useState } from 'react';
import { Glyph, Icon, type IconName } from './Icons';

export interface Stat {
  id: string;
  icon: IconName | { glyph: string };
  value: string;
  color: string;
  explain: string;
}

export function StatBar({ stats, right }: { stats: Stat[]; right?: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = stats.find((s) => s.id === open);
  return (
    <div className="statbar-wrap">
      <div className="statbar">
        {stats.map((s) => (
          <button
            key={s.id}
            className={`stat-chip ${open === s.id ? 'on' : ''}`}
            style={{ color: s.color }}
            aria-expanded={open === s.id}
            aria-label={`${s.value} ${s.id}. ${s.explain}`}
            onClick={() => setOpen(open === s.id ? null : s.id)}
          >
            {typeof s.icon === 'string' ? <Icon name={s.icon} size={20} /> : <Glyph char={s.icon.glyph} size={20} />}
            <span>{s.value}</span>
          </button>
        ))}
        {right}
      </div>
      {current && (
        <div className="stat-tip" role="status">
          {current.explain}
        </div>
      )}
    </div>
  );
}

export interface Tab {
  id: string;
  label: string;
  icon: IconName | { glyph: string };
}

export function TabBar({ tabs, active, onPick }: { tabs: Tab[]; active: string; onPick: (id: string) => void }) {
  return (
    <nav className="tabbar" aria-label="Game sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab ${active === t.id ? 'on' : ''}`}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onPick(t.id)}
        >
          {typeof t.icon === 'string' ? <Icon name={t.icon} size={22} /> : <Glyph char={t.icon.glyph} size={24} />}
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** A thin progress bar with an ink outline. */
export function Bar({ value, max, color = 'var(--yellow)', label }: { value: number; max: number; color?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

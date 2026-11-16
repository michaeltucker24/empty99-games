// The player's rocket, drawn in SVG so shop skins can recolor it.

import { SKINS } from '../core/progression';

export function Rocket({ skin = 'classic', size = 44, flame = false }: { skin?: string; size?: number; flame?: boolean }) {
  const s = SKINS.find((k) => k.id === skin) ?? SKINS[0];
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 40 50" aria-hidden="true">
      {flame && <path className="rocket-flame" d="M14 38q6 14 12 0z" fill="#FF7A1A" stroke="#16161A" strokeWidth="2" strokeLinejoin="round" />}
      <path d="M12 30l-7 6v5l8-4z M28 30l7 6v5l-8-4z" fill={s.trim} stroke="#16161A" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M20 3c7 5 10 15 8 34H12C10 18 13 8 20 3z" fill={s.body} stroke="#16161A" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="20" cy="18" r="4.5" fill="#5DCAA5" stroke="#16161A" strokeWidth="2.2" />
      <path d="M13 31h14" stroke={s.trim} strokeWidth="3" />
    </svg>
  );
}

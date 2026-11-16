// Line icons for the game chrome: sharp square ends, drawn on a 24 px grid.
// Math symbols (÷ √ π + Σ %) are typed as text in the Archivo font instead.

const PATHS = {
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1 2.6 2 3 0-3.2-.5-5.5.5-8z',
  fuel: 'M12 3l6 8a6 6 0 1 1-12 0z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  check: 'M5 12l5 5 9-10',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z',
  crate: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
  crown: 'M4 18h16 M4 18L3 7l5 4 4-6 4 6 5-4-1 11',
  store: 'M4 9l2-5h12l2 5 M4 9h16v11H4z M9 20v-6h6v6',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7v5l3 2',
  play: 'M8 5v14l11-7z',
  sound: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6',
  mute: 'M4 9h4l5-4v14l-5-4H4z M16 9l5 6 M21 9l-5 6',
  back: 'M20 12H6 M11 6l-6 6 6 6',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, stroke = 2, fill = false }: { name: IconName; size?: number; stroke?: number; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** A math symbol used as an icon (÷, √, π, +, Σ, %). */
export function Glyph({ char, size = 24 }: { char: string; size?: number }) {
  return (
    <span className="glyph" aria-hidden="true" style={{ fontSize: size, width: size, height: size, lineHeight: `${size}px` }}>
      {char}
    </span>
  );
}

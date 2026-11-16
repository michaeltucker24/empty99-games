// Calc: the studio's calculator-robot mascot. Its screen changes with the mood,
// so it can react to the player without any frame-by-frame animation.

export type Mood = 'idle' | 'happy' | 'wave' | 'cheer' | 'worried' | 'wow';

const INK = '#16161A';
const YELLOW = '#FFD23F';

function Screen({ mood }: { mood: Mood }) {
  if (mood === 'idle')
    return (
      <text x="55" y="48" textAnchor="middle" fontFamily="'Archivo Variable', sans-serif" fontWeight="800" fontSize="20" fill={YELLOW}>
        99
      </text>
    );
  if (mood === 'cheer')
    return (
      <>
        <path
          d="M45 32l1.8 4 4.2.4-3.2 2.8 1 4.2L45 41.2 41.2 43.4l1-4.2-3.2-2.8 4.2-.4z M65 32l1.8 4 4.2.4-3.2 2.8 1 4.2L65 41.2 61.2 43.4l1-4.2-3.2-2.8 4.2-.4z"
          fill={YELLOW}
        />
        <path d="M48 48q7 5 14 0" stroke={YELLOW} strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    );
  if (mood === 'worried')
    return (
      <>
        <path d="M40 40h10 M60 40h10 M47 49q8-4 16 0" stroke={YELLOW} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M74 30q3 5 0 7q-3-2 0-7z" fill="#5DCAA5" />
      </>
    );
  if (mood === 'wow')
    return (
      <>
        <circle cx="45" cy="39" r="5" fill="none" stroke={YELLOW} strokeWidth="3.5" />
        <circle cx="65" cy="39" r="5" fill="none" stroke={YELLOW} strokeWidth="3.5" />
        <circle cx="55" cy="50" r="2.5" fill={YELLOW} />
      </>
    );
  // happy, wave
  return <path d="M40 45q5-8 10 0 M60 45q5-8 10 0" stroke={YELLOW} strokeWidth="4" fill="none" strokeLinecap="round" />;
}

export function CalcBot({ mood = 'happy', size = 96, label }: { mood?: Mood; size?: number; label?: string }) {
  const armsUp = mood === 'cheer';
  const wave = mood === 'wave';
  return (
    <svg
      className={`calcbot ${mood}`}
      width={size}
      height={size}
      viewBox="0 0 110 110"
      role="img"
      aria-label={label ?? 'Calc, the mascot'}
    >
      <line x1="55" y1="8" x2="55" y2="18" stroke={INK} strokeWidth="4" />
      <circle cx="55" cy="7" r="5" fill={YELLOW} stroke={INK} strokeWidth="3" />
      {(armsUp || wave) && (
        <g className={wave ? 'calc-wave' : undefined}>
          <path d="M86 58l16-20" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="103" cy="36" r="5" fill={YELLOW} stroke={INK} strokeWidth="3" />
        </g>
      )}
      {armsUp && (
        <>
          <path d="M24 58L8 38" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="7" cy="36" r="5" fill={YELLOW} stroke={INK} strokeWidth="3" />
        </>
      )}
      <rect x="24" y="18" width="62" height="84" rx="10" fill={YELLOW} stroke={INK} strokeWidth="4" />
      <rect x="32" y="27" width="46" height="28" rx="4" fill={INK} />
      <Screen mood={mood} />
      <g fill={INK}>
        <rect x="33" y="62" width="12" height="10" rx="2" />
        <rect x="49" y="62" width="12" height="10" rx="2" />
        <rect x="65" y="62" width="12" height="10" rx="2" />
        <rect x="33" y="78" width="12" height="10" rx="2" />
        <rect x="49" y="78" width="12" height="10" rx="2" />
      </g>
      <rect x="65" y="78" width="12" height="10" rx="2" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

/** Calc with a speech bubble. */
export function CalcSays({ mood = 'happy', size = 72, children }: { mood?: Mood; size?: number; children: React.ReactNode }) {
  return (
    <div className="calcsays">
      <CalcBot mood={mood} size={size} />
      <div className="bubble">{children}</div>
    </div>
  );
}

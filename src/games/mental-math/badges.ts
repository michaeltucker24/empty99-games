// Mission patches (badges). Shown on the Profile tab and on result screens.
export const BADGES: Record<string, { name: string; icon: string; how: string }> = {
  'first-launch': { name: 'Liftoff', icon: '🚀', how: 'Finish your first daily Launch' },
  'first-stage': { name: 'Cleared for Takeoff', icon: '🛫', how: 'Clear your first flight path stage' },
  'streak-3': { name: 'On a Roll', icon: '📅', how: '3-day streak' },
  'streak-7': { name: 'Week Warrior', icon: '🗓️', how: '7-day streak' },
  inferno: { name: 'Inferno', icon: '🔥', how: 'Reach Inferno heat' },
  boss: { name: 'Boss Breaker', icon: '👑', how: 'Beat a boss round' },
  'sector-clear': { name: 'Sector Cleared', icon: '🪐', how: 'Finish every stage in a sector' },
  defused: { name: 'Bomb Squad', icon: '💣', how: 'Defuse the bomb' },
  'clean-defuse': { name: 'Steady Hands', icon: '✂️', how: 'Defuse with zero misses' },
  'real-life': { name: 'Bill Boss', icon: '🧾', how: '10 right in Real Life Math' },
  'sharp-30': { name: 'Sharp Mind', icon: '⚡', how: '30+ correct in one Launch' },
  session: { name: 'Full Session', icon: '🏆', how: 'Finish a 3-game session' },
  'quiz-perfect': { name: 'Perfect Quiz', icon: '💯', how: '10/10 on a quiz' },
};

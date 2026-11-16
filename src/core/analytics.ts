// Thin analytics layer. Every game sends the same events so they compare on one dashboard.
// PostHog loads only if PUBLIC_POSTHOG_KEY is set at build time; otherwise this is a no-op.

export type GameEvent =
  | 'round_start'
  | 'round_end'
  | 'share_click'
  | 'return_visit'
  | 'printable_made'
  | 'quiz_end'
  | 'stage_end'
  | 'mission_claim'
  | 'shop_buy'
  | 'level_up';

declare global {
  interface Window {
    posthog?: { capture: (event: string, props?: Record<string, unknown>) => void };
  }
}

export function track(game: string, event: GameEvent, props: Record<string, unknown> = {}): void {
  try {
    window.posthog?.capture(event, { app: 'empty99-games', game, ...props });
  } catch {
    /* analytics must never break a game */
  }
}

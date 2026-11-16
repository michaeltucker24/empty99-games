# empty99-games

Free learning games for Empty 99 Studios, served at empty99studios.com/<game>. The studio homepage is a separate repo (`empty99-site`); Cloudflare routes only game paths here.

Plan and decisions live in the Empty 99 Studios claude.ai project: `claude/learning-games-plan.md` and `claude/web-games-platform-blueprint.md`. Read them before adding a game.

## Stack
- Astro (static) + React islands (`client:only="react"`), TypeScript, Vitest.
- Hosting: Cloudflare Workers static assets (`wrangler.jsonc`). Assets build to `/_games/`.
- No accounts, no server code in V1. Progress lives in localStorage (`src/core/progress.ts`).

## Layout
- `src/core/`: shared engine (seeded RNG + daily seed, heat meter, progress/streaks/badges, share text + story card, sound, analytics, game contract).
- `src/components/`: `useRound` (auto-submit answer engine + countdown) and UI pieces (keypad, heat meter, combo, confetti).
- `src/games/<slug>/`: one folder per game. `logic.ts` is pure and tested; modes in `modes/`; SEO copy in `content.ts`; one `GamePage.astro` template for hub + sub-topic pages.
- `src/pages/<slug>/`: hub `index.astro`, `[topic].astro` for sub-topic SEO pages, `worksheets.astro` for printables.

## Rules
- Games never import from other games, only from `core/` and `components/`.
- Game logic is pure functions with tests. Every answer whole numbers where typed on a keypad.
- Every game emits the same analytics events (`round_start`, `round_end`, `share_click`, `return_visit`, `quiz_end`, `printable_made`).
- Standard page format per game: mini-game modes, heat-meter difficulty, rewards, sub-topic pages, quizzes + flashcards, printables. Embeds later.

## Commands
`npm run dev` · `npm test` · `npm run check` · `npm run build` · `npm run deploy` (needs Cloudflare login)

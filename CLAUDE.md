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
- Progression (shared by every game): `core/progression.ts` (XP/levels, fuel, daily missions + supply crates, weekly challenge, fuel shop, rocket skins, flight path stages) over `core/progress.ts` (streak with streak shields). UI in `components/`: `CalcBot` (mascot, moods), `Chrome` (stat bar with tap-to-explain, tab bar with icon + label), `ProgressionPanels` (Path, Missions, Shop, level bar, reward strip), `Rocket` (skinnable SVG), `Icons`. A game supplies its sectors, mission pool and XP rules (Mental Math: `games/mental-math/path.ts`).
- Look: yellow `#FFD23F`, ink `#16161A`, white; Archivo (condensed headings via `font-stretch`); 2–2.5 px ink outlines with hard offset shadows (`4px 4px 0`). Math symbols as icons (÷ Path, √ Missions, π Profile, + XP, Σ total XP), always with a word label. Keep it from looking like any one app (no rounded bubbly fonts, no 3D bottom-edge buttons, no gems/leagues/hearts naming).
- `src/games/<slug>/`: one folder per game. `logic.ts` is pure and tested; modes in `modes/`; SEO copy in `content.ts`; one `GamePage.astro` template for hub + sub-topic pages.
- `src/pages/<slug>/`: hub `index.astro`, `[topic].astro` for sub-topic SEO pages, `worksheets.astro` for printables.

## Rules
- Games never import from other games, only from `core/` and `components/`.
- Game logic is pure functions with tests. Every answer whole numbers where typed on a keypad.
- Every game emits the same analytics events (`round_start`, `round_end`, `share_click`, `return_visit`, `quiz_end`, `printable_made`).
- Standard page format per game: mini-game modes, heat-meter difficulty, rewards, sub-topic pages, quizzes + flashcards, printables. Embeds later.

## Social preview images
After adding or renaming pages: `npm run build && python3 scripts/make_og.py && npm run build`, then commit `public/<game>/og/*.png`. Add a per-page badge in `BADGES` in the script.

## Commands
`npm run dev` · `npm test` · `npm run check` · `npm run build` · `npm run deploy` (needs Cloudflare login)

# Story Framework

A mobile-first web framework for 5–10 minute interactive stories with AI characters.
Stories are JSON bundles; the framework plays them. Three modes: choices (MCQ), free text, voice.

## Quickstart
1. `pnpm install`
2. `cp .env.example .env` and set `OPENAI_API_KEY`
3. `pnpm dev` → gateway :8787, web :5173 (open on a phone-sized viewport)

## Commands
- `pnpm test` — all unit tests (no API key needed)
- `pnpm e2e` — Playwright flow with a mocked gateway (no API key needed)
- `pnpm typecheck`

## Add a story
Create `stories/<id>/` with `story.json` (public: scene, characters, beats, challenges,
endings), `secrets.json` (server-only: character secrets, judging rubrics), and `assets/`.
The server validates bundles at boot and fails fast with the exact path of any error.
No framework code changes needed.

## Known v1 limits
- Timed challenges keep counting only while the tab is visible and no AI call is in flight;
  going offline disables input but does not add a pause reason.
- Character audio plays in voice mode only.

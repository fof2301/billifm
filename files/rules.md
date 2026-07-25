# rules.md — Working Rules for Building Sutradhar

These rules bind every contributor and every AI coding session on this repo. When in doubt, re-read this file before writing code.

## 1. Prime directive
The demo is the product. Every line of code must serve one of the six demo moments (duck/dim, torch, haptics, fake call, silence test, callback). If a task doesn't map to a demo moment, don't do it.

## 2. Scope rules (YAGNI, enforced)
- No auth, no user accounts, no settings screens, no onboarding. One hardcoded listener: `listener_id = "demo"`.
- No database if a JSON file works. Listener state lives in `state/listener.json` on the server. Do not introduce Postgres/Supabase unless file writes actually break.
- No abstraction until the second use. One story, one episode, one event track — do not build a "story management system."
- Android only. Do not write iOS conditionals, do not test on iOS, do not discuss iOS.
- Pre-generate everything that can be pre-generated: branch audios, the episode narration, backup voice notes. Live generation only where liveness IS the demo (the villain call, the heroine callback).

## 3. Code rules
- Stack is fixed: Expo (React Native) app + one FastAPI (Python) server. No new frameworks, no monorepo tooling, no Docker for the hackathon.
- Every effect handler is one file in `app/effects/` with a single exported `run(event, ctx)` function. No effect may import another effect.
- The event engine is dumb: it compares audio position to `event.t` and calls the handler. All intelligence lives in the JSON, not the engine.
- Agent prompts live in `server/prompts/*.md` as plain markdown — never inline in code. Prompt changes must not require app redeploys.
- All secrets in `.env`, never committed. `.env.example` lists every required key.
- Commit small and often; every commit message states which demo moment it advances.

## 4. Character & content rules
- **Decision points are conversations, never menus. Options A/B/C exist only in the schema — NEVER on screen, never spoken as a list by any character.** Unmappable input gets the gracious in-character fallback; the agent never says "invalid," never breaks character, never stalls the story.
- Characters may never reveal story events beyond `listener.episode_progress`. The server enforces this by only injecting canon up to that episode — never rely on the prompt alone saying "don't spoil."
- Agent turns: max 2 sentences. Long TTS turns kill the illusion on a call.
- The villain never threatens real-world violence toward the listener, never references the listener's real location, family, or personal data. Menace stays inside the fiction.
- Mic use: amplitude metering only. Never record, store, or transmit audio from `mic_listen`. This is a hard privacy rule and a pitch point.
- All story content is original IP written by us. No real serial names, no celebrity voices, no cloned voices of real people.

## 5. Demo-safety rules
- Every live component has a rehearsed fallback: call fails → play pre-recorded call audio; SMS delayed → show pre-staged phone screenshot; network dies → full backup screen recording exists and has been watched end-to-end.
- The demo phone is sacred: exact device tested, DND configured to allow our number, brightness/volume presets scripted, battery >80%, hotspot backup ready.
- Nothing merges to `main` on demo day after T-minus 3 hours. Freeze means freeze.

## 6. AI coding session rules (Claude Code)
- Read `architecture.md` and the current phase in `phases.md` before generating code.
- Never regenerate a working effect handler wholesale; patch it.
- After any change to the event engine or an effect, run the 6-minute episode end-to-end before marking the task done.
- Update `memory.md` at the end of every working session (decisions made, what works, what's broken).

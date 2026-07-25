# Interactive Story Framework — Design

**Date:** 2026-07-25
**Status:** Approved pending final review

## 1. What this is

A reusable framework for short (5–10 minute) interactive story experiences played in a mobile browser. A story drops the player into a fixed scene (a cellar, a bedroom), introduces AI characters they can talk to, runs a story clock where real minutes map to story days, and challenges them against the clock. The player converses through one of three modes — **voice**, **free text**, or **MCQ** — switchable mid-story.

The framework is the product. Stories are data: JSON bundles the framework loads and plays. Nothing story-specific lives in framework code. Two minimal reference stories ship with v1 to prove the format generalizes:

- **Kidnapping escape** — thriller; stress-tests timers, challenges, tension pacing, a small cast.
- **Ancestor tree** — explorative; stress-tests a larger character roster, personality variety, per-character conversation history.

## 2. Decisions log

| Decision | Choice |
|---|---|
| Platform | Mobile-first responsive web app |
| Players | Single-player; every other person in a story is an AI character |
| Voice architecture | Push-to-talk pipeline: STT → shared dialogue engine → TTS |
| Content model | Fixed pre-authored story spine; LLM improvises dialogue within it |
| AI providers | OpenAI for LLM + Whisper STT + TTS, behind provider-agnostic interfaces |
| Architecture | Client-side engine + thin server-side AI gateway |
| Stage layout | Immersive overlay (scene fills screen; UI floats over it) |
| Reference content | Both stories, minimal versions |
| Constraint | No company names anywhere in code, docs, or UI |

## 3. Architecture

```
MONOREPO (pnpm workspaces, TypeScript, Node 20+)
├─ packages/schema     Zod StoryBundle schemas + shared types
├─ packages/engine     pure TS story state machine (no DOM, no network)
├─ apps/web            Vite + React + Tailwind player shell
├─ apps/server         Hono AI gateway + better-sqlite3
└─ stories/            story bundles (story.json + secrets.json + assets/)

BROWSER                            SERVER
┌──────────────────────┐          ┌───────────────────────────┐
│ Player shell (React) │          │ story bundles + secrets   │
│ engine (state, clock,│──POST───▶│ prompt assembly           │
│ modes, timers)       │  message │ OpenAI calls (LLM/STT/TTS)│
│ localStorage resume  │◀──reply──│ challenge judging         │
└──────────────────────┘  +audio  │ SQLite session snapshots  │
                                  └───────────────────────────┘
```

Why this split: the engine runs client-side so the UI and timers are instant and the engine is unit-testable in isolation; the server exists to hold the API key, hold story **secrets** (players must not find spoilers in devtools), assemble prompts, and judge challenge outcomes so wins are never decided client-side.

## 4. The StoryBundle format

A story is a folder: `stories/<id>/story.json` (public), `stories/<id>/secrets.json` (server-only), `stories/<id>/assets/`. Both JSON files are validated against Zod schemas from `packages/schema` at server boot — a malformed story fails fast, never mid-game.

### 4.1 Public bundle (`story.json`)

- **meta** — `id`, `title`, `tagline`, `genre`, `estimatedMinutes`, `cover`, `modes` (subset of `["mcq","text","voice"]` the story supports).
- **clock** — `realMinutesPerStoryDay`, `totalStoryDays` (story force-ends when exceeded), `phases` (e.g. `["dawn","day","dusk","night"]`; each story day is divided evenly across them).
- **scene** — the base setting: per-phase background assets (`backgrounds`: looping video or static image per phase), `ambientAudio`. Scenes rarely change; a beat may override the scene, but the format treats that as the exception.
- **characters[]** — `id`, `name`, `role`, `portrait`, `personality` (persona prompt), `voice` (`voiceId` + `instructions`), `greeting`, `availability` (`beats` list or `"*"`, `phases` list). Unavailable characters render dimmed/unreachable.
- **beats[]** — the ordered spine. Each: `id`, `narration`, `objective`, `characters` (reachable here), `challenges` (triggered here), `transitions[]` (`when` conditions on flags/clock → `goto` beat).
- **challenges[]** — `id`, `type` (`"mcq"` | `"task"`), `prompt`, `timeLimitSeconds`, and:
  - `mcq`: `options[]` with per-option `onPick` effects (set flags, goto beat).
  - `task`: solved by conversing; the server judges the transcript against a secret rubric. `onSuccess` / `onFailure` effects.
- **clues[]** — `id`, `title`, `text`; unlocked by effects, shown in a clue drawer, injected into character prompts.
- **flags** — implicit string set; effects set them, transitions and endings test them.
- **endings[]** — `id`, `when` (flags / `clockExpired` / `clockAtLeast`), `title`, `text`. First matching ending wins; order matters.

### 4.2 Secrets file (`secrets.json`)

Never served to the client. Merged in server-side during prompt assembly and judging:

- **characters.<id>.secrets** — what the character knows and under what conditions they reveal it.
- **characters.<id>.hardLimits** — things the character never does/reveals.
- **judging.<challengeId>.rubric** — success criteria the LLM judge applies to the transcript for `task` challenges.

### 4.3 Effects vocabulary

Everything that "happens" is one effects object, used by challenge outcomes and MCQ picks: `setFlags[]`, `unlockClues[]`, `unlockCharacters[]`, `goto` (beat). Small on purpose; grows only when a real story needs more.

## 5. The engine (`packages/engine`)

Pure TypeScript state machine, zero DOM/network dependencies — importable later by a native app unchanged.

**Session state** (one serializable object): `storyId`, `beatId`, `flags`, `cluesFound`, `elapsedRealMs`, `activeChallenge` (`id` + `deadlineMs`), per-character `transcripts`, `activeCharacterId`, `mode`, `endingId?`.

**Reducer contract:** `dispatch(action) → { state, effects[] }`. The engine never performs I/O; it emits **effects** the shell fulfills.

- Actions: `TICK`, `SELECT_CHARACTER`, `PLAYER_MESSAGE`, `CHARACTER_REPLY`, `MCQ_PICK`, `CHALLENGE_RESOLVED`, `SET_MODE`, `PAUSE` / `RESUME`.
- Effects: `REQUEST_DIALOGUE`, `REQUEST_JUDGE`, `PLAY_AUDIO`, `PHASE_CHANGED` (UI crossfades background), `BEAT_CHANGED`, `SNAPSHOT` (persist), `STORY_ENDED`.

**Story clock:** the shell dispatches `TICK` once per second; the engine converts `elapsedRealMs` into story day + phase from the clock config. The clock **pauses** when: the tab is hidden (mobile reality), an AI request is in flight during an active challenge (network latency never eats the player's time), or the player opens settings. Challenge countdowns run on the same tick; expiry dispatches failure effects.

**Three modes, one pipeline:** every input normalizes to `PlayerMessage { text, source: 'mcq'|'text'|'voice' }`; the engine is source-agnostic.

- **MCQ mode, challenges:** options come pre-authored from the bundle; picks resolve deterministically with no AI call.
- **MCQ mode, free conversation:** the dialogue response includes 2–3 LLM-generated suggested replies rendered as tappable chips (see §7). This is the "generated dynamically based on mode" behavior — MCQ players still get living conversations without typing.
- **Text mode:** typed message → `REQUEST_DIALOGUE`.
- **Voice mode:** hold-to-talk → audio → STT → same path; the reply comes back with TTS audio.

**Persistence:** after every action, the session serializes to `localStorage` (refresh-proof resume mid-story). On `BEAT_CHANGED` and `STORY_ENDED`, a snapshot POSTs to the server (SQLite) under an anonymous device id (UUID in `localStorage`) — this powers reviewing past conversations after a story ends.

## 6. The player shell (`apps/web`)

Vite + React + Tailwind, mobile-first, safe-area aware. CSS transitions only (no animation library until a real need appears).

**Screens:** `Library` (story cards from `GET /api/stories`) → `Intro` (cover, context, mode picker limited to `meta.modes`, mic permission request if voice) → `Stage` → `Ending` (which ending, replay, review conversations).

**Stage — immersive overlay layout** (chosen over split-panel via mockups):

- **Background layer:** current phase's scene asset, full-bleed; crossfade on `PHASE_CHANGED`. v1 reference stories ship with static images / CSS-animated gradient scenes with per-phase color grading; the format supports looping video from day one (the content pipeline that generates real videos is a later project).
- **Top bar (floating chips):** story clock ("Day 2 · Night" with phase icon) and, during a challenge, the countdown chip; objective chip beneath.
- **Character rail:** floating avatar column; available characters lit, others dimmed; active character ringed; unread-reply badge.
- **Conversation sheet:** translucent bottom sheet over the scene showing the active character's transcript; drag to expand/collapse; voice lines get a replay-audio button.
- **Input dock:** fixed at the bottom; contents swap by mode — MCQ chips / text field + send / hold-to-talk mic button. Mode switcher in settings, offering only `meta.modes`.
- **Clue drawer:** small icon opens found clues.
- **Narration:** beat narration renders as an overlay card on `BEAT_CHANGED`, dismissible.

## 7. The AI gateway (`apps/server`)

Hono on Node 20, better-sqlite3, mostly stateless (state lives in the session snapshots table and the story files on disk).

| Endpoint | Purpose |
|---|---|
| `GET /api/stories` | List public bundle metas |
| `GET /api/stories/:id` | Full public bundle (secrets never leave the server) |
| `POST /api/dialogue` | `{storyId, characterId, sessionState, transcriptTail, playerMessage, wantAudio, wantSuggestions}` → `{text, audio? (base64), suggestedReplies?[]}` — server assembles persona + secrets + story-state prompt, calls the LLM once (suggested replies requested in the same completion), TTS inlined when `wantAudio` |
| `POST /api/judge` | `{storyId, challengeId, transcriptTail}` → `{success, feedback}` via secret rubric |
| `POST /api/stt` | audio blob → `{text}` |
| `POST /api/sessions/snapshot` | Upsert session snapshot (SQLite: `sessions(id, device_id, story_id, state_json, updated_at)`) |
| `GET /api/sessions?deviceId=` | List past sessions for review |

**Providers:** `DialogueProvider`, `SttProvider`, `TtsProvider` interfaces; OpenAI implementations first (models set via env: `OPENAI_API_KEY`, `DIALOGUE_MODEL`, `STT_MODEL`, `TTS_MODEL`). Swapping vendors touches only `apps/server/src/providers/`.

**Prompt assembly (server-side only):** character personality + secrets + hard limits + current beat narration/objective + flags/clues the player has + transcript tail + a framework preamble (stay in character, stay in the story, keep replies short and speakable — they may be voiced).

**Cost guardrails:** per-device rate limit (in-memory token bucket), transcript tail capped (last N turns; summary of earlier turns kept client-side in session state), TTS only when voice output is on.

## 8. Error handling

- **LLM timeout/failure:** silent retry once; then an in-fiction stall line from a small per-story list (e.g. "*He goes quiet for a moment…*") and a retry affordance. Challenge clock is already paused during in-flight requests, so failures never cost time.
- **STT failure/empty:** "Didn't catch that" toast → re-record or tap-to-type fallback.
- **TTS failure:** text renders regardless; audio skipped silently.
- **Malformed bundle:** server refuses to boot with a schema error naming story + path.
- **Offline mid-story:** input dock disables with an offline notice; session is safe in `localStorage`; resumes on reconnect.
- **Mic permission denied:** voice mode hidden for the session; player is told why and offered text mode.

## 9. Testing

- **`packages/engine` (heaviest coverage, Vitest):** beat transitions, clock math (real→story time, phase boundaries, pause rules), challenge timeout, effects emission, mode pipeline normalization, serialization round-trip.
- **`packages/schema`:** both reference bundles validate; representative invalid bundles fail with useful errors.
- **`apps/server` (Vitest, mocked providers):** prompt assembly includes secrets/flags correctly, secrets never appear in `GET /api/stories/:id` responses, judge maps rubric verdicts to effects, rate limiting.
- **`apps/web`:** React Testing Library for the input dock (mode swapping) and conversation sheet; one **Playwright** flow playing kidnapping-escape start-to-finish in MCQ mode against a mocked gateway — deterministic, no AI calls in CI.

## 10. Out of scope for v1

- Content-generation pipeline (video/scene asset generation, voice design tooling, AI story authoring) — the framework consumes its output; building it is the next project.
- User accounts/auth (anonymous device id only), multiplayer/shared sessions, realtime speech-to-speech voice, payments, analytics.
- Scene changes mid-story beyond the format hook already included.

## 11. Success criteria

1. Both reference stories are playable end-to-end on a phone browser in all three modes.
2. A new story can be added by writing a bundle folder — zero framework code changes.
3. Engine + schema + server test suites green; Playwright MCQ flow green.
4. No story secrets observable from the client (network tab or bundle payloads).

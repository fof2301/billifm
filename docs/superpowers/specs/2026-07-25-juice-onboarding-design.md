# Game Feel + First-Play Onboarding — Design

**Date:** 2026-07-25
**Status:** Approved pending final review
**Scope:** apps/web only, plus one CC0 ambient audio file per story. No engine, schema, or server changes.

## 1. Goal

Make playing feel alive (sound, motion, tension) and make the first minute self-explanatory (coach marks). Two experience layers over the existing framework; every piece is independently deletable.

## 2. Architecture: the effect subscription seam

`useSession` gains `onEffect: { current: ((e: Effect) => void) | null }` — a ref like the existing `onAudio`, invoked inside `runEffects` for **every** engine effect. The Stage wires one dispatcher that fans out to the fx modules below. The engine already emits the needed event stream (`CHALLENGE_STARTED`, `CHALLENGE_TIMED_OUT`, `PHASE_CHANGED`, `STORY_ENDED`, `BEAT_CHANGED`); no engine changes.

New modules under `apps/web/src/fx/`:
- `useSound.ts` — cue decisions + Web Audio backend
- `useHaptics.ts` — navigator.vibrate wrapper
- `TypewriterText.tsx`, `PhaseToast.tsx`, `CoachMarks.tsx` — components

## 3. Sound (`useSound`)

**Synthesized cues** (Web Audio oscillators, zero asset files):
| Trigger | Cue |
|---|---|
| `CHALLENGE_STARTED` | short low sting |
| challenge success | soft two-note resolve |
| `CHALLENGE_TIMED_OUT` | dull thud |
| `STORY_ENDED` | muffled bell |
| deadline < 30 real seconds | quiet metronome tick (1/s), stops on resolve |

**Ambient loop**: `scene.ambientAudio` (already in the schema, previously descoped) gets one curated CC0 room-tone per story (freesound.org, credited in `assets/CREDITS.md`), looped via an `<audio>` element at ~0.25 volume, brief fade on phase change.

**Success detection**: the engine emits no success effect (success arrives as a `CHALLENGE_RESOLVED` *action*). The Stage dispatcher infers it: it tracks the active challenge id; when that challenge leaves `state.activeChallenge` in a dispatch whose effects contain no `CHALLENGE_TIMED_OUT`, it synthesizes a local `challenge-succeeded` fx event for the sound/visual layers. Same signal drives the banner's green flip (§5).

**Autoplay**: the AudioContext unlocks on the Intro screen's Begin/Resume tap (first user gesture).

**Mute**: one "Effects" toggle in SettingsSheet (localStorage `sf-effects`, default on) gates cues, ambient, and haptics.

**Structure**: cue *decision* logic (which effect → which cue, mute gating, tick start/stop) is separated from the thin oscillator/audio-element backend so decisions are unit-testable with a fake backend; the backend itself stays untested (same policy as the OpenAI provider wrappers).

## 4. Haptics (`useHaptics`)

`navigator.vibrate` — no-ops silently where unsupported (iOS Safari). Single pulse on `CHALLENGE_STARTED`, double pulse on `CHALLENGE_TIMED_OUT`, tick pulse alongside the final-10-seconds audio ticks. Gated by the same Effects toggle.

## 5. Visual moments

- **Typewriter** (`TypewriterText`): only the latest character line types at ~30 chars/s with a `▌` caret (doubles as the speaking indicator); older lines render instantly; tap to skip to full text. Used by ConversationSheet for the last character entry.
- **Phase toast** (`PhaseToast`): on `PHASE_CHANGED`, a centered chip over the scene for ~2.5s — "🌙 Night falls · Day 2" — naming the new phase and day while the background crossfades.
- **Tension visuals**: deadline chip pulses slowly under 30 real seconds; under 10 seconds a barely-visible red inset vignette breathes at tick rate. Challenge banner slides in on start, flips green + resolve sound on success, shakes once on timeout.
- **Micro-transitions** (CSS only, no animation library): character-select ring animates; suggested-reply chips stagger-fade (60ms apart); conversation sheet slides up on first select; narration card fades; Journal/Settings sheets slide from bottom.
- **Availability glow**: when a character becomes available on a phase change, their rail avatar pulses twice (the rail keeps the previous availability set in a ref and diffs it on `PHASE_CHANGED`).

## 6. Coach marks (`CoachMarks`)

First Stage mount ever (no `localStorage['sf-coached']`): dim overlay, four tap-advanced spotlights (fixed overlay with box-shadow cut-out at the target's bounding rect — no positioning library):
1. Clock chip — "A whole day passes every few minutes. Watch it."
2. Character rail — "Tap a face to talk. Some people only appear at certain hours."
3. Input dock — "This is your voice — chips, keyboard, or hold-to-talk."
4. Journal button — "Everything you know is in here. It pauses time."

"Skip" on every step; finishing or skipping writes the flag. Clock paused while showing (existing `'settings'` pause reason). Stage passes target refs. SettingsSheet gains "Replay tips" (clears the flag and re-shows).

## 7. Testing

- `useSound` decision layer: which cue per effect, mute gating, tick start/stop — fake audio backend.
- `useHaptics`: vibrate called per effect, suppressed when muted.
- `TypewriterText`: progressive reveal with fake timers; tap-to-skip completes text.
- `PhaseToast`: appears on effect, auto-dismisses.
- `CoachMarks`: shows on first mount only, advances, skip writes flag; "Replay tips" resets.
- Existing suites stay green. The Playwright e2e pre-seeds `sf-coached` via `page.addInitScript` so coach marks don't intercept its clicks; one new e2e assertion is NOT added (coach marks covered by RTL).

## 8. Out of scope

Endings gallery/achievements, judge-feedback surfacing, trust meters, PWA/share cards, video backgrounds, the standing a11y batch, engine/server/schema changes, story content changes (beyond adding `ambientAudio` paths + files to the two bundles).

## 9. Success criteria

1. A first-time player understands the clock, characters, dock, and journal without being told.
2. Challenge start/near-deadline/success/failure are each felt (sound + motion + haptics where supported) with effects on; the game is fully playable with effects muted.
3. All new behavior covered by unit tests; full suite + e2e green; no animation library added.

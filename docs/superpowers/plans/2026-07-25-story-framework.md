# Interactive Story Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first web framework that plays 5–10 minute interactive stories (voice / free-text / MCQ modes) defined entirely as JSON bundles, with AI characters, a story clock, and timed challenges.

**Architecture:** pnpm monorepo. `packages/schema` (Zod story format) → `packages/engine` (pure TS state machine, no DOM/network) → `apps/server` (Hono AI gateway holding the OpenAI key + story secrets + SQLite snapshots) → `apps/web` (Vite + React + Tailwind player shell). Stories live in `stories/<id>/` as `story.json` (public) + `secrets.json` (server-only) + SVG assets.

**Tech Stack:** TypeScript (strict), Node ≥20, pnpm workspaces, Zod, Hono + @hono/node-server, better-sqlite3, OpenAI SDK (chat + Whisper STT + TTS), Vite, React, Tailwind v4, Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-25-story-framework-design.md` — read it before starting any task.

## Global Constraints

- **No company names anywhere** — code, docs, UI copy, package names. Package scope is `@story/*`.
- TypeScript strict mode everywhere; Node ≥20; ESM (`"type": "module"`).
- TDD: every task writes the failing test first. Frequent conventional commits (`feat:`, `test:`, `chore:`).
- Story **secrets never reach the client**: `secrets.json` is read only by `apps/server`; no API response may contain rubric or secret text.
- Character audio (TTS) is generated **only in voice mode** (`wantAudio = mode === 'voice'`).
- The challenge clock **pauses** while: tab hidden, an AI request is in flight during an active challenge, or settings sheet open.
- No animation libraries — CSS transitions only. No PaaS-specific dependencies (self-hosted deploy target).
- Newer package versions may resolve than shown here; if an API differs from the code in a step, check the package's docs in `node_modules` and adapt minimally.
- YAGNI: implement exactly what a step shows; no speculative options/config.

## File structure (what exists when done)

```
game-framework/
├─ package.json                     # workspace root: test/typecheck/dev scripts
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .env.example                     # server env vars (never commit real .env)
├─ packages/
│  ├─ schema/src/{index,story,secrets,session}.ts   # Zod schemas + shared types
│  └─ engine/src/{index,types,clock,conditions,reducer}.ts  # pure state machine
├─ apps/
│  ├─ server/src/{index,app,stories,prompt,db,ratelimit}.ts
│  │           src/providers/{types,openai,fake}.ts
│  └─ web/src/{main,App,api,useSession,audio}.ts(x)
│        src/screens/{Library,Intro,Stage,Ending}.tsx
│        src/components/{BackgroundLayer,TopBar,CharacterRail,NarrationCard,
│                        ClueDrawer,ChallengeBanner,ConversationSheet,InputDock,
│                        SettingsSheet,PushToTalkButton,PastSessions}.tsx
├─ stories/
│  ├─ kidnapping-escape/{story.json,secrets.json,assets/*.svg}
│  └─ ancestor-tree/{story.json,secrets.json,assets/*.svg}
└─ e2e/mcq-flow.spec.ts             # Playwright, mocked gateway
```

**Two deliberate deviations from the spec, both minor:**
1. The spec lists a `PLAY_AUDIO` engine effect. It's unnecessary — TTS audio arrives inside the gateway's dialogue response and the shell plays it directly. The engine stays audio-agnostic.
2. The spec doesn't define MCQ-challenge timeout behavior. Schema adds optional `onTimeout` effects to `mcq` challenges; `task` challenges use their `onFailure` on timeout (matching the spec's rubric wording "fail if time expired").

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `packages/schema/package.json`, `packages/schema/tsconfig.json`, `packages/schema/src/index.ts`, `packages/schema/test/smoke.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: workspace layout + `tsconfig.base.json` every later package extends; `@story/schema` package name.

- [ ] **Step 1: Write root workspace files**

`package.json`:
```json
{
  "name": "story-framework",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": { "typescript": "^5.5.4" }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
  - apps/*
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true
  }
}
```

Append to `.gitignore` (keep existing lines):
```
coverage/
playwright-report/
test-results/
*.local
```

- [ ] **Step 2: Write the schema package skeleton + failing smoke test**

`packages/schema/package.json`:
```json
{
  "name": "@story/schema",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.5.4", "vitest": "^2.1.0" }
}
```

`packages/schema/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

`packages/schema/test/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../src/index'

describe('schema package', () => {
  it('exports a schema version', () => {
    expect(SCHEMA_VERSION).toBe(1)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm install && pnpm --filter @story/schema test`
Expected: FAIL — `src/index.ts` doesn't exist / has no `SCHEMA_VERSION`.

- [ ] **Step 4: Minimal implementation**

`packages/schema/src/index.ts`:
```ts
export const SCHEMA_VERSION = 1
```

- [ ] **Step 5: Verify pass + typecheck**

Run: `pnpm --filter @story/schema test && pnpm typecheck`
Expected: PASS (1 test), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with schema package"
```

---

### Task 2: StoryBundle + secrets schemas and shared session types

**Files:**
- Create: `packages/schema/src/story.ts`, `packages/schema/src/secrets.ts`, `packages/schema/src/session.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/test/story.test.ts`

**Interfaces:**
- Consumes: Task 1 scaffold.
- Produces (used by every later task):
  - `StoryBundleSchema`, `SecretsSchema` (Zod), types `StoryBundle`, `StorySecrets`, `Mode`, `Effects`, `When`, `Challenge`, `Character`, `Beat`, `Ending`, `ClockConfig`
  - `SessionState`, `TranscriptEntry`, `PauseReason` from `session.ts`
  - `makeMinimalBundle()` test helper exported from `test/story.test.ts` is NOT shared — later tasks build their own fixtures or use the real stories from Task 6.

- [ ] **Step 1: Write the failing tests**

`packages/schema/test/story.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { SecretsSchema, StoryBundleSchema } from '../src/index'

export function makeMinimalBundle() {
  return {
    meta: {
      id: 'test-story', title: 'Test', tagline: 't', genre: 'test',
      estimatedMinutes: 5, cover: 'assets/cover.svg', modes: ['mcq', 'text'],
    },
    clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
    scene: {
      id: 'room',
      backgrounds: { day: 'assets/day.svg', night: 'assets/night.svg' },
    },
    characters: [{
      id: 'ann', name: 'Ann', role: 'friend', portrait: 'assets/ann.svg',
      personality: 'kind', greeting: 'hello',
      voice: { voiceId: 'alloy' },
      availability: { beats: ['*'], phases: ['*'] },
    }],
    beats: [
      {
        id: 'b1', narration: 'start', objective: 'talk', characters: ['ann'],
        challenges: ['c1'],
        transitions: [{ when: { flags: ['done'] }, goto: 'b2' }],
      },
      { id: 'b2', narration: 'end', objective: 'finish', characters: ['ann'] },
    ],
    challenges: [{
      id: 'c1', type: 'mcq', prompt: 'pick', timeLimitSeconds: 60,
      options: [
        { id: 'a', text: 'A', onPick: { setFlags: ['done'] } },
        { id: 'b', text: 'B', onPick: {} },
      ],
    }],
    clues: [{ id: 'k1', title: 'K', text: 'a clue' }],
    endings: [{ id: 'fin', when: { flags: ['done'] }, title: 'Done', text: 'over' }],
  }
}

describe('StoryBundleSchema', () => {
  it('accepts a minimal valid bundle and applies defaults', () => {
    const parsed = StoryBundleSchema.parse(makeMinimalBundle())
    expect(parsed.meta.stallLines).toEqual([])
    expect(parsed.beats[1]!.challenges).toEqual([])
  })

  it('rejects a transition goto pointing at a missing beat', () => {
    const bad = makeMinimalBundle()
    bad.beats[0]!.transitions[0]!.goto = 'nope'
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/goto "nope"/)
  })

  it('rejects backgrounds that do not cover every clock phase', () => {
    const bad = makeMinimalBundle()
    delete (bad.scene.backgrounds as Record<string, string>).night
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/missing phase "night"/)
  })

  it('rejects a beat referencing an unknown character or challenge', () => {
    const bad = makeMinimalBundle()
    bad.beats[0]!.characters = ['ghost']
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/character "ghost"/)
  })

  it('rejects effects unlocking an undefined clue', () => {
    const bad = makeMinimalBundle()
    bad.challenges[0]!.options[0]!.onPick = { unlockClues: ['missing'] }
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/clue "missing"/)
  })
})

describe('SecretsSchema', () => {
  it('accepts character secrets and judging rubrics', () => {
    const parsed = SecretsSchema.parse({
      characters: { ann: { secrets: 'knows the code', hardLimits: 'never sings' } },
      judging: { c1: { rubric: 'success if code revealed' } },
    })
    expect(parsed.characters['ann']!.secrets).toContain('code')
  })

  it('defaults to empty maps', () => {
    const parsed = SecretsSchema.parse({})
    expect(parsed.characters).toEqual({})
    expect(parsed.judging).toEqual({})
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/schema test`
Expected: FAIL — `StoryBundleSchema` not exported.

- [ ] **Step 3: Implement the schemas**

`packages/schema/src/story.ts`:
```ts
import { z } from 'zod'

export const ModeSchema = z.enum(['mcq', 'text', 'voice'])
export type Mode = z.infer<typeof ModeSchema>

export const EffectsSchema = z
  .object({
    setFlags: z.array(z.string()).default([]),
    unlockClues: z.array(z.string()).default([]),
    goto: z.string().optional(),
  })
  .strict()
export type Effects = z.infer<typeof EffectsSchema>

export const WhenSchema = z
  .object({
    flags: z.array(z.string()).default([]),
    clockAtLeast: z
      .object({ day: z.number().int().min(1), phase: z.string() })
      .strict()
      .optional(),
    clockExpired: z.boolean().optional(),
  })
  .strict()
export type When = z.infer<typeof WhenSchema>

export const MetaSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    tagline: z.string(),
    genre: z.string(),
    estimatedMinutes: z.number().int().positive(),
    cover: z.string(),
    modes: z.array(ModeSchema).nonempty(),
    stallLines: z.array(z.string()).default([]),
  })
  .strict()

export const ClockSchema = z
  .object({
    realMinutesPerStoryDay: z.number().positive(),
    totalStoryDays: z.number().int().positive(),
    phases: z.array(z.string()).nonempty(),
  })
  .strict()
export type ClockConfig = z.infer<typeof ClockSchema>

export const SceneSchema = z
  .object({
    id: z.string(),
    backgrounds: z.record(z.string()),
    ambientAudio: z.string().optional(),
  })
  .strict()

export const AvailabilitySchema = z
  .object({
    beats: z.array(z.string()).nonempty(), // ['*'] means all beats
    phases: z.array(z.string()).nonempty(), // ['*'] means all phases
  })
  .strict()

export const CharacterSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    role: z.string(),
    portrait: z.string(),
    personality: z.string(),
    greeting: z.string(),
    voice: z
      .object({ voiceId: z.string(), instructions: z.string().optional() })
      .strict(),
    availability: AvailabilitySchema,
  })
  .strict()
export type Character = z.infer<typeof CharacterSchema>

export const TransitionSchema = z
  .object({ when: WhenSchema, goto: z.string() })
  .strict()

export const BeatSchema = z
  .object({
    id: z.string().min(1),
    narration: z.string(),
    objective: z.string(),
    characters: z.array(z.string()),
    challenges: z.array(z.string()).default([]),
    transitions: z.array(TransitionSchema).default([]),
  })
  .strict()
export type Beat = z.infer<typeof BeatSchema>

export const McqOptionSchema = z
  .object({ id: z.string(), text: z.string(), onPick: EffectsSchema })
  .strict()

export const ChallengeSchema = z.discriminatedUnion('type', [
  z
    .object({
      id: z.string().min(1),
      type: z.literal('mcq'),
      prompt: z.string(),
      timeLimitSeconds: z.number().int().positive(),
      options: z.array(McqOptionSchema).min(2),
      onTimeout: EffectsSchema.optional(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal('task'),
      prompt: z.string(),
      timeLimitSeconds: z.number().int().positive(),
      onSuccess: EffectsSchema,
      onFailure: EffectsSchema,
    })
    .strict(),
])
export type Challenge = z.infer<typeof ChallengeSchema>

export const ClueSchema = z
  .object({ id: z.string().min(1), title: z.string(), text: z.string() })
  .strict()

export const EndingSchema = z
  .object({
    id: z.string().min(1),
    when: WhenSchema,
    title: z.string(),
    text: z.string(),
  })
  .strict()
export type Ending = z.infer<typeof EndingSchema>

export const StoryBundleSchema = z
  .object({
    meta: MetaSchema,
    clock: ClockSchema,
    scene: SceneSchema,
    characters: z.array(CharacterSchema).nonempty(),
    beats: z.array(BeatSchema).nonempty(),
    challenges: z.array(ChallengeSchema).default([]),
    clues: z.array(ClueSchema).default([]),
    endings: z.array(EndingSchema).nonempty(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    const beatIds = new Set(b.beats.map((x) => x.id))
    const charIds = new Set(b.characters.map((x) => x.id))
    const chalIds = new Set(b.challenges.map((x) => x.id))
    const clueIds = new Set(b.clues.map((x) => x.id))

    const checkEffects = (e: Effects | undefined, where: string) => {
      if (!e) return
      if (e.goto && !beatIds.has(e.goto)) fail(`${where}: goto "${e.goto}" is not a beat`)
      for (const c of e.unlockClues)
        if (!clueIds.has(c)) fail(`${where}: clue "${c}" not defined`)
    }

    for (const p of b.clock.phases)
      if (!b.scene.backgrounds[p]) fail(`scene.backgrounds missing phase "${p}"`)

    for (const beat of b.beats) {
      for (const c of beat.characters)
        if (!charIds.has(c)) fail(`beat "${beat.id}": character "${c}" not defined`)
      for (const c of beat.challenges)
        if (!chalIds.has(c)) fail(`beat "${beat.id}": challenge "${c}" not defined`)
      for (const t of beat.transitions)
        if (!beatIds.has(t.goto)) fail(`beat "${beat.id}": goto "${t.goto}" is not a beat`)
    }

    for (const ch of b.challenges) {
      if (ch.type === 'mcq') {
        for (const o of ch.options) checkEffects(o.onPick, `challenge "${ch.id}" option "${o.id}"`)
        checkEffects(ch.onTimeout, `challenge "${ch.id}" onTimeout`)
      } else {
        checkEffects(ch.onSuccess, `challenge "${ch.id}" onSuccess`)
        checkEffects(ch.onFailure, `challenge "${ch.id}" onFailure`)
      }
    }

    for (const c of b.characters) {
      if (c.availability.beats[0] !== '*')
        for (const bid of c.availability.beats)
          if (!beatIds.has(bid)) fail(`character "${c.id}": availability beat "${bid}" not defined`)
    }
  })
export type StoryBundle = z.infer<typeof StoryBundleSchema>
```

`packages/schema/src/secrets.ts`:
```ts
import { z } from 'zod'

export const SecretsSchema = z
  .object({
    characters: z
      .record(
        z.object({ secrets: z.string(), hardLimits: z.string().optional() }).strict(),
      )
      .default({}),
    judging: z.record(z.object({ rubric: z.string() }).strict()).default({}),
  })
  .strict()
export type StorySecrets = z.infer<typeof SecretsSchema>
```

`packages/schema/src/session.ts`:
```ts
import type { Mode } from './story'

export type PauseReason = 'hidden' | 'request' | 'settings'

export interface TranscriptEntry {
  role: 'player' | 'character'
  text: string
  atMs: number // elapsedRealMs when the line landed
}

export interface SessionState {
  storyId: string
  mode: Mode
  beatId: string
  flags: string[]
  cluesFound: string[]
  resolvedChallenges: string[]
  elapsedRealMs: number
  pauseReasons: PauseReason[]
  activeChallenge: { id: string; deadlineMs: number } | null
  activeCharacterId: string | null
  transcripts: Record<string, TranscriptEntry[]>
  suggestedReplies: string[]
  endingId: string | null
}
```

`packages/schema/src/index.ts`:
```ts
export const SCHEMA_VERSION = 1
export * from './story'
export * from './secrets'
export * from './session'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/schema test && pnpm typecheck`
Expected: PASS (8 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: StoryBundle and secrets schemas with cross-reference validation"
```

---

### Task 3: Engine package + story clock

**Files:**
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts`, `packages/engine/src/clock.ts`
- Test: `packages/engine/test/clock.test.ts`

**Interfaces:**
- Consumes: `ClockConfig` from `@story/schema`.
- Produces:
  - `storyTime(clock: ClockConfig, elapsedRealMs: number): { day: number; phase: string; expired: boolean }` (day is 1-based, clamped at `totalStoryDays` once expired)
  - `clockAtLeast(clock: ClockConfig, elapsedRealMs: number, target: { day: number; phase: string }): boolean`

- [ ] **Step 1: Create the package**

`packages/engine/package.json`:
```json
{
  "name": "@story/engine",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@story/schema": "workspace:*" },
  "devDependencies": { "typescript": "^5.5.4", "vitest": "^2.1.0" }
}
```

`packages/engine/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

- [ ] **Step 2: Write the failing tests**

`packages/engine/test/clock.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { clockAtLeast, storyTime } from '../src/clock'

// 5 real minutes per story day, 4 phases => 75s per phase
const clock = {
  realMinutesPerStoryDay: 5,
  totalStoryDays: 3,
  phases: ['dawn', 'day', 'dusk', 'night'] as [string, ...string[]],
}

describe('storyTime', () => {
  it('starts at day 1, first phase', () => {
    expect(storyTime(clock, 0)).toEqual({ day: 1, phase: 'dawn', expired: false })
  })

  it('advances phases within a day (76s => second phase)', () => {
    expect(storyTime(clock, 76_000).phase).toBe('day')
  })

  it('rolls to the next day after realMinutesPerStoryDay', () => {
    expect(storyTime(clock, 5 * 60_000)).toEqual({ day: 2, phase: 'dawn', expired: false })
  })

  it('expires after totalStoryDays and clamps to the last day/phase', () => {
    const t = storyTime(clock, 15 * 60_000 + 1)
    expect(t.expired).toBe(true)
    expect(t.day).toBe(3)
    expect(t.phase).toBe('night')
  })
})

describe('clockAtLeast', () => {
  it('is false before the target and true at/after it', () => {
    const target = { day: 2, phase: 'day' }
    expect(clockAtLeast(clock, 5 * 60_000, target)).toBe(false) // day 2 dawn
    expect(clockAtLeast(clock, 5 * 60_000 + 76_000, target)).toBe(true) // day 2 day
    expect(clockAtLeast(clock, 11 * 60_000, target)).toBe(true) // day 3
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm install && pnpm --filter @story/engine test`
Expected: FAIL — `../src/clock` does not exist.

- [ ] **Step 4: Implement the clock**

`packages/engine/src/clock.ts`:
```ts
import type { ClockConfig } from '@story/schema'

export interface StoryTime {
  day: number
  phase: string
  expired: boolean
}

export function storyTime(clock: ClockConfig, elapsedRealMs: number): StoryTime {
  const dayMs = clock.realMinutesPerStoryDay * 60_000
  const rawDay = Math.floor(elapsedRealMs / dayMs) // 0-based
  const expired = rawDay >= clock.totalStoryDays
  const day = Math.min(rawDay, clock.totalStoryDays - 1) + 1
  const phaseMs = dayMs / clock.phases.length
  const withinDay = expired ? dayMs - 1 : elapsedRealMs % dayMs
  const phaseIdx = Math.min(Math.floor(withinDay / phaseMs), clock.phases.length - 1)
  return { day, phase: clock.phases[phaseIdx]!, expired }
}

export function clockAtLeast(
  clock: ClockConfig,
  elapsedRealMs: number,
  target: { day: number; phase: string },
): boolean {
  const t = storyTime(clock, elapsedRealMs)
  if (t.day !== target.day) return t.day > target.day
  return clock.phases.indexOf(t.phase) >= clock.phases.indexOf(target.phase)
}
```

`packages/engine/src/index.ts`:
```ts
export * from './clock'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @story/engine test`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: engine story clock (real time to story day/phase)"
```

---

### Task 4: Engine reducer — session lifecycle, ticks, transitions, endings

**Files:**
- Create: `packages/engine/src/types.ts`, `packages/engine/src/conditions.ts`, `packages/engine/src/reducer.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/reducer.test.ts`

**Interfaces:**
- Consumes: `storyTime`/`clockAtLeast` (Task 3); `StoryBundle`, `SessionState`, `Mode`, `When`, `Effects`, `PauseReason` (Task 2).
- Produces (Tasks 5, 6, 12 rely on these exact shapes):
  ```ts
  type Action =
    | { type: 'TICK'; deltaMs: number }
    | { type: 'SELECT_CHARACTER'; characterId: string }
    | { type: 'PLAYER_MESSAGE'; text: string; source: Mode }
    | { type: 'CHARACTER_REPLY'; characterId: string; text: string; suggestedReplies?: string[] }
    | { type: 'MCQ_PICK'; challengeId: string; optionId: string }
    | { type: 'CHALLENGE_RESOLVED'; challengeId: string; success: boolean }
    | { type: 'SET_MODE'; mode: Mode }
    | { type: 'PAUSE'; reason: PauseReason }
    | { type: 'RESUME'; reason: PauseReason }

  type Effect =
    | { type: 'BEAT_CHANGED'; beatId: string }
    | { type: 'PHASE_CHANGED'; day: number; phase: string }
    | { type: 'CHALLENGE_STARTED'; challengeId: string }
    | { type: 'CHALLENGE_TIMED_OUT'; challengeId: string }
    | { type: 'REQUEST_DIALOGUE'; characterId: string; playerMessage: string }
    | { type: 'REQUEST_JUDGE'; challengeId: string }
    | { type: 'SNAPSHOT' }
    | { type: 'STORY_ENDED'; endingId: string }

  interface ReduceResult { state: SessionState; effects: Effect[] }
  function createSession(bundle: StoryBundle, mode: Mode): ReduceResult
  function reduce(bundle: StoryBundle, state: SessionState, action: Action): ReduceResult
  function isCharacterAvailable(bundle: StoryBundle, state: SessionState, characterId: string): boolean
  ```
- This task implements `createSession`, `TICK`, `PAUSE`/`RESUME`, `SET_MODE`, transition/ending evaluation, and challenge activation/timeout. Conversation actions land in Task 5 (reducer returns state unchanged for them until then).

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/reducer.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { StoryBundle } from '@story/schema'
import { StoryBundleSchema } from '@story/schema'
import { createSession, reduce } from '../src/reducer'

// Two beats; b1 has a 60s task challenge; flag "done" moves to b2; ending on "won".
function fixture(): StoryBundle {
  return StoryBundleSchema.parse({
    meta: {
      id: 'fx', title: 'Fx', tagline: '', genre: 'test', estimatedMinutes: 5,
      cover: 'c.svg', modes: ['mcq', 'text'],
    },
    clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
    scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
    characters: [{
      id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'kind',
      greeting: 'hi', voice: { voiceId: 'alloy' },
      availability: { beats: ['*'], phases: ['day'] },
    }],
    beats: [
      {
        id: 'b1', narration: 'n1', objective: 'o1', characters: ['ann'],
        challenges: ['c1'],
        transitions: [{ when: { flags: ['done'] }, goto: 'b2' }],
      },
      { id: 'b2', narration: 'n2', objective: 'o2', characters: ['ann'] },
    ],
    challenges: [{
      id: 'c1', type: 'task', prompt: 'do it', timeLimitSeconds: 60,
      onSuccess: { setFlags: ['done', 'won'] }, onFailure: { setFlags: ['done'] },
    }],
    clues: [],
    endings: [
      { id: 'good', when: { flags: ['won'] }, title: 'W', text: 'w' },
      { id: 'timeout', when: { clockExpired: true }, title: 'T', text: 't' },
    ],
  })
}

describe('createSession', () => {
  it('enters the first beat and activates its challenge', () => {
    const { state, effects } = createSession(fixture(), 'text')
    expect(state.beatId).toBe('b1')
    expect(state.activeChallenge).toEqual({ id: 'c1', deadlineMs: 60_000 })
    expect(effects).toContainEqual({ type: 'BEAT_CHANGED', beatId: 'b1' })
    expect(effects).toContainEqual({ type: 'CHALLENGE_STARTED', challengeId: 'c1' })
  })
})

describe('TICK', () => {
  it('advances time and emits PHASE_CHANGED on phase boundaries', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    // day phase lasts 150s (5min/2 phases). Cross it.
    const r = reduce(bundle, { ...state, elapsedRealMs: 149_000, activeChallenge: null }, { type: 'TICK', deltaMs: 2_000 })
    expect(r.effects).toContainEqual({ type: 'PHASE_CHANGED', day: 1, phase: 'night' })
  })

  it('does not advance time while paused', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'PAUSE', reason: 'hidden' }).state
    const r = reduce(bundle, state, { type: 'TICK', deltaMs: 5_000 })
    expect(r.state.elapsedRealMs).toBe(0)
    state = reduce(bundle, r.state, { type: 'RESUME', reason: 'hidden' }).state
    expect(reduce(bundle, state, { type: 'TICK', deltaMs: 5_000 }).state.elapsedRealMs).toBe(5_000)
  })

  it('times out a task challenge, applies onFailure, and follows the transition', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    const r = reduce(bundle, state, { type: 'TICK', deltaMs: 61_000 })
    expect(r.effects).toContainEqual({ type: 'CHALLENGE_TIMED_OUT', challengeId: 'c1' })
    expect(r.state.flags).toContain('done')
    expect(r.state.beatId).toBe('b2')
    expect(r.state.activeChallenge).toBeNull()
    expect(r.effects).toContainEqual({ type: 'SNAPSHOT' })
  })

  it('ends the story when the clock expires', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    const r = reduce(bundle, { ...state, activeChallenge: null }, { type: 'TICK', deltaMs: 10 * 60_000 + 1_000 })
    expect(r.state.endingId).toBe('timeout')
    expect(r.effects).toContainEqual({ type: 'STORY_ENDED', endingId: 'timeout' })
  })

  it('ignores all actions after an ending', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    const ended = reduce(bundle, { ...state, activeChallenge: null }, { type: 'TICK', deltaMs: 10 * 60_000 + 1_000 }).state
    const r = reduce(bundle, ended, { type: 'TICK', deltaMs: 5_000 })
    expect(r.state).toBe(ended)
    expect(r.effects).toEqual([])
  })
})

describe('SET_MODE', () => {
  it('switches only to modes the story allows', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    expect(reduce(bundle, state, { type: 'SET_MODE', mode: 'mcq' }).state.mode).toBe('mcq')
    expect(reduce(bundle, state, { type: 'SET_MODE', mode: 'voice' }).state.mode).toBe('text')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/engine test`
Expected: FAIL — `../src/reducer` does not exist.

- [ ] **Step 3: Implement types, conditions, reducer**

`packages/engine/src/types.ts`:
```ts
import type { Mode, PauseReason, SessionState } from '@story/schema'

export type Action =
  | { type: 'TICK'; deltaMs: number }
  | { type: 'SELECT_CHARACTER'; characterId: string }
  | { type: 'PLAYER_MESSAGE'; text: string; source: Mode }
  | { type: 'CHARACTER_REPLY'; characterId: string; text: string; suggestedReplies?: string[] }
  | { type: 'MCQ_PICK'; challengeId: string; optionId: string }
  | { type: 'CHALLENGE_RESOLVED'; challengeId: string; success: boolean }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'PAUSE'; reason: PauseReason }
  | { type: 'RESUME'; reason: PauseReason }

export type Effect =
  | { type: 'BEAT_CHANGED'; beatId: string }
  | { type: 'PHASE_CHANGED'; day: number; phase: string }
  | { type: 'CHALLENGE_STARTED'; challengeId: string }
  | { type: 'CHALLENGE_TIMED_OUT'; challengeId: string }
  | { type: 'REQUEST_DIALOGUE'; characterId: string; playerMessage: string }
  | { type: 'REQUEST_JUDGE'; challengeId: string }
  | { type: 'SNAPSHOT' }
  | { type: 'STORY_ENDED'; endingId: string }

export interface ReduceResult {
  state: SessionState
  effects: Effect[]
}
```

`packages/engine/src/conditions.ts`:
```ts
import type { StoryBundle, When } from '@story/schema'
import { clockAtLeast, storyTime } from './clock'

export function whenMatches(
  bundle: StoryBundle,
  state: { flags: string[]; elapsedRealMs: number },
  when: When,
): boolean {
  if (when.flags.some((f) => !state.flags.includes(f))) return false
  if (when.clockExpired !== undefined) {
    if (storyTime(bundle.clock, state.elapsedRealMs).expired !== when.clockExpired) return false
  }
  if (when.clockAtLeast) {
    if (!clockAtLeast(bundle.clock, state.elapsedRealMs, when.clockAtLeast)) return false
  }
  return true
}
```

`packages/engine/src/reducer.ts`:
```ts
import type { Effects, Mode, SessionState, StoryBundle } from '@story/schema'
import { storyTime } from './clock'
import { whenMatches } from './conditions'
import type { Action, Effect, ReduceResult } from './types'

export function createSession(bundle: StoryBundle, mode: Mode): ReduceResult {
  const first = bundle.beats[0]!
  let state: SessionState = {
    storyId: bundle.meta.id,
    mode,
    beatId: first.id,
    flags: [],
    cluesFound: [],
    resolvedChallenges: [],
    elapsedRealMs: 0,
    pauseReasons: [],
    activeChallenge: null,
    activeCharacterId: null,
    transcripts: {},
    suggestedReplies: [],
    endingId: null,
  }
  const effects: Effect[] = [{ type: 'BEAT_CHANGED', beatId: first.id }]
  state = activateChallenge(bundle, state, effects)
  return { state, effects }
}

export function isCharacterAvailable(
  bundle: StoryBundle,
  state: SessionState,
  characterId: string,
): boolean {
  const ch = bundle.characters.find((c) => c.id === characterId)
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  if (!ch || !beat || !beat.characters.includes(characterId)) return false
  const { beats, phases } = ch.availability
  if (beats[0] !== '*' && !beats.includes(state.beatId)) return false
  const phase = storyTime(bundle.clock, state.elapsedRealMs).phase
  if (phases[0] !== '*' && !phases.includes(phase)) return false
  return true
}

function activateChallenge(
  bundle: StoryBundle,
  state: SessionState,
  effects: Effect[],
): SessionState {
  if (state.activeChallenge || state.endingId) return state
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  if (!beat) return state
  const nextId = beat.challenges.find((id) => !state.resolvedChallenges.includes(id))
  if (!nextId) return state
  const ch = bundle.challenges.find((c) => c.id === nextId)!
  effects.push({ type: 'CHALLENGE_STARTED', challengeId: ch.id })
  return {
    ...state,
    activeChallenge: { id: ch.id, deadlineMs: state.elapsedRealMs + ch.timeLimitSeconds * 1000 },
  }
}

function applyEffects(
  bundle: StoryBundle,
  state: SessionState,
  effects: Effect[],
  e: Effects,
): SessionState {
  let next = {
    ...state,
    flags: [...new Set([...state.flags, ...e.setFlags])],
    cluesFound: [...new Set([...state.cluesFound, ...e.unlockClues])],
  }
  if (e.goto && e.goto !== next.beatId) next = changeBeat(bundle, next, effects, e.goto)
  return next
}

function changeBeat(
  bundle: StoryBundle,
  state: SessionState,
  effects: Effect[],
  beatId: string,
): SessionState {
  effects.push({ type: 'BEAT_CHANGED', beatId }, { type: 'SNAPSHOT' })
  let next: SessionState = { ...state, beatId, activeChallenge: null, suggestedReplies: [] }
  next = activateChallenge(bundle, next, effects)
  return next
}

/** Run beat transitions (repeatedly) then endings; called after every state change. */
function evaluate(bundle: StoryBundle, state: SessionState, effects: Effect[]): SessionState {
  let next = state
  for (let guard = 0; guard < bundle.beats.length; guard++) {
    const beat = bundle.beats.find((b) => b.id === next.beatId)
    const hit = beat?.transitions.find((t) => whenMatches(bundle, next, t.when))
    if (!hit || hit.goto === next.beatId) break
    next = changeBeat(bundle, next, effects, hit.goto)
  }
  if (!next.endingId) {
    const ending = bundle.endings.find((e) => whenMatches(bundle, next, e.when))
    if (ending) {
      next = { ...next, endingId: ending.id, activeChallenge: null }
      effects.push({ type: 'STORY_ENDED', endingId: ending.id }, { type: 'SNAPSHOT' })
    }
  }
  return next
}

function resolveChallenge(
  bundle: StoryBundle,
  state: SessionState,
  effects: Effect[],
  challengeId: string,
  outcome: Effects,
): SessionState {
  let next: SessionState = {
    ...state,
    activeChallenge: null,
    resolvedChallenges: [...state.resolvedChallenges, challengeId],
  }
  next = applyEffects(bundle, next, effects, outcome)
  next = activateChallenge(bundle, next, effects)
  return evaluate(bundle, next, effects)
}

export function reduce(bundle: StoryBundle, state: SessionState, action: Action): ReduceResult {
  if (state.endingId) return { state, effects: [] }
  const effects: Effect[] = []

  switch (action.type) {
    case 'PAUSE': {
      if (state.pauseReasons.includes(action.reason)) return { state, effects }
      return { state: { ...state, pauseReasons: [...state.pauseReasons, action.reason] }, effects }
    }
    case 'RESUME': {
      return {
        state: { ...state, pauseReasons: state.pauseReasons.filter((r) => r !== action.reason) },
        effects,
      }
    }
    case 'SET_MODE': {
      if (!bundle.meta.modes.includes(action.mode)) return { state, effects }
      return { state: { ...state, mode: action.mode }, effects }
    }
    case 'TICK': {
      if (state.pauseReasons.length > 0) return { state, effects }
      const before = storyTime(bundle.clock, state.elapsedRealMs)
      let next: SessionState = { ...state, elapsedRealMs: state.elapsedRealMs + action.deltaMs }
      const after = storyTime(bundle.clock, next.elapsedRealMs)
      if (after.phase !== before.phase || after.day !== before.day) {
        effects.push({ type: 'PHASE_CHANGED', day: after.day, phase: after.phase })
      }
      if (next.activeChallenge && next.elapsedRealMs >= next.activeChallenge.deadlineMs) {
        const ch = bundle.challenges.find((c) => c.id === next.activeChallenge!.id)!
        effects.push({ type: 'CHALLENGE_TIMED_OUT', challengeId: ch.id })
        const outcome = ch.type === 'task' ? ch.onFailure : (ch.onTimeout ?? { setFlags: [], unlockClues: [] })
        next = resolveChallenge(bundle, next, effects, ch.id, outcome)
      } else {
        next = evaluate(bundle, next, effects)
      }
      return { state: next, effects }
    }
    default:
      // Conversation actions are implemented in Task 5.
      return { state, effects }
  }
}
```

Update `packages/engine/src/index.ts`:
```ts
export * from './clock'
export * from './conditions'
export * from './reducer'
export * from './types'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/engine test && pnpm typecheck`
Expected: PASS (12 tests total in package).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: engine reducer with ticks, pauses, transitions, endings, challenge timeout"
```

---

### Task 5: Engine reducer — conversations, MCQ picks, judged challenges

**Files:**
- Modify: `packages/engine/src/reducer.ts`
- Test: `packages/engine/test/conversation.test.ts`

**Interfaces:**
- Consumes: Task 4 reducer internals (`applyEffects`, `resolveChallenge`, `evaluate`, `activateChallenge` already exist).
- Produces: full handling of `SELECT_CHARACTER`, `PLAYER_MESSAGE`, `CHARACTER_REPLY`, `MCQ_PICK`, `CHALLENGE_RESOLVED`. Behavioral contract used by `useSession` (Task 12):
  - `SELECT_CHARACTER` on an available character sets `activeCharacterId` and seeds the character's `greeting` into the transcript on first contact.
  - `PLAYER_MESSAGE` appends to the active character's transcript, emits `REQUEST_DIALOGUE`, and auto-pauses the clock (`pauseReasons` gains `'request'`) **only while a challenge is active**.
  - `CHARACTER_REPLY` appends the reply, stores `suggestedReplies`, removes the `'request'` pause, and emits `REQUEST_JUDGE` if the active challenge is a `task`.
  - `CHALLENGE_RESOLVED` with `success: true` applies `onSuccess`; with `success: false` it does nothing (the deadline is the failure path).
  - `MCQ_PICK` applies the picked option's `onPick` and resolves the challenge.

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/conversation.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { StoryBundle } from '@story/schema'
import { StoryBundleSchema } from '@story/schema'
import { createSession, reduce } from '../src/reducer'

function fixture(): StoryBundle {
  return StoryBundleSchema.parse({
    meta: {
      id: 'fx2', title: 'Fx2', tagline: '', genre: 'test', estimatedMinutes: 5,
      cover: 'c.svg', modes: ['mcq', 'text', 'voice'],
    },
    clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
    scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
    characters: [
      {
        id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'kind',
        greeting: 'hello there', voice: { voiceId: 'alloy' },
        availability: { beats: ['*'], phases: ['*'] },
      },
      {
        id: 'night-owl', name: 'Owl', role: 'r', portrait: 'p.svg', personality: 'sleepy',
        greeting: 'hoot', voice: { voiceId: 'onyx' },
        availability: { beats: ['*'], phases: ['night'] },
      },
    ],
    beats: [
      {
        id: 'b1', narration: 'n', objective: 'o', characters: ['ann', 'night-owl'],
        challenges: ['task1', 'quiz1'],
      },
      { id: 'b2', narration: 'n2', objective: 'o2', characters: ['ann'] },
    ],
    challenges: [
      {
        id: 'task1', type: 'task', prompt: 'convince ann', timeLimitSeconds: 120,
        onSuccess: { setFlags: ['convinced'] }, onFailure: {},
      },
      {
        id: 'quiz1', type: 'mcq', prompt: 'pick one', timeLimitSeconds: 60,
        options: [
          { id: 'a', text: 'right', onPick: { setFlags: ['picked'], goto: 'b2' } },
          { id: 'b', text: 'wrong', onPick: {} },
        ],
      },
    ],
    clues: [],
    endings: [{ id: 'fin', when: { clockExpired: true }, title: 'F', text: 'f' }],
  })
}

describe('SELECT_CHARACTER', () => {
  it('selects an available character and seeds the greeting once', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    expect(state.activeCharacterId).toBe('ann')
    expect(state.transcripts['ann']).toEqual([
      { role: 'character', text: 'hello there', atMs: 0 },
    ])
    // selecting again does not duplicate the greeting
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    expect(state.transcripts['ann']!.length).toBe(1)
  })

  it('rejects a character unavailable in the current phase', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text') // day phase; owl is night-only
    const r = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'night-owl' })
    expect(r.state.activeCharacterId).toBeNull()
  })
})

describe('PLAYER_MESSAGE / CHARACTER_REPLY', () => {
  it('appends the message, requests dialogue, and pauses the clock during a challenge', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    const r = reduce(bundle, state, { type: 'PLAYER_MESSAGE', text: 'hi ann', source: 'text' })
    expect(r.state.transcripts['ann']!.at(-1)).toMatchObject({ role: 'player', text: 'hi ann' })
    expect(r.effects).toContainEqual({ type: 'REQUEST_DIALOGUE', characterId: 'ann', playerMessage: 'hi ann' })
    expect(r.state.pauseReasons).toContain('request')
  })

  it('reply unpauses, stores suggestions, and requests judging for task challenges', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    state = reduce(bundle, state, { type: 'PLAYER_MESSAGE', text: 'hi', source: 'text' }).state
    const r = reduce(bundle, state, {
      type: 'CHARACTER_REPLY', characterId: 'ann', text: 'well…', suggestedReplies: ['Ask why', 'Stay quiet'],
    })
    expect(r.state.transcripts['ann']!.at(-1)).toMatchObject({ role: 'character', text: 'well…' })
    expect(r.state.suggestedReplies).toEqual(['Ask why', 'Stay quiet'])
    expect(r.state.pauseReasons).not.toContain('request')
    expect(r.effects).toContainEqual({ type: 'REQUEST_JUDGE', challengeId: 'task1' })
  })

  it('does nothing without an active character', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    const r = reduce(bundle, state, { type: 'PLAYER_MESSAGE', text: 'hello?', source: 'text' })
    expect(r.effects).toEqual([])
  })
})

describe('CHALLENGE_RESOLVED', () => {
  it('success applies onSuccess and activates the next challenge in the beat', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    const r = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'task1', success: true })
    expect(r.state.flags).toContain('convinced')
    expect(r.state.activeChallenge?.id).toBe('quiz1')
    expect(r.effects).toContainEqual({ type: 'CHALLENGE_STARTED', challengeId: 'quiz1' })
  })

  it('failure verdicts leave the challenge running', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    const r = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'task1', success: false })
    expect(r.state.activeChallenge?.id).toBe('task1')
  })
})

describe('MCQ_PICK', () => {
  it('applies the picked option and follows its goto', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    // resolve task1 first so quiz1 is active
    state = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'task1', success: true }).state
    const r = reduce(bundle, state, { type: 'MCQ_PICK', challengeId: 'quiz1', optionId: 'a' })
    expect(r.state.flags).toContain('picked')
    expect(r.state.beatId).toBe('b2')
  })
})

describe('serialization', () => {
  it('round-trips through JSON', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    const revived = JSON.parse(JSON.stringify(state))
    const r = reduce(bundle, revived, { type: 'TICK', deltaMs: 1000 })
    expect(r.state.elapsedRealMs).toBe(1000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/engine test`
Expected: FAIL — conversation actions currently fall through the `default` branch.

- [ ] **Step 3: Implement the conversation actions**

In `packages/engine/src/reducer.ts`, replace the `default:` branch of `reduce` with these cases (before `default`, which now becomes unreachable and can return `{ state, effects }`):

```ts
    case 'SELECT_CHARACTER': {
      if (!isCharacterAvailable(bundle, state, action.characterId)) return { state, effects }
      let next: SessionState = { ...state, activeCharacterId: action.characterId, suggestedReplies: [] }
      if (!next.transcripts[action.characterId]) {
        const ch = bundle.characters.find((c) => c.id === action.characterId)!
        next = {
          ...next,
          transcripts: {
            ...next.transcripts,
            [action.characterId]: [{ role: 'character', text: ch.greeting, atMs: next.elapsedRealMs }],
          },
        }
      }
      return { state: next, effects }
    }
    case 'PLAYER_MESSAGE': {
      const charId = state.activeCharacterId
      if (!charId) return { state, effects }
      const entry = { role: 'player' as const, text: action.text, atMs: state.elapsedRealMs }
      let next: SessionState = {
        ...state,
        suggestedReplies: [],
        transcripts: { ...state.transcripts, [charId]: [...(state.transcripts[charId] ?? []), entry] },
      }
      if (next.activeChallenge && !next.pauseReasons.includes('request')) {
        next = { ...next, pauseReasons: [...next.pauseReasons, 'request'] }
      }
      effects.push({ type: 'REQUEST_DIALOGUE', characterId: charId, playerMessage: action.text })
      return { state: next, effects }
    }
    case 'CHARACTER_REPLY': {
      const entry = { role: 'character' as const, text: action.text, atMs: state.elapsedRealMs }
      let next: SessionState = {
        ...state,
        suggestedReplies: action.suggestedReplies ?? [],
        pauseReasons: state.pauseReasons.filter((r) => r !== 'request'),
        transcripts: {
          ...state.transcripts,
          [action.characterId]: [...(state.transcripts[action.characterId] ?? []), entry],
        },
      }
      if (next.activeChallenge) {
        const ch = bundle.challenges.find((c) => c.id === next.activeChallenge!.id)
        if (ch?.type === 'task') effects.push({ type: 'REQUEST_JUDGE', challengeId: ch.id })
      }
      return { state: next, effects }
    }
    case 'CHALLENGE_RESOLVED': {
      if (!action.success) return { state, effects }
      if (state.activeChallenge?.id !== action.challengeId) return { state, effects }
      const ch = bundle.challenges.find((c) => c.id === action.challengeId)
      if (!ch || ch.type !== 'task') return { state, effects }
      return { state: resolveChallenge(bundle, state, effects, ch.id, ch.onSuccess), effects }
    }
    case 'MCQ_PICK': {
      if (state.activeChallenge?.id !== action.challengeId) return { state, effects }
      const ch = bundle.challenges.find((c) => c.id === action.challengeId)
      if (!ch || ch.type !== 'mcq') return { state, effects }
      const opt = ch.options.find((o) => o.id === action.optionId)
      if (!opt) return { state, effects }
      return { state: resolveChallenge(bundle, state, effects, ch.id, opt.onPick), effects }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/engine test && pnpm typecheck`
Expected: PASS (all engine tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: engine conversation, MCQ, and judged-challenge actions"
```

---

### Task 6: Reference stories + headless simulation test

**Files:**
- Create: `stories/kidnapping-escape/story.json`, `stories/kidnapping-escape/secrets.json`, `stories/kidnapping-escape/assets/` (5 SVGs)
- Create: `stories/ancestor-tree/story.json`, `stories/ancestor-tree/secrets.json`, `stories/ancestor-tree/assets/` (3 SVGs + 3 portraits)
- Test: `packages/engine/test/stories.test.ts`

**Interfaces:**
- Consumes: `StoryBundleSchema`, `SecretsSchema` (Task 2); full reducer (Tasks 4–5).
- Produces: the two content bundles every server/web/e2e task loads. Asset paths inside bundles are relative (`assets/…`); the server serves them at `/stories/:id/assets/*` (Task 7).

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/stories.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SecretsSchema, StoryBundleSchema } from '@story/schema'
import { createSession, reduce } from '../src/reducer'

const STORIES = join(__dirname, '../../../stories')
const load = (id: string, file: string) =>
  JSON.parse(readFileSync(join(STORIES, id, file), 'utf8'))

describe('reference bundles validate', () => {
  for (const id of ['kidnapping-escape', 'ancestor-tree']) {
    it(`${id} story.json and secrets.json parse`, () => {
      const bundle = StoryBundleSchema.parse(load(id, 'story.json'))
      const secrets = SecretsSchema.parse(load(id, 'secrets.json'))
      // every task challenge has a rubric
      for (const ch of bundle.challenges)
        if (ch.type === 'task') expect(secrets.judging[ch.id], `rubric for ${ch.id}`).toBeDefined()
      // every character with secrets exists
      for (const cid of Object.keys(secrets.characters))
        expect(bundle.characters.some((c) => c.id === cid)).toBe(true)
    })
  }
})

describe('kidnapping-escape plays headlessly to the good ending', () => {
  it('c1 success -> b2, mcq bird -> b3, c3 success -> escaped', () => {
    const bundle = StoryBundleSchema.parse(load('kidnapping-escape', 'story.json'))
    let { state } = createSession(bundle, 'mcq')
    expect(state.activeChallenge?.id).toBe('c1')

    let r = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'c1', success: true })
    expect(r.state.beatId).toBe('b2')
    expect(r.state.activeChallenge?.id).toBe('c2')

    r = reduce(bundle, r.state, { type: 'MCQ_PICK', challengeId: 'c2', optionId: 'bird' })
    expect(r.state.beatId).toBe('b3')
    expect(r.state.activeChallenge?.id).toBe('c3')

    r = reduce(bundle, r.state, { type: 'CHALLENGE_RESOLVED', challengeId: 'c3', success: true })
    expect(r.state.endingId).toBe('escaped')
  })

  it('missing mira: wrong mcq answer then day 2 moves you to b3-alone', () => {
    const bundle = StoryBundleSchema.parse(load('kidnapping-escape', 'story.json'))
    let { state } = createSession(bundle, 'mcq')
    let r = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'c1', success: true })
    r = reduce(bundle, r.state, { type: 'MCQ_PICK', challengeId: 'c2', optionId: 'name' })
    expect(r.state.beatId).toBe('b2')
    // advance past day 2 "day" phase (5 min/day, 4 phases: day 2 day starts at 6:15)
    r = reduce(bundle, r.state, { type: 'TICK', deltaMs: 7 * 60_000 })
    expect(r.state.beatId).toBe('b3-alone')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/engine test`
Expected: FAIL — story files don't exist.

- [ ] **Step 3: Write the kidnapping-escape bundle**

`stories/kidnapping-escape/story.json`:
```json
{
  "meta": {
    "id": "kidnapping-escape",
    "title": "The Cellar",
    "tagline": "You have 3 days. Only you can do this.",
    "genre": "thriller",
    "estimatedMinutes": 8,
    "cover": "assets/cover.svg",
    "modes": ["mcq", "text", "voice"],
    "stallLines": ["He goes quiet for a moment…", "You hear footsteps pacing above…"]
  },
  "clock": { "realMinutesPerStoryDay": 5, "totalStoryDays": 3, "phases": ["dawn", "day", "dusk", "night"] },
  "scene": {
    "id": "cellar",
    "backgrounds": {
      "dawn": "assets/cellar-dawn.svg",
      "day": "assets/cellar-day.svg",
      "dusk": "assets/cellar-dusk.svg",
      "night": "assets/cellar-night.svg"
    }
  },
  "characters": [
    {
      "id": "viktor",
      "name": "Viktor",
      "role": "Your captor",
      "portrait": "assets/viktor.svg",
      "personality": "Calm, polite, chillingly patient. Never raises his voice. Speaks in short sentences. Believes what he is doing is justified.",
      "greeting": "Ah. You're awake. Good — we have work to do.",
      "voice": { "voiceId": "onyx", "instructions": "slow, quiet, unsettlingly calm" },
      "availability": { "beats": ["*"], "phases": ["dawn", "day", "dusk"] }
    },
    {
      "id": "mira",
      "name": "Mira",
      "role": "A voice in the vents",
      "portrait": "assets/mira.svg",
      "personality": "Whispers. Scared but sharp. Taken weeks before you. Knows the building.",
      "greeting": "Psst — down here. Don't let him hear you.",
      "voice": { "voiceId": "shimmer", "instructions": "whispered, urgent" },
      "availability": { "beats": ["b2", "b3"], "phases": ["night", "dawn"] }
    }
  ],
  "beats": [
    {
      "id": "b1",
      "narration": "You wake on a cot in a cellar. Your hands tingle — something in you feels… different.",
      "objective": "Find out why you were taken.",
      "characters": ["viktor"],
      "challenges": ["c1"],
      "transitions": [{ "when": { "flags": ["knows_why_taken"] }, "goto": "b2" }]
    },
    {
      "id": "b2",
      "narration": "Night falls. A whisper drifts from the vent near the floor.",
      "objective": "Earn Mira's trust before dawn.",
      "characters": ["viktor", "mira"],
      "challenges": ["c2"],
      "transitions": [
        { "when": { "flags": ["mira_trusts_you"] }, "goto": "b3" },
        { "when": { "clockAtLeast": { "day": 2, "phase": "day" } }, "goto": "b3-alone" }
      ]
    },
    {
      "id": "b3",
      "narration": "Mira's directions lead you to a hidden lock. Your hands know what to do.",
      "objective": "Open the lock only you can open.",
      "characters": ["viktor", "mira"],
      "challenges": ["c3"]
    },
    {
      "id": "b3-alone",
      "narration": "The vent has gone silent. Whatever you do now, you do alone.",
      "objective": "Open the lock only you can open.",
      "characters": ["viktor"],
      "challenges": ["c3"]
    }
  ],
  "challenges": [
    {
      "id": "c1",
      "type": "task",
      "prompt": "Get Viktor to reveal why he chose YOU.",
      "timeLimitSeconds": 150,
      "onSuccess": { "setFlags": ["knows_why_taken"], "unlockClues": ["your_gift"] },
      "onFailure": { "setFlags": ["knows_why_taken"] }
    },
    {
      "id": "c2",
      "type": "mcq",
      "prompt": "Mira asks: 'Prove you're not one of his. What's carved on the cot's leg?'",
      "timeLimitSeconds": 60,
      "options": [
        { "id": "bird", "text": "A bird", "onPick": { "setFlags": ["mira_trusts_you"] } },
        { "id": "name", "text": "A name", "onPick": {} },
        { "id": "nothing", "text": "Nothing", "onPick": {} }
      ]
    },
    {
      "id": "c3",
      "type": "task",
      "prompt": "Talk your way through it — describe how you open the lock with your gift.",
      "timeLimitSeconds": 120,
      "onSuccess": { "setFlags": ["door_opened"] },
      "onFailure": {}
    }
  ],
  "clues": [
    { "id": "your_gift", "title": "Your gift", "text": "Viktor said your hands can open what others can't." }
  ],
  "endings": [
    { "id": "escaped", "when": { "flags": ["door_opened", "mira_trusts_you"] }, "title": "Out, together", "text": "The door swings open. Mira's hand finds yours in the dark, and you run." },
    { "id": "alone", "when": { "flags": ["door_opened"] }, "title": "Out, alone", "text": "The door swings open onto cold night air. You don't look back." },
    { "id": "timeout", "when": { "clockExpired": true }, "title": "Day 3 ends", "text": "The third dawn comes and goes. Viktor was patient. You were not fast enough." }
  ]
}
```

`stories/kidnapping-escape/secrets.json`:
```json
{
  "characters": {
    "viktor": {
      "secrets": "He chose the player because their hands can open the vault beneath the house. He will reveal this ONLY if the player stays calm and asks about themselves rather than begging. He lies about the time of day.",
      "hardLimits": "Never reveals the vault's location. Never lets the player leave. Never breaks character."
    },
    "mira": {
      "secrets": "She carved a bird on the cot's leg when she was held in this room. She knows the guard rotation and that the lock responds to slow, deliberate touch."
    }
  },
  "judging": {
    "c1": { "rubric": "Success only if the character's replies in the transcript have revealed that the player was chosen for a special ability of their hands. Deflections alone are failure." },
    "c3": { "rubric": "Success only if the player has described deliberately using their gift/hands on the lock (calm, specific action). Vague wishes or unrelated talk are failure." }
  }
}
```

- [ ] **Step 4: Write the ancestor-tree bundle**

`stories/ancestor-tree/story.json`:
```json
{
  "meta": {
    "id": "ancestor-tree",
    "title": "The Locket",
    "tagline": "Everyone you came from is still here, if you know how to listen.",
    "genre": "mystery",
    "estimatedMinutes": 7,
    "cover": "assets/cover.svg",
    "modes": ["mcq", "text", "voice"],
    "stallLines": ["The attic light flickers…", "Dust drifts through the lamplight…"]
  },
  "clock": { "realMinutesPerStoryDay": 5, "totalStoryDays": 2, "phases": ["morning", "evening"] },
  "scene": {
    "id": "attic",
    "backgrounds": { "morning": "assets/attic-morning.svg", "evening": "assets/attic-evening.svg" }
  },
  "characters": [
    {
      "id": "rose",
      "name": "Grandma Rose",
      "role": "Your great-grandmother, 1920s",
      "portrait": "assets/rose.svg",
      "personality": "Warm, wry, sharp memory for songs and grudges. Talks around painful things until asked gently.",
      "greeting": "Well now. You have her eyes, you know.",
      "voice": { "voiceId": "coral", "instructions": "warm, slow, old-fashioned" },
      "availability": { "beats": ["*"], "phases": ["*"] }
    },
    {
      "id": "elias",
      "name": "Captain Elias",
      "role": "Your ancestor, 1800s sailor",
      "portrait": "assets/elias.svg",
      "personality": "Gruff, superstitious, secretly sentimental. Speaks in weather and omens.",
      "greeting": "Storm's coming, little one. Speak quick.",
      "voice": { "voiceId": "onyx", "instructions": "gravelly, wind-worn" },
      "availability": { "beats": ["*"], "phases": ["evening"] }
    },
    {
      "id": "amara",
      "name": "Amara",
      "role": "Your ancestor, 1700s healer",
      "portrait": "assets/amara.svg",
      "personality": "Serene, precise, speaks in remedies and roots. Answers questions with questions until trust is earned.",
      "greeting": "Sit. The tea is almost ready, child of my child.",
      "voice": { "voiceId": "sage", "instructions": "calm, deliberate, kind" },
      "availability": { "beats": ["*"], "phases": ["morning"] }
    }
  ],
  "beats": [
    {
      "id": "a1",
      "narration": "In your grandmother's attic you find a locket that won't open — and the room fills with people only you can see.",
      "objective": "Learn the lullaby that runs in your family.",
      "characters": ["rose", "elias", "amara"],
      "challenges": ["h1"],
      "transitions": [{ "when": { "flags": ["heard_the_song"] }, "goto": "a2" }]
    },
    {
      "id": "a2",
      "narration": "The locket hums when you hum the tune. There is something it wants you to know.",
      "objective": "Discover what the locket keeps.",
      "characters": ["rose", "elias", "amara"],
      "challenges": ["h2"]
    }
  ],
  "challenges": [
    {
      "id": "h1",
      "type": "task",
      "prompt": "Learn the words of the lullaby Rose's mother used to sing.",
      "timeLimitSeconds": 240,
      "onSuccess": { "setFlags": ["heard_the_song"], "unlockClues": ["lullaby"] },
      "onFailure": { "setFlags": ["heard_the_song"] }
    },
    {
      "id": "h2",
      "type": "task",
      "prompt": "Find out from your ancestors what the locket protects.",
      "timeLimitSeconds": 240,
      "onSuccess": { "setFlags": ["knows_secret"], "unlockClues": ["locket_truth"] },
      "onFailure": {}
    }
  ],
  "clues": [
    { "id": "lullaby", "title": "The lullaby", "text": "\"Low tide, slow tide, carry her home…\" — every generation changed one word." },
    { "id": "locket_truth", "title": "What the locket keeps", "text": "A portrait of the first of your line — and proof the family never really left each other." }
  ],
  "endings": [
    { "id": "keeper", "when": { "flags": ["knows_secret"] }, "title": "The Keeper", "text": "The locket clicks open. Now it's your turn to remember them." },
    { "id": "drifted", "when": { "clockExpired": true }, "title": "Dust settles", "text": "The attic empties. The locket stays shut — for now. They'll wait. They're good at waiting." }
  ]
}
```

`stories/ancestor-tree/secrets.json`:
```json
{
  "characters": {
    "rose": {
      "secrets": "She knows the full lullaby but only sings it if asked about HER mother, not about the locket. The changed word in her generation was 'home' -> 'harbor'."
    },
    "elias": {
      "secrets": "He engraved the locket at sea. It opens only for someone who knows the lullaby. He'll admit this only in the evening, and only if the player mentions the song."
    },
    "amara": {
      "secrets": "The locket holds the portrait of the family's first ancestor. She reveals this if the player shows patience — answering one of her questions before asking their own."
    }
  },
  "judging": {
    "h1": { "rubric": "Success only if a character has shared actual lullaby words/lines in the transcript. Mentions that a song exists, without words, are failure." },
    "h2": { "rubric": "Success only if a character has revealed what is inside or protected by the locket (the first ancestor's portrait / family memory). Hints without substance are failure." }
  }
}
```

- [ ] **Step 5: Write the SVG assets**

Same pattern for all: full-viewport gradient + one accent shape. Create each file listed, varying the two gradient stops. Template (this exact file is `stories/kidnapping-escape/assets/cellar-night.svg`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2440"/><stop offset="1" stop-color="#0a0d16"/></linearGradient></defs><rect width="390" height="844" fill="url(#g)"/><rect x="290" y="120" width="60" height="80" fill="#aac3ff" opacity="0.15"/></svg>
```

Gradient stops per file (accent rect stays; pick a plausible accent color per mood):
- `cellar-dawn.svg`: `#3d3a55` → `#181423` · `cellar-day.svg`: `#4a4a52` → `#1e1d24` · `cellar-dusk.svg`: `#402f3d` → `#140f18` · `cellar-night.svg`: as above · `cover.svg`: `#1c2440` → `#0a0d16` with a `<text x="40" y="120" fill="#dfe6f3" font-size="40" font-family="serif">The Cellar</text>` instead of the rect.
- `attic-morning.svg`: `#8a7a5c` → `#3d3627` · `attic-evening.svg`: `#5c4a52` → `#241d20` · `cover.svg`: `#8a7a5c` → `#3d3627` with `<text …>The Locket</text>`.
- Portraits (`viktor.svg`, `mira.svg`, `rose.svg`, `elias.svg`, `amara.svg`): 120×120 viewBox, one `<circle cx="60" cy="60" r="56" fill="…"/>` + `<text x="60" y="72" text-anchor="middle" font-size="44" fill="#fff" font-family="sans-serif">V</text>` with the character's initial; fills: viktor `#2e2419`, mira `#232f47`, rose `#7a4a52`, elias `#2f4a5c`, amara `#4a5c3a`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @story/engine test`
Expected: PASS — bundle validation + both simulation tests green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: kidnapping-escape and ancestor-tree reference story bundles"
```

---

### Task 7: Server scaffold — story registry, public endpoints, asset serving

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/stories.ts`, `apps/server/src/app.ts`, `apps/server/src/index.ts`, `.env.example`
- Test: `apps/server/test/stories-api.test.ts`

**Interfaces:**
- Consumes: schemas (Task 2), story bundles on disk (Task 6).
- Produces (web Task 11 + later server tasks rely on):
  - `loadStories(dir: string): StoryRegistry` where `StoryRegistry = Map<string, { bundle: StoryBundle; secrets: StorySecrets; dir: string }>`
  - `createApp(deps: AppDeps): Hono` — `AppDeps` starts as `{ stories: StoryRegistry }` and **grows in Tasks 9–10** (`providers`, `db`, `rateLimiter`)
  - `GET /api/stories` → `{ stories: StoryBundle['meta'][] }`
  - `GET /api/stories/:id` → the full public bundle (404 unknown id)
  - `GET /stories/:id/assets/:file` → SVG/audio file streaming (no path traversal)

- [ ] **Step 1: Create the package**

`apps/server/package.json`:
```json
{
  "name": "@story/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "@story/engine": "workspace:*",
    "@story/schema": "workspace:*",
    "better-sqlite3": "^11.3.0",
    "hono": "^4.6.0",
    "openai": "^4.104.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.0"
  }
}
```

`apps/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test"]
}
```

`.env.example` (repo root):
```
OPENAI_API_KEY=
DIALOGUE_MODEL=gpt-4o-mini
STT_MODEL=whisper-1
TTS_MODEL=gpt-4o-mini-tts
PORT=8787
STORIES_DIR=./stories
DB_PATH=./data/sessions.db
```

- [ ] **Step 2: Write the failing tests**

`apps/server/test/stories-api.test.ts`:
```ts
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { loadStories } from '../src/stories'

const stories = loadStories(join(__dirname, '../../../stories'))
const app = createApp({ stories })

describe('story registry', () => {
  it('loads and validates both reference stories', () => {
    expect([...stories.keys()].sort()).toEqual(['ancestor-tree', 'kidnapping-escape'])
  })

  it('throws a named error on an invalid stories dir', () => {
    expect(() => loadStories(join(__dirname, 'fixtures/broken'))).toThrow(/broken-story/)
  })
})

describe('GET /api/stories', () => {
  it('lists metas only', async () => {
    const res = await app.request('/api/stories')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stories).toHaveLength(2)
    expect(body.stories[0]).toHaveProperty('title')
    expect(body.stories[0]).not.toHaveProperty('beats')
  })
})

describe('GET /api/stories/:id', () => {
  it('returns the public bundle and never any secret text', async () => {
    const res = await app.request('/api/stories/kidnapping-escape')
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('Viktor')
    expect(text).not.toMatch(/vault/i) // secrets.json content must not leak
    expect(text).not.toMatch(/rubric/i)
  })

  it('404s on unknown story', async () => {
    expect((await app.request('/api/stories/nope')).status).toBe(404)
  })
})

describe('GET /stories/:id/assets/:file', () => {
  it('serves an SVG asset', async () => {
    const res = await app.request('/stories/kidnapping-escape/assets/cellar-night.svg')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/svg+xml')
  })

  it('blocks path traversal', async () => {
    const res = await app.request('/stories/kidnapping-escape/assets/..%2Fsecrets.json')
    expect(res.status).toBe(404)
  })
})
```

Also create the fixture `apps/server/test/fixtures/broken/broken-story/story.json` containing `{ "meta": {} }` (invalid on purpose) and an empty-object `secrets.json` next to it.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm install && pnpm --filter @story/server test`
Expected: FAIL — `src/app` / `src/stories` missing.

- [ ] **Step 4: Implement registry and app**

`apps/server/src/stories.ts`:
```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StoryBundle, StorySecrets } from '@story/schema'
import { SecretsSchema, StoryBundleSchema } from '@story/schema'

export type StoryRegistry = Map<string, { bundle: StoryBundle; secrets: StorySecrets; dir: string }>

export function loadStories(dir: string): StoryRegistry {
  const registry: StoryRegistry = new Map()
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const storyDir = join(dir, entry.name)
    try {
      const bundle = StoryBundleSchema.parse(
        JSON.parse(readFileSync(join(storyDir, 'story.json'), 'utf8')),
      )
      const secrets = SecretsSchema.parse(
        JSON.parse(readFileSync(join(storyDir, 'secrets.json'), 'utf8')),
      )
      registry.set(bundle.meta.id, { bundle, secrets, dir: storyDir })
    } catch (err) {
      throw new Error(`invalid story "${entry.name}": ${(err as Error).message}`)
    }
  }
  return registry
}
```

`apps/server/src/app.ts`:
```ts
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Hono } from 'hono'
import type { StoryRegistry } from './stories'

export interface AppDeps {
  stories: StoryRegistry
}

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get('/api/stories', (c) =>
    c.json({ stories: [...deps.stories.values()].map((s) => s.bundle.meta) }),
  )

  app.get('/api/stories/:id', (c) => {
    const story = deps.stories.get(c.req.param('id'))
    if (!story) return c.json({ error: 'story not found' }, 404)
    return c.json(story.bundle)
  })

  app.get('/stories/:id/assets/:file', (c) => {
    const story = deps.stories.get(c.req.param('id'))
    const file = basename(c.req.param('file')) // strips any traversal
    if (!story || file !== c.req.param('file')) return c.notFound()
    const ext = file.slice(file.lastIndexOf('.'))
    const mime = MIME[ext]
    if (!mime) return c.notFound()
    try {
      const body = readFileSync(join(story.dir, 'assets', file))
      return c.body(body, 200, { 'content-type': mime, 'cache-control': 'public, max-age=3600' })
    } catch {
      return c.notFound()
    }
  })

  return app
}
```

`apps/server/src/index.ts`:
```ts
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadStories } from './stories'

const port = Number(process.env.PORT ?? 8787)
const stories = loadStories(process.env.STORIES_DIR ?? './stories')
const app = createApp({ stories })

console.log(`gateway listening on :${port} with ${stories.size} stories`)
serve({ fetch: app.fetch, port })
```

- [ ] **Step 5: Run tests, boot check, commit**

Run: `pnpm --filter @story/server test && pnpm typecheck`
Expected: PASS.
Run from repo root: `pnpm --filter @story/server dev` → expect `gateway listening on :8787 with 2 stories`; Ctrl-C.

```bash
git add -A
git commit -m "feat: gateway story registry, public story endpoints, asset serving"
```

---

### Task 8: Providers + prompt assembly

**Files:**
- Create: `apps/server/src/providers/types.ts`, `apps/server/src/providers/openai.ts`, `apps/server/src/providers/fake.ts`, `apps/server/src/prompt.ts`
- Test: `apps/server/test/prompt.test.ts`

**Interfaces:**
- Consumes: `StoryBundle`, `StorySecrets`, `TranscriptEntry` (Task 2).
- Produces (Task 9 routes call exactly these):
  ```ts
  interface DialogueProvider {
    complete(opts: {
      system: string
      messages: { role: 'user' | 'assistant'; content: string }[]
      json?: boolean
    }): Promise<string>
  }
  interface SttProvider { transcribe(audio: Buffer, mimeType: string): Promise<string> }
  interface TtsProvider { speak(text: string, voiceId: string, instructions?: string): Promise<Buffer> }
  interface Providers { dialogue: DialogueProvider; stt: SttProvider; tts: TtsProvider }

  interface DialogueContext {
    bundle: StoryBundle; secrets: StorySecrets; characterId: string
    session: { beatId: string; flags: string[]; cluesFound: string[]; day: number; phase: string }
    wantSuggestions: boolean
  }
  function buildCharacterSystemPrompt(ctx: DialogueContext): string
  function buildJudgeSystemPrompt(bundle: StoryBundle, secrets: StorySecrets, challengeId: string): string
  function createOpenAiProviders(cfg: { apiKey: string; dialogueModel: string; sttModel: string; ttsModel: string }): Providers
  function createFakeProviders(overrides?: Partial<Providers>): Providers   // for tests
  ```

- [ ] **Step 1: Write the failing tests**

`apps/server/test/prompt.test.ts`:
```ts
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCharacterSystemPrompt, buildJudgeSystemPrompt } from '../src/prompt'
import { loadStories } from '../src/stories'

const { bundle, secrets } = loadStories(join(__dirname, '../../../stories')).get('kidnapping-escape')!
const session = { beatId: 'b1', flags: ['knows_why_taken'], cluesFound: ['your_gift'], day: 1, phase: 'day' }

describe('buildCharacterSystemPrompt', () => {
  it('includes persona, secrets, hard limits, story state, and clue text', () => {
    const p = buildCharacterSystemPrompt({ bundle, secrets, characterId: 'viktor', session, wantSuggestions: false })
    expect(p).toContain('chillingly patient')          // personality
    expect(p).toContain('vault beneath the house')     // secret knowledge
    expect(p).toContain("Never reveals the vault's location") // hard limits
    expect(p).toContain('Find out why you were taken') // beat objective
    expect(p).toContain('knows_why_taken')             // flags
    expect(p).toContain('your hands can open')         // unlocked clue text
    expect(p).toContain('Day 1, day')                  // story time
  })

  it('requests strict JSON with suggestions when asked', () => {
    const p = buildCharacterSystemPrompt({ bundle, secrets, characterId: 'viktor', session, wantSuggestions: true })
    expect(p).toContain('"suggestedReplies"')
    const noSugg = buildCharacterSystemPrompt({ bundle, secrets, characterId: 'viktor', session, wantSuggestions: false })
    expect(noSugg).not.toContain('"suggestedReplies"')
  })
})

describe('buildJudgeSystemPrompt', () => {
  it('embeds the challenge rubric and asks for a JSON verdict', () => {
    const p = buildJudgeSystemPrompt(bundle, secrets, 'c1')
    expect(p).toContain('special ability of their hands') // rubric text
    expect(p).toContain('"success"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/server test`
Expected: FAIL — `src/prompt` missing.

- [ ] **Step 3: Implement**

`apps/server/src/providers/types.ts`:
```ts
export interface DialogueProvider {
  complete(opts: {
    system: string
    messages: { role: 'user' | 'assistant'; content: string }[]
    json?: boolean
  }): Promise<string>
}

export interface SttProvider {
  transcribe(audio: Buffer, mimeType: string): Promise<string>
}

export interface TtsProvider {
  speak(text: string, voiceId: string, instructions?: string): Promise<Buffer>
}

export interface Providers {
  dialogue: DialogueProvider
  stt: SttProvider
  tts: TtsProvider
}
```

`apps/server/src/providers/openai.ts` (thin wrappers — not unit-tested; verify manually in Task 17's smoke check):
```ts
import OpenAI, { toFile } from 'openai'
import type { Providers } from './types'

export function createOpenAiProviders(cfg: {
  apiKey: string
  dialogueModel: string
  sttModel: string
  ttsModel: string
}): Providers {
  const client = new OpenAI({ apiKey: cfg.apiKey })
  return {
    dialogue: {
      async complete({ system, messages, json }) {
        const res = await client.chat.completions.create({
          model: cfg.dialogueModel,
          messages: [{ role: 'system', content: system }, ...messages],
          ...(json ? { response_format: { type: 'json_object' as const } } : {}),
        })
        return res.choices[0]?.message?.content ?? ''
      },
    },
    stt: {
      async transcribe(audio, mimeType) {
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
        const res = await client.audio.transcriptions.create({
          file: await toFile(audio, `speech.${ext}`),
          model: cfg.sttModel,
        })
        return res.text
      },
    },
    tts: {
      async speak(text, voiceId, instructions) {
        const res = await client.audio.speech.create({
          model: cfg.ttsModel,
          voice: voiceId,
          input: text,
          ...(instructions ? { instructions } : {}),
        })
        return Buffer.from(await res.arrayBuffer())
      },
    },
  }
}
```

`apps/server/src/providers/fake.ts`:
```ts
import type { Providers } from './types'

export function createFakeProviders(overrides: Partial<Providers> = {}): Providers {
  return {
    dialogue: { complete: async () => JSON.stringify({ reply: 'fake reply' }) },
    stt: { transcribe: async () => 'fake transcript' },
    tts: { speak: async () => Buffer.from('fake-audio') },
    ...overrides,
  }
}
```

`apps/server/src/prompt.ts`:
```ts
import type { StoryBundle, StorySecrets } from '@story/schema'

export interface DialogueContext {
  bundle: StoryBundle
  secrets: StorySecrets
  characterId: string
  session: { beatId: string; flags: string[]; cluesFound: string[]; day: number; phase: string }
  wantSuggestions: boolean
}

export function buildCharacterSystemPrompt(ctx: DialogueContext): string {
  const { bundle, secrets, characterId, session } = ctx
  const ch = bundle.characters.find((c) => c.id === characterId)
  if (!ch) throw new Error(`unknown character ${characterId}`)
  const beat = bundle.beats.find((b) => b.id === session.beatId)
  const sec = secrets.characters[characterId]
  const clues = bundle.clues
    .filter((c) => session.cluesFound.includes(c.id))
    .map((c) => `- ${c.title}: ${c.text}`)
    .join('\n')

  const format = ctx.wantSuggestions
    ? `Respond with strict JSON: {"reply": "<what you say>", "suggestedReplies": ["<3 short things the player might say next, in the player's voice>"]}`
    : `Respond with strict JSON: {"reply": "<what you say>"}`

  return [
    `You are ${ch.name}, ${ch.role}, a character in an interactive story. Stay in character at all times. Never mention being an AI, the story format, or anything outside the fiction.`,
    `Keep replies to 1-3 short sentences — they may be spoken aloud.`,
    `PERSONALITY: ${ch.personality}`,
    sec ? `WHAT YOU KNOW (reveal only per the conditions): ${sec.secrets}` : '',
    sec?.hardLimits ? `HARD LIMITS: ${sec.hardLimits}` : '',
    `CURRENT SCENE: ${beat?.narration ?? ''} The player's objective: ${beat?.objective ?? ''}`,
    `STORY TIME: Day ${session.day}, ${session.phase}.`,
    `STORY FLAGS SET: ${session.flags.join(', ') || 'none'}`,
    clues ? `CLUES THE PLAYER HOLDS:\n${clues}` : '',
    format,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildJudgeSystemPrompt(
  bundle: StoryBundle,
  secrets: StorySecrets,
  challengeId: string,
): string {
  const ch = bundle.challenges.find((c) => c.id === challengeId)
  const rubric = secrets.judging[challengeId]?.rubric
  if (!ch || !rubric) throw new Error(`no rubric for challenge ${challengeId}`)
  return [
    `You are the impartial judge of an interactive story challenge. Evaluate ONLY the transcript the user provides.`,
    `CHALLENGE: ${ch.prompt}`,
    `RUBRIC: ${rubric}`,
    `Respond with strict JSON: {"success": true|false, "feedback": "<one short in-fiction sentence>"}. When uncertain, success is false.`,
  ].join('\n\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/server test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: provider interfaces, OpenAI implementations, prompt assembly"
```

---

### Task 9: Dialogue, judge, STT routes + CORS + rate limiting

**Files:**
- Create: `apps/server/src/ratelimit.ts`
- Modify: `apps/server/src/app.ts` (add routes + middleware), `apps/server/src/index.ts` (wire providers)
- Test: `apps/server/test/ai-routes.test.ts`

**Interfaces:**
- Consumes: providers + prompts (Task 8), registry (Task 7).
- Produces (web `api.ts` in Task 11 calls exactly these):
  - `AppDeps` grows to `{ stories, providers: Providers, rateLimiter: RateLimiter }`
  - `POST /api/dialogue` body `{ storyId, characterId, session: { beatId, flags, cluesFound, day, phase }, transcriptTail: TranscriptEntry[], playerMessage, wantAudio, wantSuggestions }` → `{ text: string, suggestedReplies?: string[], audioBase64?: string }`
  - `POST /api/judge` body `{ storyId, challengeId, transcriptTail }` → `{ success: boolean, feedback: string }`
  - `POST /api/stt` multipart field `audio` → `{ text: string }`
  - All POST `/api/*` require header `x-device-id`; missing → 400, over budget (30 req/min/device) → 429
  - `createRateLimiter(maxPerMinute: number): RateLimiter` with `RateLimiter = { allow(deviceId: string, nowMs: number): boolean }`

- [ ] **Step 1: Write the failing tests**

`apps/server/test/ai-routes.test.ts`:
```ts
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createFakeProviders } from '../src/providers/fake'
import { createRateLimiter } from '../src/ratelimit'
import { loadStories } from '../src/stories'

const stories = loadStories(join(__dirname, '../../../stories'))
const HEADERS = { 'content-type': 'application/json', 'x-device-id': 'dev-1' }

function makeApp(overrides = {}) {
  return createApp({
    stories,
    providers: createFakeProviders(overrides),
    rateLimiter: createRateLimiter(30),
  })
}

const dialogueBody = {
  storyId: 'kidnapping-escape',
  characterId: 'viktor',
  session: { beatId: 'b1', flags: [], cluesFound: [], day: 1, phase: 'day' },
  transcriptTail: [{ role: 'character', text: 'Ah. You are awake.', atMs: 0 }],
  playerMessage: 'Why me?',
  wantAudio: false,
  wantSuggestions: true,
}

describe('POST /api/dialogue', () => {
  it('returns reply and suggestions parsed from provider JSON', async () => {
    const seen: string[] = []
    const app = makeApp({
      dialogue: {
        complete: async ({ system }: { system: string }) => {
          seen.push(system)
          return JSON.stringify({ reply: 'Because of your hands.', suggestedReplies: ['My hands?'] })
        },
      },
    })
    const res = await app.request('/api/dialogue', { method: 'POST', headers: HEADERS, body: JSON.stringify(dialogueBody) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Because of your hands.', suggestedReplies: ['My hands?'] })
    expect(seen[0]).toContain('vault beneath the house') // secrets reached the prompt
  })

  it('falls back to raw text when the provider returns non-JSON', async () => {
    const app = makeApp({ dialogue: { complete: async () => 'plain sentence' } })
    const res = await app.request('/api/dialogue', { method: 'POST', headers: HEADERS, body: JSON.stringify(dialogueBody) })
    expect((await res.json()).text).toBe('plain sentence')
  })

  it('inlines base64 audio when wantAudio is true', async () => {
    const app = makeApp()
    const res = await app.request('/api/dialogue', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ ...dialogueBody, wantAudio: true, wantSuggestions: false }),
    })
    const body = await res.json()
    expect(body.audioBase64).toBe(Buffer.from('fake-audio').toString('base64'))
  })

  it('requires x-device-id', async () => {
    const app = makeApp()
    const res = await app.request('/api/dialogue', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dialogueBody),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/judge', () => {
  it('maps the provider verdict', async () => {
    const app = makeApp({ dialogue: { complete: async () => JSON.stringify({ success: true, feedback: 'He told you.' }) } })
    const res = await app.request('/api/judge', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ storyId: 'kidnapping-escape', challengeId: 'c1', transcriptTail: [] }),
    })
    expect(await res.json()).toEqual({ success: true, feedback: 'He told you.' })
  })

  it('fails closed on unparseable verdicts', async () => {
    const app = makeApp({ dialogue: { complete: async () => 'hmm' } })
    const res = await app.request('/api/judge', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ storyId: 'kidnapping-escape', challengeId: 'c1', transcriptTail: [] }),
    })
    expect((await res.json()).success).toBe(false)
  })
})

describe('POST /api/stt', () => {
  it('transcribes an uploaded blob', async () => {
    const app = makeApp()
    const form = new FormData()
    form.append('audio', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }), 'a.webm')
    const res = await app.request('/api/stt', { method: 'POST', headers: { 'x-device-id': 'dev-1' }, body: form })
    expect(await res.json()).toEqual({ text: 'fake transcript' })
  })
})

describe('rate limiting', () => {
  it('429s after the per-minute budget', async () => {
    const app = createApp({ stories, providers: createFakeProviders(), rateLimiter: createRateLimiter(2) })
    const hit = () => app.request('/api/judge', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ storyId: 'kidnapping-escape', challengeId: 'c1', transcriptTail: [] }),
    })
    expect((await hit()).status).toBe(200)
    expect((await hit()).status).toBe(200)
    expect((await hit()).status).toBe(429)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/server test`
Expected: FAIL — routes/ratelimit missing.

- [ ] **Step 3: Implement**

`apps/server/src/ratelimit.ts`:
```ts
export interface RateLimiter {
  allow(deviceId: string, nowMs: number): boolean
}

export function createRateLimiter(maxPerMinute: number): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    allow(deviceId, nowMs) {
      const windowStart = nowMs - 60_000
      const recent = (hits.get(deviceId) ?? []).filter((t) => t > windowStart)
      if (recent.length >= maxPerMinute) {
        hits.set(deviceId, recent)
        return false
      }
      recent.push(nowMs)
      hits.set(deviceId, recent)
      return true
    },
  }
}
```

In `apps/server/src/app.ts`, extend `AppDeps`, add CORS + the routes. New imports and body:

```ts
import { cors } from 'hono/cors'
import { z } from 'zod'
import { buildCharacterSystemPrompt, buildJudgeSystemPrompt } from './prompt'
import type { Providers } from './providers/types'
import type { RateLimiter } from './ratelimit'

export interface AppDeps {
  stories: StoryRegistry
  providers?: Providers
  rateLimiter?: RateLimiter
}

const TranscriptTailSchema = z.array(
  z.object({ role: z.enum(['player', 'character']), text: z.string(), atMs: z.number() }),
)

const DialogueBodySchema = z.object({
  storyId: z.string(),
  characterId: z.string(),
  session: z.object({
    beatId: z.string(),
    flags: z.array(z.string()),
    cluesFound: z.array(z.string()),
    day: z.number(),
    phase: z.string(),
  }),
  transcriptTail: TranscriptTailSchema.max(12),
  playerMessage: z.string().min(1).max(2000),
  wantAudio: z.boolean(),
  wantSuggestions: z.boolean(),
})

const JudgeBodySchema = z.object({
  storyId: z.string(),
  challengeId: z.string(),
  transcriptTail: TranscriptTailSchema.max(24),
})
```

Inside `createApp`, before the routes:

```ts
  app.use('*', cors())

  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'POST') return next()
    const deviceId = c.req.header('x-device-id')
    if (!deviceId) return c.json({ error: 'x-device-id header required' }, 400)
    if (deps.rateLimiter && !deps.rateLimiter.allow(deviceId, Date.now()))
      return c.json({ error: 'rate limited' }, 429)
    return next()
  })
```

The AI routes (after the existing GET routes; `parseJson` is a tiny local helper):

```ts
  const parseJson = (raw: string): Record<string, unknown> => {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  app.post('/api/dialogue', async (c) => {
    if (!deps.providers) return c.json({ error: 'no providers configured' }, 500)
    const parsed = DialogueBodySchema.safeParse(await c.req.json())
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    const body = parsed.data
    const story = deps.stories.get(body.storyId)
    const character = story?.bundle.characters.find((ch) => ch.id === body.characterId)
    if (!story || !character) return c.json({ error: 'unknown story or character' }, 404)

    const system = buildCharacterSystemPrompt({
      bundle: story.bundle,
      secrets: story.secrets,
      characterId: body.characterId,
      session: body.session,
      wantSuggestions: body.wantSuggestions,
    })
    const messages = [
      ...body.transcriptTail.map((t) => ({
        role: t.role === 'player' ? ('user' as const) : ('assistant' as const),
        content: t.text,
      })),
      { role: 'user' as const, content: body.playerMessage },
    ]
    const raw = await deps.providers.dialogue.complete({ system, messages, json: true })
    const out = parseJson(raw)
    const text = typeof out.reply === 'string' && out.reply ? out.reply : raw
    const suggestedReplies =
      body.wantSuggestions && Array.isArray(out.suggestedReplies)
        ? (out.suggestedReplies as string[]).filter((s) => typeof s === 'string').slice(0, 3)
        : undefined

    let audioBase64: string | undefined
    if (body.wantAudio) {
      try {
        const buf = await deps.providers.tts.speak(text, character.voice.voiceId, character.voice.instructions)
        audioBase64 = buf.toString('base64')
      } catch {
        audioBase64 = undefined // TTS failure: text still ships (spec §8)
      }
    }
    return c.json({ text, ...(suggestedReplies ? { suggestedReplies } : {}), ...(audioBase64 ? { audioBase64 } : {}) })
  })

  app.post('/api/judge', async (c) => {
    if (!deps.providers) return c.json({ error: 'no providers configured' }, 500)
    const parsed = JudgeBodySchema.safeParse(await c.req.json())
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    const body = parsed.data
    const story = deps.stories.get(body.storyId)
    if (!story) return c.json({ error: 'unknown story' }, 404)
    let system: string
    try {
      system = buildJudgeSystemPrompt(story.bundle, story.secrets, body.challengeId)
    } catch {
      return c.json({ error: 'unknown challenge' }, 404)
    }
    const transcript = body.transcriptTail
      .map((t) => `${t.role === 'player' ? 'PLAYER' : 'CHARACTER'}: ${t.text}`)
      .join('\n')
    const raw = await deps.providers.dialogue.complete({
      system,
      messages: [{ role: 'user', content: transcript || '(no conversation yet)' }],
      json: true,
    })
    const out = parseJson(raw)
    return c.json({
      success: out.success === true,
      feedback: typeof out.feedback === 'string' ? out.feedback : '',
    })
  })

  app.post('/api/stt', async (c) => {
    if (!deps.providers) return c.json({ error: 'no providers configured' }, 500)
    const form = await c.req.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File)) return c.json({ error: 'audio file required' }, 400)
    const text = await deps.providers.stt.transcribe(Buffer.from(await audio.arrayBuffer()), audio.type)
    return c.json({ text })
  })
```

Update `apps/server/src/index.ts` to wire the real pieces:

```ts
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createOpenAiProviders } from './providers/openai'
import { createRateLimiter } from './ratelimit'
import { loadStories } from './stories'

const port = Number(process.env.PORT ?? 8787)
const stories = loadStories(process.env.STORIES_DIR ?? './stories')
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY is required')

const app = createApp({
  stories,
  providers: createOpenAiProviders({
    apiKey,
    dialogueModel: process.env.DIALOGUE_MODEL ?? 'gpt-4o-mini',
    sttModel: process.env.STT_MODEL ?? 'whisper-1',
    ttsModel: process.env.TTS_MODEL ?? 'gpt-4o-mini-tts',
  }),
  rateLimiter: createRateLimiter(30),
})

console.log(`gateway listening on :${port} with ${stories.size} stories`)
serve({ fetch: app.fetch, port })
```

Note: Task 7's tests call `createApp({ stories })` — `providers`/`rateLimiter` are optional, so they still pass unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/server test && pnpm typecheck`
Expected: PASS (all server tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: dialogue, judge, and stt gateway routes with CORS and rate limiting"
```

---

### Task 10: Session snapshot persistence (SQLite)

**Files:**
- Create: `apps/server/src/db.ts`
- Modify: `apps/server/src/app.ts` (session routes), `apps/server/src/index.ts` (wire db)
- Test: `apps/server/test/sessions.test.ts`

**Interfaces:**
- Consumes: `SessionState` (Task 2).
- Produces (web Tasks 12 & 16 call these):
  - `createSessionsDb(path: string): SessionsDb` (`':memory:'` in tests) with:
    ```ts
    interface SessionsDb {
      upsert(row: { sessionId: string; deviceId: string; storyId: string; stateJson: string; endingId: string | null }): void
      listByDevice(deviceId: string): { sessionId: string; storyId: string; endingId: string | null; updatedAt: number }[]
      get(sessionId: string, deviceId: string): { stateJson: string } | undefined
    }
    ```
  - `POST /api/sessions/snapshot` body `{ sessionId, storyId, state: SessionState }` (deviceId from header) → `{ ok: true }`
  - `GET /api/sessions` (header `x-device-id`) → `{ sessions: [...] }`
  - `GET /api/sessions/:id` (header `x-device-id`, ownership enforced) → `{ state: SessionState }` or 404

- [ ] **Step 1: Write the failing tests**

`apps/server/test/sessions.test.ts`:
```ts
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createSessionsDb } from '../src/db'
import { createFakeProviders } from '../src/providers/fake'
import { createRateLimiter } from '../src/ratelimit'
import { loadStories } from '../src/stories'

const stories = loadStories(join(__dirname, '../../../stories'))
const HEADERS = { 'content-type': 'application/json', 'x-device-id': 'dev-1' }

function makeApp() {
  return createApp({
    stories,
    providers: createFakeProviders(),
    rateLimiter: createRateLimiter(30),
    db: createSessionsDb(':memory:'),
  })
}

const state = {
  storyId: 'kidnapping-escape', mode: 'mcq', beatId: 'b1', flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 1000, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}

describe('session snapshots', () => {
  it('upserts, lists, and fetches by owner', async () => {
    const app = makeApp()
    const snap = (s: object) => app.request('/api/sessions/snapshot', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ sessionId: 'sess-1', storyId: 'kidnapping-escape', state: s }),
    })
    expect((await snap(state)).status).toBe(200)
    expect((await snap({ ...state, endingId: 'escaped' })).status).toBe(200) // upsert

    const list = await (await app.request('/api/sessions', { headers: { 'x-device-id': 'dev-1' } })).json()
    expect(list.sessions).toHaveLength(1)
    expect(list.sessions[0]).toMatchObject({ sessionId: 'sess-1', endingId: 'escaped' })

    const got = await (await app.request('/api/sessions/sess-1', { headers: { 'x-device-id': 'dev-1' } })).json()
    expect(got.state.endingId).toBe('escaped')
  })

  it('hides sessions from other devices', async () => {
    const app = makeApp()
    await app.request('/api/sessions/snapshot', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ sessionId: 'sess-1', storyId: 'kidnapping-escape', state }),
    })
    const res = await app.request('/api/sessions/sess-1', { headers: { 'x-device-id': 'other' } })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/server test`
Expected: FAIL — `src/db` missing.

- [ ] **Step 3: Implement**

`apps/server/src/db.ts`:
```ts
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'

export interface SessionsDb {
  upsert(row: {
    sessionId: string
    deviceId: string
    storyId: string
    stateJson: string
    endingId: string | null
  }): void
  listByDevice(deviceId: string): {
    sessionId: string
    storyId: string
    endingId: string | null
    updatedAt: number
  }[]
  get(sessionId: string, deviceId: string): { stateJson: string } | undefined
}

export function createSessionsDb(path: string): SessionsDb {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      device_id  TEXT NOT NULL,
      story_id   TEXT NOT NULL,
      state_json TEXT NOT NULL,
      ending_id  TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id, updated_at DESC);
  `)
  const upsert = db.prepare(`
    INSERT INTO sessions (session_id, device_id, story_id, state_json, ending_id, updated_at)
    VALUES (@sessionId, @deviceId, @storyId, @stateJson, @endingId, @updatedAt)
    ON CONFLICT(session_id) DO UPDATE SET
      state_json = excluded.state_json, ending_id = excluded.ending_id, updated_at = excluded.updated_at
  `)
  const list = db.prepare(`
    SELECT session_id AS sessionId, story_id AS storyId, ending_id AS endingId, updated_at AS updatedAt
    FROM sessions WHERE device_id = ? ORDER BY updated_at DESC LIMIT 50
  `)
  const getOne = db.prepare(
    `SELECT state_json AS stateJson FROM sessions WHERE session_id = ? AND device_id = ?`,
  )
  return {
    upsert: (row) => upsert.run({ ...row, updatedAt: Date.now() }),
    listByDevice: (deviceId) => list.all(deviceId) as ReturnType<SessionsDb['listByDevice']>,
    get: (sessionId, deviceId) => getOne.get(sessionId, deviceId) as { stateJson: string } | undefined,
  }
}
```

In `apps/server/src/app.ts`: add `db?: SessionsDb` to `AppDeps`, import the type, and add routes:

```ts
  const SnapshotBodySchema = z.object({
    sessionId: z.string().min(1),
    storyId: z.string().min(1),
    state: z.record(z.unknown()),
  })

  app.post('/api/sessions/snapshot', async (c) => {
    if (!deps.db) return c.json({ error: 'no db configured' }, 500)
    const parsed = SnapshotBodySchema.safeParse(await c.req.json())
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400)
    const { sessionId, storyId, state } = parsed.data
    deps.db.upsert({
      sessionId,
      deviceId: c.req.header('x-device-id')!,
      storyId,
      stateJson: JSON.stringify(state),
      endingId: typeof state.endingId === 'string' ? state.endingId : null,
    })
    return c.json({ ok: true })
  })

  app.get('/api/sessions', (c) => {
    if (!deps.db) return c.json({ error: 'no db configured' }, 500)
    const deviceId = c.req.header('x-device-id')
    if (!deviceId) return c.json({ error: 'x-device-id header required' }, 400)
    return c.json({ sessions: deps.db.listByDevice(deviceId) })
  })

  app.get('/api/sessions/:id', (c) => {
    if (!deps.db) return c.json({ error: 'no db configured' }, 500)
    const deviceId = c.req.header('x-device-id')
    if (!deviceId) return c.json({ error: 'x-device-id header required' }, 400)
    const row = deps.db.get(c.req.param('id'), deviceId)
    if (!row) return c.json({ error: 'not found' }, 404)
    return c.json({ state: JSON.parse(row.stateJson) })
  })
```

In `apps/server/src/index.ts`, add to `createApp` deps: `db: createSessionsDb(process.env.DB_PATH ?? './data/sessions.db')` (import it).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/server test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: session snapshot persistence with sqlite and ownership checks"
```

---

### Task 11: Web scaffold — api client, Library, Intro

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/{main.tsx,App.tsx,api.ts,styles.css}`, `apps/web/src/screens/{Library.tsx,Intro.tsx}`, `apps/web/test/setup.ts`
- Test: `apps/web/test/library.test.tsx`

**Interfaces:**
- Consumes: gateway endpoints (Tasks 7, 9, 10); `StoryBundle`, `Mode` types.
- Produces (all later web tasks use):
  - `api.ts`: `deviceId()`, `assetUrl(storyId, path)`, `listStories()`, `getStory(id)`, `dialogue(body)`, `judge(body)`, `stt(blob)`, `snapshot(sessionId, storyId, state)`, `listSessions()`, `getSession(id)` — all typed against the Task 9/10 contracts; base URL from `import.meta.env.VITE_API_URL ?? 'http://localhost:8787'`; every POST sends `x-device-id`.
  - `App.tsx` route state machine: `{ name: 'library' } | { name: 'intro'; storyId: string } | { name: 'stage'; bundle: StoryBundle; mode: Mode; resume: boolean } | { name: 'ending'; bundle: StoryBundle; endingId: string }` — `Stage`/`Ending` screens are stubs until Tasks 13/16.

- [ ] **Step 1: Create the package**

`apps/web/package.json`:
```json
{
  "name": "@story/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@story/engine": "workspace:*",
    "@story/schema": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"] },
  "include": ["src", "test"]
}
```

`apps/web/vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
})
```

`apps/web/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Story Stage</title>
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/styles.css`:
```css
@import 'tailwindcss';
```

- [ ] **Step 2: Write the failing test**

`apps/web/test/library.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/api', () => ({
  listStories: vi.fn(async () => [
    {
      id: 'kidnapping-escape', title: 'The Cellar', tagline: 'You have 3 days.',
      genre: 'thriller', estimatedMinutes: 8, cover: 'assets/cover.svg',
      modes: ['mcq', 'text', 'voice'], stallLines: [],
    },
  ]),
  assetUrl: (id: string, p: string) => `http://x/stories/${id}/${p}`,
}))

import { Library } from '../src/screens/Library'

describe('Library', () => {
  it('renders a card per story with title and duration', async () => {
    render(<Library onPick={() => {}} />)
    expect(await screen.findByText('The Cellar')).toBeInTheDocument()
    expect(screen.getByText(/8 min/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm install && pnpm --filter @story/web test`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement**

`apps/web/src/api.ts`:
```ts
import type { SessionState, StoryBundle, TranscriptEntry } from '@story/schema'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export function deviceId(): string {
  let id = localStorage.getItem('sf-device-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('sf-device-id', id)
  }
  return id
}

export const assetUrl = (storyId: string, path: string) => `${BASE}/stories/${storyId}/${path}`

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
      'x-device-id': deviceId(),
      ...init?.headers,
    },
  })
  if (!res.ok) throw new Error(`api ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const listStories = () =>
  req<{ stories: StoryBundle['meta'][] }>('/api/stories').then((r) => r.stories)

export const getStory = (id: string) => req<StoryBundle>(`/api/stories/${id}`)

export interface DialogueResponse {
  text: string
  suggestedReplies?: string[]
  audioBase64?: string
}

export const dialogue = (body: {
  storyId: string
  characterId: string
  session: { beatId: string; flags: string[]; cluesFound: string[]; day: number; phase: string }
  transcriptTail: TranscriptEntry[]
  playerMessage: string
  wantAudio: boolean
  wantSuggestions: boolean
}) => req<DialogueResponse>('/api/dialogue', { method: 'POST', body: JSON.stringify(body) })

export const judge = (body: {
  storyId: string
  challengeId: string
  transcriptTail: TranscriptEntry[]
}) => req<{ success: boolean; feedback: string }>('/api/judge', { method: 'POST', body: JSON.stringify(body) })

export const stt = (blob: Blob) => {
  const form = new FormData()
  form.append('audio', blob, 'speech.webm')
  return req<{ text: string }>('/api/stt', { method: 'POST', body: form })
}

export const snapshot = (sessionId: string, storyId: string, state: SessionState) =>
  req<{ ok: true }>('/api/sessions/snapshot', {
    method: 'POST',
    body: JSON.stringify({ sessionId, storyId, state }),
  })

export const listSessions = () =>
  req<{ sessions: { sessionId: string; storyId: string; endingId: string | null; updatedAt: number }[] }>(
    '/api/sessions',
  ).then((r) => r.sessions)

export const getSession = (id: string) =>
  req<{ state: SessionState }>(`/api/sessions/${id}`).then((r) => r.state)
```

`apps/web/src/screens/Library.tsx`:
```tsx
import type { StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'
import { assetUrl, listStories } from '../api'

export function Library({ onPick }: { onPick: (storyId: string) => void }) {
  const [stories, setStories] = useState<StoryBundle['meta'][] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    listStories().then(setStories).catch(() => setError(true))
  }, [])

  if (error) return <p className="p-8 text-center text-slate-400">Couldn't load stories. Is the gateway running?</p>
  if (!stories) return <p className="p-8 text-center text-slate-400">Loading…</p>

  return (
    <div className="mx-auto max-w-md p-4 pb-12">
      <h1 className="py-6 text-2xl font-bold">Stories</h1>
      <div className="flex flex-col gap-4">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-left transition hover:border-slate-600"
          >
            <img src={assetUrl(s.id, s.cover)} alt="" className="h-40 w-full object-cover" />
            <div className="p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <span className="text-xs text-slate-400">{s.estimatedMinutes} min</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{s.tagline}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

`apps/web/src/screens/Intro.tsx`:
```tsx
import type { Mode, StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'
import { assetUrl, getStory } from '../api'

const MODE_LABEL: Record<Mode, string> = { mcq: 'Choices', text: 'Free text', voice: 'Voice' }

export function Intro({
  storyId,
  onStart,
  onBack,
}: {
  storyId: string
  onStart: (bundle: StoryBundle, mode: Mode, resume: boolean) => void
  onBack: () => void
}) {
  const [bundle, setBundle] = useState<StoryBundle | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const hasSave = Boolean(localStorage.getItem(`sf-session-${storyId}`))

  useEffect(() => {
    getStory(storyId).then((b) => {
      setBundle(b)
      setMode(b.meta.modes[0])
    })
  }, [storyId])

  if (!bundle || !mode) return <p className="p-8 text-center text-slate-400">Loading…</p>

  const start = async (resume: boolean) => {
    if (mode === 'voice') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      } catch {
        alert('Microphone unavailable — starting in free text instead.')
        onStart(bundle, bundle.meta.modes.includes('text') ? 'text' : bundle.meta.modes[0], resume)
        return
      }
    }
    onStart(bundle, mode, resume)
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-md">
      <img src={assetUrl(storyId, bundle.meta.cover)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="relative flex min-h-dvh flex-col justify-end p-6 pb-10">
        <button onClick={onBack} className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-sm">← Back</button>
        <h1 className="text-3xl font-bold">{bundle.meta.title}</h1>
        <p className="mt-2 text-slate-300">{bundle.meta.tagline}</p>
        <p className="mt-1 text-xs text-slate-400">{bundle.meta.genre} · ~{bundle.meta.estimatedMinutes} min</p>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-slate-400">How do you want to play?</p>
          <div className="mt-2 flex gap-2">
            {bundle.meta.modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-2 text-sm ${m === mode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {hasSave && (
            <button onClick={() => start(true)} className="rounded-xl bg-indigo-600 py-3 font-semibold">
              Resume story
            </button>
          )}
          <button
            onClick={() => start(false)}
            className={`rounded-xl py-3 font-semibold ${hasSave ? 'bg-slate-800' : 'bg-indigo-600'}`}
          >
            {hasSave ? 'Start over' : 'Begin'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

`apps/web/src/App.tsx`:
```tsx
import type { Mode, StoryBundle } from '@story/schema'
import { useState } from 'react'
import { Intro } from './screens/Intro'
import { Library } from './screens/Library'

export type Route =
  | { name: 'library' }
  | { name: 'intro'; storyId: string }
  | { name: 'stage'; bundle: StoryBundle; mode: Mode; resume: boolean }
  | { name: 'ending'; bundle: StoryBundle; endingId: string }

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'library' })

  switch (route.name) {
    case 'library':
      return <Library onPick={(storyId) => setRoute({ name: 'intro', storyId })} />
    case 'intro':
      return (
        <Intro
          storyId={route.storyId}
          onBack={() => setRoute({ name: 'library' })}
          onStart={(bundle, mode, resume) => setRoute({ name: 'stage', bundle, mode, resume })}
        />
      )
    case 'stage':
      return <p className="p-8">Stage: coming in Task 13</p>
    case 'ending':
      return <p className="p-8">Ending: coming in Task 16</p>
  }
}
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Run tests + manual smoke, commit**

Run: `pnpm --filter @story/web test && pnpm typecheck`
Expected: PASS.
Smoke: `pnpm --filter @story/server dev` in one shell (needs no OpenAI key for GET routes only if you temporarily comment the key check — skip if unwilling; the Playwright task covers it), `pnpm --filter @story/web dev` in another → phone-width browser shows both story cards.

```bash
git add -A
git commit -m "feat: web scaffold with api client, library, and intro screens"
```

---

### Task 12: `useSession` — engine loop, persistence, effect fulfillment

**Files:**
- Create: `apps/web/src/useSession.ts`
- Test: `apps/web/test/useSession.test.ts`

**Interfaces:**
- Consumes: engine (`createSession`, `reduce`, `Action`, `Effect`, `storyTime`), `api.ts` (dialogue/judge/snapshot).
- Produces (Stage components in Tasks 13–16 consume exactly this):
  ```ts
  interface SessionApi {
    state: SessionState
    time: { day: number; phase: string; expired: boolean }
    busy: boolean                 // dialogue request in flight
    stallLine: string | null      // shown when a reply is slow
    failedMessage: string | null  // last message that errored (retry affordance)
    send(text: string): void
    retry(): void
    pick(optionId: string): void            // MCQ challenge answer
    selectCharacter(id: string): void
    setMode(m: Mode): void
    pause(r: PauseReason): void
    resume(r: PauseReason): void
    onAudio: { current: ((b64: string) => void) | null }  // Task 15 plugs playback in
  }
  function useSession(bundle: StoryBundle, mode: Mode, resume: boolean, onEnded: (endingId: string) => void): SessionApi
  ```
  - Persists to `localStorage['sf-session-<storyId>']` after every dispatch; a stable `sessionId` is stored alongside (`crypto.randomUUID()` on new session).
  - `SNAPSHOT` effects → `api.snapshot` fire-and-forget; `REQUEST_DIALOGUE` → `api.dialogue` (with `wantAudio = mode==='voice'`, `wantSuggestions = mode==='mcq'`, transcript tail last 12) → dispatch `CHARACTER_REPLY`; `REQUEST_JUDGE` → `api.judge` → dispatch `CHALLENGE_RESOLVED` only on success.
  - Dialogue errors: one silent retry; then set `failedMessage`, dispatch `RESUME('request')` so the clock isn't stuck.
  - Stall: if a dialogue reply takes >6s, set `stallLine` from `meta.stallLines` (fallback `'…'`), cleared on reply.
  - 1s `TICK` interval; `visibilitychange` → `PAUSE/RESUME('hidden')`; on unmount clear interval.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/useSession.test.ts`:
```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'

const dialogueMock = vi.fn()
const judgeMock = vi.fn()
const snapshotMock = vi.fn(async () => ({ ok: true as const }))
vi.mock('../src/api', () => ({
  dialogue: (...a: unknown[]) => dialogueMock(...a),
  judge: (...a: unknown[]) => judgeMock(...a),
  snapshot: (...a: unknown[]) => snapshotMock(...a),
}))

import { useSession } from '../src/useSession'

const bundle = StoryBundleSchema.parse({
  meta: {
    id: 'hx', title: 'Hx', tagline: '', genre: 'test', estimatedMinutes: 5,
    cover: 'c.svg', modes: ['mcq', 'text'], stallLines: ['the wind howls…'],
  },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [{
    id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'kind',
    greeting: 'hi', voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] },
  }],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'], challenges: ['t1'] }],
  challenges: [{
    id: 't1', type: 'task', prompt: 'p', timeLimitSeconds: 60,
    onSuccess: { setFlags: ['won'] }, onFailure: {},
  }],
  clues: [],
  endings: [{ id: 'fin', when: { flags: ['won'] }, title: 'F', text: 'f' }],
})

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  dialogueMock.mockReset()
  judgeMock.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('useSession', () => {
  it('ticks the clock once per second', () => {
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.state.elapsedRealMs).toBe(3000)
  })

  it('sends a message: dialogue call, reply appended, judge success ends story', async () => {
    dialogueMock.mockResolvedValue({ text: 'oh really' })
    judgeMock.mockResolvedValue({ success: true, feedback: 'done' })
    const ended = vi.fn()
    const { result } = renderHook(() => useSession(bundle, 'text', false, ended))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('I did the thing'))
    expect(result.current.busy).toBe(true)
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    await waitFor(() => expect(result.current.state.transcripts['ann']!.at(-1)?.text).toBe('oh really'))
    await waitFor(() => expect(ended).toHaveBeenCalledWith('fin'))
    expect(dialogueMock.mock.calls[0]![0]).toMatchObject({ storyId: 'hx', characterId: 'ann', wantSuggestions: false })
  })

  it('clock is paused while a challenge dialogue is in flight', async () => {
    let release: (v: { text: string }) => void
    dialogueMock.mockReturnValue(new Promise((r) => { release = r }))
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('hello'))
    const before = result.current.state.elapsedRealMs
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.state.elapsedRealMs).toBe(before)
    await act(async () => { release!({ text: 'hi' }); await vi.runOnlyPendingTimersAsync() })
  })

  it('failed dialogue sets failedMessage after one retry and unblocks the clock', async () => {
    dialogueMock.mockRejectedValue(new Error('boom'))
    judgeMock.mockResolvedValue({ success: false, feedback: '' })
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('hello'))
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    await waitFor(() => expect(result.current.failedMessage).toBe('hello'))
    expect(dialogueMock).toHaveBeenCalledTimes(2)
    expect(result.current.state.pauseReasons).not.toContain('request')
  })

  it('persists to localStorage and resumes', () => {
    const { result, unmount } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => vi.advanceTimersByTime(2000))
    unmount()
    const { result: resumed } = renderHook(() => useSession(bundle, 'text', true, () => {}))
    expect(resumed.current.state.elapsedRealMs).toBe(2000)
    expect(resumed.current.state.activeCharacterId).toBe('ann')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/web test`
Expected: FAIL — `src/useSession` missing.

- [ ] **Step 3: Implement**

`apps/web/src/useSession.ts`:
```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Mode, PauseReason, SessionState, StoryBundle } from '@story/schema'
import type { Action, Effect } from '@story/engine'
import { createSession, reduce, storyTime } from '@story/engine'
import * as api from './api'

const TAIL = 12
const STALL_MS = 6000

export interface SessionApi {
  state: SessionState
  time: { day: number; phase: string; expired: boolean }
  busy: boolean
  stallLine: string | null
  failedMessage: string | null
  send(text: string): void
  retry(): void
  pick(optionId: string): void
  selectCharacter(id: string): void
  setMode(m: Mode): void
  pause(r: PauseReason): void
  resume(r: PauseReason): void
  onAudio: { current: ((b64: string) => void) | null }
}

export function useSession(
  bundle: StoryBundle,
  mode: Mode,
  resumeSave: boolean,
  onEnded: (endingId: string) => void,
): SessionApi {
  const saveKey = `sf-session-${bundle.meta.id}`
  const onAudio = useRef<((b64: string) => void) | null>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const initial = useMemo(() => {
    if (resumeSave) {
      const raw = localStorage.getItem(saveKey)
      if (raw) {
        const saved = JSON.parse(raw) as { sessionId: string; state: SessionState }
        // never resume paused-by-stale-reasons
        return { sessionId: saved.sessionId, state: { ...saved.state, pauseReasons: [] as PauseReason[] } }
      }
    }
    return { sessionId: crypto.randomUUID(), state: createSession(bundle, mode).state }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stateRef = useRef<SessionState>(initial.state)
  const [state, setState] = useState<SessionState>(initial.state)
  const [busy, setBusy] = useState(false)
  const [stallLine, setStallLine] = useState<string | null>(null)
  const [failedMessage, setFailedMessage] = useState<string | null>(null)

  const runEffects = useCallback((effects: Effect[]) => {
    for (const e of effects) {
      if (e.type === 'SNAPSHOT' || e.type === 'STORY_ENDED') {
        api.snapshot(initial.sessionId, bundle.meta.id, stateRef.current).catch(() => {})
      }
      if (e.type === 'STORY_ENDED') onEndedRef.current(e.endingId)
      if (e.type === 'REQUEST_DIALOGUE') void requestDialogue(e.characterId, e.playerMessage, 0)
      if (e.type === 'REQUEST_JUDGE') void requestJudge(e.challengeId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dispatch = useCallback(
    (action: Action) => {
      const r = reduce(bundle, stateRef.current, action)
      stateRef.current = r.state
      setState(r.state)
      localStorage.setItem(saveKey, JSON.stringify({ sessionId: initial.sessionId, state: r.state }))
      runEffects(r.effects)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle],
  )

  async function requestDialogue(characterId: string, playerMessage: string, attempt: number) {
    setBusy(true)
    setFailedMessage(null)
    const stall = setTimeout(() => {
      const lines = bundle.meta.stallLines
      setStallLine(lines.length ? lines[Math.floor(Math.random() * lines.length)]! : '…')
    }, STALL_MS)
    try {
      const s = stateRef.current
      const t = storyTime(bundle.clock, s.elapsedRealMs)
      const res = await api.dialogue({
        storyId: bundle.meta.id,
        characterId,
        session: { beatId: s.beatId, flags: s.flags, cluesFound: s.cluesFound, day: t.day, phase: t.phase },
        transcriptTail: (s.transcripts[characterId] ?? []).slice(-TAIL),
        playerMessage,
        wantAudio: s.mode === 'voice',
        wantSuggestions: s.mode === 'mcq',
      })
      dispatch({ type: 'CHARACTER_REPLY', characterId, text: res.text, suggestedReplies: res.suggestedReplies })
      if (res.audioBase64) onAudio.current?.(res.audioBase64)
    } catch {
      if (attempt === 0) return requestDialogue(characterId, playerMessage, 1)
      setFailedMessage(playerMessage)
      dispatch({ type: 'RESUME', reason: 'request' })
    } finally {
      clearTimeout(stall)
      setStallLine(null)
      setBusy(false)
    }
  }

  async function requestJudge(challengeId: string) {
    try {
      const s = stateRef.current
      const charId = s.activeCharacterId
      const res = await api.judge({
        storyId: bundle.meta.id,
        challengeId,
        transcriptTail: charId ? (s.transcripts[charId] ?? []).slice(-TAIL * 2) : [],
      })
      if (res.success) dispatch({ type: 'CHALLENGE_RESOLVED', challengeId, success: true })
    } catch {
      /* judge failures are silent; the deadline is the backstop */
    }
  }

  useEffect(() => {
    const tick = setInterval(() => dispatch({ type: 'TICK', deltaMs: 1000 }), 1000)
    const onVis = () =>
      dispatch({ type: document.hidden ? 'PAUSE' : 'RESUME', reason: 'hidden' })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [dispatch])

  const time = storyTime(bundle.clock, state.elapsedRealMs)

  return {
    state,
    time,
    busy,
    stallLine,
    failedMessage,
    send: (text) => dispatch({ type: 'PLAYER_MESSAGE', text, source: stateRef.current.mode }),
    retry: () => {
      const msg = failedMessage
      const charId = stateRef.current.activeCharacterId
      if (msg && charId) void requestDialogue(charId, msg, 0)
    },
    pick: (optionId) => {
      const ch = stateRef.current.activeChallenge
      if (ch) dispatch({ type: 'MCQ_PICK', challengeId: ch.id, optionId })
    },
    selectCharacter: (id) => dispatch({ type: 'SELECT_CHARACTER', characterId: id }),
    setMode: (m) => dispatch({ type: 'SET_MODE', mode: m }),
    pause: (r) => dispatch({ type: 'PAUSE', reason: r }),
    resume: (r) => dispatch({ type: 'RESUME', reason: r }),
    onAudio,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/web test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: useSession hook bridging engine, gateway, and persistence"
```

---

### Task 13: Stage chrome — background, top bar, character rail, narration, clues

**Files:**
- Create: `apps/web/src/screens/Stage.tsx`, `apps/web/src/components/{BackgroundLayer.tsx,TopBar.tsx,CharacterRail.tsx,NarrationCard.tsx,ClueDrawer.tsx,ChallengeBanner.tsx}`
- Modify: `apps/web/src/App.tsx` (mount Stage + Ending routing)
- Test: `apps/web/test/stage-chrome.test.tsx`

**Interfaces:**
- Consumes: `useSession` (Task 12), `isCharacterAvailable` (Task 4), `assetUrl` (Task 11).
- Produces: `<Stage bundle mode resume onEnded />`; slots for `ConversationSheet`/`InputDock` arrive in Task 14 (Stage renders a `{/* conversation: Task 14 */}` placeholder region this task).

- [ ] **Step 1: Write the failing tests**

`apps/web/test/stage-chrome.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { CharacterRail } from '../src/components/CharacterRail'
import { TopBar } from '../src/components/TopBar'

vi.mock('../src/api', () => ({ assetUrl: (id: string, p: string) => `http://x/${id}/${p}` }))

const bundle = StoryBundleSchema.parse({
  meta: { id: 'sx', title: 'Sx', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [
    { id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } },
    { id: 'owl', name: 'Owl', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'onyx' }, availability: { beats: ['*'], phases: ['night'] } },
  ],
  beats: [{ id: 'b1', narration: 'n', objective: 'Find the key', characters: ['ann', 'owl'] }],
  challenges: [], clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const baseState = {
  storyId: 'sx', mode: 'text' as const, beatId: 'b1', flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}

describe('TopBar', () => {
  it('shows day, phase, objective, and a mm:ss countdown when a challenge is active', () => {
    render(
      <TopBar
        bundle={bundle}
        state={{ ...baseState, activeChallenge: { id: 'x', deadlineMs: 95_000 } }}
        time={{ day: 1, phase: 'day', expired: false }}
        onOpenSettings={() => {}}
      />,
    )
    expect(screen.getByText(/Day 1/)).toBeInTheDocument()
    expect(screen.getByText(/day/)).toBeInTheDocument()
    expect(screen.getByText('Find the key')).toBeInTheDocument()
    expect(screen.getByText('01:35')).toBeInTheDocument() // 95s remaining at t=0
  })
})

describe('CharacterRail', () => {
  it('marks phase-unavailable characters and highlights the active one', () => {
    render(
      <CharacterRail
        bundle={bundle}
        state={{ ...baseState, activeCharacterId: 'ann' }}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /Ann/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Owl/ })).toBeDisabled() // day phase, night-only
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/web test`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement the components**

`apps/web/src/components/TopBar.tsx`:
```tsx
import type { SessionState, StoryBundle } from '@story/schema'

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const PHASE_ICON: Record<string, string> = {
  dawn: '🌅', day: '☀️', dusk: '🌆', night: '🌙', morning: '🌅', evening: '🌆',
}

export function TopBar({
  bundle,
  state,
  time,
  onOpenSettings,
}: {
  bundle: StoryBundle
  state: SessionState
  time: { day: number; phase: string }
  onOpenSettings: () => void
}) {
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  const remaining = state.activeChallenge ? state.activeChallenge.deadlineMs - state.elapsedRealMs : null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-slate-100">
          {PHASE_ICON[time.phase] ?? '🕐'} Day {time.day} · {time.phase}
        </span>
        <div className="flex items-center gap-2">
          {remaining !== null && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${remaining < 30_000 ? 'bg-red-600' : 'bg-red-500/80'}`}>
              ⏱ {mmss(remaining)}
            </span>
          )}
          <button onClick={onOpenSettings} className="pointer-events-auto rounded-full bg-black/50 px-3 py-1 text-xs">⚙︎</button>
        </div>
      </div>
      {beat && (
        <p className="mt-2 text-center">
          <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-300">{beat.objective}</span>
        </p>
      )}
    </div>
  )
}
```

`apps/web/src/components/CharacterRail.tsx`:
```tsx
import type { SessionState, StoryBundle } from '@story/schema'
import { isCharacterAvailable } from '@story/engine'
import { assetUrl } from '../api'

export function CharacterRail({
  bundle,
  state,
  onSelect,
}: {
  bundle: StoryBundle
  state: SessionState
  onSelect: (id: string) => void
}) {
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  const chars = bundle.characters.filter((c) => beat?.characters.includes(c.id))
  return (
    <div className="absolute left-3 top-24 z-20 flex flex-col gap-2">
      {chars.map((c) => {
        const available = isCharacterAvailable(bundle, state, c.id)
        const active = state.activeCharacterId === c.id
        return (
          <button
            key={c.id}
            aria-label={c.name}
            aria-pressed={active}
            disabled={!available}
            onClick={() => onSelect(c.id)}
            className={`h-11 w-11 overflow-hidden rounded-full border-2 transition ${
              active ? 'border-indigo-400' : 'border-white/20'
            } ${available ? '' : 'opacity-35'}`}
          >
            <img src={assetUrl(bundle.meta.id, c.portrait)} alt={c.name} className="h-full w-full object-cover" />
          </button>
        )
      })}
    </div>
  )
}
```

`apps/web/src/components/BackgroundLayer.tsx`:
```tsx
import type { StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'
import { assetUrl } from '../api'

/** Crossfades between per-phase scene backgrounds. */
export function BackgroundLayer({ bundle, phase }: { bundle: StoryBundle; phase: string }) {
  const [layers, setLayers] = useState<[string, string | null]>([phase, null])
  useEffect(() => {
    setLayers(([current]) => (current === phase ? [current, null] : [phase, current]))
  }, [phase])
  const src = (p: string) => assetUrl(bundle.meta.id, bundle.scene.backgrounds[p] ?? '')
  const [top, fading] = layers
  return (
    <div className="absolute inset-0">
      {fading && <img src={src(fading)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <img
        key={top}
        src={src(top)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
      />
    </div>
  )
}
```

`apps/web/src/components/NarrationCard.tsx`:
```tsx
import type { StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'

export function NarrationCard({ bundle, beatId }: { bundle: StoryBundle; beatId: string }) {
  const [shownFor, setShownFor] = useState<string | null>(beatId)
  useEffect(() => setShownFor(beatId), [beatId])
  if (shownFor === null) return null
  const beat = bundle.beats.find((b) => b.id === shownFor)
  if (!beat) return null
  return (
    <button
      onClick={() => setShownFor(null)}
      className="absolute inset-x-4 top-1/4 z-30 rounded-2xl border border-white/10 bg-black/80 p-5 text-left"
    >
      <p className="text-sm leading-relaxed text-slate-100">{beat.narration}</p>
      <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">tap to continue</p>
    </button>
  )
}
```

`apps/web/src/components/ClueDrawer.tsx`:
```tsx
import type { SessionState, StoryBundle } from '@story/schema'
import { useState } from 'react'

export function ClueDrawer({ bundle, state }: { bundle: StoryBundle; state: SessionState }) {
  const [open, setOpen] = useState(false)
  const clues = bundle.clues.filter((c) => state.cluesFound.includes(c.id))
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="absolute right-3 top-24 z-20 rounded-full bg-black/50 px-3 py-1 text-xs"
      >
        🔍 {clues.length}
      </button>
      {open && (
        <div className="absolute inset-0 z-40 bg-black/70" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-slate-900 p-5 pb-10" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-300">Clues</h3>
            {clues.length === 0 && <p className="mt-2 text-sm text-slate-500">Nothing yet.</p>}
            {clues.map((c) => (
              <div key={c.id} className="mt-3">
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-sm text-slate-400">{c.text}</p>
              </div>
            ))}
            <button onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-slate-800 py-2 text-sm">Close</button>
          </div>
        </div>
      )}
    </>
  )
}
```

`apps/web/src/components/ChallengeBanner.tsx`:
```tsx
import type { SessionState, StoryBundle } from '@story/schema'

export function ChallengeBanner({ bundle, state }: { bundle: StoryBundle; state: SessionState }) {
  if (!state.activeChallenge) return null
  const ch = bundle.challenges.find((c) => c.id === state.activeChallenge!.id)
  if (!ch) return null
  return (
    <div className="pointer-events-none absolute inset-x-4 top-36 z-10">
      <p className="rounded-xl bg-red-950/70 px-4 py-2 text-center text-xs text-red-200">{ch.prompt}</p>
    </div>
  )
}
```

`apps/web/src/screens/Stage.tsx`:
```tsx
import type { Mode, StoryBundle } from '@story/schema'
import { useSession } from '../useSession'
import { BackgroundLayer } from '../components/BackgroundLayer'
import { ChallengeBanner } from '../components/ChallengeBanner'
import { CharacterRail } from '../components/CharacterRail'
import { ClueDrawer } from '../components/ClueDrawer'
import { NarrationCard } from '../components/NarrationCard'
import { TopBar } from '../components/TopBar'

export function Stage({
  bundle,
  mode,
  resume,
  onEnded,
}: {
  bundle: StoryBundle
  mode: Mode
  resume: boolean
  onEnded: (endingId: string) => void
}) {
  const session = useSession(bundle, mode, resume, onEnded)
  const { state, time } = session

  return (
    <div className="relative mx-auto h-dvh max-w-md overflow-hidden bg-slate-950">
      <BackgroundLayer bundle={bundle} phase={time.phase} />
      <TopBar bundle={bundle} state={state} time={time} onOpenSettings={() => {}} />
      <CharacterRail bundle={bundle} state={state} onSelect={session.selectCharacter} />
      <ChallengeBanner bundle={bundle} state={state} />
      <ClueDrawer bundle={bundle} state={state} />
      <NarrationCard bundle={bundle} beatId={state.beatId} />
      {/* conversation sheet + input dock: Task 14 */}
    </div>
  )
}
```

In `apps/web/src/App.tsx`, replace the `stage` placeholder case:
```tsx
    case 'stage':
      return (
        <Stage
          bundle={route.bundle}
          mode={route.mode}
          resume={route.resume}
          onEnded={(endingId) => setRoute({ name: 'ending', bundle: route.bundle, endingId })}
        />
      )
```
(and `import { Stage } from './screens/Stage'`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/web test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: immersive stage chrome (background, clock, rail, narration, clues)"
```

---

### Task 14: ConversationSheet + InputDock + SettingsSheet

**Files:**
- Create: `apps/web/src/components/{ConversationSheet.tsx,InputDock.tsx,SettingsSheet.tsx}`
- Modify: `apps/web/src/screens/Stage.tsx` (mount all three)
- Test: `apps/web/test/input-dock.test.tsx`

**Interfaces:**
- Consumes: `SessionApi` (Task 12), challenge/bundle types.
- Produces:
  - `<ConversationSheet bundle state busy stallLine failedMessage onRetry />` — translucent bottom sheet with the active character's transcript.
  - `<InputDock bundle session voiceSlot? />` — renders per mode: MCQ chips (active mcq challenge options take priority over `state.suggestedReplies`), text field + send, or `voiceSlot` (Task 15 passes the push-to-talk button; until then voice mode shows a disabled mic placeholder).
  - `<SettingsSheet bundle session open onClose />` — mode switcher limited to `meta.modes`; dispatches `pause('settings')`/`resume('settings')` on open/close.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/input-dock.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { InputDock } from '../src/components/InputDock'

vi.mock('../src/api', () => ({ assetUrl: () => 'x' }))

const bundle = StoryBundleSchema.parse({
  meta: { id: 'dx', title: 'D', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['mcq', 'text', 'voice'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [{ id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
    voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } }],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'], challenges: ['q1'] }],
  challenges: [{ id: 'q1', type: 'mcq', prompt: 'pick', timeLimitSeconds: 60,
    options: [{ id: 'a', text: 'Option A', onPick: {} }, { id: 'b', text: 'Option B', onPick: {} }] }],
  clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const baseState = {
  storyId: 'dx', mode: 'mcq' as const, beatId: 'b1', flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: 'ann', transcripts: {}, suggestedReplies: [], endingId: null,
}

function makeSession(overrides: object) {
  return {
    state: baseState, time: { day: 1, phase: 'day', expired: false }, busy: false,
    stallLine: null, failedMessage: null, send: vi.fn(), retry: vi.fn(), pick: vi.fn(),
    selectCharacter: vi.fn(), setMode: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    onAudio: { current: null }, ...overrides,
  }
}

describe('InputDock', () => {
  it('mcq mode with an active mcq challenge shows its options and picks', async () => {
    const session = makeSession({ state: { ...baseState, activeChallenge: { id: 'q1', deadlineMs: 60_000 } } })
    render(<InputDock bundle={bundle} session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Option A' }))
    expect(session.pick).toHaveBeenCalledWith('a')
  })

  it('mcq mode without a challenge shows suggested replies and sends them', async () => {
    const session = makeSession({ state: { ...baseState, suggestedReplies: ['Ask why', 'Stay quiet'] } })
    render(<InputDock bundle={bundle} session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ask why' }))
    expect(session.send).toHaveBeenCalledWith('Ask why')
  })

  it('text mode sends typed messages and clears the field', async () => {
    const session = makeSession({ state: { ...baseState, mode: 'text' as const } })
    render(<InputDock bundle={bundle} session={session} />)
    const input = screen.getByPlaceholderText(/say something/i)
    await userEvent.type(input, 'hello there{enter}')
    expect(session.send).toHaveBeenCalledWith('hello there')
    expect(input).toHaveValue('')
  })

  it('disables input while busy or with no character selected', () => {
    const session = makeSession({ state: { ...baseState, mode: 'text' as const, activeCharacterId: null } })
    render(<InputDock bundle={bundle} session={session} />)
    expect(screen.getByPlaceholderText(/pick someone/i)).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @story/web test`
Expected: FAIL — `InputDock` missing.

- [ ] **Step 3: Implement**

`apps/web/src/components/InputDock.tsx`:
```tsx
import type { StoryBundle } from '@story/schema'
import { useState, type ReactNode } from 'react'
import type { SessionApi } from '../useSession'

export function InputDock({
  bundle,
  session,
  voiceSlot,
}: {
  bundle: StoryBundle
  session: SessionApi
  voiceSlot?: ReactNode
}) {
  const { state, busy } = session
  const [draft, setDraft] = useState('')
  const noCharacter = !state.activeCharacterId

  const mcqChallenge =
    state.activeChallenge != null
      ? bundle.challenges.find((c) => c.id === state.activeChallenge!.id && c.type === 'mcq')
      : undefined

  const submit = () => {
    const text = draft.trim()
    if (!text || busy || noCharacter) return
    session.send(text)
    setDraft('')
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {state.mode === 'mcq' && (
        <div className="flex flex-col gap-2">
          {mcqChallenge?.type === 'mcq'
            ? mcqChallenge.options.map((o) => (
                <button
                  key={o.id}
                  disabled={busy}
                  onClick={() => session.pick(o.id)}
                  className="rounded-full border border-indigo-500/60 bg-indigo-950/80 px-4 py-2.5 text-sm text-indigo-100 disabled:opacity-50"
                >
                  {o.text}
                </button>
              ))
            : state.suggestedReplies.map((s) => (
                <button
                  key={s}
                  disabled={busy || noCharacter}
                  onClick={() => session.send(s)}
                  className="rounded-full border border-white/15 bg-black/60 px-4 py-2.5 text-sm text-slate-100 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
          {!mcqChallenge && state.suggestedReplies.length === 0 && (
            <p className="text-center text-xs text-slate-400">
              {noCharacter ? 'Pick someone to talk to' : busy ? '…' : 'Tap a character to get options'}
            </p>
          )}
        </div>
      )}

      {state.mode === 'text' && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            disabled={busy || noCharacter}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={noCharacter ? 'Pick someone to talk to' : 'Say something…'}
            className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm placeholder:text-slate-500 disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={busy || noCharacter}
            className="h-10 w-10 shrink-0 rounded-full bg-indigo-600 text-white disabled:opacity-50"
            aria-label="Send"
          >
            ➤
          </button>
        </div>
      )}

      {state.mode === 'voice' &&
        (voiceSlot ?? (
          <p className="text-center text-xs text-slate-500">voice unavailable</p>
        ))}
    </div>
  )
}
```

`apps/web/src/components/ConversationSheet.tsx`:
```tsx
import type { SessionState, StoryBundle } from '@story/schema'
import { useEffect, useRef } from 'react'

export function ConversationSheet({
  bundle,
  state,
  busy,
  stallLine,
  failedMessage,
  onRetry,
}: {
  bundle: StoryBundle
  state: SessionState
  busy: boolean
  stallLine: string | null
  failedMessage: string | null
  onRetry: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const charId = state.activeCharacterId
  const entries = charId ? (state.transcripts[charId] ?? []) : []
  const character = bundle.characters.find((c) => c.id === charId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [entries.length, stallLine])

  if (!charId) return null
  return (
    <div className="absolute inset-x-2 bottom-20 z-10 max-h-[45%] rounded-2xl border border-white/10 bg-slate-950/80">
      <p className="px-4 pt-3 text-[11px] uppercase tracking-wide text-slate-400">
        {character?.name} — {character?.role}
      </p>
      <div ref={scrollRef} className="max-h-[calc(45dvh-3rem)] overflow-y-auto p-3">
        {entries.map((e, i) => (
          <p
            key={i}
            className={`my-1 max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              e.role === 'player' ? 'ml-auto bg-indigo-600 text-white' : 'bg-white/10 text-slate-100'
            }`}
          >
            {e.text}
          </p>
        ))}
        {busy && <p className="my-1 max-w-[85%] rounded-xl bg-white/5 px-3 py-2 text-sm italic text-slate-400">{stallLine ?? '…'}</p>}
        {failedMessage && (
          <button onClick={onRetry} className="my-1 w-full rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            Couldn't reach them — tap to retry
          </button>
        )}
      </div>
    </div>
  )
}
```

`apps/web/src/components/SettingsSheet.tsx`:
```tsx
import type { Mode, StoryBundle } from '@story/schema'
import { useEffect } from 'react'
import type { SessionApi } from '../useSession'

const MODE_LABEL: Record<Mode, string> = { mcq: 'Choices', text: 'Free text', voice: 'Voice' }

export function SettingsSheet({
  bundle,
  session,
  open,
  onClose,
}: {
  bundle: StoryBundle
  session: SessionApi
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (open) session.pause('settings')
    else session.resume('settings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 bg-black/70" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-slate-900 p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-slate-300">Mode</h3>
        <div className="mt-3 flex gap-2">
          {bundle.meta.modes.map((m) => (
            <button
              key={m}
              onClick={() => session.setMode(m)}
              className={`rounded-full px-4 py-2 text-sm ${session.state.mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-slate-800 py-2 text-sm">Close</button>
      </div>
    </div>
  )
}
```

In `apps/web/src/screens/Stage.tsx`: add `const [settingsOpen, setSettingsOpen] = useState(false)`, pass `onOpenSettings={() => setSettingsOpen(true)}` to `TopBar`, and replace the Task 13 placeholder comment with:

```tsx
      <ConversationSheet
        bundle={bundle}
        state={state}
        busy={session.busy}
        stallLine={session.stallLine}
        failedMessage={session.failedMessage}
        onRetry={session.retry}
      />
      <InputDock bundle={bundle} session={session} />
      <SettingsSheet bundle={bundle} session={session} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/web test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: conversation sheet, adaptive input dock, settings sheet"
```

---

### Task 15: Voice — push-to-talk, STT, reply audio

**Files:**
- Create: `apps/web/src/audio.ts`, `apps/web/src/components/PushToTalkButton.tsx`
- Modify: `apps/web/src/screens/Stage.tsx` (wire voiceSlot + onAudio)
- Test: `apps/web/test/audio.test.ts`

**Interfaces:**
- Consumes: `api.stt` (Task 11), `SessionApi.send` / `SessionApi.onAudio` (Task 12), `voiceSlot` (Task 14).
- Produces:
  - `createRecorder(): { start(): Promise<void>; stop(): Promise<Blob> }` — MediaRecorder, `audio/webm`, one mic stream per recording, tracks stopped on stop.
  - `playBase64Mp3(b64: string): void`
  - `<PushToTalkButton session />` — hold (pointerdown/up + pointercancel) to record; on release: transcribe → `session.send(text)`; empty/failed transcription shows a "Didn't catch that" hint with the text field as fallback (switch hint: "try Choices/Free text from ⚙︎").

- [ ] **Step 1: Write the failing tests**

`apps/web/test/audio.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { createRecorder } from '../src/audio'

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(public stream: { getTracks(): { stop(): void }[] }) {
    FakeMediaRecorder.instances.push(this)
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

describe('createRecorder', () => {
  it('records a webm blob and releases the mic', async () => {
    const stop = vi.fn()
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) },
    })
    const rec = createRecorder()
    await rec.start()
    const blob = await rec.stop()
    expect(blob.type).toBe('audio/webm')
    expect(stop).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @story/web test`
Expected: FAIL — `src/audio` missing.

- [ ] **Step 3: Implement**

`apps/web/src/audio.ts`:
```ts
export function createRecorder(): { start(): Promise<void>; stop(): Promise<Blob> } {
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  const chunks: Blob[] = []
  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recorder = new MediaRecorder(stream as MediaStream)
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.start()
    },
    stop() {
      return new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error('not recording'))
        recorder.onstop = () => {
          stream?.getTracks().forEach((t) => t.stop())
          resolve(new Blob(chunks, { type: 'audio/webm' }))
        }
        recorder.stop()
      })
    },
  }
}

export function playBase64Mp3(b64: string): void {
  void new Audio(`data:audio/mpeg;base64,${b64}`).play().catch(() => {})
}
```

`apps/web/src/components/PushToTalkButton.tsx`:
```tsx
import { useRef, useState } from 'react'
import { stt } from '../api'
import { createRecorder } from '../audio'
import type { SessionApi } from '../useSession'

type Phase = 'idle' | 'recording' | 'transcribing' | 'error'

export function PushToTalkButton({ session }: { session: SessionApi }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const rec = useRef<ReturnType<typeof createRecorder> | null>(null)
  const disabled = session.busy || !session.state.activeCharacterId

  const begin = async () => {
    if (disabled || phase !== 'idle') return
    try {
      rec.current = createRecorder()
      await rec.current.start()
      setPhase('recording')
    } catch {
      setPhase('error')
    }
  }

  const finish = async () => {
    if (phase !== 'recording' || !rec.current) return
    setPhase('transcribing')
    try {
      const blob = await rec.current.stop()
      const { text } = await stt(blob)
      if (!text.trim()) throw new Error('empty')
      session.send(text)
      setPhase('idle')
    } catch {
      setPhase('error')
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onPointerDown={begin}
        onPointerUp={finish}
        onPointerCancel={finish}
        disabled={disabled}
        aria-label="Hold to talk"
        className={`h-16 w-16 touch-none rounded-full text-2xl transition ${
          phase === 'recording' ? 'scale-110 bg-red-500 ring-8 ring-red-500/25' : 'bg-red-600'
        } disabled:opacity-40`}
      >
        🎙
      </button>
      <p className="text-[11px] text-slate-400">
        {disabled
          ? 'pick someone to talk to'
          : phase === 'recording'
            ? 'release to send'
            : phase === 'transcribing'
              ? 'listening…'
              : phase === 'error'
                ? "Didn't catch that — try again, or switch mode from ⚙︎"
                : 'hold to talk'}
      </p>
    </div>
  )
}
```

In `apps/web/src/screens/Stage.tsx`: wire reply audio and the voice slot.

```tsx
import { useEffect, useState } from 'react'
import { playBase64Mp3 } from '../audio'
import { PushToTalkButton } from '../components/PushToTalkButton'
// inside the component, after useSession:
  useEffect(() => {
    session.onAudio.current = playBase64Mp3
  }, [session.onAudio])
// and pass the slot:
  <InputDock bundle={bundle} session={session} voiceSlot={<PushToTalkButton session={session} />} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/web test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: push-to-talk voice input and character reply audio"
```

---

### Task 16: Ending screen, past-session review, offline handling

**Files:**
- Create: `apps/web/src/screens/Ending.tsx`, `apps/web/src/components/PastSessions.tsx`, `apps/web/src/components/TranscriptViewer.tsx`
- Modify: `apps/web/src/App.tsx` (ending route + past sessions on Library), `apps/web/src/screens/Library.tsx` (Past plays section), `apps/web/src/components/InputDock.tsx` (offline disable)
- Test: `apps/web/test/ending.test.tsx`

**Interfaces:**
- Consumes: route state (Task 11), `api.listSessions`/`api.getSession` (Task 10 contract), transcripts in `SessionState`.
- Produces:
  - `<Ending bundle endingId onReplay onLibrary />` — shows the matched ending's title/text, "Play again" (clears `sf-session-<storyId>` then routes to intro), "Back to stories", and a `TranscriptViewer` of the final local session state.
  - `<TranscriptViewer bundle state />` — per-character collapsible transcript list (the "past convos" view).
  - `<PastSessions onOpen(state, bundleId) />` on Library — lists server sessions for this device; opening one fetches its state and shows `TranscriptViewer` in an overlay.
  - Offline: `InputDock` renders an "You're offline — the story is paused" bar and disables inputs when `navigator.onLine` is false (listen to `online`/`offline` events); the session also gets `pause('request')`… **no** — offline pause uses `pause('hidden')`? Neither: add nothing to the engine; the dock disables and the clock keeps its existing pause rules. Timed challenges failing while offline is accepted v1 behavior (documented in README).

- [ ] **Step 1: Write the failing test**

`apps/web/test/ending.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { Ending } from '../src/screens/Ending'

vi.mock('../src/api', () => ({ assetUrl: () => 'x', listSessions: vi.fn(), getSession: vi.fn() }))

const bundle = StoryBundleSchema.parse({
  meta: { id: 'ex', title: 'Ex', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [{ id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
    voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } }],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'] }],
  challenges: [], clues: [],
  endings: [{ id: 'good', when: { flags: ['x'] }, title: 'You made it', text: 'Sunlight.' }],
})

describe('Ending', () => {
  it('shows the ending and the conversation review', () => {
    localStorage.setItem(
      'sf-session-ex',
      JSON.stringify({
        sessionId: 's1',
        state: {
          storyId: 'ex', mode: 'text', beatId: 'b1', flags: ['x'], cluesFound: [],
          resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
          activeCharacterId: 'ann', suggestedReplies: [], endingId: 'good',
          transcripts: { ann: [{ role: 'character', text: 'g', atMs: 0 }] },
        },
      }),
    )
    render(<Ending bundle={bundle} endingId="good" onReplay={() => {}} onLibrary={() => {}} />)
    expect(screen.getByText('You made it')).toBeInTheDocument()
    expect(screen.getByText('Sunlight.')).toBeInTheDocument()
    expect(screen.getByText(/Ann/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @story/web test`
Expected: FAIL — `Ending` missing.

- [ ] **Step 3: Implement**

`apps/web/src/components/TranscriptViewer.tsx`:
```tsx
import type { SessionState, StoryBundle } from '@story/schema'
import { useState } from 'react'

export function TranscriptViewer({ bundle, state }: { bundle: StoryBundle; state: SessionState }) {
  const [open, setOpen] = useState<string | null>(null)
  const talked = bundle.characters.filter((c) => (state.transcripts[c.id] ?? []).length > 0)
  if (talked.length === 0) return <p className="text-sm text-slate-500">No conversations.</p>
  return (
    <div className="flex flex-col gap-2">
      {talked.map((c) => (
        <div key={c.id} className="rounded-xl border border-slate-800">
          <button
            onClick={() => setOpen(open === c.id ? null : c.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm"
          >
            <span>{c.name}</span>
            <span className="text-xs text-slate-500">{state.transcripts[c.id]!.length} lines</span>
          </button>
          {open === c.id && (
            <div className="border-t border-slate-800 p-3">
              {state.transcripts[c.id]!.map((e, i) => (
                <p key={i} className={`my-1 text-sm ${e.role === 'player' ? 'text-indigo-300' : 'text-slate-300'}`}>
                  <span className="text-xs text-slate-500">{e.role === 'player' ? 'You' : c.name}: </span>
                  {e.text}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

`apps/web/src/screens/Ending.tsx`:
```tsx
import type { SessionState, StoryBundle } from '@story/schema'
import { TranscriptViewer } from '../components/TranscriptViewer'

export function Ending({
  bundle,
  endingId,
  onReplay,
  onLibrary,
}: {
  bundle: StoryBundle
  endingId: string
  onReplay: () => void
  onLibrary: () => void
}) {
  const ending = bundle.endings.find((e) => e.id === endingId)
  const raw = localStorage.getItem(`sf-session-${bundle.meta.id}`)
  const state = raw ? (JSON.parse(raw).state as SessionState) : null

  return (
    <div className="mx-auto max-w-md p-6 pb-12">
      <p className="pt-8 text-xs uppercase tracking-widest text-slate-500">{bundle.meta.title}</p>
      <h1 className="mt-2 text-3xl font-bold">{ending?.title ?? 'The End'}</h1>
      <p className="mt-3 leading-relaxed text-slate-300">{ending?.text}</p>

      <div className="mt-8 flex gap-2">
        <button
          onClick={() => {
            localStorage.removeItem(`sf-session-${bundle.meta.id}`)
            onReplay()
          }}
          className="flex-1 rounded-xl bg-indigo-600 py-3 font-semibold"
        >
          Play again
        </button>
        <button onClick={onLibrary} className="flex-1 rounded-xl bg-slate-800 py-3 font-semibold">
          All stories
        </button>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-slate-400">Your conversations</h2>
      <div className="mt-3">{state ? <TranscriptViewer bundle={bundle} state={state} /> : null}</div>
    </div>
  )
}
```

`apps/web/src/components/PastSessions.tsx`:
```tsx
import type { SessionState } from '@story/schema'
import { useEffect, useState } from 'react'
import { getSession, listSessions } from '../api'

export function PastSessions({ onOpen }: { onOpen: (state: SessionState, storyId: string) => void }) {
  const [sessions, setSessions] = useState<{ sessionId: string; storyId: string; endingId: string | null; updatedAt: number }[]>([])
  useEffect(() => {
    listSessions().then(setSessions).catch(() => {})
  }, [])
  if (sessions.length === 0) return null
  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold text-slate-400">Past plays</h2>
      <div className="mt-2 flex flex-col gap-2">
        {sessions.map((s) => (
          <button
            key={s.sessionId}
            onClick={() => getSession(s.sessionId).then((st) => onOpen(st, s.storyId)).catch(() => {})}
            className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3 text-left text-sm"
          >
            <span>{s.storyId}</span>
            <span className="text-xs text-slate-500">{s.endingId ?? 'unfinished'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

In `apps/web/src/screens/Library.tsx`: render `<PastSessions onOpen={...} />` under the story list; on open, show a full-screen overlay with `TranscriptViewer` (fetch the bundle via `getStory(storyId)` first; local `useState` for the overlay). In `apps/web/src/App.tsx`: fill the `ending` case with `<Ending bundle={route.bundle} endingId={route.endingId} onReplay={() => setRoute({ name: 'intro', storyId: route.bundle.meta.id })} onLibrary={() => setRoute({ name: 'library' })} />`.

In `apps/web/src/components/InputDock.tsx`: add at the top of the component
```tsx
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
```
and render before the mode blocks: `{!online && <p className="mb-2 rounded-xl bg-amber-950/70 px-3 py-2 text-center text-xs text-amber-200">You're offline — hang tight.</p>}`; add `|| !online` to every `disabled` condition.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @story/web test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ending screen, transcript review, past sessions, offline handling"
```

---

### Task 17: Playwright MCQ end-to-end + dev ergonomics + README

**Files:**
- Create: `e2e/mcq-flow.spec.ts`, `playwright.config.ts`, `README.md`
- Modify: root `package.json` (dev/e2e scripts, playwright dep)

**Interfaces:**
- Consumes: everything. The e2e mocks the gateway with `page.route` — CI needs no OpenAI key and no server process.
- Produces: `pnpm e2e` green; `pnpm dev` runs server+web together; README quickstart.

- [ ] **Step 1: Add Playwright**

Root `package.json` — add to scripts and devDependencies:
```json
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "dev": "pnpm --parallel --filter @story/server --filter @story/web dev",
    "e2e": "playwright test"
  },
  "devDependencies": { "@playwright/test": "^1.47.0", "typescript": "^5.5.4" }
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173', ...devices['iPhone 13'] },
  webServer: {
    command: 'pnpm --filter @story/web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
```

Run: `pnpm install && pnpm exec playwright install chromium`

- [ ] **Step 2: Write the e2e test (fails: it plays the real story via a mocked gateway)**

`e2e/mcq-flow.spec.ts`:
```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const story = JSON.parse(
  readFileSync(join(__dirname, '../stories/kidnapping-escape/story.json'), 'utf8'),
)
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'

test('plays kidnapping-escape start to finish in MCQ mode', async ({ page }) => {
  let dialogueCount = 0
  await page.route('**/api/stories', (r) => r.fulfill({ json: { stories: [story.meta] } }))
  await page.route('**/api/stories/kidnapping-escape', (r) => r.fulfill({ json: story }))
  await page.route('**/stories/**/assets/**', (r) =>
    r.fulfill({ body: SVG, contentType: 'image/svg+xml' }),
  )
  await page.route('**/api/sessions/snapshot', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/api/dialogue', (r) => {
    dialogueCount++
    r.fulfill({
      json: {
        text: dialogueCount === 1 ? 'You have a gift. Your hands.' : 'We are done talking.',
        suggestedReplies: ['Why my hands?', 'Let me go'],
      },
    })
  })
  await page.route('**/api/judge', (r) => r.fulfill({ json: { success: true, feedback: 'done' } }))

  await page.goto('/')
  await page.getByText('The Cellar').click()
  await page.getByRole('button', { name: 'Choices' }).click()
  await page.getByRole('button', { name: 'Begin' }).click()

  // beat 1: dismiss narration, talk to Viktor, use a suggested reply; judge passes c1
  await page.getByText('tap to continue').click()
  await page.getByRole('button', { name: 'Viktor' }).click()
  await expect(page.getByText("Ah. You're awake. Good — we have work to do.")).toBeVisible()
  await page.getByRole('button', { name: 'Why my hands?' }).click()

  // judge success -> beat 2 -> mcq challenge c2 options appear
  await page.getByText('tap to continue').click()
  await page.getByRole('button', { name: 'A bird' }).click()

  // beat 3 -> task c3: talk again, judge passes -> escaped ending
  await page.getByText('tap to continue').click()
  await page.getByRole('button', { name: 'Viktor' }).click()
  await page.getByRole('button', { name: 'Why my hands?' }).click()

  await expect(page.getByText('Out, together')).toBeVisible({ timeout: 15_000 })
})
```

Note for the implementer: beat 2's mcq (`c2`) is Mira's challenge but its options render regardless of selected character — the dock shows the **active challenge's** options in MCQ mode. Viktor stays available across beats (day phases); the story clock starts at dawn so Viktor is… **check**: kidnapping availability for viktor is `dawn, day, dusk` — at t=0 phase is `dawn`, available. Mira (night/dawn) is available at dawn in b2/b3 — fine, but this test never needs her.

- [ ] **Step 3: Run it**

Run: `pnpm e2e`
Expected: PASS (1 test). Debug with `pnpm e2e --ui` if selectors drift — fix the app or the story, never by weakening assertions to less than the ending text.

- [ ] **Step 4: README**

`README.md` (root) — quickstart, structure, how to add a story:
```markdown
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
```

- [ ] **Step 5: Full suite + commit**

Run: `pnpm test && pnpm typecheck && pnpm e2e`
Expected: everything green.

```bash
git add -A
git commit -m "feat: playwright mcq end-to-end flow, dev scripts, readme"
```

Optional manual smoke (needs a real `OPENAI_API_KEY` in `.env`): `pnpm dev`, play one beat of each story in text mode and one voice exchange on a real phone browser — this is the only step that exercises `providers/openai.ts` for real.

---

## Plan self-review (already applied)

1. **Spec coverage:** format §4 → Task 2/6; engine §5 → Tasks 3–5; shell §6 → Tasks 11–16; gateway §7 → Tasks 7–10; errors §8 → Tasks 9 (TTS skip, fail-closed judge), 12 (retry/stall), 15 (STT fallback), 16 (offline); testing §9 → every task + Task 17; success criteria §11 → Tasks 6 (bundle-only stories), 7 (no-secret-leak test), 17 (e2e). Deviations from spec are declared up top (PLAY_AUDIO, mcq onTimeout).
2. **Placeholders:** none — every step carries runnable code or exact file content.
3. **Type consistency:** `SessionApi`, `AppDeps`, route bodies, and engine `Action`/`Effect` shapes are defined once (Tasks 4, 8, 9, 12) and consumed by name in later tasks.






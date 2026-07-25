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
      if (e.goto && !beatIds.has(e.goto)) fail(`${where}: goto '${e.goto}' is not a beat`)
      for (const c of e.unlockClues)
        if (!clueIds.has(c)) fail(`${where}: clue '${c}' not defined`)
    }

    const checkWhen = (w: When, where: string) => {
      if (w.clockAtLeast && !b.clock.phases.includes(w.clockAtLeast.phase))
        fail(`${where}: clockAtLeast phase '${w.clockAtLeast.phase}' not defined`)
    }

    for (const p of b.clock.phases)
      if (!b.scene.backgrounds[p]) fail(`scene.backgrounds missing phase '${p}'`)

    for (const beat of b.beats) {
      for (const c of beat.characters)
        if (!charIds.has(c)) fail(`beat '${beat.id}': character '${c}' not defined`)
      for (const c of beat.challenges)
        if (!chalIds.has(c)) fail(`beat '${beat.id}': challenge '${c}' not defined`)
      for (const t of beat.transitions) {
        if (!beatIds.has(t.goto)) fail(`beat '${beat.id}': goto '${t.goto}' is not a beat`)
        checkWhen(t.when, `beat '${beat.id}'`)
      }
    }

    for (const e of b.endings) checkWhen(e.when, `ending '${e.id}'`)

    for (const ch of b.challenges) {
      if (ch.type === 'mcq') {
        for (const o of ch.options) checkEffects(o.onPick, `challenge '${ch.id}' option '${o.id}'`)
        checkEffects(ch.onTimeout, `challenge '${ch.id}' onTimeout`)
      } else {
        checkEffects(ch.onSuccess, `challenge '${ch.id}' onSuccess`)
        checkEffects(ch.onFailure, `challenge '${ch.id}' onFailure`)
      }
    }

    for (const c of b.characters) {
      if (c.availability.beats[0] !== '*')
        for (const bid of c.availability.beats)
          if (!beatIds.has(bid)) fail(`character '${c.id}': availability beat '${bid}' not defined`)
      if (c.availability.phases[0] !== '*')
        for (const p of c.availability.phases)
          if (!b.clock.phases.includes(p)) fail(`character '${c.id}': availability phase '${p}' not defined`)
    }
  })
export type StoryBundle = z.infer<typeof StoryBundleSchema>

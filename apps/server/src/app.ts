import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { buildCharacterSystemPrompt, buildJudgeSystemPrompt } from './prompt'
import type { Providers } from './providers/types'
import type { RateLimiter } from './ratelimit'
import type { StoryRegistry } from './stories'
import type { SessionsDb } from './db'

export interface AppDeps {
  stories: StoryRegistry
  providers?: Providers
  rateLimiter?: RateLimiter
  db?: SessionsDb
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

const SnapshotBodySchema = z.object({
  sessionId: z.string().min(1),
  storyId: z.string().min(1),
  state: z.record(z.unknown()),
})

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.use('*', cors())

  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'POST') return next()
    const deviceId = c.req.header('x-device-id')
    if (!deviceId) return c.json({ error: 'x-device-id header required' }, 400)
    if (deps.rateLimiter && !deps.rateLimiter.allow(deviceId, Date.now()))
      return c.json({ error: 'rate limited' }, 429)
    return next()
  })

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

  return app
}

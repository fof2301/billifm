import { join } from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createSessionsDb } from './db'
import { createOpenAiProviders } from './providers/openai'
import { createRateLimiter } from './ratelimit'
import { loadStories } from './stories'

// apps/server/src -> apps/server -> apps -> repo root. Defaults must resolve from here,
// not from process.cwd(), since `pnpm --filter @story/server dev` runs with cwd = apps/server.
const ROOT = join(import.meta.dirname, '../../..')

const port = Number(process.env.PORT ?? 8787)
const stories = loadStories(process.env.STORIES_DIR ?? join(ROOT, 'stories'))
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
  db: createSessionsDb(process.env.DB_PATH ?? join(ROOT, 'data/sessions.db')),
})

console.log(`gateway listening on :${port} with ${stories.size} stories`)
serve({ fetch: app.fetch, port })

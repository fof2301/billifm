import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadStories } from './stories'

const port = Number(process.env.PORT ?? 8787)
const stories = loadStories(process.env.STORIES_DIR ?? './stories')
const app = createApp({ stories })

console.log(`gateway listening on :${port} with ${stories.size} stories`)
serve({ fetch: app.fetch, port })

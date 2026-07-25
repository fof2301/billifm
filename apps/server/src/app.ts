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

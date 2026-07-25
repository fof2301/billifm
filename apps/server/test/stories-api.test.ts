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
  it('serves an image asset', async () => {
    const res = await app.request('/stories/kidnapping-escape/assets/night.jpg')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/jpeg')
  })

  it('blocks path traversal', async () => {
    const res = await app.request('/stories/kidnapping-escape/assets/..%2Fsecrets.json')
    expect(res.status).toBe(404)
  })
})

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

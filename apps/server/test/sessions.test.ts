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

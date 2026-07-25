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

describe('ancestor-tree plays headlessly to the keeper ending', () => {
  it('h1 success -> a2, h2 success -> keeper', () => {
    const bundle = StoryBundleSchema.parse(load('ancestor-tree', 'story.json'))
    const { state } = createSession(bundle, 'text')
    expect(state.activeChallenge?.id).toBe('h1')

    let r = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'h1', success: true })
    expect(r.state.beatId).toBe('a2')
    expect(r.state.activeChallenge?.id).toBe('h2')

    r = reduce(bundle, r.state, { type: 'CHALLENGE_RESOLVED', challengeId: 'h2', success: true })
    expect(r.state.endingId).toBe('keeper')
  })
})

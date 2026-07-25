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

  it('reply keeps the clock paused for judging, stores suggestions, and requests judging for task challenges', () => {
    // Spec: the clock stays paused across the judge call too, since it's another AI
    // request in flight during an active challenge. Only CHALLENGE_RESOLVED releases it.
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    state = reduce(bundle, state, { type: 'PLAYER_MESSAGE', text: 'hi', source: 'text' }).state
    expect(state.pauseReasons).toContain('request')
    const r = reduce(bundle, state, {
      type: 'CHARACTER_REPLY', characterId: 'ann', text: 'well…', suggestedReplies: ['Ask why', 'Stay quiet'],
    })
    expect(r.state.transcripts['ann']!.at(-1)).toMatchObject({ role: 'character', text: 'well…' })
    expect(r.state.suggestedReplies).toEqual(['Ask why', 'Stay quiet'])
    expect(r.state.pauseReasons).toContain('request')
    expect(r.effects).toContainEqual({ type: 'REQUEST_JUDGE', challengeId: 'task1' })
  })

  it('reply releases the pause when no judge will follow (mcq challenge active)', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'task1', success: true }).state
    expect(state.activeChallenge?.id).toBe('quiz1')
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    state = reduce(bundle, state, { type: 'PLAYER_MESSAGE', text: 'pick?', source: 'text' }).state
    expect(state.pauseReasons).toContain('request')
    const r = reduce(bundle, state, { type: 'CHARACTER_REPLY', characterId: 'ann', text: 'hmm' })
    expect(r.state.pauseReasons).not.toContain('request')
    expect(r.effects.some((e) => e.type === 'REQUEST_JUDGE')).toBe(false)
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

  it('failure verdicts leave the challenge running and release the request pause', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    state = reduce(bundle, state, { type: 'PLAYER_MESSAGE', text: 'hi', source: 'text' }).state
    expect(state.pauseReasons).toContain('request')
    const r = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'task1', success: false })
    expect(r.state.activeChallenge?.id).toBe('task1')
    expect(r.state.pauseReasons).not.toContain('request')
  })

  it('releases the request pause even when the resolved challenge id does not match the active one', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'SELECT_CHARACTER', characterId: 'ann' }).state
    state = reduce(bundle, state, { type: 'PLAYER_MESSAGE', text: 'hi', source: 'text' }).state
    expect(state.pauseReasons).toContain('request')
    const r = reduce(bundle, state, { type: 'CHALLENGE_RESOLVED', challengeId: 'not-real', success: true })
    expect(r.state.activeChallenge?.id).toBe('task1')
    expect(r.state.pauseReasons).not.toContain('request')
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

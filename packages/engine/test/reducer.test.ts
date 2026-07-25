import { describe, expect, it } from 'vitest'
import type { StoryBundle } from '@story/schema'
import { StoryBundleSchema } from '@story/schema'
import { createSession, reduce } from '../src/reducer'

// Two beats; b1 has a 60s task challenge; flag "done" moves to b2; ending on "won".
function fixture(): StoryBundle {
  return StoryBundleSchema.parse({
    meta: {
      id: 'fx', title: 'Fx', tagline: '', genre: 'test', estimatedMinutes: 5,
      cover: 'c.svg', modes: ['mcq', 'text'],
    },
    clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
    scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
    characters: [{
      id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'kind',
      greeting: 'hi', voice: { voiceId: 'alloy' },
      availability: { beats: ['*'], phases: ['day'] },
    }],
    beats: [
      {
        id: 'b1', narration: 'n1', objective: 'o1', characters: ['ann'],
        challenges: ['c1'],
        transitions: [{ when: { flags: ['done'] }, goto: 'b2' }],
      },
      { id: 'b2', narration: 'n2', objective: 'o2', characters: ['ann'] },
    ],
    challenges: [{
      id: 'c1', type: 'task', prompt: 'do it', timeLimitSeconds: 60,
      onSuccess: { setFlags: ['done', 'won'] }, onFailure: { setFlags: ['done'] },
    }],
    clues: [],
    endings: [
      { id: 'good', when: { flags: ['won'] }, title: 'W', text: 'w' },
      { id: 'timeout', when: { clockExpired: true }, title: 'T', text: 't' },
    ],
  })
}

describe('createSession', () => {
  it('enters the first beat and activates its challenge', () => {
    const { state, effects } = createSession(fixture(), 'text')
    expect(state.beatId).toBe('b1')
    expect(state.activeChallenge).toEqual({ id: 'c1', deadlineMs: 60_000 })
    expect(effects).toContainEqual({ type: 'BEAT_CHANGED', beatId: 'b1' })
    expect(effects).toContainEqual({ type: 'CHALLENGE_STARTED', challengeId: 'c1' })
  })
})

describe('TICK', () => {
  it('advances time and emits PHASE_CHANGED on phase boundaries', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    // day phase lasts 150s (5min/2 phases). Cross it.
    const r = reduce(bundle, { ...state, elapsedRealMs: 149_000, activeChallenge: null }, { type: 'TICK', deltaMs: 2_000 })
    expect(r.effects).toContainEqual({ type: 'PHASE_CHANGED', day: 1, phase: 'night' })
  })

  it('does not advance time while paused', () => {
    const bundle = fixture()
    let { state } = createSession(bundle, 'text')
    state = reduce(bundle, state, { type: 'PAUSE', reason: 'hidden' }).state
    const r = reduce(bundle, state, { type: 'TICK', deltaMs: 5_000 })
    expect(r.state.elapsedRealMs).toBe(0)
    state = reduce(bundle, r.state, { type: 'RESUME', reason: 'hidden' }).state
    expect(reduce(bundle, state, { type: 'TICK', deltaMs: 5_000 }).state.elapsedRealMs).toBe(5_000)
  })

  it('times out a task challenge, applies onFailure, and follows the transition', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    const r = reduce(bundle, state, { type: 'TICK', deltaMs: 61_000 })
    expect(r.effects).toContainEqual({ type: 'CHALLENGE_TIMED_OUT', challengeId: 'c1' })
    expect(r.state.flags).toContain('done')
    expect(r.state.beatId).toBe('b2')
    expect(r.state.activeChallenge).toBeNull()
    expect(r.effects).toContainEqual({ type: 'SNAPSHOT' })
  })

  it('ends the story when the clock expires', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    const r = reduce(bundle, { ...state, activeChallenge: null }, { type: 'TICK', deltaMs: 10 * 60_000 + 1_000 })
    expect(r.state.endingId).toBe('timeout')
    expect(r.effects).toContainEqual({ type: 'STORY_ENDED', endingId: 'timeout' })
  })

  it('ignores all actions after an ending', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    const ended = reduce(bundle, { ...state, activeChallenge: null }, { type: 'TICK', deltaMs: 10 * 60_000 + 1_000 }).state
    const r = reduce(bundle, ended, { type: 'TICK', deltaMs: 5_000 })
    expect(r.state).toBe(ended)
    expect(r.effects).toEqual([])
  })
})

describe('SET_MODE', () => {
  it('switches only to modes the story allows', () => {
    const bundle = fixture()
    const { state } = createSession(bundle, 'text')
    expect(reduce(bundle, state, { type: 'SET_MODE', mode: 'mcq' }).state.mode).toBe('mcq')
    expect(reduce(bundle, state, { type: 'SET_MODE', mode: 'voice' }).state.mode).toBe('text')
  })
})

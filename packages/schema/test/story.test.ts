import { describe, expect, it } from 'vitest'
import { SecretsSchema, StoryBundleSchema, Effects, When } from '../src/index'

export function makeMinimalBundle() {
  return {
    meta: {
      id: 'test-story', title: 'Test', tagline: 't', genre: 'test',
      estimatedMinutes: 5, cover: 'assets/cover.svg', modes: ['mcq', 'text'],
    },
    clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
    scene: {
      id: 'room',
      backgrounds: { day: 'assets/day.svg', night: 'assets/night.svg' },
    },
    characters: [{
      id: 'ann', name: 'Ann', role: 'friend', portrait: 'assets/ann.svg',
      personality: 'kind', greeting: 'hello',
      voice: { voiceId: 'alloy' },
      availability: { beats: ['*'], phases: ['*'] },
    }],
    beats: [
      {
        id: 'b1', narration: 'start', objective: 'talk', characters: ['ann'],
        challenges: ['c1'],
        transitions: [{ when: { flags: ['done'] }, goto: 'b2' }],
      },
      { id: 'b2', narration: 'end', objective: 'finish', characters: ['ann'] },
    ],
    challenges: [{
      id: 'c1', type: 'mcq', prompt: 'pick', timeLimitSeconds: 60,
      options: [
        { id: 'a', text: 'A', onPick: { setFlags: ['done'] } },
        { id: 'b', text: 'B', onPick: {} },
      ],
    }],
    clues: [{ id: 'k1', title: 'K', text: 'a clue' }],
    endings: [{ id: 'fin', when: { flags: ['done'] }, title: 'Done', text: 'over' }],
  }
}

describe('StoryBundleSchema', () => {
  it('accepts a minimal valid bundle and applies defaults', () => {
    const parsed = StoryBundleSchema.parse(makeMinimalBundle())
    expect(parsed.meta.stallLines).toEqual([])
    expect(parsed.beats[1]!.challenges).toEqual([])
  })

  it('rejects a transition goto pointing at a missing beat', () => {
    const bad = makeMinimalBundle()
    const beat = bad.beats[0]
    if (beat && beat.transitions && beat.transitions[0]) {
      beat.transitions[0].goto = 'nope'
    }
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/goto 'nope'/)
  })

  it('rejects backgrounds that do not cover every clock phase', () => {
    const bad = makeMinimalBundle()
    delete (bad.scene.backgrounds as Record<string, string>).night
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/missing phase 'night'/)
  })

  it('rejects a beat referencing an unknown character or challenge', () => {
    const bad = makeMinimalBundle()
    bad.beats[0]!.characters = ['ghost']
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/character 'ghost'/)
  })

  it('rejects effects unlocking an undefined clue', () => {
    const bad = makeMinimalBundle()
    const challenge = bad.challenges[0]
    if (challenge && challenge.options && challenge.options[0]) {
      const effect: Effects = { setFlags: [], unlockClues: ['missing'] }
      challenge.options[0].onPick = effect
    }
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/clue 'missing'/)
  })

  it('rejects a beat transition clockAtLeast phase that is not in clock.phases', () => {
    const bad = makeMinimalBundle()
    const beat = bad.beats[0]
    if (beat && beat.transitions && beat.transitions[0]) {
      const when: When = { flags: [], clockAtLeast: { day: 1, phase: 'nope' } }
      beat.transitions[0].when = when
    }
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/phase 'nope'/)
  })

  it('rejects an ending clockAtLeast phase that is not in clock.phases', () => {
    const bad = makeMinimalBundle()
    const when: When = { flags: [], clockAtLeast: { day: 1, phase: 'nope' } }
    bad.endings[0]!.when = when
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/phase 'nope'/)
  })

  it('rejects a character availability phase that is not in clock.phases', () => {
    const bad = makeMinimalBundle()
    bad.characters[0]!.availability = { beats: ['*'], phases: ['nope'] }
    expect(() => StoryBundleSchema.parse(bad)).toThrow(/phase 'nope'/)
  })
})

describe('SecretsSchema', () => {
  it('accepts character secrets and judging rubrics', () => {
    const parsed = SecretsSchema.parse({
      characters: { ann: { secrets: 'knows the code', hardLimits: 'never sings' } },
      judging: { c1: { rubric: 'success if code revealed' } },
    })
    expect(parsed.characters['ann']!.secrets).toContain('code')
  })

  it('defaults to empty maps', () => {
    const parsed = SecretsSchema.parse({})
    expect(parsed.characters).toEqual({})
    expect(parsed.judging).toEqual({})
  })
})

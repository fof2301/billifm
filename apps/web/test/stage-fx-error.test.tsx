import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { Stage } from '../src/screens/Stage'
import { useSession } from '../src/useSession'
import type { SessionApi } from '../src/useSession'

vi.mock('../src/api', () => ({ assetUrl: (id: string, p: string) => `http://x/${id}/${p}` }))
// Stage renders through the real useSession hook (network calls, timers, localStorage
// saves) — none of that is relevant here, so it's swapped for a scripted fake per the
// pattern coach-marks.test.tsx already uses for the same reason.
vi.mock('../src/useSession', () => ({ useSession: vi.fn() }))
// Forces the sound decision layer — one of several fx handlers Stage's single fx
// subscription fans out to (sound/haptics/toast/banner) — to throw on the
// 'challenge-started' event only. This stands in for a bug in ANY of those handlers:
// Stage's fx callback runs synchronously inside useSession's runEffects loop, ahead of
// REQUEST_DIALOGUE handling, so an uncaught throw here would abort that loop and strand
// later effects in the same dispatch (message delivery, the clock's pause release, etc.).
// Scoped to one event type (rather than throwing unconditionally) so a later, unrelated
// event can demonstrate the fx *subscription* itself survives — throwing on every event
// would also swallow that later event's own handling, proving nothing beyond "this one
// call didn't crash".
vi.mock('../src/fx/sound', () => ({
  createSoundController: () => ({
    handle: (e: { type: string }) => {
      if (e.type === 'challenge-started') throw new Error('boom from sound handler')
    },
    tickCheck: vi.fn(),
    startAmbient: vi.fn(),
    stopAmbient: vi.fn(),
  }),
}))

const bundle = StoryBundleSchema.parse({
  meta: { id: 'fx', title: 'Fx', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [
    { id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } },
  ],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'] }],
  challenges: [],
  clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const baseState = {
  storyId: 'fx', mode: 'text' as const, beatId: 'b1', beatsVisited: ['b1'], flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}

function fakeSession(): SessionApi {
  return {
    state: baseState,
    time: { day: 1, phase: 'day', expired: false, hour: 0, minute: 0 },
    busy: false,
    stallLine: null,
    failedMessage: null,
    send: vi.fn(),
    retry: vi.fn(),
    pick: vi.fn(),
    selectCharacter: vi.fn(),
    setMode: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onAudio: { current: null },
    onEffect: { current: null },
    getAudio: () => undefined,
  }
}

describe('Stage — fx fan-out exception isolation', () => {
  let session: SessionApi

  beforeEach(() => {
    localStorage.setItem('sf-coached', '1') // skip the coach overlay — irrelevant here
    session = fakeSession()
    vi.mocked(useSession).mockReturnValue(session)
  })

  it('catches a throwing fx handler instead of letting it escape, and keeps processing later fx events', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Stage bundle={bundle} mode="text" resume={false} onEnded={() => {}} />)

    // Stage's own onEffect subscription (wired via useFxEvents) fans this event out to
    // sound.handle, which the mock above makes throw. Without the fix this propagates
    // straight out of the effect-stream callback.
    expect(() => {
      act(() => {
        session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'c1' })
      })
    }).not.toThrow()

    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(errSpy.mock.calls[0]?.[0]).toBeInstanceOf(Error)

    // The event stream keeps being processed afterwards — a later, unrelated fx event
    // still renders correctly, proving the throw didn't detach or corrupt the subscription.
    act(() => {
      session.onEffect.current?.({ type: 'PHASE_CHANGED', day: 2, phase: 'night' })
    })
    expect(screen.getByText(/🌙 Night · Day 2/)).toBeInTheDocument()

    errSpy.mockRestore()
  })
})

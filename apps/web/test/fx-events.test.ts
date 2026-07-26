import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Effect } from '@story/engine'
import type { SessionApi } from '../src/useSession'
import { useFxEvents } from '../src/fx/events'

// Minimal scripted stand-in for SessionApi: useFxEvents only reads `onEffect` (a ref it
// assigns into) and `state.activeChallenge?.id`. Cast at the call site so this stays a
// plain mutable object rather than a full SessionApi mock with a dozen unused vi.fn()s.
type FakeSession = {
  onEffect: { current: ((e: Effect) => void) | null }
  state: { activeChallenge: { id: string; deadlineMs: number } | null }
}

function makeSession(): FakeSession {
  return { onEffect: { current: null }, state: { activeChallenge: null } }
}

describe('useFxEvents', () => {
  it('forwards CHALLENGE_STARTED as challenge-started', () => {
    const session = makeSession()
    const onEvent = vi.fn()
    renderHook(() => useFxEvents(session as unknown as SessionApi, onEvent))

    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'c1' }))

    expect(onEvent).toHaveBeenCalledWith({ type: 'challenge-started', challengeId: 'c1' })
  })

  it('forwards CHALLENGE_TIMED_OUT and does NOT infer success when the challenge then clears', () => {
    const session = makeSession()
    const onEvent = vi.fn()
    const { rerender } = renderHook(() => useFxEvents(session as unknown as SessionApi, onEvent))

    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'c1' }))
    session.state = { activeChallenge: { id: 'c1', deadlineMs: 0 } }
    rerender()
    onEvent.mockClear()

    act(() => session.onEffect.current?.({ type: 'CHALLENGE_TIMED_OUT', challengeId: 'c1' }))
    session.state = { activeChallenge: null }
    rerender()

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({ type: 'challenge-timed-out', challengeId: 'c1' })
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'challenge-succeeded' }))
  })

  it('emits challenge-succeeded when the tracked challenge leaves activeChallenge without a timeout marker', () => {
    const session = makeSession()
    const onEvent = vi.fn()
    const { rerender } = renderHook(() => useFxEvents(session as unknown as SessionApi, onEvent))

    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'c1' }))
    session.state = { activeChallenge: { id: 'c1', deadlineMs: 0 } }
    rerender()
    onEvent.mockClear()

    // Success arrives as a CHALLENGE_RESOLVED action, not an engine effect — the reducer
    // just clears activeChallenge with no CHALLENGE_TIMED_OUT in between.
    session.state = { activeChallenge: null }
    rerender()

    expect(onEvent).toHaveBeenCalledWith({ type: 'challenge-succeeded', challengeId: 'c1' })
  })

  it('forwards PHASE_CHANGED and STORY_ENDED', () => {
    const session = makeSession()
    const onEvent = vi.fn()
    renderHook(() => useFxEvents(session as unknown as SessionApi, onEvent))

    act(() => session.onEffect.current?.({ type: 'PHASE_CHANGED', day: 2, phase: 'night' }))
    expect(onEvent).toHaveBeenCalledWith({ type: 'phase-changed', day: 2, phase: 'night' })

    act(() => session.onEffect.current?.({ type: 'STORY_ENDED', endingId: 'fin' }))
    expect(onEvent).toHaveBeenCalledWith({ type: 'story-ended' })
  })
})

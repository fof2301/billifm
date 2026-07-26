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

  // Regression: the engine can resolve a challenge and activate its successor (or end the
  // story) in the SAME dispatch — e.g. a task success advances the beat, which immediately
  // starts that beat's next challenge. By the time the state-watching effect below would
  // have inferred success from `activeChallenge` clearing, CHALLENGE_STARTED has already
  // overwritten trackedIdRef (or STORY_ENDED has cleared it), so success must be inferred
  // synchronously, inside the effect-stream handler itself, ahead of that watcher.

  it('chained challenges: a challenge succeeding straight into the next one starting (same dispatch) still emits success for the first, before the new challenge-started', () => {
    const session = makeSession()
    const onEvent = vi.fn()
    const { rerender } = renderHook(() => useFxEvents(session as unknown as SessionApi, onEvent))

    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'a' }))
    session.state = { activeChallenge: { id: 'a', deadlineMs: 0 } }
    rerender()
    onEvent.mockClear()

    // Mirrors real dispatch order: state already reflects challenge 'b' by the time the
    // CHALLENGE_STARTED('b') effect fires.
    session.state = { activeChallenge: { id: 'b', deadlineMs: 0 } }
    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'b' }))

    expect(onEvent.mock.calls.map((c) => c[0])).toEqual([
      { type: 'challenge-succeeded', challengeId: 'a' },
      { type: 'challenge-started', challengeId: 'b' },
    ])

    // The state watcher must not double-emit once it observes the 'a' -> 'b' transition.
    rerender()
    expect(onEvent).toHaveBeenCalledTimes(2)
  })

  it('success into ending: a challenge succeeding straight into STORY_ENDED (same dispatch) still emits success before story-ended', () => {
    const session = makeSession()
    const onEvent = vi.fn()
    const { rerender } = renderHook(() => useFxEvents(session as unknown as SessionApi, onEvent))

    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'a' }))
    onEvent.mockClear()

    session.state = { activeChallenge: null }
    act(() => session.onEffect.current?.({ type: 'STORY_ENDED', endingId: 'fin' }))

    expect(onEvent.mock.calls.map((c) => c[0])).toEqual([
      { type: 'challenge-succeeded', challengeId: 'a' },
      { type: 'story-ended' },
    ])

    rerender()
    expect(onEvent).toHaveBeenCalledTimes(2)
  })

  // Regression: createSession's initial effects are discarded by useSession (only .state is
  // taken), so a challenge already active in the session's INITIAL state — the first beat
  // starting with a challenge, or a save resumed mid-challenge — never gets a CHALLENGE_STARTED
  // effect delivered through onEffect. trackedIdRef must seed itself from that live state
  // instead of starting null, or that first challenge's success cue never fires.
  it('tracks a challenge that was already active in the session\'s INITIAL state, so its success cue still fires when the next challenge starts', () => {
    const session: FakeSession = {
      onEffect: { current: null },
      state: { activeChallenge: { id: 'c1', deadlineMs: 0 } },
    }
    const onEvent = vi.fn()
    renderHook(() => useFxEvents(session as unknown as SessionApi, onEvent))

    session.state = { activeChallenge: { id: 'c2', deadlineMs: 0 } }
    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'c2' }))

    expect(onEvent.mock.calls.map((c) => c[0])).toEqual([
      { type: 'challenge-succeeded', challengeId: 'c1' },
      { type: 'challenge-started', challengeId: 'c2' },
    ])
  })

  it('timeout then chain: a challenge that timed out does not get a spurious success when the next challenge starts', () => {
    const session = makeSession()
    const onEvent = vi.fn()
    const { rerender } = renderHook(() => useFxEvents(session as unknown as SessionApi, onEvent))

    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'a' }))
    session.state = { activeChallenge: { id: 'a', deadlineMs: 0 } }
    rerender()

    act(() => session.onEffect.current?.({ type: 'CHALLENGE_TIMED_OUT', challengeId: 'a' }))
    session.state = { activeChallenge: { id: 'b', deadlineMs: 0 } }
    act(() => session.onEffect.current?.({ type: 'CHALLENGE_STARTED', challengeId: 'b' }))
    rerender()

    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'challenge-succeeded', challengeId: 'a' }),
    )
  })
})

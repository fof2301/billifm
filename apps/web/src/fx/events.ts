import { useEffect, useRef } from 'react'
import type { Effect } from '@story/engine'
import type { SessionApi } from '../useSession'

export type FxEvent =
  | { type: 'challenge-started'; challengeId: string }
  | { type: 'challenge-succeeded'; challengeId: string }
  | { type: 'challenge-timed-out'; challengeId: string }
  | { type: 'phase-changed'; day: number; phase: string }
  | { type: 'story-ended' }

/**
 * Turns the engine's raw effect stream into the higher-level fx vocabulary consumers
 * (sound/haptics/visual layers) react to. Also infers challenge success: the engine emits
 * no success effect (success arrives as a CHALLENGE_RESOLVED *action*, not an effect), so
 * this watches `activeChallenge` clearing without an intervening timeout.
 */
export function useFxEvents(session: SessionApi, onEvent: (e: FxEvent) => void): void {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  // The challenge id we're currently watching for a success/failure outcome, and the id
  // of the challenge that most recently timed out (so a subsequent activeChallenge clear
  // isn't mistaken for a success). Seeded from the LIVE state, not null: useSession's
  // createSession discards its initial effects (only .state survives), so a challenge
  // already active when this hook first mounts — the first beat starting with a challenge,
  // or a save resumed mid-challenge — never arrives as a CHALLENGE_STARTED effect. Without
  // this seed, that challenge's eventual success would be dropped: trackedIdRef would still
  // be null when its successor's CHALLENGE_STARTED fires, so nothing gets flushed for it.
  const trackedIdRef = useRef<string | null>(session.state.activeChallenge?.id ?? null)
  const timedOutIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Emits the pending success for the currently tracked challenge, if any, and clears
    // both tracking refs. The engine emits no success effect of its own (success arrives
    // as a CHALLENGE_RESOLVED *action*), so this is the only place that infers it. It has
    // to run synchronously from CHALLENGE_STARTED/STORY_ENDED (below) rather than waiting
    // on the activeChallenge-watching effect further down, because the engine can resolve
    // a challenge and activate its successor (or end the story) in the SAME dispatch —
    // by the time that effect ran, CHALLENGE_STARTED would already have overwritten
    // trackedIdRef (or STORY_ENDED would already have cleared it), silently dropping the
    // success. Clearing timedOutIdRef here too (not just trackedIdRef) is hygiene: it stops
    // a stale timeout marker from suppressing a later success for a re-tracked challenge.
    const flushPendingSuccess = () => {
      const tracked = trackedIdRef.current
      if (tracked !== null && timedOutIdRef.current !== tracked) {
        onEventRef.current({ type: 'challenge-succeeded', challengeId: tracked })
      }
      trackedIdRef.current = null
      timedOutIdRef.current = null
    }

    session.onEffect.current = (e: Effect) => {
      switch (e.type) {
        case 'CHALLENGE_STARTED':
          if (trackedIdRef.current !== null && trackedIdRef.current !== e.challengeId) {
            flushPendingSuccess()
          }
          trackedIdRef.current = e.challengeId
          onEventRef.current({ type: 'challenge-started', challengeId: e.challengeId })
          break
        case 'CHALLENGE_TIMED_OUT':
          timedOutIdRef.current = e.challengeId
          trackedIdRef.current = null
          onEventRef.current({ type: 'challenge-timed-out', challengeId: e.challengeId })
          break
        case 'PHASE_CHANGED':
          onEventRef.current({ type: 'phase-changed', day: e.day, phase: e.phase })
          break
        case 'STORY_ENDED':
          flushPendingSuccess()
          onEventRef.current({ type: 'story-ended' })
          break
        default:
          break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.onEffect])

  // Fallback for the no-successor case: the tracked challenge left `activeChallenge` with
  // no new challenge starting and no ending in the same dispatch (e.g. a beat change with
  // no immediate follow-up challenge). The effect-stream paths above already clear
  // trackedIdRef whenever they've handled the transition themselves, so this never
  // double-fires for the chained-challenge or success-into-ending cases.
  useEffect(() => {
    const activeId = session.state.activeChallenge?.id ?? null
    const tracked = trackedIdRef.current
    if (tracked !== null && activeId !== tracked) {
      if (timedOutIdRef.current !== tracked) {
        onEventRef.current({ type: 'challenge-succeeded', challengeId: tracked })
      }
      trackedIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state.activeChallenge?.id])
}

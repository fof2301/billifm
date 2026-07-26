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
  // isn't mistaken for a success).
  const trackedIdRef = useRef<string | null>(null)
  const timedOutIdRef = useRef<string | null>(null)

  useEffect(() => {
    session.onEffect.current = (e: Effect) => {
      switch (e.type) {
        case 'CHALLENGE_STARTED':
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
          onEventRef.current({ type: 'story-ended' })
          break
        default:
          break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.onEffect])

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

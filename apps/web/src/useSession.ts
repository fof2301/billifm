import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Mode, PauseReason, SessionState, StoryBundle } from '@story/schema'
import type { Action, Effect } from '@story/engine'
import { createSession, reduce, storyTime } from '@story/engine'
import * as api from './api'

const TAIL = 12
const STALL_MS = 6000

export interface SessionApi {
  state: SessionState
  time: { day: number; phase: string; expired: boolean }
  busy: boolean
  stallLine: string | null
  failedMessage: string | null
  send(text: string): void
  retry(): void
  pick(optionId: string): void
  selectCharacter(id: string): void
  setMode(m: Mode): void
  pause(r: PauseReason): void
  resume(r: PauseReason): void
  onAudio: { current: ((b64: string) => void) | null }
}

export function useSession(
  bundle: StoryBundle,
  mode: Mode,
  resumeSave: boolean,
  onEnded: (endingId: string) => void,
): SessionApi {
  const saveKey = `sf-session-${bundle.meta.id}`
  const onAudio = useRef<((b64: string) => void) | null>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const initial = useMemo(() => {
    if (resumeSave) {
      const raw = localStorage.getItem(saveKey)
      if (raw) {
        try {
          const saved = JSON.parse(raw) as { sessionId: string; state: SessionState }
          // never resume paused-by-stale-reasons
          return { sessionId: saved.sessionId, state: { ...saved.state, pauseReasons: [] as PauseReason[] } }
        } catch {
          // corrupt save — fall through to a fresh session below instead of crashing
        }
      }
    }
    return { sessionId: crypto.randomUUID(), state: createSession(bundle, mode).state }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stateRef = useRef<SessionState>(initial.state)
  const [state, setState] = useState<SessionState>(initial.state)
  const [busy, setBusy] = useState(false)
  const [stallLine, setStallLine] = useState<string | null>(null)
  const [failedMessage, setFailedMessage] = useState<string | null>(null)

  const runEffects = useCallback((effects: Effect[]) => {
    for (const e of effects) {
      if (e.type === 'SNAPSHOT' || e.type === 'STORY_ENDED') {
        api.snapshot(initial.sessionId, bundle.meta.id, stateRef.current).catch(() => {})
      }
      if (e.type === 'STORY_ENDED') onEndedRef.current(e.endingId)
      if (e.type === 'REQUEST_DIALOGUE') void requestDialogue(e.characterId, e.playerMessage)
      if (e.type === 'REQUEST_JUDGE') void requestJudge(e.challengeId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dispatch = useCallback(
    (action: Action) => {
      const r = reduce(bundle, stateRef.current, action)
      stateRef.current = r.state
      setState(r.state)
      localStorage.setItem(saveKey, JSON.stringify({ sessionId: initial.sessionId, state: r.state }))
      runEffects(r.effects)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle],
  )

  async function requestDialogue(characterId: string, playerMessage: string) {
    setBusy(true)
    setFailedMessage(null)
    const stall = setTimeout(() => {
      const lines = bundle.meta.stallLines
      setStallLine(lines.length ? lines[Math.floor(Math.random() * lines.length)]! : '…')
    }, STALL_MS)
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const s = stateRef.current
          const t = storyTime(bundle.clock, s.elapsedRealMs)
          const res = await api.dialogue({
            storyId: bundle.meta.id,
            characterId,
            session: { beatId: s.beatId, flags: s.flags, cluesFound: s.cluesFound, day: t.day, phase: t.phase },
            // Exclude the just-appended player message (the final entry) — it's already
          // sent separately as `playerMessage`; including it here would send it twice.
          transcriptTail: (s.transcripts[characterId] ?? []).slice(-TAIL - 1, -1),
            playerMessage,
            wantAudio: s.mode === 'voice',
            wantSuggestions: s.mode === 'mcq',
          })
          dispatch({ type: 'CHARACTER_REPLY', characterId, text: res.text, suggestedReplies: res.suggestedReplies })
          if (res.audioBase64) onAudio.current?.(res.audioBase64)
          return
        } catch {
          if (attempt === 1) {
            setFailedMessage(playerMessage)
            dispatch({ type: 'RESUME', reason: 'request' })
          }
        }
      }
    } finally {
      clearTimeout(stall)
      setStallLine(null)
      setBusy(false)
    }
  }

  async function requestJudge(challengeId: string) {
    try {
      const s = stateRef.current
      const charId = s.activeCharacterId
      const res = await api.judge({
        storyId: bundle.meta.id,
        challengeId,
        transcriptTail: charId ? (s.transcripts[charId] ?? []).slice(-TAIL * 2) : [],
      })
      // Dispatch on both verdicts: the reducer no-ops the resolve step on false, but the
      // clock's 'request' pause — held through this judge call — only releases here.
      dispatch({ type: 'CHALLENGE_RESOLVED', challengeId, success: res.success })
    } catch {
      // The judge request itself failed (not a verdict) — release the pause explicitly;
      // the deadline is still the backstop for the challenge itself.
      dispatch({ type: 'RESUME', reason: 'request' })
    }
  }

  useEffect(() => {
    const tick = setInterval(() => dispatch({ type: 'TICK', deltaMs: 1000 }), 1000)
    const onVis = () =>
      dispatch({ type: document.hidden ? 'PAUSE' : 'RESUME', reason: 'hidden' })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [dispatch])

  const time = storyTime(bundle.clock, state.elapsedRealMs)

  return {
    state,
    time,
    busy,
    stallLine,
    failedMessage,
    send: (text) => dispatch({ type: 'PLAYER_MESSAGE', text, source: stateRef.current.mode }),
    retry: () => {
      const msg = failedMessage
      const charId = stateRef.current.activeCharacterId
      if (msg && charId) {
        // Re-entering flight during an active challenge must re-pause the clock;
        // PAUSE is idempotent so this is safe even if it's already paused.
        if (stateRef.current.activeChallenge) dispatch({ type: 'PAUSE', reason: 'request' })
        void requestDialogue(charId, msg)
      }
    },
    pick: (optionId) => {
      const ch = stateRef.current.activeChallenge
      if (ch) dispatch({ type: 'MCQ_PICK', challengeId: ch.id, optionId })
    },
    selectCharacter: (id) => dispatch({ type: 'SELECT_CHARACTER', characterId: id }),
    setMode: (m) => dispatch({ type: 'SET_MODE', mode: m }),
    pause: (r) => dispatch({ type: 'PAUSE', reason: r }),
    resume: (r) => dispatch({ type: 'RESUME', reason: r }),
    onAudio,
  }
}

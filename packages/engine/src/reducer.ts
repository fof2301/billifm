import type { Effects, Mode, SessionState, StoryBundle } from '@story/schema'
import { storyTime } from './clock'
import { whenMatches } from './conditions'
import type { Action, Effect, ReduceResult } from './types'

export function createSession(bundle: StoryBundle, mode: Mode): ReduceResult {
  const first = bundle.beats[0]!
  let state: SessionState = {
    storyId: bundle.meta.id,
    mode,
    beatId: first.id,
    flags: [],
    cluesFound: [],
    resolvedChallenges: [],
    elapsedRealMs: 0,
    pauseReasons: [],
    activeChallenge: null,
    activeCharacterId: null,
    transcripts: {},
    suggestedReplies: [],
    endingId: null,
  }
  const effects: Effect[] = [{ type: 'BEAT_CHANGED', beatId: first.id }]
  state = activateChallenge(bundle, state, effects)
  return { state, effects }
}

export function isCharacterAvailable(
  bundle: StoryBundle,
  state: SessionState,
  characterId: string,
): boolean {
  const ch = bundle.characters.find((c) => c.id === characterId)
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  if (!ch || !beat || !beat.characters.includes(characterId)) return false
  const { beats, phases } = ch.availability
  if (beats[0] !== '*' && !beats.includes(state.beatId)) return false
  const phase = storyTime(bundle.clock, state.elapsedRealMs).phase
  if (phases[0] !== '*' && !phases.includes(phase)) return false
  return true
}

function activateChallenge(
  bundle: StoryBundle,
  state: SessionState,
  effects: Effect[],
): SessionState {
  if (state.activeChallenge || state.endingId) return state
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  if (!beat) return state
  const nextId = beat.challenges.find((id) => !state.resolvedChallenges.includes(id))
  if (!nextId) return state
  const ch = bundle.challenges.find((c) => c.id === nextId)!
  effects.push({ type: 'CHALLENGE_STARTED', challengeId: ch.id })
  return {
    ...state,
    activeChallenge: { id: ch.id, deadlineMs: state.elapsedRealMs + ch.timeLimitSeconds * 1000 },
  }
}

function applyEffects(
  bundle: StoryBundle,
  state: SessionState,
  effects: Effect[],
  e: Effects,
): SessionState {
  let next = {
    ...state,
    flags: [...new Set([...state.flags, ...e.setFlags])],
    cluesFound: [...new Set([...state.cluesFound, ...e.unlockClues])],
  }
  if (e.goto && e.goto !== next.beatId) next = changeBeat(bundle, next, effects, e.goto)
  return next
}

function changeBeat(
  bundle: StoryBundle,
  state: SessionState,
  effects: Effect[],
  beatId: string,
): SessionState {
  effects.push({ type: 'BEAT_CHANGED', beatId }, { type: 'SNAPSHOT' })
  let next: SessionState = { ...state, beatId, activeChallenge: null, suggestedReplies: [] }
  next = activateChallenge(bundle, next, effects)
  return next
}

/** Run beat transitions (repeatedly) then endings; called after every state change. */
function evaluate(bundle: StoryBundle, state: SessionState, effects: Effect[]): SessionState {
  let next = state
  for (let guard = 0; guard < bundle.beats.length; guard++) {
    const beat = bundle.beats.find((b) => b.id === next.beatId)
    const hit = beat?.transitions.find((t) => whenMatches(bundle, next, t.when))
    if (!hit || hit.goto === next.beatId) break
    next = changeBeat(bundle, next, effects, hit.goto)
  }
  if (!next.endingId) {
    const ending = bundle.endings.find((e) => whenMatches(bundle, next, e.when))
    if (ending) {
      next = { ...next, endingId: ending.id, activeChallenge: null }
      effects.push({ type: 'STORY_ENDED', endingId: ending.id }, { type: 'SNAPSHOT' })
    }
  }
  return next
}

function resolveChallenge(
  bundle: StoryBundle,
  state: SessionState,
  effects: Effect[],
  challengeId: string,
  outcome: Effects,
): SessionState {
  let next: SessionState = {
    ...state,
    activeChallenge: null,
    resolvedChallenges: [...state.resolvedChallenges, challengeId],
  }
  next = applyEffects(bundle, next, effects, outcome)
  next = activateChallenge(bundle, next, effects)
  return evaluate(bundle, next, effects)
}

export function reduce(bundle: StoryBundle, state: SessionState, action: Action): ReduceResult {
  if (state.endingId) return { state, effects: [] }
  const effects: Effect[] = []

  switch (action.type) {
    case 'PAUSE': {
      if (state.pauseReasons.includes(action.reason)) return { state, effects }
      return { state: { ...state, pauseReasons: [...state.pauseReasons, action.reason] }, effects }
    }
    case 'RESUME': {
      return {
        state: { ...state, pauseReasons: state.pauseReasons.filter((r) => r !== action.reason) },
        effects,
      }
    }
    case 'SET_MODE': {
      if (!bundle.meta.modes.includes(action.mode)) return { state, effects }
      return { state: { ...state, mode: action.mode }, effects }
    }
    case 'TICK': {
      if (state.pauseReasons.length > 0) return { state, effects }
      const before = storyTime(bundle.clock, state.elapsedRealMs)
      let next: SessionState = { ...state, elapsedRealMs: state.elapsedRealMs + action.deltaMs }
      const after = storyTime(bundle.clock, next.elapsedRealMs)
      if (after.phase !== before.phase || after.day !== before.day) {
        effects.push({ type: 'PHASE_CHANGED', day: after.day, phase: after.phase })
      }
      if (next.activeChallenge && next.elapsedRealMs >= next.activeChallenge.deadlineMs) {
        const ch = bundle.challenges.find((c) => c.id === next.activeChallenge!.id)!
        effects.push({ type: 'CHALLENGE_TIMED_OUT', challengeId: ch.id })
        const outcome = ch.type === 'task' ? ch.onFailure : (ch.onTimeout ?? { setFlags: [], unlockClues: [] })
        next = resolveChallenge(bundle, next, effects, ch.id, outcome)
      } else {
        next = evaluate(bundle, next, effects)
      }
      return { state: next, effects }
    }
    case 'SELECT_CHARACTER': {
      if (!isCharacterAvailable(bundle, state, action.characterId)) return { state, effects }
      let next: SessionState = { ...state, activeCharacterId: action.characterId, suggestedReplies: [] }
      if (!next.transcripts[action.characterId]) {
        const ch = bundle.characters.find((c) => c.id === action.characterId)!
        next = {
          ...next,
          transcripts: {
            ...next.transcripts,
            [action.characterId]: [{ role: 'character', text: ch.greeting, atMs: next.elapsedRealMs }],
          },
        }
      }
      return { state: next, effects }
    }
    case 'PLAYER_MESSAGE': {
      const charId = state.activeCharacterId
      if (!charId) return { state, effects }
      const entry = { role: 'player' as const, text: action.text, atMs: state.elapsedRealMs }
      let next: SessionState = {
        ...state,
        suggestedReplies: [],
        transcripts: { ...state.transcripts, [charId]: [...(state.transcripts[charId] ?? []), entry] },
      }
      if (next.activeChallenge && !next.pauseReasons.includes('request')) {
        next = { ...next, pauseReasons: [...next.pauseReasons, 'request'] }
      }
      effects.push({ type: 'REQUEST_DIALOGUE', characterId: charId, playerMessage: action.text })
      return { state: next, effects }
    }
    case 'CHARACTER_REPLY': {
      const entry = { role: 'character' as const, text: action.text, atMs: state.elapsedRealMs }
      let next: SessionState = {
        ...state,
        suggestedReplies: action.suggestedReplies ?? [],
        pauseReasons: state.pauseReasons.filter((r) => r !== 'request'),
        transcripts: {
          ...state.transcripts,
          [action.characterId]: [...(state.transcripts[action.characterId] ?? []), entry],
        },
      }
      if (next.activeChallenge) {
        const ch = bundle.challenges.find((c) => c.id === next.activeChallenge!.id)
        if (ch?.type === 'task') effects.push({ type: 'REQUEST_JUDGE', challengeId: ch.id })
      }
      return { state: next, effects }
    }
    case 'CHALLENGE_RESOLVED': {
      if (!action.success) return { state, effects }
      if (state.activeChallenge?.id !== action.challengeId) return { state, effects }
      const ch = bundle.challenges.find((c) => c.id === action.challengeId)
      if (!ch || ch.type !== 'task') return { state, effects }
      return { state: resolveChallenge(bundle, state, effects, ch.id, ch.onSuccess), effects }
    }
    case 'MCQ_PICK': {
      if (state.activeChallenge?.id !== action.challengeId) return { state, effects }
      const ch = bundle.challenges.find((c) => c.id === action.challengeId)
      if (!ch || ch.type !== 'mcq') return { state, effects }
      const opt = ch.options.find((o) => o.id === action.optionId)
      if (!opt) return { state, effects }
      return { state: resolveChallenge(bundle, state, effects, ch.id, opt.onPick), effects }
    }
    default:
      return { state, effects }
  }
}

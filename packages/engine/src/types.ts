import type { Mode, PauseReason, SessionState } from '@story/schema'

export type Action =
  | { type: 'TICK'; deltaMs: number }
  | { type: 'SELECT_CHARACTER'; characterId: string }
  | { type: 'PLAYER_MESSAGE'; text: string; source: Mode }
  | { type: 'CHARACTER_REPLY'; characterId: string; text: string; suggestedReplies?: string[] }
  | { type: 'MCQ_PICK'; challengeId: string; optionId: string }
  | { type: 'CHALLENGE_RESOLVED'; challengeId: string; success: boolean }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'PAUSE'; reason: PauseReason }
  | { type: 'RESUME'; reason: PauseReason }

export type Effect =
  | { type: 'BEAT_CHANGED'; beatId: string }
  | { type: 'PHASE_CHANGED'; day: number; phase: string }
  | { type: 'CHALLENGE_STARTED'; challengeId: string }
  | { type: 'CHALLENGE_TIMED_OUT'; challengeId: string }
  | { type: 'REQUEST_DIALOGUE'; characterId: string; playerMessage: string }
  | { type: 'REQUEST_JUDGE'; challengeId: string }
  | { type: 'SNAPSHOT' }
  | { type: 'STORY_ENDED'; endingId: string }

export interface ReduceResult {
  state: SessionState
  effects: Effect[]
}

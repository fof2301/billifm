import type { Mode } from './story'

export type PauseReason = 'hidden' | 'request' | 'settings'

export interface TranscriptEntry {
  role: 'player' | 'character'
  text: string
  atMs: number // elapsedRealMs when the line landed
}

export interface SessionState {
  storyId: string
  mode: Mode
  beatId: string
  flags: string[]
  cluesFound: string[]
  resolvedChallenges: string[]
  elapsedRealMs: number
  pauseReasons: PauseReason[]
  activeChallenge: { id: string; deadlineMs: number } | null
  activeCharacterId: string | null
  transcripts: Record<string, TranscriptEntry[]>
  suggestedReplies: string[]
  endingId: string | null
}

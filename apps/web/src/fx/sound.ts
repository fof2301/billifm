import type { AudioBackend } from './audio'
import type { FxEvent } from './events'

/**
 * Decision layer over the (untested) audio backend: given an FxEvent or a per-second
 * tick check, decides WHICH cue to play and whether to play it at all — the actual
 * synthesis lives in fx/audio.ts. Kept separate specifically so this part is unit
 * testable with a fake backend (jsdom has no AudioContext).
 */
export function createSoundController(
  backend: AudioBackend,
  enabled: () => boolean,
): {
  handle(e: FxEvent): void
  tickCheck(remainingMs: number | null): void
  startAmbient(sceneId: string, fileUrl?: string): void
  stopAmbient(): void
} {
  return {
    handle(e: FxEvent): void {
      switch (e.type) {
        case 'challenge-started':
          if (enabled()) backend.playSting()
          break
        case 'challenge-succeeded':
          if (enabled()) backend.playResolve()
          break
        case 'challenge-timed-out':
          if (enabled()) backend.playThud()
          break
        case 'phase-changed':
          if (enabled()) backend.duckAmbient()
          break
        case 'story-ended':
          if (enabled()) backend.playBell()
          // Ambient always stops on story end, muted or not — nothing should keep
          // droning once the story is over.
          backend.stopAmbient()
          break
      }
    },
    tickCheck(remainingMs: number | null): void {
      if (!enabled() || remainingMs === null) return
      if (remainingMs > 0 && remainingMs < 30_000) backend.playTick()
    },
    startAmbient(sceneId: string, fileUrl?: string): void {
      if (!enabled()) return
      backend.startAmbient(sceneId, fileUrl)
    },
    stopAmbient(): void {
      // Always passes through (even muted) so toggling Effects off mid-game silences
      // any ambient bed that was already playing.
      backend.stopAmbient()
    },
  }
}

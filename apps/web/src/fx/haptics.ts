import type { FxEvent } from './events'

/**
 * Haptic feedback controller: given an FxEvent or a per-second tick check,
 * decides whether to vibrate and what pattern to use. No-ops when disabled
 * or when navigator.vibrate is unavailable.
 */
export function createHapticsController(
  enabled: () => boolean,
  vibrate = (p: number | number[]) => navigator.vibrate?.(p),
): {
  handle(e: FxEvent): void
  tickCheck(remainingMs: number | null): void
} {
  return {
    handle(e: FxEvent): void {
      if (!enabled()) return
      switch (e.type) {
        case 'challenge-started':
          vibrate(40)
          break
        case 'challenge-timed-out':
          vibrate([60, 60, 60])
          break
        case 'challenge-succeeded':
        case 'phase-changed':
        case 'story-ended':
          // No haptic feedback for these events
          break
      }
    },
    tickCheck(remainingMs: number | null): void {
      if (!enabled() || remainingMs === null) return
      if (remainingMs > 0 && remainingMs < 10_000) vibrate(15)
    },
  }
}

import type { SessionState, StoryBundle } from '@story/schema'
import { storyTime } from '@story/engine'

/** In-story 24h clock face, e.g. "07:36". */
export function hhmm(t: { hour: number; minute: number }): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
}

export const PHASE_ICON: Record<string, string> = {
  dawn: '🌅', day: '☀️', dusk: '🌆', night: '🌙', morning: '🌅', evening: '🌆',
}

export function TopBar({
  bundle,
  state,
  time,
  clueCount,
  onOpenTree,
  onOpenJournal,
  onOpenSettings,
  clockRef,
  journalRef,
}: {
  bundle: StoryBundle
  state: SessionState
  time: { day: number; phase: string; hour: number; minute: number }
  clueCount: number
  onOpenTree?: () => void
  onOpenJournal: () => void
  onOpenSettings: () => void
  clockRef?: React.MutableRefObject<HTMLElement | null>
  journalRef?: React.MutableRefObject<HTMLElement | null>
}) {
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  const remaining = state.activeChallenge ? state.activeChallenge.deadlineMs - state.elapsedRealMs : null
  const deadline = state.activeChallenge ? storyTime(bundle.clock, state.activeChallenge.deadlineMs) : null
  return (
    <div className="pointer-events-none">
      <div className="flex items-center justify-between gap-2">
        <span
          ref={(el) => {
            if (clockRef) clockRef.current = el
          }}
          className="rounded-full bg-black/50 px-3 py-1 text-xs text-slate-100"
        >
          {PHASE_ICON[time.phase] ?? '🕐'} Day {time.day} · {hhmm(time)}
        </span>
        <div className="flex items-center gap-2">
          {remaining !== null && deadline !== null && (
            <span
              data-testid="deadline-chip"
              // Reads as a second clock face — "the hour this is due" — rather than a
              // countdown timer. Urgency comes from the text tint, not a red pill.
              className={`rounded-full bg-black/50 px-3 py-1 text-xs tabular-nums ${
                remaining < 30_000 ? 'animate-pulse text-rose-300' : 'text-amber-200/90'
              }`}
            >
              ⏳ by {hhmm(deadline)}
            </span>
          )}
          {onOpenTree && (
            <button
              onClick={onOpenTree}
              aria-label="Family tree"
              className="pointer-events-auto rounded-full bg-black/50 px-3 py-1 text-xs"
            >
              🌳
            </button>
          )}
          <button
            ref={(el) => {
              if (journalRef) journalRef.current = el
            }}
            onClick={onOpenJournal}
            aria-label="Journal"
            className="pointer-events-auto rounded-full bg-black/50 px-3 py-1 text-xs"
          >
            📖 {clueCount}
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="pointer-events-auto rounded-full bg-black/50 px-3 py-1 text-xs"
          >
            ⚙︎
          </button>
        </div>
      </div>
      {beat && (
        <p className="mt-2 text-center">
          <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-300">{beat.objective}</span>
        </p>
      )}
    </div>
  )
}

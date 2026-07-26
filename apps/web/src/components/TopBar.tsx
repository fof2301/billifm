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
  onOpenJournal,
  onOpenSettings,
}: {
  bundle: StoryBundle
  state: SessionState
  time: { day: number; phase: string; hour: number; minute: number }
  clueCount: number
  onOpenJournal: () => void
  onOpenSettings: () => void
}) {
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  const remaining = state.activeChallenge ? state.activeChallenge.deadlineMs - state.elapsedRealMs : null
  const deadline = state.activeChallenge ? storyTime(bundle.clock, state.activeChallenge.deadlineMs) : null
  return (
    <div className="pointer-events-none">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-slate-100">
          {PHASE_ICON[time.phase] ?? '🕐'} Day {time.day} · {hhmm(time)}
        </span>
        <div className="flex items-center gap-2">
          {remaining !== null && deadline !== null && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${remaining < 30_000 ? 'bg-red-600 animate-pulse' : 'bg-red-500/80'}`}>
              {`⏱ by ${hhmm(deadline)}`}
            </span>
          )}
          <button
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

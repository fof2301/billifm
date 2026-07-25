import type { SessionState, StoryBundle } from '@story/schema'

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const PHASE_ICON: Record<string, string> = {
  dawn: '🌅', day: '☀️', dusk: '🌆', night: '🌙', morning: '🌅', evening: '🌆',
}

export function TopBar({
  bundle,
  state,
  time,
  onOpenSettings,
}: {
  bundle: StoryBundle
  state: SessionState
  time: { day: number; phase: string }
  onOpenSettings: () => void
}) {
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  const remaining = state.activeChallenge ? state.activeChallenge.deadlineMs - state.elapsedRealMs : null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-slate-100">
          {PHASE_ICON[time.phase] ?? '🕐'} Day {time.day} · {time.phase}
        </span>
        <div className="flex items-center gap-2">
          {remaining !== null && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${remaining < 30_000 ? 'bg-red-600' : 'bg-red-500/80'}`}>
              {`⏱ ${mmss(remaining)}`}
            </span>
          )}
          <button onClick={onOpenSettings} className="pointer-events-auto rounded-full bg-black/50 px-3 py-1 text-xs">⚙︎</button>
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

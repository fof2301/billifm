import { useEffect, useState } from 'react'
import { PHASE_ICON } from '../components/TopBar'

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)
}

/**
 * Centered "phase changed" chip. Dumb by design: Stage owns the toast's whole lifecycle
 * (set on the `phase-changed` fx event, cleared via a 2.5s timeout) — this component only
 * renders what it's given, fading in on each new toast via a mount-driven opacity flip
 * (a plain CSS transition, not a keyframe, so it re-triggers every time `toast` changes
 * without needing its own timers).
 */
export function PhaseToast({ toast }: { toast: { day: number; phase: string } | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) {
      setVisible(false)
      return
    }
    setVisible(false)
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [toast])

  if (!toast) return null
  const icon = PHASE_ICON[toast.phase] ?? '🕐'

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-30 flex justify-center">
      <span
        className={`rounded-full bg-black/70 px-4 py-2 text-sm text-slate-100 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {icon} {capitalize(toast.phase)} · Day {toast.day}
      </span>
    </div>
  )
}

import { useLayoutEffect, useState } from 'react'

export const COACH_STEPS = [
  { key: 'clock', copy: 'A whole day passes every few minutes. Watch it.' },
  { key: 'rail', copy: 'Tap a face to talk. Some people only appear at certain hours.' },
  { key: 'dock', copy: 'This is your voice — chips, keyboard, or hold-to-talk.' },
  { key: 'journal', copy: 'Everything you know is in here. It pauses time.' },
] as const

/**
 * First-play overlay: one spotlight + copy card per COACH_STEPS entry, walked through via
 * Next/"Got it"/Skip. Stage owns whether this renders at all (gated on the 'sf-coached'
 * localStorage flag) — this component only knows how to walk its four steps and report
 * when it's finished (via onDone, for both a normal finish and a Skip).
 */
export function CoachMarks({
  targets,
  onDone,
}: {
  targets: Record<(typeof COACH_STEPS)[number]['key'], React.RefObject<HTMLElement | null>>
  onDone: () => void
}) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const current = COACH_STEPS[step]! // step is always kept in [0, COACH_STEPS.length) below

  // Recomputes the spotlight rect on step change only (no resize handling — YAGNI, per
  // brief). Layout effect (not a passive one) so the rect is measured and committed before
  // the browser paints — a passive effect would let one frame render with the new step's
  // copy but the previous step's spotlight position. A target missing at the time its step
  // comes up (null ref — never rendered, or not available in this beat) skips straight past
  // that step instead of spotlighting nothing; running post-commit means a ref that's
  // merely not yet attached at first paint (same-commit sibling) still resolves correctly
  // by the time this fires.
  useLayoutEffect(() => {
    const el = targets[current.key].current
    if (!el) {
      if (step >= COACH_STEPS.length - 1) onDone()
      else setStep((s) => s + 1)
      return
    }
    setRect(el.getBoundingClientRect())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Render-time check mirrors the effect above so nothing flashes (stale spotlight/copy)
  // during the one tick between a missing target being detected and the step advancing.
  if (!targets[current.key].current) return null

  const isLast = step === COACH_STEPS.length - 1
  const advance = () => {
    if (isLast) onDone()
    else setStep((s) => s + 1)
  }

  return (
    <div className="fixed inset-0 z-50">
      {rect && (
        <div
          className="pointer-events-none absolute rounded-2xl"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
          }}
        />
      )}
      <div className="fixed inset-x-4 bottom-6 rounded-2xl bg-slate-900 p-4 text-slate-100 shadow-xl">
        <p className="text-sm leading-relaxed">{current.copy}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={onDone} className="px-2 py-1 text-xs text-slate-400">
            Skip
          </button>
          <button onClick={advance} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
            {isLast ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

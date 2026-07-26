import type { StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'

export function NarrationCard({ bundle, beatId }: { bundle: StoryBundle; beatId: string }) {
  const [shownFor, setShownFor] = useState<string | null>(beatId)
  useEffect(() => setShownFor(beatId), [beatId])

  // Fades in on every appearance (not just first mount): this component never actually
  // unmounts between beats — only `shownFor` toggles null/non-null — so the mount-driven
  // "visible" flip is re-run from an effect keyed on `shownFor` itself.
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (shownFor === null) return
    setVisible(false)
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [shownFor])

  if (shownFor === null) return null
  const beat = bundle.beats.find((b) => b.id === shownFor)
  if (!beat) return null
  return (
    <button
      onClick={() => setShownFor(null)}
      className={`absolute inset-x-4 top-1/4 z-30 rounded-2xl border border-white/10 bg-black/80 p-5 text-left transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <p className="text-sm leading-relaxed text-slate-100">{beat.narration}</p>
      <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">tap to continue</p>
    </button>
  )
}

import type { StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'

export function NarrationCard({ bundle, beatId }: { bundle: StoryBundle; beatId: string }) {
  const [shownFor, setShownFor] = useState<string | null>(beatId)
  useEffect(() => setShownFor(beatId), [beatId])
  if (shownFor === null) return null
  const beat = bundle.beats.find((b) => b.id === shownFor)
  if (!beat) return null
  return (
    <button
      onClick={() => setShownFor(null)}
      className="absolute inset-x-4 top-1/4 z-30 rounded-2xl border border-white/10 bg-black/80 p-5 text-left"
    >
      <p className="text-sm leading-relaxed text-slate-100">{beat.narration}</p>
      <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">tap to continue</p>
    </button>
  )
}

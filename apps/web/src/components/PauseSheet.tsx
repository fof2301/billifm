import { useEffect, useState } from 'react'

/** Pause overlay: the story clock stops while this is open. */
export function PauseSheet({
  storyTitle,
  session,
  open,
  onResume,
  onRestart,
  onLeave,
}: {
  storyTitle: string
  session: { pause(r: 'paused'): void; resume(r: 'paused'): void }
  open: boolean
  onResume: () => void
  onRestart: () => void
  onLeave: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (open) session.pause('paused')
    else {
      session.resume('paused')
      setConfirming(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div data-pause className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
      <div className="w-full max-w-xs animate-[slideup_0.2s_ease-out] text-center">
        <p className="text-[11px] uppercase tracking-widest text-slate-500">Paused</p>
        <h2 className="mt-1 text-xl font-bold">{storyTitle}</h2>
        <p className="mt-2 text-xs text-slate-400">The clock is stopped. Nothing moves until you do.</p>

        <div className="mt-6 flex flex-col gap-2">
          <button onClick={onResume} className="rounded-xl bg-indigo-600 py-3 font-semibold">
            Resume
          </button>
          <button onClick={onLeave} className="rounded-xl bg-slate-800 py-3 text-sm">
            All stories
          </button>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="rounded-xl border border-slate-700 py-3 text-sm text-slate-400"
            >
              Start over
            </button>
          ) : (
            <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3">
              <p className="text-xs text-red-200">This erases your progress in this story.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={onRestart} className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold">
                  Yes, wipe it
                </button>
                <button onClick={() => setConfirming(false)} className="flex-1 rounded-lg bg-slate-800 py-2 text-xs">
                  Keep playing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

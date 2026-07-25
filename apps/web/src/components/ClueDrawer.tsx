import type { SessionState, StoryBundle } from '@story/schema'
import { useState } from 'react'

export function ClueDrawer({ bundle, state }: { bundle: StoryBundle; state: SessionState }) {
  const [open, setOpen] = useState(false)
  const clues = bundle.clues.filter((c) => state.cluesFound.includes(c.id))
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="absolute right-3 top-24 z-20 rounded-full bg-black/50 px-3 py-1 text-xs"
      >
        🔍 {clues.length}
      </button>
      {open && (
        <div className="absolute inset-0 z-40 bg-black/70" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-slate-900 p-5 pb-10" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-300">Clues</h3>
            {clues.length === 0 && <p className="mt-2 text-sm text-slate-500">Nothing yet.</p>}
            {clues.map((c) => (
              <div key={c.id} className="mt-3">
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-sm text-slate-400">{c.text}</p>
              </div>
            ))}
            <button onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-slate-800 py-2 text-sm">Close</button>
          </div>
        </div>
      )}
    </>
  )
}

import type { SessionState, StoryBundle } from '@story/schema'
import { useState } from 'react'

export function TranscriptViewer({ bundle, state }: { bundle: StoryBundle; state: SessionState }) {
  const [open, setOpen] = useState<string | null>(null)
  const talked = bundle.characters.filter((c) => (state.transcripts[c.id] ?? []).length > 0)
  if (talked.length === 0) return <p className="text-sm text-slate-500">No conversations.</p>
  return (
    <div className="flex flex-col gap-2">
      {talked.map((c) => (
        <div key={c.id} className="rounded-xl border border-slate-800">
          <button
            onClick={() => setOpen(open === c.id ? null : c.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm"
          >
            <span>{c.name}</span>
            <span className="text-xs text-slate-500">{state.transcripts[c.id]!.length} lines</span>
          </button>
          {open === c.id && (
            <div className="border-t border-slate-800 p-3">
              {state.transcripts[c.id]!.map((e, i) => (
                <p key={i} className={`my-1 text-sm ${e.role === 'player' ? 'text-indigo-300' : 'text-slate-300'}`}>
                  <span className="text-xs text-slate-500">{e.role === 'player' ? 'You' : c.name}: </span>
                  {e.text}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

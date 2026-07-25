import type { Mode, StoryBundle } from '@story/schema'
import { useEffect } from 'react'
import type { SessionApi } from '../useSession'

const MODE_LABEL: Record<Mode, string> = { mcq: 'Choices', text: 'Free text', voice: 'Voice' }

export function SettingsSheet({
  bundle,
  session,
  open,
  onClose,
}: {
  bundle: StoryBundle
  session: SessionApi
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (open) session.pause('settings')
    else session.resume('settings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 bg-black/70" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-slate-900 p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-slate-300">Mode</h3>
        <div className="mt-3 flex gap-2">
          {bundle.meta.modes.map((m) => (
            <button
              key={m}
              onClick={() => session.setMode(m)}
              className={`rounded-full px-4 py-2 text-sm ${session.state.mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-slate-800 py-2 text-sm">Close</button>
      </div>
    </div>
  )
}

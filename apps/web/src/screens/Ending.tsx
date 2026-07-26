import type { SessionState, StoryBundle } from '@story/schema'
import { TranscriptViewer } from '../components/TranscriptViewer'

export function Ending({
  bundle,
  endingId,
  onReplay,
  onLibrary,
}: {
  bundle: StoryBundle
  endingId: string
  onReplay: () => void
  onLibrary: () => void
}) {
  const ending = bundle.endings.find((e) => e.id === endingId)
  const raw = localStorage.getItem(`sf-session-${bundle.meta.id}`)
  let state: SessionState | null = null
  if (raw) {
    try {
      state = JSON.parse(raw).state as SessionState
    } catch {
      // corrupt save — render the ending without the conversations section below
    }
  }

  return (
    <div className="mx-auto max-w-md p-6 pb-12">
      <p className="pt-8 text-xs uppercase tracking-widest text-slate-500">{bundle.meta.title}</p>
      <h1 className="mt-2 text-3xl font-bold">{ending?.title ?? 'The End'}</h1>
      <p className="mt-3 leading-relaxed text-slate-300">{ending?.text}</p>

      <div className="mt-8 flex gap-2">
        <button
          onClick={() => {
            localStorage.removeItem(`sf-session-${bundle.meta.id}`)
            onReplay()
          }}
          className="flex-1 rounded-xl bg-indigo-600 py-3 font-semibold"
        >
          Play again
        </button>
        <button onClick={onLibrary} className="flex-1 rounded-xl bg-slate-800 py-3 font-semibold">
          All stories
        </button>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-slate-400">Your conversations</h2>
      <div className="mt-3">{state ? <TranscriptViewer bundle={bundle} state={state} /> : null}</div>
    </div>
  )
}

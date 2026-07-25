import type { Mode, StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'
import { assetUrl, getStory } from '../api'

const MODE_LABEL: Record<Mode, string> = { mcq: 'Choices', text: 'Free text', voice: 'Voice' }

export function Intro({
  storyId,
  onStart,
  onBack,
}: {
  storyId: string
  onStart: (bundle: StoryBundle, mode: Mode, resume: boolean) => void
  onBack: () => void
}) {
  const [bundle, setBundle] = useState<StoryBundle | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [error, setError] = useState(false)
  const hasSave = Boolean(localStorage.getItem(`sf-session-${storyId}`))

  useEffect(() => {
    getStory(storyId)
      .then((b) => {
        setBundle(b)
        setMode(b.meta.modes[0])
      })
      .catch(() => setError(true))
  }, [storyId])

  if (error)
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Couldn't load this story.</p>
        <button onClick={onBack} className="mt-4 rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-100">
          ← Back
        </button>
      </div>
    )
  if (!bundle || !mode) return <p className="p-8 text-center text-slate-400">Loading…</p>

  const start = async (resume: boolean) => {
    if (mode === 'voice') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      } catch {
        alert('Microphone unavailable — starting in free text instead.')
        onStart(bundle, bundle.meta.modes.includes('text') ? 'text' : bundle.meta.modes[0], resume)
        return
      }
    }
    onStart(bundle, mode, resume)
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-md">
      <img src={assetUrl(storyId, bundle.meta.cover)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="relative flex min-h-dvh flex-col justify-end p-6 pb-10">
        <button onClick={onBack} className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-sm">← Back</button>
        <h1 className="text-3xl font-bold">{bundle.meta.title}</h1>
        <p className="mt-2 text-slate-300">{bundle.meta.tagline}</p>
        <p className="mt-1 text-xs text-slate-400">{bundle.meta.genre} · ~{bundle.meta.estimatedMinutes} min</p>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-slate-400">How do you want to play?</p>
          <div className="mt-2 flex gap-2">
            {bundle.meta.modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-2 text-sm ${m === mode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {hasSave && (
            <button onClick={() => start(true)} className="rounded-xl bg-indigo-600 py-3 font-semibold">
              Resume story
            </button>
          )}
          <button
            onClick={() => start(false)}
            className={`rounded-xl py-3 font-semibold ${hasSave ? 'bg-slate-800' : 'bg-indigo-600'}`}
          >
            {hasSave ? 'Start over' : 'Begin'}
          </button>
        </div>
      </div>
    </div>
  )
}

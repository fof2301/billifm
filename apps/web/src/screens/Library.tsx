import type { SessionState, StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'
import { assetUrl, getStory, listStories } from '../api'
import { PastSessions } from '../components/PastSessions'
import { TranscriptViewer } from '../components/TranscriptViewer'

export function Library({ onPick }: { onPick: (storyId: string) => void }) {
  const [stories, setStories] = useState<StoryBundle['meta'][] | null>(null)
  const [error, setError] = useState(false)
  const [review, setReview] = useState<{ bundle: StoryBundle; state: SessionState } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  /** Wipes saved progress and the first-play flag, but keeps the device identity. */
  const resetEverything = () => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sf-session-')) localStorage.removeItem(k)
    }
    localStorage.removeItem('sf-coached')
    setConfirmReset(false)
  }

  useEffect(() => {
    listStories()
      // meta.order pins featured stories to the front; unset sorts last.
      .then((list) => setStories([...list].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9))))
      .catch(() => setError(true))
  }, [])

  if (error) return <p className="p-8 text-center text-slate-400">Couldn't load stories. Is the gateway running?</p>
  if (!stories) return <p className="p-8 text-center text-slate-400">Loading…</p>

  return (
    <div className="mx-auto max-w-md p-4 pb-12 sm:max-w-3xl lg:max-w-5xl">
      <header className="py-6 sm:py-10">
        <h1 className="text-2xl font-bold sm:text-4xl">Stories</h1>
        <p className="mt-1 text-sm text-slate-400">
          Short interactive mysteries. Talk your way through them — by voice, by typing, or by choosing.
        </p>
      </header>
      {/* One column on phones, two from sm, three from lg. */}
      <div data-story-grid className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-left transition hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-lg hover:shadow-black/40"
          >
            <div className="relative aspect-[3/2] overflow-hidden sm:aspect-[4/5]">
              <img
                src={assetUrl(s.id, s.cover)}
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-slate-200">
                {s.estimatedMinutes} min
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">{s.genre}</p>
              <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{s.tagline}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-12 border-t border-slate-900 pt-6 text-center">
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="text-xs text-slate-500 underline underline-offset-4">
            Reset all progress
          </button>
        ) : (
          <div className="mx-auto max-w-xs rounded-xl border border-red-500/40 bg-red-950/30 p-3">
            <p className="text-xs text-red-200">
              Erases every story's saved progress and the first-play tips on this device.
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={resetEverything} className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold">
                Yes, reset everything
              </button>
              <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-lg bg-slate-800 py-2 text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <PastSessions
        onOpen={(state, storyId) => {
          getStory(storyId)
            .then((bundle) => setReview({ bundle, state }))
            .catch(() => {})
        }}
      />

      {review && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-4">
          <div className="mx-auto max-w-md pb-12 sm:max-w-3xl">
            <div className="flex items-center justify-between py-4">
              <h1 className="text-xl font-bold">{review.bundle.meta.title}</h1>
              <button onClick={() => setReview(null)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
                Close
              </button>
            </div>
            <TranscriptViewer bundle={review.bundle} state={review.state} />
          </div>
        </div>
      )}
    </div>
  )
}

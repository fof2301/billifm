import type { StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'
import { assetUrl, listStories } from '../api'

export function Library({ onPick }: { onPick: (storyId: string) => void }) {
  const [stories, setStories] = useState<StoryBundle['meta'][] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    listStories().then(setStories).catch(() => setError(true))
  }, [])

  if (error) return <p className="p-8 text-center text-slate-400">Couldn't load stories. Is the gateway running?</p>
  if (!stories) return <p className="p-8 text-center text-slate-400">Loading…</p>

  return (
    <div className="mx-auto max-w-md p-4 pb-12">
      <h1 className="py-6 text-2xl font-bold">Stories</h1>
      <div className="flex flex-col gap-4">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-left transition hover:border-slate-600"
          >
            <img src={assetUrl(s.id, s.cover)} alt="" className="h-40 w-full object-cover" />
            <div className="p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <span className="text-xs text-slate-400">{s.estimatedMinutes} min</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{s.tagline}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

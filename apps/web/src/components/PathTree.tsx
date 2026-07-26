import type { SessionState, StoryBundle } from '@story/schema'
import { useEffect } from 'react'

/** Depth of each beat from the opening beat, following goto transitions. */
function beatDepths(bundle: StoryBundle): Map<string, number> {
  const depth = new Map<string, number>([[bundle.beats[0]!.id, 0]])
  const queue = [bundle.beats[0]!.id]
  while (queue.length) {
    const id = queue.shift()!
    const beat = bundle.beats.find((b) => b.id === id)
    const targets = new Set<string>()
    for (const t of beat?.transitions ?? []) targets.add(t.goto)
    for (const chId of beat?.challenges ?? []) {
      const ch = bundle.challenges.find((c) => c.id === chId)
      if (!ch) continue
      const outcomes = ch.type === 'mcq' ? ch.options.map((o) => o.onPick) : [ch.onSuccess, ch.onFailure]
      for (const o of outcomes) if (o?.goto) targets.add(o.goto)
    }
    for (const target of targets) {
      if (depth.has(target)) continue
      depth.set(target, (depth.get(id) ?? 0) + 1)
      queue.push(target)
    }
  }
  // Anything unreachable by transitions still deserves a row.
  for (const b of bundle.beats) if (!depth.has(b.id)) depth.set(b.id, bundle.beats.length)
  return depth
}

/**
 * The decision tree: every turn the story can take, what you did take, and what
 * is still ahead. Rows are depth from the opening beat, so a fork renders as two
 * nodes side by side.
 */
export function PathTree({
  bundle,
  state,
  session,
  open,
  onClose,
}: {
  bundle: StoryBundle
  state: SessionState
  session: { pause(r: 'tree'): void; resume(r: 'tree'): void }
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (open) session.pause('tree')
    else session.resume('tree')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const depths = beatDepths(bundle)
  const rows = [...new Set([...depths.values()])].sort((a, b) => a - b)

  return (
    <div data-path-tree className="absolute inset-0 z-40 overflow-y-auto bg-black/85" onClick={onClose}>
      <div
        className="min-h-full animate-[slideup_0.25s_ease-out] p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center text-lg font-bold">What you've done</h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Every turn this night can take. Yours is lit.
        </p>

        <div className="mx-auto mt-6 flex max-w-sm flex-col items-center">
          {rows.map((row, ri) => {
            const beats = bundle.beats.filter((b) => depths.get(b.id) === row)
            return (
              <div key={row} className="flex w-full flex-col items-center">
                {ri > 0 && <div className="h-5 w-px bg-white/20" aria-hidden="true" />}
                <div className="flex w-full flex-wrap justify-center gap-2">
                  {beats.map((b) => {
                    const visited = state.beatsVisited.includes(b.id)
                    const current = state.beatId === b.id
                    return (
                      <div
                        key={b.id}
                        data-testid="path-node"
                        data-state={current ? 'current' : visited ? 'visited' : 'unknown'}
                        className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-left transition ${
                          current
                            ? 'border-indigo-400 bg-indigo-950/60'
                            : visited
                              ? 'border-white/15 bg-white/5'
                              : 'border-white/5 bg-black/40'
                        }`}
                      >
                        <p
                          className={`text-xs font-medium ${
                            visited || current ? 'text-slate-100' : 'text-slate-600'
                          }`}
                        >
                          {visited || current ? b.objective : 'Not taken'}
                        </p>
                        {current && <p className="mt-0.5 text-[10px] text-indigo-300">you are here</p>}
                        {visited && !current && <p className="mt-0.5 text-[10px] text-slate-500">done</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={onClose} className="mx-auto mt-8 block w-full max-w-sm rounded-xl bg-slate-800 py-2.5 text-sm">
          Close
        </button>
      </div>
    </div>
  )
}

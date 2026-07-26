import type { Character, SessionState, StoryBundle } from '@story/schema'
import { isCharacterAvailable } from '@story/engine'
import { useEffect } from 'react'
import { assetUrl } from '../api'

/** A bundle opts into the tree screen simply by giving its characters `kin`. */
export function hasKin(bundle: StoryBundle): boolean {
  return bundle.characters.some((c) => c.kin)
}

function generationLabel(generation: number): string {
  if (generation === 0) return 'You'
  if (generation === -1) return 'One generation back'
  if (generation === 1) return 'Yet to come'
  if (generation < -1) return `${Math.abs(generation)} generations back`
  return `${generation} generations ahead`
}

/** First clue this relative still needs, for the lock hint. */
function missingClue(bundle: StoryBundle, state: SessionState, c: Character) {
  const id = c.availability.requiresClues.find((k) => !state.cluesFound.includes(k))
  return id ? bundle.clues.find((k) => k.id === id) : undefined
}

export function FamilyTree({
  bundle,
  state,
  session,
  open,
  onSelect,
  onClose,
}: {
  bundle: StoryBundle
  state: SessionState
  session: { pause(r: 'tree'): void; resume(r: 'tree'): void }
  open: boolean
  onSelect: (id: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    if (open) session.pause('tree')
    else session.resume('tree')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const kin = bundle.characters.filter((c) => c.kin)
  const generations = [...new Set(kin.map((c) => c.kin!.generation))].sort((a, b) => a - b)

  return (
    <div data-family-tree className="absolute inset-0 z-40 overflow-y-auto bg-slate-950" onClick={onClose}>
      <div
        className="min-h-full animate-[slideup_0.25s_ease-out] p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center text-lg font-bold">Your line</h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          The lantern reaches whoever you have a way to reach.
        </p>

        <div className="mx-auto mt-6 flex max-w-sm flex-col items-center">
          {generations.map((g, gi) => (
            <div key={g} className="flex w-full flex-col items-center">
              {gi > 0 && <div className="h-6 w-px bg-white/20" aria-hidden="true" />}
              <p className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">{generationLabel(g)}</p>
              <div className="flex flex-wrap justify-center gap-4">
                {kin
                  .filter((c) => c.kin!.generation === g)
                  .map((c) => {
                    const available = isCharacterAvailable(bundle, state, c.id)
                    const locked = missingClue(bundle, state, c)
                    const active = state.activeCharacterId === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (!available) return
                          onSelect(c.id)
                          onClose()
                        }}
                        disabled={!available}
                        aria-label={c.name}
                        className="flex w-24 flex-col items-center gap-1 text-center disabled:cursor-default"
                      >
                        <span
                          className={`relative h-16 w-16 overflow-hidden rounded-full border-2 transition ${
                            active ? 'border-indigo-400' : 'border-white/20'
                          }`}
                        >
                          <img
                            src={assetUrl(bundle.meta.id, c.portrait)}
                            alt=""
                            className={`h-full w-full object-cover transition ${
                              available ? '' : 'opacity-25 grayscale'
                            }`}
                          />
                          {!available && (
                            <span className="absolute inset-0 flex items-center justify-center text-lg" aria-hidden="true">
                              🔒
                            </span>
                          )}
                        </span>
                        <span
                          data-testid="kin-name"
                          className={`text-xs font-medium ${available ? 'text-slate-100' : 'text-slate-500'}`}
                        >
                          {c.name}
                        </span>
                        <span className="text-[10px] leading-tight text-slate-500">{c.role}</span>
                        {locked && (
                          <span className="text-[10px] leading-tight text-amber-400/80">Find: {locked.title}</span>
                        )}
                        {!locked && !available && (
                          <span className="text-[10px] leading-tight text-slate-600">Not reachable now</span>
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mx-auto mt-8 block w-full max-w-sm rounded-xl bg-slate-800 py-2.5 text-sm">
          Close
        </button>
      </div>
    </div>
  )
}

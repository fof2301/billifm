import type { SessionState, StoryBundle } from '@story/schema'
import { isCharacterAvailable } from '@story/engine'
import { useEffect } from 'react'
import { assetUrl } from '../api'
import { mmss } from './TopBar'

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

export function Journal({
  bundle,
  state,
  time,
  session,
  open,
  onClose,
}: {
  bundle: StoryBundle
  state: SessionState
  time: { day: number; phase: string }
  session: { pause(r: 'settings'): void; resume(r: 'settings'): void }
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (open) session.pause('settings')
    else session.resume('settings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const beat = bundle.beats.find((b) => b.id === state.beatId)
  const challenge = state.activeChallenge
    ? bundle.challenges.find((c) => c.id === state.activeChallenge!.id)
    : undefined
  const clues = bundle.clues.filter((c) => state.cluesFound.includes(c.id))
  const visited = state.beatsVisited
    .map((id) => bundle.beats.find((b) => b.id === id))
    .filter(Boolean)
  const people = bundle.characters.filter((c) => beat?.characters.includes(c.id))

  return (
    <div data-journal className="absolute inset-0 z-40 bg-black/70" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-slate-900 p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{bundle.meta.title}</h2>
          <span className="text-xs text-slate-400">
            Day {time.day} of {bundle.clock.totalStoryDays} · {time.phase}
          </span>
        </div>

        <Section label="Your objective">
          <p className="text-sm font-medium text-slate-100">{beat?.objective}</p>
          {challenge && state.activeChallenge && (
            <p className="mt-2 rounded-xl bg-red-950/60 px-3 py-2 text-xs text-red-200">
              ⏱ {mmss(state.activeChallenge.deadlineMs - state.elapsedRealMs)} — {challenge.prompt}
            </p>
          )}
        </Section>

        <Section label="The story so far">
          <div className="flex flex-col gap-2">
            {visited.map((b) => (
              <p key={b!.id} className="text-sm leading-relaxed text-slate-300">
                {b!.narration}
              </p>
            ))}
          </div>
        </Section>

        <Section label="Clues">
          {clues.length === 0 && <p className="text-sm text-slate-500">Nothing yet — talk to people.</p>}
          {clues.map((c) => (
            <div key={c.id} className="mt-1">
              <p className="text-sm font-medium">{c.title}</p>
              <p className="text-sm text-slate-400">{c.text}</p>
            </div>
          ))}
        </Section>

        <Section label="People here">
          <div className="flex flex-col gap-2">
            {people.map((c) => {
              const here = isCharacterAvailable(bundle, state, c.id)
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <img
                    src={assetUrl(bundle.meta.id, c.portrait)}
                    alt=""
                    className={`h-9 w-9 rounded-full object-cover ${here ? '' : 'opacity-40'}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {c.name} <span className="font-normal text-slate-500">— {c.role}</span>
                    </p>
                    <p className={`text-xs ${here ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {here
                        ? 'Here now'
                        : c.availability.phases[0] === '*'
                          ? 'Away'
                          : `Away — around at ${c.availability.phases.join(', ')}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-slate-800 py-2.5 text-sm">
          Close
        </button>
      </div>
    </div>
  )
}

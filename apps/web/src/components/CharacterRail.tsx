import type { SessionState, StoryBundle } from '@story/schema'
import { isCharacterAvailable } from '@story/engine'
import { useEffect, useRef } from 'react'
import { assetUrl } from '../api'

export function CharacterRail({
  bundle,
  state,
  onSelect,
  railRef,
}: {
  bundle: StoryBundle
  state: SessionState
  onSelect: (id: string) => void
  railRef?: React.MutableRefObject<HTMLElement | null>
}) {
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  const chars = bundle.characters.filter((c) => beat?.characters.includes(c.id))
  const availability = new Map(chars.map((c) => [c.id, isCharacterAvailable(bundle, state, c.id)]))

  // Previous render's availability, so a character who just flipped to available (e.g. a
  // phase change unlocked them) gets a one-shot glow — never re-applied on later renders
  // while they simply stay available. Written from an effect (after commit), not during
  // render, so it reflects exactly one prior render even under StrictMode's dev double-render.
  const prevAvailableRef = useRef<Map<string, boolean>>(new Map())
  useEffect(() => {
    prevAvailableRef.current = availability
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <div
      ref={(el) => {
        if (railRef) railRef.current = el
      }}
      className="pointer-events-auto flex flex-col gap-2 self-start"
    >
      {chars.map((c) => {
        const available = availability.get(c.id) ?? false
        const active = state.activeCharacterId === c.id
        const justAvailable = available && prevAvailableRef.current.get(c.id) === false
        return (
          <button
            key={c.id}
            aria-label={c.name}
            aria-pressed={active}
            disabled={!available}
            onClick={() => onSelect(c.id)}
            className={`h-11 w-11 overflow-hidden rounded-full border-2 transition ${
              active ? 'border-indigo-400' : 'border-white/20'
            } ${available ? '' : 'opacity-35'} ${justAvailable ? 'animate-[pulse_1s_ease-in-out_2]' : ''}`}
          >
            <img src={assetUrl(bundle.meta.id, c.portrait)} alt={c.name} className="h-full w-full object-cover" />
          </button>
        )
      })}
    </div>
  )
}

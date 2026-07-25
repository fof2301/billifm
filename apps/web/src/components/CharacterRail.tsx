import type { SessionState, StoryBundle } from '@story/schema'
import { isCharacterAvailable } from '@story/engine'
import { assetUrl } from '../api'

export function CharacterRail({
  bundle,
  state,
  onSelect,
}: {
  bundle: StoryBundle
  state: SessionState
  onSelect: (id: string) => void
}) {
  const beat = bundle.beats.find((b) => b.id === state.beatId)
  const chars = bundle.characters.filter((c) => beat?.characters.includes(c.id))
  return (
    <div className="absolute left-3 top-24 z-20 flex flex-col gap-2">
      {chars.map((c) => {
        const available = isCharacterAvailable(bundle, state, c.id)
        const active = state.activeCharacterId === c.id
        return (
          <button
            key={c.id}
            aria-label={c.name}
            aria-pressed={active}
            disabled={!available}
            onClick={() => onSelect(c.id)}
            className={`h-11 w-11 overflow-hidden rounded-full border-2 transition ${
              active ? 'border-indigo-400' : 'border-white/20'
            } ${available ? '' : 'opacity-35'}`}
          >
            <img src={assetUrl(bundle.meta.id, c.portrait)} alt={c.name} className="h-full w-full object-cover" />
          </button>
        )
      })}
    </div>
  )
}

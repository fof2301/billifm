import type { StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'
import { assetUrl } from '../api'

/** Crossfades between per-phase scene backgrounds. */
export function BackgroundLayer({ bundle, phase }: { bundle: StoryBundle; phase: string }) {
  const [layers, setLayers] = useState<[string, string | null]>([phase, null])
  useEffect(() => {
    setLayers(([current]) => (current === phase ? [current, null] : [phase, current]))
  }, [phase])
  const src = (p: string) => assetUrl(bundle.meta.id, bundle.scene.backgrounds[p] ?? '')
  const [top, fading] = layers
  return (
    <div className="absolute inset-0">
      {fading && <img src={src(fading)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <img
        key={top}
        src={src(top)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
      />
    </div>
  )
}

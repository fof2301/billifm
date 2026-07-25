import type { StoryBundle } from '@story/schema'
import { assetUrl } from '../api'

/**
 * Crossfades between per-phase scene backgrounds. All phase layers stay
 * mounted (2-4 small assets) and only opacity changes — a keyed remount
 * would appear instantly because CSS transitions don't fire on first paint.
 */
export function BackgroundLayer({ bundle, phase }: { bundle: StoryBundle; phase: string }) {
  return (
    <div className="absolute inset-0">
      {Object.entries(bundle.scene.backgrounds).map(([p, src]) => (
        <img
          key={p}
          src={assetUrl(bundle.meta.id, src)}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            p === phase ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  )
}

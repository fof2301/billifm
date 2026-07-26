import type { StoryBundle, When } from '@story/schema'
import { clockAtLeast, storyTime } from './clock'

export function whenMatches(
  bundle: StoryBundle,
  state: { flags: string[]; elapsedRealMs: number },
  when: When,
): boolean {
  if (when.flags.some((f) => !state.flags.includes(f))) return false
  if (when.clockExpired !== undefined) {
    if (storyTime(bundle.clock, state.elapsedRealMs).expired !== when.clockExpired) return false
  }
  if (when.clockAtLeast) {
    if (!clockAtLeast(bundle.clock, state.elapsedRealMs, when.clockAtLeast)) return false
  }
  return true
}

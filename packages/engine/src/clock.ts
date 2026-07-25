import type { ClockConfig } from '@story/schema'

export interface StoryTime {
  day: number
  phase: string
  expired: boolean
}

export function storyTime(clock: ClockConfig, elapsedRealMs: number): StoryTime {
  const dayMs = clock.realMinutesPerStoryDay * 60_000
  const rawDay = Math.floor(elapsedRealMs / dayMs) // 0-based
  const expired = rawDay >= clock.totalStoryDays
  const day = Math.min(rawDay, clock.totalStoryDays - 1) + 1
  const phaseMs = dayMs / clock.phases.length
  const withinDay = expired ? dayMs - 1 : elapsedRealMs % dayMs
  const phaseIdx = Math.min(Math.floor(withinDay / phaseMs), clock.phases.length - 1)
  return { day, phase: clock.phases[phaseIdx]!, expired }
}

export function clockAtLeast(
  clock: ClockConfig,
  elapsedRealMs: number,
  target: { day: number; phase: string },
): boolean {
  const t = storyTime(clock, elapsedRealMs)
  if (t.day !== target.day) return t.day > target.day
  return clock.phases.indexOf(t.phase) >= clock.phases.indexOf(target.phase)
}

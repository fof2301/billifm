import type { ClockConfig } from '@story/schema'

export interface StoryTime {
  day: number
  phase: string
  expired: boolean
  /** 24h in-story clock: one full 0-24 sweep per story day. */
  hour: number
  minute: number
}

export function storyTime(clock: ClockConfig, elapsedRealMs: number): StoryTime {
  const dayMs = clock.realMinutesPerStoryDay * 60_000
  const rawDay = Math.floor(elapsedRealMs / dayMs) // 0-based
  const expired = rawDay >= clock.totalStoryDays
  const day = Math.min(rawDay, clock.totalStoryDays - 1) + 1
  const phaseMs = dayMs / clock.phases.length
  const withinDay = expired ? dayMs - 1 : elapsedRealMs % dayMs
  const phaseIdx = Math.min(Math.floor(withinDay / phaseMs), clock.phases.length - 1)
  // Integer math: (withinDay/dayMs)*24 floats can land at 7.5999…, flooring
  // the minutes one short.
  const totalStoryMinutes = Math.floor((withinDay * 1440) / dayMs)
  const hour = Math.floor(totalStoryMinutes / 60)
  const minute = totalStoryMinutes % 60
  return { day, phase: clock.phases[phaseIdx]!, expired, hour, minute }
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

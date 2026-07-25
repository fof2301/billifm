import { describe, expect, it } from 'vitest'
import { clockAtLeast, storyTime } from '../src/clock'

// 5 real minutes per story day, 4 phases => 75s per phase
const clock = {
  realMinutesPerStoryDay: 5,
  totalStoryDays: 3,
  phases: ['dawn', 'day', 'dusk', 'night'] as [string, ...string[]],
}

describe('storyTime', () => {
  it('starts at day 1, first phase', () => {
    expect(storyTime(clock, 0)).toEqual({ day: 1, phase: 'dawn', expired: false, hour: 0, minute: 0 })
  })

  it('advances phases within a day (76s => second phase)', () => {
    expect(storyTime(clock, 76_000).phase).toBe('day')
  })

  it('rolls to the next day after realMinutesPerStoryDay', () => {
    expect(storyTime(clock, 5 * 60_000)).toEqual({ day: 2, phase: 'dawn', expired: false, hour: 0, minute: 0 })
  })

  it('expires after totalStoryDays and clamps to the last day/phase', () => {
    const t = storyTime(clock, 15 * 60_000 + 1)
    expect(t.expired).toBe(true)
    expect(t.hour).toBe(23)
    expect(t.minute).toBe(59)
    expect(t.day).toBe(3)
    expect(t.phase).toBe('night')
  })
})

describe('story clock (0-24h over one real day-length)', () => {
  it('maps elapsed real time to a 24h story time', () => {
    expect(storyTime(clock, 150_000)).toMatchObject({ hour: 12, minute: 0 }) // half a day
    expect(storyTime(clock, 95_000)).toMatchObject({ hour: 7, minute: 36 }) // 95s of 300s
  })
})

describe('clockAtLeast', () => {
  it('is false before the target and true at/after it', () => {
    const target = { day: 2, phase: 'day' }
    expect(clockAtLeast(clock, 5 * 60_000, target)).toBe(false) // day 2 dawn
    expect(clockAtLeast(clock, 5 * 60_000 + 76_000, target)).toBe(true) // day 2 day
    expect(clockAtLeast(clock, 11 * 60_000, target)).toBe(true) // day 3
  })
})

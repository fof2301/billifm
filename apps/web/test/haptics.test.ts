import { describe, expect, it, vi } from 'vitest'
import type { FxEvent } from '../src/fx/events'
import { createHapticsController } from '../src/fx/haptics'

function createVibrateSpy() {
  return vi.fn()
}

describe('createHapticsController — event mapping', () => {
  it('challenge-started vibrates with 40ms pulse', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).handle({ type: 'challenge-started', challengeId: 'c1' })
    expect(vibrate).toHaveBeenCalledWith(40)
  })

  it('challenge-timed-out vibrates with [60, 60, 60] pattern', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).handle({ type: 'challenge-timed-out', challengeId: 'c1' })
    expect(vibrate).toHaveBeenCalledWith([60, 60, 60])
  })

  it('challenge-succeeded does not vibrate', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).handle({ type: 'challenge-succeeded', challengeId: 'c1' })
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('phase-changed does not vibrate', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).handle({ type: 'phase-changed', day: 2, phase: 'night' })
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('story-ended does not vibrate', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).handle({ type: 'story-ended' })
    expect(vibrate).not.toHaveBeenCalled()
  })
})

describe('createHapticsController — tickCheck boundaries', () => {
  it('does not vibrate when remaining is null', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).tickCheck(null)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('does not vibrate at 10s — outside the 10s window', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).tickCheck(10_000)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('vibrates at 9.999s — inside the window', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).tickCheck(9_999)
    expect(vibrate).toHaveBeenCalledWith(15)
  })

  it('does not vibrate at exactly 0 — deadline reached, window requires > 0', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).tickCheck(0)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('vibrates at 1ms — inside the window', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).tickCheck(1)
    expect(vibrate).toHaveBeenCalledWith(15)
  })

  it('does not vibrate at 30s — outside the 10s window', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).tickCheck(30_000)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('does not vibrate at 15s — outside the 10s window', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => true, vibrate).tickCheck(15_000)
    expect(vibrate).not.toHaveBeenCalled()
  })
})

describe('createHapticsController — mute gating', () => {
  const allEvents: FxEvent[] = [
    { type: 'challenge-started', challengeId: 'c1' },
    { type: 'challenge-timed-out', challengeId: 'c1' },
  ]

  it('vibrates no patterns when disabled', () => {
    const vibrate = createVibrateSpy()
    const haptics = createHapticsController(() => false, vibrate)
    for (const e of allEvents) haptics.handle(e)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('tickCheck vibrates nothing when disabled, even inside the window', () => {
    const vibrate = createVibrateSpy()
    createHapticsController(() => false, vibrate).tickCheck(5_000)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('no-ops gracefully when vibrate is missing', () => {
    const haptics = createHapticsController(() => true, undefined as any)
    expect(() => haptics.handle({ type: 'challenge-started', challengeId: 'c1' })).not.toThrow()
    expect(() => haptics.tickCheck(5_000)).not.toThrow()
  })
})

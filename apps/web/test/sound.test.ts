import { describe, expect, it, vi } from 'vitest'
import type { AudioBackend } from '../src/fx/audio'
import type { FxEvent } from '../src/fx/events'
import { createSoundController } from '../src/fx/sound'

function fakeBackend(): AudioBackend {
  return {
    unlock: vi.fn(),
    playSting: vi.fn(),
    playResolve: vi.fn(),
    playThud: vi.fn(),
    playBell: vi.fn(),
    playTick: vi.fn(),
    startAmbient: vi.fn(),
    duckAmbient: vi.fn(),
    stopAmbient: vi.fn(),
  }
}

describe('createSoundController — cue mapping', () => {
  it('challenge-started plays the sting', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).handle({ type: 'challenge-started', challengeId: 'c1' })
    expect(backend.playSting).toHaveBeenCalledTimes(1)
  })

  it('challenge-succeeded plays the resolve chime', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).handle({ type: 'challenge-succeeded', challengeId: 'c1' })
    expect(backend.playResolve).toHaveBeenCalledTimes(1)
  })

  it('challenge-timed-out plays the thud', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).handle({ type: 'challenge-timed-out', challengeId: 'c1' })
    expect(backend.playThud).toHaveBeenCalledTimes(1)
  })

  it('phase-changed ducks the ambient bed', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).handle({ type: 'phase-changed', day: 2, phase: 'night' })
    expect(backend.duckAmbient).toHaveBeenCalledTimes(1)
  })

  it('story-ended plays the bell AND stops ambient', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).handle({ type: 'story-ended' })
    expect(backend.playBell).toHaveBeenCalledTimes(1)
    expect(backend.stopAmbient).toHaveBeenCalledTimes(1)
  })
})

describe('createSoundController — tickCheck boundaries', () => {
  it('does not tick when remaining is null', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).tickCheck(null)
    expect(backend.playTick).not.toHaveBeenCalled()
  })

  it('does not tick at 31s — outside the 30s window', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).tickCheck(31_000)
    expect(backend.playTick).not.toHaveBeenCalled()
  })

  it('ticks at 29s — inside the window', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).tickCheck(29_000)
    expect(backend.playTick).toHaveBeenCalledTimes(1)
  })

  it('does not tick at exactly 0 — deadline reached, window requires > 0', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).tickCheck(0)
    expect(backend.playTick).not.toHaveBeenCalled()
  })
})

describe('createSoundController — mute gating', () => {
  const allEvents: FxEvent[] = [
    { type: 'challenge-started', challengeId: 'c1' },
    { type: 'challenge-succeeded', challengeId: 'c1' },
    { type: 'challenge-timed-out', challengeId: 'c1' },
    { type: 'phase-changed', day: 1, phase: 'night' },
  ]

  it('plays no cues for any event when disabled', () => {
    const backend = fakeBackend()
    const sound = createSoundController(backend, () => false)
    for (const e of allEvents) sound.handle(e)
    expect(backend.playSting).not.toHaveBeenCalled()
    expect(backend.playResolve).not.toHaveBeenCalled()
    expect(backend.playThud).not.toHaveBeenCalled()
    expect(backend.duckAmbient).not.toHaveBeenCalled()
  })

  it('story-ended: no bell when disabled, but ambient still stops', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => false).handle({ type: 'story-ended' })
    expect(backend.playBell).not.toHaveBeenCalled()
    expect(backend.stopAmbient).toHaveBeenCalledTimes(1)
  })

  it('tickCheck plays nothing when disabled, even inside the window', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => false).tickCheck(29_000)
    expect(backend.playTick).not.toHaveBeenCalled()
  })

  it('startAmbient no-ops when disabled', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => false).startAmbient('cellar')
    expect(backend.startAmbient).not.toHaveBeenCalled()
  })

  it('stopAmbient always passes through, even when disabled (muting mid-game must silence it)', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => false).stopAmbient()
    expect(backend.stopAmbient).toHaveBeenCalledTimes(1)
  })
})

describe('createSoundController — ambient file-vs-synth passthrough', () => {
  it('passes the resolved file URL through untouched when the scene has one', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).startAmbient('cellar', 'http://x/stories/s/ambient.mp3')
    expect(backend.startAmbient).toHaveBeenCalledWith('cellar', 'http://x/stories/s/ambient.mp3')
  })

  it('passes sceneId with undefined fileUrl through for synthesis when the scene has none', () => {
    const backend = fakeBackend()
    createSoundController(backend, () => true).startAmbient('library')
    expect(backend.startAmbient).toHaveBeenCalledWith('library', undefined)
  })
})

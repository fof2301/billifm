import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import type { SessionApi } from '../src/useSession'
import { SettingsSheet } from '../src/components/SettingsSheet'
import { effectsEnabled, setEffectsEnabled } from '../src/fx/prefs'

const bundle = StoryBundleSchema.parse({
  meta: { id: 'sx', title: 'Sx', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [
    { id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } },
  ],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'] }],
  challenges: [],
  clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

function fakeSession(): SessionApi {
  return {
    state: { mode: 'text' } as SessionApi['state'],
    pause: vi.fn(),
    resume: vi.fn(),
    setMode: vi.fn(),
  } as unknown as SessionApi
}

beforeEach(() => {
  localStorage.clear()
})

describe('SettingsSheet — Effects toggle', () => {
  it('renders pressed (effects on by default) and flips the pref off on click', () => {
    const session = fakeSession()
    render(<SettingsSheet bundle={bundle} session={session} open onClose={() => {}} onReplayTips={() => {}} />)

    const btn = screen.getByRole('button', { name: 'Effects' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(btn)

    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(effectsEnabled()).toBe(false)
  })

  it('reflects an already-muted pref and flips it back on', () => {
    setEffectsEnabled(false)
    const session = fakeSession()
    render(<SettingsSheet bundle={bundle} session={session} open onClose={() => {}} onReplayTips={() => {}} />)

    const btn = screen.getByRole('button', { name: 'Effects' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(btn)

    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(effectsEnabled()).toBe(true)
  })
})

describe('SettingsSheet — Replay tips', () => {
  it('clears the coach flag and calls onReplayTips', () => {
    localStorage.setItem('sf-coached', '1')
    const onReplayTips = vi.fn()
    const session = fakeSession()
    render(<SettingsSheet bundle={bundle} session={session} open onClose={() => {}} onReplayTips={onReplayTips} />)

    fireEvent.click(screen.getByRole('button', { name: 'Replay tips' }))

    expect(localStorage.getItem('sf-coached')).toBeNull()
    expect(onReplayTips).toHaveBeenCalledTimes(1)
  })
})

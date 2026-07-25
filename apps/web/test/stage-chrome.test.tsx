import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { CharacterRail } from '../src/components/CharacterRail'
import { TopBar } from '../src/components/TopBar'

vi.mock('../src/api', () => ({ assetUrl: (id: string, p: string) => `http://x/${id}/${p}` }))

const bundle = StoryBundleSchema.parse({
  meta: { id: 'sx', title: 'Sx', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [
    { id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } },
    { id: 'owl', name: 'Owl', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'onyx' }, availability: { beats: ['*'], phases: ['night'] } },
  ],
  beats: [{ id: 'b1', narration: 'n', objective: 'Find the key', characters: ['ann', 'owl'] }],
  challenges: [], clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const baseState = {
  storyId: 'sx', mode: 'text' as const, beatId: 'b1', flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}

describe('TopBar', () => {
  it('shows day, phase, objective, and a mm:ss countdown when a challenge is active', () => {
    render(
      <TopBar
        bundle={bundle}
        state={{ ...baseState, activeChallenge: { id: 'x', deadlineMs: 95_000 } }}
        time={{ day: 1, phase: 'day' }}
        onOpenSettings={() => {}}
      />,
    )
    expect(screen.getByText(/Day 1/)).toBeInTheDocument()
    expect(screen.getByText(/day/)).toBeInTheDocument()
    expect(screen.getByText('Find the key')).toBeInTheDocument()
    expect(screen.getByText(/01:35/)).toBeInTheDocument() // 95s remaining at t=0
  })
})

describe('CharacterRail', () => {
  it('marks phase-unavailable characters and highlights the active one', () => {
    render(
      <CharacterRail
        bundle={bundle}
        state={{ ...baseState, activeCharacterId: 'ann' }}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /Ann/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Owl/ })).toBeDisabled() // day phase, night-only
  })
})

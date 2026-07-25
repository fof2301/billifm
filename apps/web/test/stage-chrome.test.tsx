import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { BackgroundLayer } from '../src/components/BackgroundLayer'
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
  storyId: 'sx', mode: 'text' as const, beatId: 'b1', beatsVisited: ['b1'], flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}

describe('TopBar', () => {
  it('shows day, story clock, objective, and the challenge deadline in story time', () => {
    render(
      <TopBar
        bundle={bundle}
        state={{ ...baseState, activeChallenge: { id: 'x', deadlineMs: 95_000 } }}
        time={{ day: 1, phase: 'day', hour: 0, minute: 0 }}
        clueCount={0}
        onOpenJournal={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    expect(screen.getByText(/Day 1/)).toBeInTheDocument()
    expect(screen.getByText('Find the key')).toBeInTheDocument()
    expect(screen.getByText(/00:00/)).toBeInTheDocument() // story clock at t=0
    expect(screen.getByText(/by 07:36/)).toBeInTheDocument() // 95s deadline = 07:36 story time
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

describe('BackgroundLayer', () => {
  it('keeps all phase layers mounted so transitions animate on phase change', () => {
    const { rerender, container } = render(<BackgroundLayer bundle={bundle} phase="day" />)
    // Both day and night imgs must be mounted (same nodes stay, only opacity changes for CSS transition)
    const imgs = container.querySelectorAll('img[alt=""]')
    expect(imgs.length).toBe(2) // day and night

    const dayImg = Array.from(imgs).find((img) => (img as HTMLImageElement).src.includes('d.svg'))! as HTMLImageElement
    const nightImg = Array.from(imgs).find((img) => (img as HTMLImageElement).src.includes('n.svg'))! as HTMLImageElement

    // At phase="day": day has opacity-100, night has opacity-0
    expect(dayImg).toHaveClass('opacity-100')
    expect(nightImg).toHaveClass('opacity-0')

    // Rerender with phase="night": same nodes, classes swap
    rerender(<BackgroundLayer bundle={bundle} phase="night" />)
    expect(dayImg).toHaveClass('opacity-0')
    expect(nightImg).toHaveClass('opacity-100')
  })
})

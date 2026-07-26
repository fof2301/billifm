import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { BackgroundLayer } from '../src/components/BackgroundLayer'
import { ChallengeBanner } from '../src/components/ChallengeBanner'
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

  it('glows a character that just flipped to available, but not one that was already available', () => {
    // elapsedRealMs=0 -> day phase (owl unavailable); 200_000ms -> night phase (owl available).
    // See packages/engine/src/clock.ts: dayMs=300_000, phaseMs=150_000 for this bundle's clock.
    const { rerender } = render(
      <CharacterRail bundle={bundle} state={{ ...baseState, elapsedRealMs: 0 }} onSelect={() => {}} />,
    )
    // First render ever: nothing has "just" flipped, even for the already-available Ann.
    expect(screen.getByRole('button', { name: /Ann/ })).not.toHaveClass('animate-[pulse_1s_ease-in-out_2]')
    expect(screen.getByRole('button', { name: /Owl/ })).not.toHaveClass('animate-[pulse_1s_ease-in-out_2]')

    rerender(<CharacterRail bundle={bundle} state={{ ...baseState, elapsedRealMs: 200_000 }} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Owl/ })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Owl/ })).toHaveClass('animate-[pulse_1s_ease-in-out_2]')
    // Ann was available before and after — never glows.
    expect(screen.getByRole('button', { name: /Ann/ })).not.toHaveClass('animate-[pulse_1s_ease-in-out_2]')

    // Further renders while Owl stays available must not re-apply the glow.
    rerender(<CharacterRail bundle={bundle} state={{ ...baseState, elapsedRealMs: 210_000 }} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Owl/ })).not.toHaveClass('animate-[pulse_1s_ease-in-out_2]')
  })
})

const challengeBundle = StoryBundleSchema.parse({
  meta: { id: 'cb', title: 'Cb', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [
    { id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } },
  ],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: [], challenges: ['c1'] }],
  challenges: [
    { id: 'c1', type: 'task', prompt: 'Convince Ann to help.', timeLimitSeconds: 90, onSuccess: {}, onFailure: {} },
  ],
  clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const challengeBaseState = {
  storyId: 'cb', mode: 'text' as const, beatId: 'b1', beatsVisited: ['b1'], flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}

describe('ChallengeBanner', () => {
  it('renders the active prompt with the plain (non-outcome) red styling', () => {
    render(
      <ChallengeBanner
        bundle={challengeBundle}
        state={{ ...challengeBaseState, activeChallenge: { id: 'c1', deadlineMs: 90_000 } }}
      />,
    )
    const p = screen.getByText('Convince Ann to help.')
    expect(p).toHaveClass('bg-red-950/70', 'text-red-200')
    expect(p).not.toHaveClass('bg-emerald-950/70')
  })

  it('flips to green success styling when outcome is success', () => {
    render(
      <ChallengeBanner
        bundle={challengeBundle}
        state={{ ...challengeBaseState, activeChallenge: { id: 'c1', deadlineMs: 90_000 } }}
        outcome="success"
      />,
    )
    const p = screen.getByText('Convince Ann to help.')
    expect(p).toHaveClass('bg-emerald-950/70', 'text-emerald-200')
  })

  it('adds a shake animation when outcome is timeout', () => {
    render(
      <ChallengeBanner
        bundle={challengeBundle}
        state={{ ...challengeBaseState, activeChallenge: { id: 'c1', deadlineMs: 90_000 } }}
        outcome="timeout"
      />,
    )
    const p = screen.getByText('Convince Ann to help.')
    expect(p).toHaveClass('animate-[shake_0.4s_ease-in-out]')
  })

  it('stays mounted on the last prompt during the outcome window after activeChallenge has already cleared', () => {
    render(
      <ChallengeBanner
        bundle={challengeBundle}
        state={{ ...challengeBaseState, activeChallenge: null }}
        outcome="success"
        lastPrompt="Convince Ann to help."
      />,
    )
    expect(screen.getByText('Convince Ann to help.')).toHaveClass('bg-emerald-950/70')
  })

  it('renders nothing with no active challenge and no outcome', () => {
    const { container } = render(<ChallengeBanner bundle={challengeBundle} state={challengeBaseState} />)
    expect(container).toBeEmptyDOMElement()
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

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { TypewriterText } from '../src/fx/TypewriterText'
import { ConversationSheet } from '../src/components/ConversationSheet'

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom has no scroll methods on Element; ConversationSheet calls scrollTo on its
  // scroll container every render, which would otherwise throw in this test env.
  Element.prototype.scrollTo = vi.fn()
})
afterEach(() => vi.useRealTimers())

describe('TypewriterText', () => {
  it('reveals one character per interval and shows a caret while incomplete', () => {
    const { container } = render(<TypewriterText text="Hello" cps={10} />)
    // cps=10 => 100ms per character
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(container.textContent).toBe('Hel▌')
  })

  it('shows the full text with no caret once every character has revealed', () => {
    const { container } = render(<TypewriterText text="Hi" cps={10} />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(container.textContent).toBe('Hi')
  })

  it('completes instantly on click, without waiting for remaining intervals', () => {
    const { container } = render(<TypewriterText text="Hello" cps={10} />)
    act(() => {
      vi.advanceTimersByTime(100) // only 1 of 5 chars revealed so far
    })
    fireEvent.click(container.firstChild as Element)
    expect(container.textContent).toBe('Hello')

    // Further timer advances must not error or change anything (interval was cleared).
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container.textContent).toBe('Hello')
  })

  it('fires onStep on every reveal step, including the step that completes the text', () => {
    const onStep = vi.fn()
    render(<TypewriterText text="Hi" cps={10} onStep={onStep} />)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(onStep).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(onStep).toHaveBeenCalledTimes(2) // second step also completes "Hi" (length 2)
  })

  it('fires onStep when a click completes the text early', () => {
    const onStep = vi.fn()
    const { container } = render(<TypewriterText text="Hello" cps={10} onStep={onStep} />)
    fireEvent.click(container.firstChild as Element)
    expect(onStep).toHaveBeenCalledTimes(1)
  })

  it('resets the reveal counter when the text prop changes', () => {
    const { container, rerender } = render(<TypewriterText text="Hi" cps={10} />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(container.textContent).toBe('Hi')

    rerender(<TypewriterText text="Yo!" cps={10} />)
    expect(container.textContent).toBe('▌') // reset to zero chars revealed, caret only

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(container.textContent).toBe('Y▌')
  })
})

const bundle = StoryBundleSchema.parse({
  meta: { id: 'tw', title: 'Tw', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [
    {
      id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] },
    },
  ],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'] }],
  challenges: [],
  clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const baseState = {
  storyId: 'tw', mode: 'text' as const, beatId: 'b1', beatsVisited: ['b1'], flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: 'ann',
  transcripts: {
    ann: [
      { role: 'character' as const, text: 'First line here', atMs: 0 },
      { role: 'character' as const, text: 'Second line here', atMs: 1 },
    ],
  },
  suggestedReplies: [], endingId: null,
}

describe('ConversationSheet typewriter integration', () => {
  it('only animates the LAST character entry — earlier entries render fully and instantly', () => {
    render(
      <ConversationSheet
        bundle={bundle}
        state={baseState}
        busy={false}
        stallLine={null}
        failedMessage={null}
        onRetry={() => {}}
      />,
    )

    // First (older) entry: fully present with no animation delay.
    expect(screen.getByText('First line here')).toBeInTheDocument()

    // Last entry: mid-reveal at t=0, not yet fully present as a single text node.
    expect(screen.queryByText('Second line here')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('Second line here')).toBeInTheDocument()
  })
})

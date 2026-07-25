import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { Journal } from '../src/components/Journal'

vi.mock('../src/api', () => ({ assetUrl: (id: string, p: string) => `http://x/${id}/${p}` }))

const bundle = StoryBundleSchema.parse({
  meta: { id: 'jx', title: 'The Test', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [
    { id: 'ann', name: 'Ann', role: 'friend', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } },
    { id: 'owl', name: 'Owl', role: 'watcher', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'onyx' }, availability: { beats: ['*'], phases: ['night'] } },
  ],
  beats: [
    { id: 'b1', narration: 'You wake in a room.', objective: 'Find the key', characters: ['ann', 'owl'], challenges: ['c1'] },
    { id: 'b2', narration: 'A door creaks open.', objective: 'Go through', characters: ['ann'] },
  ],
  challenges: [{ id: 'c1', type: 'task', prompt: 'Convince Ann to help.', timeLimitSeconds: 90,
    onSuccess: {}, onFailure: {} }],
  clues: [{ id: 'k1', title: 'Rusty key', text: 'Found under the cot.' }],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const state = {
  storyId: 'jx', mode: 'text' as const, beatId: 'b2', beatsVisited: ['b1', 'b2'],
  flags: [], cluesFound: ['k1'], resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [],
  activeChallenge: { id: 'c1', deadlineMs: 90_000 }, activeCharacterId: null,
  transcripts: {}, suggestedReplies: [], endingId: null,
}

function makeSession() {
  return { pause: vi.fn(), resume: vi.fn() }
}

describe('Journal', () => {
  it('shows objective, active task, story so far, clues, and people with availability', () => {
    render(
      <Journal
        bundle={bundle}
        state={state}
        time={{ day: 1, phase: 'day', expired: false }}
        session={makeSession()}
        open
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Go through')).toBeInTheDocument() // current objective
    expect(screen.getByText(/Convince Ann to help/)).toBeInTheDocument() // active challenge
    expect(screen.getByText('You wake in a room.')).toBeInTheDocument() // visited narrations
    expect(screen.getByText('A door creaks open.')).toBeInTheDocument()
    expect(screen.getByText('Rusty key')).toBeInTheDocument() // clue
    expect(screen.getByText(/Day 1 of 2/)).toBeInTheDocument() // progress
    expect(screen.getByText('Ann')).toBeInTheDocument()
    expect(screen.getByText(/Here now/)).toBeInTheDocument() // ann available (day, '*')
    // owl is in beat b2? no — beat b2 characters = ['ann'], so owl not listed
    expect(screen.queryByText('Owl')).not.toBeInTheDocument()
  })

  it('pauses the clock while open and resumes on close', async () => {
    const session = makeSession()
    const onClose = vi.fn()
    const { rerender } = render(
      <Journal bundle={bundle} state={state} time={{ day: 1, phase: 'day', expired: false }} session={session} open onClose={onClose} />,
    )
    expect(session.pause).toHaveBeenCalledWith('settings')
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
    rerender(
      <Journal bundle={bundle} state={state} time={{ day: 1, phase: 'day', expired: false }} session={session} open={false} onClose={onClose} />,
    )
    expect(session.resume).toHaveBeenCalledWith('settings')
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <Journal bundle={bundle} state={state} time={{ day: 1, phase: 'day', expired: false }} session={makeSession()} open={false} onClose={() => {}} />,
    )
    expect(container.querySelector('[data-journal]')).toBeNull()
  })
})

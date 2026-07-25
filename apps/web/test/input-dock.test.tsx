import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { InputDock } from '../src/components/InputDock'

vi.mock('../src/api', () => ({ assetUrl: () => 'x' }))

const bundle = StoryBundleSchema.parse({
  meta: { id: 'dx', title: 'D', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['mcq', 'text', 'voice'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [{ id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
    voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } }],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'], challenges: ['q1'] }],
  challenges: [{ id: 'q1', type: 'mcq', prompt: 'pick', timeLimitSeconds: 60,
    options: [{ id: 'a', text: 'Option A', onPick: {} }, { id: 'b', text: 'Option B', onPick: {} }] }],
  clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const baseState = {
  storyId: 'dx', mode: 'mcq' as const, beatId: 'b1', beatsVisited: ['b1'], flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: 'ann', transcripts: {}, suggestedReplies: [], endingId: null,
}

function makeSession(overrides: object) {
  return {
    state: baseState, time: { day: 1, phase: 'day', expired: false }, busy: false,
    stallLine: null, failedMessage: null, send: vi.fn(), retry: vi.fn(), pick: vi.fn(),
    selectCharacter: vi.fn(), setMode: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    onAudio: { current: null }, ...overrides,
  }
}

describe('InputDock', () => {
  it('mcq mode with an active mcq challenge shows its options and picks', async () => {
    const session = makeSession({ state: { ...baseState, activeChallenge: { id: 'q1', deadlineMs: 60_000 } } })
    render(<InputDock bundle={bundle} session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Option A' }))
    expect(session.pick).toHaveBeenCalledWith('a')
  })

  it('mcq mode without a challenge shows suggested replies and sends them', async () => {
    const session = makeSession({ state: { ...baseState, suggestedReplies: ['Ask why', 'Stay quiet'] } })
    render(<InputDock bundle={bundle} session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ask why' }))
    expect(session.send).toHaveBeenCalledWith('Ask why')
  })

  it('mcq mode with a character but no suggestions yet shows starter chips', async () => {
    const session = makeSession({})
    render(<InputDock bundle={bundle} session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Who are you?' }))
    expect(session.send).toHaveBeenCalledWith('Who are you?')
  })

  it('text mode sends typed messages and clears the field', async () => {
    const session = makeSession({ state: { ...baseState, mode: 'text' as const } })
    render(<InputDock bundle={bundle} session={session} />)
    const input = screen.getByPlaceholderText(/say something/i)
    await userEvent.type(input, 'hello there{enter}')
    expect(session.send).toHaveBeenCalledWith('hello there')
    expect(input).toHaveValue('')
  })

  it('disables input while busy or with no character selected', () => {
    const session = makeSession({ state: { ...baseState, mode: 'text' as const, activeCharacterId: null } })
    render(<InputDock bundle={bundle} session={session} />)
    expect(screen.getByPlaceholderText(/pick someone/i)).toBeDisabled()
  })
})

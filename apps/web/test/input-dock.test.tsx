import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { InputDock } from '../src/components/InputDock'

// jsdom's real requestAnimationFrame fires on a wall-clock timer, which makes tests that
// need to observe the "before the flip" and "after the flip" states flaky/slow. Stub it to
// resolve on a same-tick macrotask instead, so `await act(() => Promise.resolve())`-style
// flushing is deterministic.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

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
    state: baseState, time: { day: 1, phase: 'day', expired: false, hour: 0, minute: 0 }, busy: false,
    stallLine: null, failedMessage: null, send: vi.fn(), retry: vi.fn(), pick: vi.fn(),
    selectCharacter: vi.fn(), setMode: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    onAudio: { current: null }, onEffect: { current: null },
    getAudio: () => undefined, ...overrides,
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

  // Regression: chips don't exist until a character is picked (activeCharacterId starts
  // null), so a "mounted once on InputDock's own mount" flip is already true by the time
  // the FIRST chip set ever renders — nothing ever staggers in. The entrance must be
  // re-armed per chip-set identity instead.
  it('re-arms the chip entrance per chip-set identity — the first starter set stages in on a fresh frame', async () => {
    const noCharSession = makeSession({ state: { ...baseState, activeCharacterId: null } })
    const { rerender } = render(<InputDock bundle={bundle} session={noCharSession} />)
    expect(screen.getByText(/pick someone/i)).toBeInTheDocument()

    // Let the dock's initial mount-frame flip fire BEFORE any chips exist — this is the
    // real-world timing bug: `mounted` flips ~1 frame after InputDock mounts, well before
    // a player has actually picked a character, so a "mounted once, ever" flip is already
    // true by the time the first chip set has anything to show.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const withCharSession = makeSession({})
    rerender(<InputDock bundle={bundle} session={withCharSession} />)

    const labels = ['Who are you?', 'What is this place?', 'What do you want from me?']
    const buttons = labels.map((l) => screen.getByRole('button', { name: l }))
    buttons.forEach((b) => expect(b).toHaveClass('opacity-0', 'translate-y-1'))
    expect(buttons[0]).toHaveStyle({ transitionDelay: '0ms' })
    expect(buttons[1]).toHaveStyle({ transitionDelay: '60ms' })
    expect(buttons[2]).toHaveStyle({ transitionDelay: '120ms' })

    // Flush the (stubbed) animation frame the mount effect scheduled.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    buttons.forEach((b) => expect(b).toHaveClass('opacity-100', 'translate-y-0'))
  })

  it('re-arms the entrance again when suggested replies refresh to a different set', async () => {
    const starters = makeSession({})
    const { rerender } = render(<InputDock bundle={bundle} session={starters} />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(screen.getByRole('button', { name: 'Who are you?' })).toHaveClass('opacity-100')

    const suggested = makeSession({ state: { ...baseState, suggestedReplies: ['Ask why', 'Stay quiet'] } })
    rerender(<InputDock bundle={bundle} session={suggested} />)

    const fresh = screen.getByRole('button', { name: 'Ask why' })
    expect(fresh).toHaveClass('opacity-0', 'translate-y-1')

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(fresh).toHaveClass('opacity-100', 'translate-y-0')
  })
})

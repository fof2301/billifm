import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PushToTalkButton } from '../src/components/PushToTalkButton'

vi.mock('../src/api', () => ({
  stt: vi.fn(async () => ({ text: '' })),
}))

vi.mock('../src/audio', () => ({
  createRecorder: vi.fn(() => ({
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => new Blob(['x'], { type: 'audio/webm' })),
  })),
}))

const baseState = {
  storyId: 'test',
  mode: 'voice' as const,
  beatId: 'b1', beatsVisited: ['b1'],
  flags: [],
  cluesFound: [],
  resolvedChallenges: [],
  elapsedRealMs: 0,
  pauseReasons: [],
  activeChallenge: null,
  activeCharacterId: 'char1',
  transcripts: {},
  suggestedReplies: [],
  endingId: null,
}

function makeSession(overrides: object = {}) {
  return {
    state: baseState,
    time: { day: 1, phase: 'day', expired: false, hour: 0, minute: 0 },
    busy: false,
    stallLine: null,
    failedMessage: null,
    send: vi.fn(),
    retry: vi.fn(),
    pick: vi.fn(),
    selectCharacter: vi.fn(),
    setMode: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onAudio: { current: null },
    onEffect: { current: null },
    ...overrides,
  }
}

describe('PushToTalkButton', () => {
  it('recovers from error phase when user holds to talk again', async () => {
    const user = userEvent.setup()
    const session = makeSession({})
    render(<PushToTalkButton session={session} />)

    const button = screen.getByLabelText('Hold to talk')

    // First press: recording starts, release triggers stt which returns empty (error)
    await user.pointer({ target: button, keys: '[MouseLeft>]' })
    expect(screen.getByText('release to send')).toBeInTheDocument()

    await user.pointer({ target: button, keys: '[/MouseLeft]' })
    // Wait for transcribing and then error state
    await vi.waitFor(
      () => {
        expect(screen.getByText(/Didn't catch that/i)).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    // Second press: should start recording again (not stay stuck in error)
    await user.pointer({ target: button, keys: '[MouseLeft>]' })
    expect(screen.getByText('release to send')).toBeInTheDocument()

    await user.pointer({ target: button, keys: '[/MouseLeft]' })
    vi.unstubAllGlobals()
  })
})

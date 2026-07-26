import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PushToTalkButton } from '../src/components/PushToTalkButton'

const sttMock = vi.fn(async (_blob?: Blob) => ({ text: '' }))
vi.mock('../src/api', () => ({
  stt: (blob: Blob) => sttMock(blob),
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
    closeConversation: vi.fn(),
    setMode: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onAudio: { current: null },
    onEffect: { current: null },
    getAudio: vi.fn(() => undefined),
    ...overrides,
  }
}

describe('PushToTalkButton (tap to record, tap to send)', () => {
  it('toggles: tap starts recording, tap again stops and sends the transcription', async () => {
    sttMock.mockResolvedValueOnce({ text: 'hello from voice' })
    const user = userEvent.setup()
    const session = makeSession()
    render(<PushToTalkButton session={session} />)

    await user.click(screen.getByLabelText('Record a message'))
    expect(screen.getByText(/tap to send/)).toBeInTheDocument()

    await user.click(screen.getByLabelText('Stop and send'))
    await vi.waitFor(() => expect(session.send).toHaveBeenCalledWith('hello from voice'))
    expect(screen.getByText('tap to speak')).toBeInTheDocument()
  })

  it('recovers from error phase when the user taps again', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    render(<PushToTalkButton session={session} />)

    // stt default returns empty text -> error phase
    await user.click(screen.getByLabelText('Record a message'))
    expect(screen.getByText(/tap to send/)).toBeInTheDocument()
    await user.click(screen.getByLabelText('Stop and send'))
    await vi.waitFor(() => {
      expect(screen.getByText(/Didn't catch that/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Tap again: recording restarts (not stuck in error)
    await user.click(screen.getByLabelText('Record a message'))
    expect(screen.getByText(/tap to send/)).toBeInTheDocument()
  })
})

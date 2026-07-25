import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'

const dialogueMock = vi.fn()
const judgeMock = vi.fn()
const snapshotMock = vi.fn(async (..._a: unknown[]) => ({ ok: true as const }))
vi.mock('../src/api', () => ({
  dialogue: (...a: unknown[]) => dialogueMock(...a),
  judge: (...a: unknown[]) => judgeMock(...a),
  snapshot: (...a: unknown[]) => snapshotMock(...a),
}))

import { useSession } from '../src/useSession'

const bundle = StoryBundleSchema.parse({
  meta: {
    id: 'hx', title: 'Hx', tagline: '', genre: 'test', estimatedMinutes: 5,
    cover: 'c.svg', modes: ['mcq', 'text'], stallLines: ['the wind howls…'],
  },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [{
    id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'kind',
    greeting: 'hi', voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] },
  }],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'], challenges: ['t1'] }],
  challenges: [{
    id: 't1', type: 'task', prompt: 'p', timeLimitSeconds: 60,
    onSuccess: { setFlags: ['won'] }, onFailure: {},
  }],
  clues: [],
  endings: [{ id: 'fin', when: { flags: ['won'] }, title: 'F', text: 'f' }],
})

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  dialogueMock.mockReset()
  judgeMock.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('useSession', () => {
  it('ticks the clock once per second', () => {
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.state.elapsedRealMs).toBe(3000)
  })

  it('sends the just-appended player message once: it is the playerMessage, not also in transcriptTail', async () => {
    dialogueMock.mockResolvedValue({ text: 'reply' })
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('unique player text'))
    await waitFor(() => expect(dialogueMock).toHaveBeenCalled())
    const call = dialogueMock.mock.calls[0]![0] as { playerMessage: string; transcriptTail: { text: string }[] }
    expect(call.playerMessage).toBe('unique player text')
    expect(call.transcriptTail.some((e) => e.text === 'unique player text')).toBe(false)
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
  })

  it('sends a message: dialogue call, reply appended, judge success ends story', async () => {
    dialogueMock.mockResolvedValue({ text: 'oh really' })
    judgeMock.mockResolvedValue({ success: true, feedback: 'done' })
    const ended = vi.fn()
    const { result } = renderHook(() => useSession(bundle, 'text', false, ended))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('I did the thing'))
    expect(result.current.busy).toBe(true)
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    await waitFor(() => expect(result.current.state.transcripts['ann']!.at(-1)?.text).toBe('oh really'))
    await waitFor(() => expect(ended).toHaveBeenCalledWith('fin'))
    expect(dialogueMock.mock.calls[0]![0]).toMatchObject({ storyId: 'hx', characterId: 'ann', wantSuggestions: false })
  })

  it('clock is paused while a challenge dialogue is in flight', async () => {
    let release: (v: { text: string }) => void
    dialogueMock.mockReturnValue(new Promise((r) => { release = r }))
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('hello'))
    const before = result.current.state.elapsedRealMs
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.state.elapsedRealMs).toBe(before)
    await act(async () => { release!({ text: 'hi' }); await vi.runOnlyPendingTimersAsync() })
  })

  it('failed dialogue sets failedMessage after one retry and unblocks the clock', async () => {
    dialogueMock.mockRejectedValue(new Error('boom'))
    judgeMock.mockResolvedValue({ success: false, feedback: '' })
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('hello'))
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    await waitFor(() => expect(result.current.failedMessage).toBe('hello'))
    expect(dialogueMock).toHaveBeenCalledTimes(2)
    expect(result.current.state.pauseReasons).not.toContain('request')
  })

  it('retry during an active challenge re-pauses the clock before the dialogue call goes out', async () => {
    dialogueMock.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('hello'))
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    await waitFor(() => expect(result.current.failedMessage).toBe('hello'))
    expect(result.current.state.pauseReasons).not.toContain('request')
    expect(result.current.state.activeChallenge?.id).toBe('t1')

    let release: (v: { text: string }) => void
    dialogueMock.mockReturnValue(new Promise((r) => { release = r }))
    act(() => result.current.retry())
    // PAUSE dispatches synchronously, before the retried requestDialogue call resolves.
    expect(result.current.state.pauseReasons).toContain('request')
    await act(async () => { release!({ text: 'hi' }); await vi.runOnlyPendingTimersAsync() })
  })

  it('judge failure verdict still releases the pause but leaves the challenge active', async () => {
    dialogueMock.mockResolvedValue({ text: 'oh really' })
    judgeMock.mockResolvedValue({ success: false, feedback: 'not yet' })
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('I did the thing'))
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    await waitFor(() => expect(judgeMock).toHaveBeenCalled())
    await waitFor(() => expect(result.current.state.pauseReasons).not.toContain('request'))
    expect(result.current.state.activeChallenge?.id).toBe('t1')
  })

  it('resumes the clock when the judge call itself errors', async () => {
    dialogueMock.mockResolvedValue({ text: 'oh really' })
    judgeMock.mockRejectedValue(new Error('judge unavailable'))
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('I did the thing'))
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    await waitFor(() => expect(judgeMock).toHaveBeenCalled())
    await waitFor(() => expect(result.current.state.pauseReasons).not.toContain('request'))
  })

  it('keeps busy true through the retry window after the first dialogue attempt fails', async () => {
    dialogueMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockReturnValueOnce(new Promise<{ text: string }>(() => {})) // retry attempt: never resolves
    const { result } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => result.current.send('hello'))
    expect(result.current.busy).toBe(true)
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    await waitFor(() => expect(dialogueMock).toHaveBeenCalledTimes(2))
    expect(result.current.busy).toBe(true)
  })

  it('falls back to a fresh session instead of crashing when the saved session string is corrupt', () => {
    localStorage.setItem(`sf-session-${bundle.meta.id}`, 'not valid json{{{')
    const { result } = renderHook(() => useSession(bundle, 'text', true, () => {}))
    expect(result.current.state.beatId).toBe('b1')
    expect(result.current.state.activeCharacterId).toBeNull()
    expect(result.current.state.elapsedRealMs).toBe(0)
  })

  it('persists to localStorage and resumes', () => {
    const { result, unmount } = renderHook(() => useSession(bundle, 'text', false, () => {}))
    act(() => result.current.selectCharacter('ann'))
    act(() => vi.advanceTimersByTime(2000))
    unmount()
    const { result: resumed } = renderHook(() => useSession(bundle, 'text', true, () => {}))
    expect(resumed.current.state.elapsedRealMs).toBe(2000)
    expect(resumed.current.state.activeCharacterId).toBe('ann')
  })
})

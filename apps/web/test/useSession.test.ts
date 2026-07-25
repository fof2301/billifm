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

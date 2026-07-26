import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'

const { getStoryMock } = vi.hoisted(() => ({ getStoryMock: vi.fn() }))

vi.mock('../src/api', () => ({
  getStory: (...a: unknown[]) => getStoryMock(...a),
  assetUrl: (id: string, p: string) => `http://x/stories/${id}/${p}`,
}))

import { Intro } from '../src/screens/Intro'

const bundle = StoryBundleSchema.parse({
  meta: {
    id: 'kidnapping-escape', title: 'The Cellar', tagline: 'You have 3 days.', genre: 'thriller',
    estimatedMinutes: 8, cover: 'assets/cover.svg', modes: ['mcq', 'text'],
  },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [{
    id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
    voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] },
  }],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'] }],
  challenges: [], clues: [],
  endings: [{ id: 'fin', when: { clockExpired: true }, title: 'F', text: 'f' }],
})

const savedState = {
  storyId: 'kidnapping-escape', mode: 'text', beatId: 'b1', beatsVisited: ['b1'], flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null as string | null,
}

beforeEach(() => {
  getStoryMock.mockReset()
  localStorage.clear()
})

describe('Intro', () => {
  it('shows an error state with a working back button when the story fails to load', async () => {
    getStoryMock.mockRejectedValue(new Error('network fail'))
    const onBack = vi.fn()
    render(<Intro storyId="kidnapping-escape" onStart={() => {}} onBack={onBack} />)

    expect(await screen.findByText(/couldn't load this story/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('offers Resume story for an in-progress save', async () => {
    getStoryMock.mockResolvedValue(bundle)
    localStorage.setItem(
      'sf-session-kidnapping-escape',
      JSON.stringify({ sessionId: 's1', state: { ...savedState, endingId: null } }),
    )
    render(<Intro storyId="kidnapping-escape" onStart={() => {}} onBack={() => {}} />)
    await screen.findByText('The Cellar')
    expect(screen.getByRole('button', { name: /resume story/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument()
  })

  it('offers replay, not a soft-locked resume, once the saved session already reached an ending', async () => {
    getStoryMock.mockResolvedValue(bundle)
    localStorage.setItem(
      'sf-session-kidnapping-escape',
      JSON.stringify({ sessionId: 's1', state: { ...savedState, endingId: 'fin' } }),
    )
    render(<Intro storyId="kidnapping-escape" onStart={() => {}} onBack={() => {}} />)
    await screen.findByText('The Cellar')
    expect(screen.queryByRole('button', { name: /resume story/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^begin$/i })).toBeInTheDocument()
  })

  it('offers replay, not resume, when the saved session string is corrupt', async () => {
    getStoryMock.mockResolvedValue(bundle)
    localStorage.setItem('sf-session-kidnapping-escape', 'not valid json{{{')
    render(<Intro storyId="kidnapping-escape" onStart={() => {}} onBack={() => {}} />)
    await screen.findByText('The Cellar')
    expect(screen.queryByRole('button', { name: /resume story/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^begin$/i })).toBeInTheDocument()
  })
})

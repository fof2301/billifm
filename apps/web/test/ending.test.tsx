import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { Ending } from '../src/screens/Ending'

vi.mock('../src/api', () => ({ assetUrl: () => 'x', listSessions: vi.fn(), getSession: vi.fn() }))

const bundle = StoryBundleSchema.parse({
  meta: { id: 'ex', title: 'Ex', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [{ id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
    voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } }],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'] }],
  challenges: [], clues: [],
  endings: [{ id: 'good', when: { flags: ['x'] }, title: 'You made it', text: 'Sunlight.' }],
})

describe('Ending', () => {
  it('shows the ending and the conversation review', () => {
    localStorage.setItem(
      'sf-session-ex',
      JSON.stringify({
        sessionId: 's1',
        state: {
          storyId: 'ex', mode: 'text', beatId: 'b1', flags: ['x'], cluesFound: [],
          resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
          activeCharacterId: 'ann', suggestedReplies: [], endingId: 'good',
          transcripts: { ann: [{ role: 'character', text: 'g', atMs: 0 }] },
        },
      }),
    )
    render(<Ending bundle={bundle} endingId="good" onReplay={() => {}} onLibrary={() => {}} />)
    expect(screen.getByText('You made it')).toBeInTheDocument()
    expect(screen.getByText('Sunlight.')).toBeInTheDocument()
    expect(screen.getByText(/Ann/)).toBeInTheDocument()
  })
})

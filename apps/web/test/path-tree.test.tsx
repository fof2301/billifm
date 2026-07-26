import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { PathTree } from '../src/components/PathTree'

vi.mock('../src/api', () => ({ assetUrl: (id: string, p: string) => `http://x/${id}/${p}` }))

// b1 -> b2 -> fork(b3a | b3b) -> b4
const bundle = StoryBundleSchema.parse({
  meta: { id: 'px', title: 'P', tagline: '', genre: 't', estimatedMinutes: 8, cover: 'c.jpg', modes: ['text'], tree: 'path' },
  clock: { realMinutesPerStoryDay: 8, totalStoryDays: 1, phases: ['night'] },
  scene: { id: 's', backgrounds: { night: 'n.jpg' } },
  characters: [{ id: 'r', name: 'R', role: 'x', portrait: 'p.jpg', personality: 'x', greeting: 'hi',
    voice: { voiceId: 'nova' }, availability: { beats: ['*'], phases: ['*'] } }],
  beats: [
    { id: 'b1', narration: 'n', objective: 'Answer the call', characters: ['r'],
      transitions: [{ when: { flags: ['a'] }, goto: 'b2' }] },
    { id: 'b2', narration: 'n', objective: 'Prove it is real', characters: ['r'], challenges: ['c1'] },
    { id: 'b3a', narration: 'n', objective: 'Confront the boyfriend', characters: ['r'] },
    { id: 'b3b', narration: 'n', objective: 'Raid the showroom', characters: ['r'] },
    { id: 'b4', narration: 'n', objective: 'Survive 11:58', characters: ['r'],
      transitions: [{ when: { flags: ['z'] }, goto: 'b4' }] },
  ],
  challenges: [{ id: 'c1', type: 'mcq', prompt: 'pick', timeLimitSeconds: 60,
    options: [{ id: 'a', text: 'A', onPick: { goto: 'b3a' } }, { id: 'b', text: 'B', onPick: { goto: 'b3b' } }] }],
  clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const state = {
  storyId: 'px', mode: 'text' as const, beatId: 'b3a', beatsVisited: ['b1', 'b2', 'b3a'],
  flags: [], cluesFound: [], resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [],
  activeChallenge: null, activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}
const session = () => ({ pause: vi.fn(), resume: vi.fn() })

describe('PathTree', () => {
  it('lights the path taken, marks where you are, and hides untaken turns', () => {
    render(<PathTree bundle={bundle} state={state} session={session()} open onClose={() => {}} />)
    expect(screen.getByText('Answer the call')).toBeInTheDocument()
    expect(screen.getByText('Prove it is real')).toBeInTheDocument()
    expect(screen.getByText('Confront the boyfriend')).toBeInTheDocument()
    expect(screen.getByText('you are here')).toBeInTheDocument()
    // the fork you didn't take stays unnamed
    expect(screen.queryByText('Raid the showroom')).not.toBeInTheDocument()
    expect(screen.getAllByText('Not taken').length).toBeGreaterThan(0)
  })

  it('places the fork branches on the same row', () => {
    render(<PathTree bundle={bundle} state={state} session={session()} open onClose={() => {}} />)
    const nodes = screen.getAllByTestId('path-node')
    expect(nodes).toHaveLength(5)
    expect(nodes.filter((n) => n.dataset.state === 'visited')).toHaveLength(2)
    expect(nodes.filter((n) => n.dataset.state === 'current')).toHaveLength(1)
  })

  it('pauses the clock while open and renders nothing when closed', () => {
    const s = session()
    const { container, rerender } = render(
      <PathTree bundle={bundle} state={state} session={s} open onClose={() => {}} />,
    )
    expect(s.pause).toHaveBeenCalledWith('tree')
    rerender(<PathTree bundle={bundle} state={state} session={s} open={false} onClose={() => {}} />)
    expect(s.resume).toHaveBeenCalledWith('tree')
    expect(container.querySelector('[data-path-tree]')).toBeNull()
  })
})

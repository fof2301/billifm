import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { FamilyTree, hasKin } from '../src/components/FamilyTree'

vi.mock('../src/api', () => ({ assetUrl: (id: string, p: string) => `http://x/${id}/${p}` }))

const kinBundle = StoryBundleSchema.parse({
  meta: { id: 'lx', title: 'Line', tagline: '', genre: 't', estimatedMinutes: 9, cover: 'c.jpg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 8, totalStoryDays: 1, phases: ['dusk', 'dawn'] },
  scene: { id: 's', backgrounds: { dusk: 'd.jpg', dawn: 'w.jpg' } },
  characters: [
    { id: 'sera', name: 'Sera', role: 'grandmother', portrait: 'sera.jpg', personality: 'x', greeting: 'hi',
      voice: { voiceId: 'coral' }, availability: { beats: ['*'], phases: ['*'] }, kin: { generation: -1, parents: [] } },
    { id: 'ilsa', name: 'Ilsa', role: '1891', portrait: 'ilsa.jpg', personality: 'x', greeting: 'hm',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'], requiresClues: ['letter'] },
      kin: { generation: -4, parents: [] } },
    { id: 'wren', name: 'Wren', role: 'daughter', portrait: 'wren.jpg', personality: 'x', greeting: 'mum',
      voice: { voiceId: 'shimmer' }, availability: { beats: ['*'], phases: ['*'] }, kin: { generation: 1, parents: [] } },
  ],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['sera', 'ilsa', 'wren'] }],
  challenges: [],
  clues: [{ id: 'letter', title: 'The unsent letter', text: 'water-stained' }],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const noKinBundle = StoryBundleSchema.parse({
  ...JSON.parse(JSON.stringify(kinBundle)),
  characters: kinBundle.characters.map(({ kin: _kin, ...c }) => c),
})

const state = {
  storyId: 'lx', mode: 'text' as const, beatId: 'b1', beatsVisited: ['b1'], flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}

const session = () => ({ pause: vi.fn(), resume: vi.fn() })

describe('hasKin', () => {
  it('detects whether a bundle declares a family tree', () => {
    expect(hasKin(kinBundle)).toBe(true)
    expect(hasKin(noKinBundle)).toBe(false)
  })
})

describe('FamilyTree', () => {
  it('lists relatives oldest generation first', () => {
    render(<FamilyTree bundle={kinBundle} state={state} session={session()} open onSelect={() => {}} onClose={() => {}} />)
    const names = screen.getAllByTestId('kin-name').map((n) => n.textContent)
    expect(names).toEqual(['Ilsa', 'Sera', 'Wren'])
  })

  it('locks a relative behind their clue and shows what to find', () => {
    const onSelect = vi.fn()
    render(<FamilyTree bundle={kinBundle} state={state} session={session()} open onSelect={onSelect} onClose={() => {}} />)
    expect(screen.getByText(/Find: The unsent letter/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ilsa/ }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('unlocks the relative once the clue is found, and selecting closes the tree', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <FamilyTree bundle={kinBundle} state={{ ...state, cluesFound: ['letter'] }} session={session()}
        open onSelect={onSelect} onClose={onClose} />,
    )
    expect(screen.queryByText(/Find: The unsent letter/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ilsa/ }))
    expect(onSelect).toHaveBeenCalledWith('ilsa')
    expect(onClose).toHaveBeenCalled()
  })

  it('pauses the clock while open and renders nothing when closed', () => {
    const s = session()
    const { container, rerender } = render(
      <FamilyTree bundle={kinBundle} state={state} session={s} open onSelect={() => {}} onClose={() => {}} />,
    )
    expect(s.pause).toHaveBeenCalledWith('tree')
    rerender(<FamilyTree bundle={kinBundle} state={state} session={s} open={false} onSelect={() => {}} onClose={() => {}} />)
    expect(s.resume).toHaveBeenCalledWith('tree')
    expect(container.querySelector('[data-family-tree]')).toBeNull()
  })
})

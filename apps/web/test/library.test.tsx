import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/api', () => ({
  listStories: vi.fn(async () => [
    {
      id: 'kidnapping-escape', title: 'The Cellar', tagline: 'You have 3 days.',
      genre: 'thriller', estimatedMinutes: 8, cover: 'assets/cover.svg',
      modes: ['mcq', 'text', 'voice'], stallLines: [],
    },
  ]),
  assetUrl: (id: string, p: string) => `http://x/stories/${id}/${p}`,
  getStory: vi.fn(),
  listSessions: vi.fn(async () => []),
  getSession: vi.fn(),
}))

import { Library } from '../src/screens/Library'

describe('Library', () => {
  it('renders a card per story with title and duration', async () => {
    render(<Library onPick={() => {}} />)
    expect(await screen.findByText('The Cellar')).toBeInTheDocument()
    expect(screen.getByText(/8 min/)).toBeInTheDocument()
  })
})

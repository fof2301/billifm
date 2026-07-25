import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/api', () => ({
  getStory: vi.fn(async () => {
    throw new Error('network fail')
  }),
  assetUrl: (id: string, p: string) => `http://x/stories/${id}/${p}`,
}))

import { Intro } from '../src/screens/Intro'

describe('Intro', () => {
  it('shows an error state with a working back button when the story fails to load', async () => {
    const onBack = vi.fn()
    render(<Intro storyId="kidnapping-escape" onStart={() => {}} onBack={onBack} />)

    expect(await screen.findByText(/couldn't load this story/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})

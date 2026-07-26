import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PauseSheet } from '../src/components/PauseSheet'

const session = () => ({ pause: vi.fn(), resume: vi.fn() })

describe('PauseSheet', () => {
  it('holds the clock while open and releases it on close', () => {
    const s = session()
    const { rerender } = render(
      <PauseSheet storyTitle="The Lantern Line" session={s} open onResume={() => {}} onRestart={() => {}} onLeave={() => {}} />,
    )
    expect(s.pause).toHaveBeenCalledWith('paused')
    rerender(
      <PauseSheet storyTitle="The Lantern Line" session={s} open={false} onResume={() => {}} onRestart={() => {}} onLeave={() => {}} />,
    )
    expect(s.resume).toHaveBeenCalledWith('paused')
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <PauseSheet storyTitle="X" session={session()} open={false} onResume={() => {}} onRestart={() => {}} onLeave={() => {}} />,
    )
    expect(container.querySelector('[data-pause]')).toBeNull()
  })

  it('resumes, leaves, and restarts through its three actions', () => {
    const onResume = vi.fn()
    const onLeave = vi.fn()
    const onRestart = vi.fn()
    render(
      <PauseSheet storyTitle="The Lantern Line" session={session()} open
        onResume={onResume} onRestart={onRestart} onLeave={onLeave} />,
    )
    expect(screen.getByText('The Lantern Line')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expect(onResume).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /all stories/i }))
    expect(onLeave).toHaveBeenCalled()
    // Start over asks for confirmation before wiping progress
    fireEvent.click(screen.getByRole('button', { name: /start over/i }))
    expect(onRestart).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /yes, wipe/i }))
    expect(onRestart).toHaveBeenCalled()
  })
})

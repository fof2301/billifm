import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhaseToast } from '../src/fx/PhaseToast'

describe('PhaseToast', () => {
  it('renders nothing when there is no toast', () => {
    const { container } = render(<PhaseToast toast={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the phase icon, capitalized phase name, and day', () => {
    render(<PhaseToast toast={{ day: 2, phase: 'night' }} />)
    expect(screen.getByText(/🌙 Night · Day 2/)).toBeInTheDocument()
  })

  it('capitalizes the phase name for display', () => {
    render(<PhaseToast toast={{ day: 1, phase: 'dawn' }} />)
    expect(screen.getByText(/🌅 Dawn · Day 1/)).toBeInTheDocument()
  })

  it('falls back to a generic icon for a phase absent from the shared icon map', () => {
    render(<PhaseToast toast={{ day: 3, phase: 'storm' }} />)
    expect(screen.getByText(/🕐 Storm · Day 3/)).toBeInTheDocument()
  })

  it('disappears once the toast prop is cleared — Stage owns the 2.5s timeout, not this component', () => {
    const { rerender, container } = render(<PhaseToast toast={{ day: 1, phase: 'day' }} />)
    expect(screen.getByText(/Day · Day 1/)).toBeInTheDocument()

    rerender(<PhaseToast toast={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

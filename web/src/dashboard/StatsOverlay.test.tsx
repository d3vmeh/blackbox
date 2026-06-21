// web/src/dashboard/StatsOverlay.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatsOverlay } from './StatsOverlay'
import { deriveStats } from './deriveStats'
import { loadStubMultiAgentTrace } from './data/stubMultiAgentTrace'

const stats = deriveStats(loadStubMultiAgentTrace())

describe('StatsOverlay', () => {
  it('renders aggregate tiles and a row per agent when open', () => {
    render(<StatsOverlay open stats={stats} onClose={() => {}} />)
    expect(screen.getByTestId('stats-overlay')).toBeInTheDocument()
    // one body row per agent
    expect(screen.getByText('intake')).toBeInTheDocument()
    expect(screen.getByText('payout')).toBeInTheDocument()
    // tokens are flagged estimated, never presented as exact
    expect(screen.getByText('est.')).toBeInTheDocument()
    expect(screen.getByText('est. tokens')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(<StatsOverlay open={false} stats={stats} onClose={() => {}} />)
    expect(screen.queryByTestId('stats-overlay')).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<StatsOverlay open stats={stats} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close statistics'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

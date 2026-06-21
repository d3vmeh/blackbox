import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrustBadge } from './TrustBadge'

describe('TrustBadge', () => {
  it('renders the UNTRUSTED label with no signal hue (neutral data-state)', () => {
    render(<TrustBadge state="untrusted" />)
    expect(screen.getByText('UNTRUSTED')).toBeInTheDocument()
    const badge = screen.getByText('UNTRUSTED').closest('.trust-badge')
    expect(badge).toHaveAttribute('data-state', 'untrusted')
  })

  it('renders the PROVING label with a live k/n counter from rate*n', () => {
    render(<TrustBadge state="proving" rate={0.6} n={5} />)
    expect(screen.getByText('PROVING')).toBeInTheDocument()
    // round(0.6 * 5) = 3
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('omits the counter while proving when n is absent', () => {
    render(<TrustBadge state="proving" />)
    expect(screen.getByText('PROVING')).toBeInTheDocument()
    expect(screen.queryByText(/\/\d/)).not.toBeInTheDocument()
  })

  it('renders the TRUSTED label using the pass treatment (trusted data-state)', () => {
    render(<TrustBadge state="trusted" rate={1} n={5} />)
    expect(screen.getByText('TRUSTED')).toBeInTheDocument()
    const badge = screen.getByText('TRUSTED').closest('.trust-badge')
    // the trusted state is the lone signal use (--pass + --ring-pass); the
    // data-state hook is what selects that treatment in TrustBadge.css.
    expect(badge).toHaveAttribute('data-state', 'trusted')
    // the trusted state shows no proving counter
    expect(screen.queryByText('5/5')).not.toBeInTheDocument()
  })
})

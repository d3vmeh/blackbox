// Landing showcase dashboard — mirrors the real dashboard's regions on fake data.
// The component is scroll-driven (IntersectionObserver): a no-op observer leaves
// it on the idle (FAIL) beat; capturing the observer callback and advancing fake
// timers plays the scripted cascade through to the confirmed PASS / TRUSTED state.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { Dashboard } from './Dashboard'

let fireIntersect: (() => void) | null = null

class IOStub {
  constructor(cb: IntersectionObserverCallback) {
    fireIntersect = () =>
      cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
}

describe('landing showcase Dashboard', () => {
  beforeEach(() => {
    fireIntersect = null
    vi.stubGlobal('IntersectionObserver', IOStub)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('renders the real-dashboard regions on the idle (FAIL) beat', () => {
    render(<Dashboard />)

    // readout verdict (scoped to the banner — the inspector also shows oracle FAIL)
    expect(within(screen.getByRole('banner')).getByText('FAIL')).toBeInTheDocument()
    // monitor rail sections
    expect(screen.getByRole('heading', { name: /Agents/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Supervise/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Candidates/ })).toBeInTheDocument()
    // ranked suspect + provenance graph nodes
    expect(screen.getByText('decimal slip · earliest corrupted hand-off')).toBeInTheDocument()
    expect(screen.getByTestId('node-g2')).toBeInTheDocument()
    expect(screen.getByText('billed_amount = $52,000')).toBeInTheDocument()
    // agent roster label appears (also in topology/band — at least once)
    expect(screen.getAllByText('PAYOUT').length).toBeGreaterThan(0)
    // inspector
    expect(screen.getByText('Inspector')).toBeInTheDocument()
  })

  it('autoplays through the cascade to the confirmed PASS / TRUSTED state', async () => {
    vi.useFakeTimers()
    try {
      render(<Dashboard />)
      await act(async () => { fireIntersect?.() })       // scroll into view → start the cascade
      // Advance in chunks: each flush lets a beat's effect schedule the next
      // timeout before the following advance fires it (run past all holds, ~8.5s).
      for (let i = 0; i < 10; i++) {
        await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      }

      expect(within(screen.getByRole('banner')).getByText('PASS')).toBeInTheDocument()
      expect(screen.getByText('TRUSTED')).toBeInTheDocument()
      expect(screen.getByText(/Fix confirmed/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

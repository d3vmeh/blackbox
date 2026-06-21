// web/src/dashboard/Dashboard.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import { Dashboard } from './Dashboard'

// claim_adjudication fixture: root s1 / INTAKE billed_amount slip; decoy s4 / ADJUSTER.

describe('Dashboard', () => {
  it('renders the readout verdict and the trace spine', () => {
    render(<Dashboard />)
    expect(screen.getByText('FAIL')).toBeInTheDocument()
    expect(screen.getAllByText(/INTAKE/).length).toBeGreaterThan(0)
  })

  it('selecting a node updates the inspector', () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a0'))
    const inspector = screen.getByRole('complementary')
    expect(within(inspector).getAllByText(/52000/).length).toBeGreaterThan(0)
  })

  it('replaying the root candidate flips the verdict to PASS (trusted)', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a0'))
    fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))
    expect(await screen.findByText('PASS', {}, { timeout: 3500 })).toBeInTheDocument()
    expect(await screen.findByText('TRUSTED', {}, { timeout: 3500 })).toBeInTheDocument()
  }, 6000)

  it('replaying a decoy candidate does NOT flip the verdict (rejection beat)', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a3'))
    fireEvent.click(screen.getByRole('button', { name: /replay candidate/i }))
    expect(await screen.findByText('FAIL')).toBeInTheDocument()
    expect(screen.queryByText('PASS')).not.toBeInTheDocument()
  })

  it('does not let the startup analyze timer interrupt a first-click replay', async () => {
    vi.useFakeTimers()
    try {
      render(<Dashboard />)
      fireEvent.click(screen.getByTestId('node-a0'))
      fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))

      await act(async () => {
        await Promise.resolve()
        vi.advanceTimersByTime(2200)
      })
      expect(screen.getByText('PASS')).toBeInTheDocument()

      // The old startup timer fired at 6000ms and reset the phase to analyze.
      // Advancing beyond it must leave the confirmed replay intact.
      act(() => { vi.advanceTimersByTime(6000) })
      expect(screen.getByText('PASS')).toBeInTheDocument()
      expect(screen.getByText('TRUSTED')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Dashboard · pending run (Dev READY state)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/scenarios')) {
        return {
          ok: true,
          json: async () => ([
            { name: 'claim_adjudication', label: 'insurance · claim adjudication' },
            { name: 'prior_auth', label: 'clinical · prior authorization' },
          ]),
        } as Response
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows READY and hides the stale graph when the picked scenario is not loaded', async () => {
    render(<Dashboard />)
    expect(screen.getByText('FAIL')).toBeInTheDocument()
    expect(screen.getAllByText(/INTAKE/).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Choose scenario' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Choose scenario' }))
    fireEvent.click(screen.getByRole('button', { name: /clinical · prior authorization/i }))

    expect(screen.getByText('READY')).toBeInTheDocument()
    expect(screen.getByText(/ready to run/i)).toBeInTheDocument()
    expect(screen.queryByText(/INTAKE/)).not.toBeInTheDocument()
    expect(document.querySelector('.dash--await')).toBeTruthy()
  })

  it('restores the loaded trace when re-selecting the scenario that is already loaded', async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Choose scenario' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Choose scenario' }))
    fireEvent.click(screen.getByRole('button', { name: /clinical · prior authorization/i }))
    expect(screen.getByText('READY')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Choose scenario' }))
    fireEvent.click(screen.getByRole('button', { name: /insurance · claim adjudication/i }))

    expect(screen.getByText('FAIL')).toBeInTheDocument()
    expect(screen.getAllByText(/INTAKE/).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(document.querySelector('.dash--await')).toBeFalsy()
    })
  })
})

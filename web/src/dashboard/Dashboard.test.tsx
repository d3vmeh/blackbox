// web/src/dashboard/Dashboard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  it('renders the readout verdict and the graph', () => {
    render(<Dashboard />)
    expect(screen.getByText('FAIL')).toBeInTheDocument()
    expect(screen.getAllByText(/parse_duration/).length).toBeGreaterThan(0)
  })

  it('selecting a node updates the inspector', () => {
    render(<Dashboard />)
    // a0 is spec_interpreter (s1) — the root cause; pre-selected on first paint.
    // Clicking it confirms the inspector shows s1's output (unit: minutes).
    fireEvent.click(screen.getByTestId('node-a0'))
    // Scope to the inspector aside so we prove the INSPECTOR reacted to selection —
    // the log console renders step msgs unconditionally, so a global query would pass
    // even without selection.
    const inspector = screen.getByRole('complementary')
    expect(within(inspector).getAllByText(/minutes/).length).toBeGreaterThan(0)
  })

  it('replaying the root candidate flips the verdict to PASS', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a0')) // the true root (spec_interpreter, s1)
    fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))
    expect(await screen.findByText('PASS')).toBeInTheDocument()
  })

  it('replaying a decoy candidate does NOT flip the verdict (rejection beat)', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a2')) // the decoy: test_writer (s3)
    fireEvent.click(screen.getByRole('button', { name: /replay candidate/i }))
    // verdict stays FAIL; the focused decoy step does not flip the outcome
    expect(await screen.findByText('FAIL')).toBeInTheDocument()
    expect(screen.queryByText('PASS')).not.toBeInTheDocument()
  })
})

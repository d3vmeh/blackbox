// web/src/dashboard/Dashboard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  it('renders the readout verdict and the graph', () => {
    render(<Dashboard />)
    expect(screen.getByText('FAIL')).toBeInTheDocument()
    expect(screen.getAllByText(/normalize_dates/).length).toBeGreaterThan(0)
  })

  it('selecting a node updates the inspector', () => {
    render(<Dashboard />)
    // a2 is the merged normalize_dates action (a0=plan, a1=extract params); its focus
    // step is the result s3 whose output carries the wrong date.
    fireEvent.click(screen.getByTestId('node-a2'))
    // Scope to the inspector aside so we prove the INSPECTOR reacted to selection —
    // the log console renders the date unconditionally, so a global query would pass
    // even without selection.
    const inspector = screen.getByRole('complementary')
    expect(within(inspector).getAllByText(/2024-12-07/).length).toBeGreaterThan(0)
  })

  it('replaying the root candidate flips the verdict to PASS', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a2')) // the true root (normalize_dates)
    fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))
    expect(await screen.findByText('PASS')).toBeInTheDocument()
  })

  it('replaying a decoy candidate does NOT flip the verdict (rejection beat)', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a9')) // the decoy: "relax direct-only"
    fireEvent.click(screen.getByRole('button', { name: /replay candidate/i }))
    // verdict stays FAIL; the focused decoy step does not flip the outcome
    expect(await screen.findByText('FAIL')).toBeInTheDocument()
    expect(screen.queryByText('PASS')).not.toBeInTheDocument()
  })
})

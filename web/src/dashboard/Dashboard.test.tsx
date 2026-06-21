// web/src/dashboard/Dashboard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  it('renders the readout verdict and the graph', () => {
    render(<Dashboard />)
    expect(screen.getByText('FAIL')).toBeInTheDocument()
    expect(screen.getAllByText(/INTAKE|42000|42,000/i).length).toBeGreaterThan(0)
  })

  it('selecting a node updates the inspector', () => {
    render(<Dashboard />)
    // a0 is INTAKE (s1) — the root cause; pre-selected on first paint.
    fireEvent.click(screen.getByTestId('node-a0'))
    const inspector = screen.getByRole('complementary')
    expect(within(inspector).getAllByText(/42000|4200/i).length).toBeGreaterThan(0)
  })

  it('replaying the root candidate flips the verdict to PASS', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a0')) // INTAKE (s1)
    fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))
    expect(await screen.findByText('PASS')).toBeInTheDocument()
  })

  it('replaying a decoy candidate does NOT flip the verdict (rejection beat)', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a3')) // decoy: ADJUDICATOR (s4)
    fireEvent.click(screen.getByRole('button', { name: /replay candidate/i }))
    expect(await screen.findByText('FAIL')).toBeInTheDocument()
    expect(screen.queryByText('PASS')).not.toBeInTheDocument()
  })
})

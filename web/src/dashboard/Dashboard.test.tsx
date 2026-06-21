// web/src/dashboard/Dashboard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  it('renders the readout verdict and the graph', () => {
    render(<Dashboard />)
    expect(screen.getByText('FAIL')).toBeInTheDocument()
    expect(screen.getAllByText(/normalize_dates/).length).toBeGreaterThan(0)
  })

  it('selecting a node updates the inspector', () => {
    render(<Dashboard />)
    // a1 is the normalize_dates action (a0 = plan). Click it.
    fireEvent.click(screen.getByTestId('node-a1'))
    // inspector now shows the focused step's output
    expect(screen.getAllByText(/2024-12-07/).length).toBeGreaterThan(0)
  })

  it('replaying with the fix flips the verdict to PASS', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a1'))
    fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))
    expect(await screen.findByText('PASS')).toBeInTheDocument()
  })
})

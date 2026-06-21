// web/src/dashboard/Dashboard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Dashboard } from './Dashboard'

// The multi-agent stub (Accounts-Payable overpayment):
//   root cause s2 lives in node a1 (extractor OCR misread); s1+s2 merge into a1.
//   the fraud decoy s8 lives in node a5 (risk_score; s7+s8 merge into a5).

describe('Dashboard', () => {
  it('renders the readout verdict and the trace spine', () => {
    render(<Dashboard />)
    expect(screen.getByText('FAIL')).toBeInTheDocument()
    // the spine shows the extractor's ocr_extract step label
    expect(screen.getAllByText(/ocr_extract/).length).toBeGreaterThan(0)
  })

  it('selecting a node updates the inspector', () => {
    render(<Dashboard />)
    // a1 is the extractor OCR result (s2) — the root cause; pre-selected on first paint.
    // Clicking it confirms the inspector shows s2's misread raw_text "1,240.00".
    fireEvent.click(screen.getByTestId('node-a1'))
    // Scope to the inspector aside so we prove the INSPECTOR reacted to selection.
    const inspector = screen.getByRole('complementary')
    expect(within(inspector).getAllByText(/1,240\.00/).length).toBeGreaterThan(0)
  })

  it('replaying the root candidate flips the verdict to PASS (trusted)', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a1')) // the true root (extractor OCR, s2)
    fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))
    // The scripted climax (decoy → re-target → root) lands on confirm after ~2.2s:
    // the verdict flips and the oracle becomes TRUSTED.
    expect(await screen.findByText('PASS', {}, { timeout: 3500 })).toBeInTheDocument()
    expect(await screen.findByText('TRUSTED', {}, { timeout: 3500 })).toBeInTheDocument()
  }, 6000)

  it('replaying a decoy candidate does NOT flip the verdict (rejection beat)', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByTestId('node-a5')) // the fraud decoy (risk_score, s8)
    fireEvent.click(screen.getByRole('button', { name: /replay candidate/i }))
    // verdict stays FAIL; the focused decoy step does not flip the outcome
    expect(await screen.findByText('FAIL')).toBeInTheDocument()
    expect(screen.queryByText('PASS')).not.toBeInTheDocument()
  })
})

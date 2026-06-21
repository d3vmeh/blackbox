import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ScenarioToolbar } from './ScenarioToolbar'

describe('ScenarioToolbar', () => {
  const scenarios = [
    { name: 'claim_adjudication', label: 'insurance · claim adjudication' },
    { name: 'prior_auth', label: 'clinical · prior authorization' },
  ]

  it('opens the menu and selects a scenario', async () => {
    const onPick = vi.fn()
    render(
      <ScenarioToolbar
        scenarios={scenarios}
        picked="claim_adjudication"
        loaded="claim_adjudication"
        onPick={onPick}
        onRun={() => {}}
        loading={false}
        error={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Choose scenario' }))
    fireEvent.click(screen.getByRole('button', { name: /clinical · prior authorization/i }))
    expect(onPick).toHaveBeenCalledWith('prior_auth')
  })

  it('shows pending hint when picked differs from loaded', () => {
    render(
      <ScenarioToolbar
        scenarios={scenarios}
        picked="prior_auth"
        loaded="claim_adjudication"
        onPick={() => {}}
        onRun={() => {}}
        loading={false}
        error={null}
      />,
    )
    expect(screen.getByText(/not loaded/i)).toBeInTheDocument()
  })
})

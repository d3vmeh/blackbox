// web/src/dashboard/MonitorPanel.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonitorPanel, type MonitorLine } from './MonitorPanel'

const LINES: MonitorLine[] = [
  { text: '◉ localizing…' },
  { text: 'replay s8 0/5', tone: 'reject' },
  { text: 'replay s2 5/5', tone: 'pass' },
]

describe('MonitorPanel', () => {
  it('renders the play-by-play lines when open', () => {
    render(<MonitorPanel open lines={LINES} trust="proving" />)
    expect(screen.getByTestId('monitor-panel')).toBeInTheDocument()
    expect(screen.getByText('◉ localizing…')).toBeInTheDocument()
    expect(screen.getByText('replay s8 0/5')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(<MonitorPanel open={false} lines={LINES} trust="untrusted" />)
    expect(screen.queryByTestId('monitor-panel')).not.toBeInTheDocument()
    expect(screen.queryByText('◉ localizing…')).not.toBeInTheDocument()
  })

  it('surfaces a pass-tone line and a trusted trust line when trusted', () => {
    render(<MonitorPanel open lines={LINES} trust="trusted" />)
    const passLine = screen.getByText('replay s2 5/5')
    expect(passLine).toHaveAttribute('data-tone', 'pass')
    expect(screen.getByText('trusted')).toBeInTheDocument()
  })
})

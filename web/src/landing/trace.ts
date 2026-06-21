/**
 * Mock trace for the landing-page instrument ONLY. The real app consumes the
 * backend contracts in ../types.ts; this is a hand-authored demo of a failed
 * flight-booking agent run used to drive the hero animation.
 */

export type StepStatus = 'neutral' | 'root' | 'blast' | 'pass'

export interface DemoStep {
  id: string
  kind: 'reason' | 'tool_call' | 'tool_result' | 'decision' | 'final'
  /** short mono label shown in the spine */
  label: string
}

export const DEMO_TRACE: DemoStep[] = [
  { id: 's0', kind: 'reason', label: 'parse_request("SFO→NRT, depart 03/04")' },
  { id: 's1', kind: 'tool_call', label: 'search_flights(SFO, NRT)' },
  { id: 's2', kind: 'tool_result', label: '42 fares returned' },
  { id: 's3', kind: 'decision', label: 'rank by price + duration' },
  { id: 's4', kind: 'reason', label: 'resolve_date("03/04") → 2026-04-03' },
  { id: 's5', kind: 'tool_call', label: 'hold_seat(date=2026-04-03)' },
  { id: 's6', kind: 'tool_result', label: 'seat held · APR 3' },
  { id: 's7', kind: 'tool_call', label: 'charge_card($1,284.00)' },
  { id: 's8', kind: 'tool_result', label: 'booking JX-90412 confirmed' },
  { id: 's9', kind: 'reason', label: 'draft_itinerary()' },
  { id: 's10', kind: 'final', label: 'send_confirmation(user)' },
]

/** The one earliest-wrong step: it read "03/04" (Mar 4) as Apr 3. */
export const ROOT_INDEX = 4
/** Forward slice: everything downstream that inherited the wrong date. */
export const BLAST_END = 10

export type Phase = 'idle' | 'blast' | 'analyze' | 'confirm'

/** What the readout status line says during each beat. */
export const PHASE_STATUS: Record<Phase, string> = {
  idle: 'trace recorded · awaiting analysis',
  blast: 'tracing blast radius…',
  analyze: 'localizing root cause…',
  confirm: 'fix confirmed · fail → pass',
}

export function statusFor(index: number, phase: Phase): StepStatus {
  const inBlast = index > ROOT_INDEX && index <= BLAST_END
  switch (phase) {
    case 'idle':
      return 'neutral'
    case 'blast':
    case 'analyze':
      if (index === ROOT_INDEX) return 'root'
      return inBlast ? 'blast' : 'neutral'
    case 'confirm':
      return index === ROOT_INDEX || inBlast ? 'pass' : 'neutral'
  }
}

/** Stagger delay (ms) so the poison cascades forward and the heal sweeps down. */
export function delayFor(index: number, phase: Phase, staggerMs: number): number {
  if (phase === 'blast' || phase === 'confirm') {
    const offset = index - ROOT_INDEX
    return offset > 0 ? offset * staggerMs : 0
  }
  return 0
}

/**
 * Landing-page demo spine — mirrors shared/fixtures/flight_run/trace.json
 * (LangGraph flight agent + injected parse_date fault). Keep ROOT_INDEX /
 * BLAST_END in sync with agent.flight.export_run.
 */

export type StepStatus = 'neutral' | 'root' | 'blast' | 'pass'

export interface DemoStep {
  id: string
  kind: 'reason' | 'tool_call' | 'tool_result' | 'decision' | 'final'
  /** short mono label shown in the spine */
  label: string
}

export const DEMO_TRACE: DemoStep[] = [
  { id: 's1', kind: 'reason', label: 'plan("AUS · Jul 12 · under $500")' },
  { id: 's2', kind: 'tool_call', label: 'search_flights(AUS, 2026-07-12)' },
  { id: 's3', kind: 'tool_result', label: 'UA-441 @ $412 · depart 2026-07-12' },
  { id: 's4', kind: 'reason', label: 'parse_date(raw) → 2026-12-07' },
  { id: 's5', kind: 'decision', label: 'select UA-441 for 2026-12-07' },
  { id: 's6', kind: 'tool_call', label: 'check_budget(412, cap=500)' },
  { id: 's7', kind: 'tool_result', label: 'budget ok' },
  { id: 's8', kind: 'tool_call', label: 'book_flight(UA-441 · 2026-12-07)' },
  { id: 's9', kind: 'reason', label: 'compose_email(depart 2026-12-07)' },
  { id: 's10', kind: 'final', label: 'send_itinerary(6 recipients)' },
]

/** parse_date (s4) — earliest wrong step in flight_run. */
export const ROOT_INDEX = 3
/** Forward slice through send_itinerary (s10). */
export const BLAST_END = 9

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

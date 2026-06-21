/**
 * Landing-page demo spine — mirrors shared/fixtures/claim_adjudication/trace.json
 * (insurance claims multi-agent pipeline + injected INTAKE amount fault).
 * Keep ROOT_INDEX / BLAST_END in sync with agent.ap.export_run.
 */

export type StepStatus = 'neutral' | 'root' | 'blast' | 'pass'

export interface DemoStep {
  id: string
  kind: 'reason' | 'tool_call' | 'tool_result' | 'decision' | 'final'
  /** short mono label shown in the spine */
  label: string
}

export const DEMO_TRACE: DemoStep[] = [
  { id: 's1', kind: 'tool_result', label: 'INTAKE parse claim → billed_amount $52,000' },
  { id: 's2', kind: 'decision', label: 'COVERAGE gold tier · approve up to limit' },
  { id: 's3', kind: 'decision', label: 'FRAUD risk 0.12 · flagged, overridden' },
  { id: 's4', kind: 'decision', label: 'ADJUSTER merge → payout $52,000' },
  { id: 's5', kind: 'final', label: 'PAYOUT rail · oracle FAIL (exceeds tier cap)' },
]

/** INTAKE (s1) — earliest corrupted hand-off. */
export const ROOT_INDEX = 0
/** Forward slice through PAYOUT (s5). */
export const BLAST_END = 4

export type Phase = 'idle' | 'blast' | 'analyze' | 'confirm'

/** What the readout status line says during each beat. */
export const PHASE_STATUS: Record<Phase, string> = {
  idle: 'trace recorded · awaiting analysis',
  blast: 'tracing blast radius across agents…',
  analyze: 'localizing earliest corrupted hand-off…',
  confirm: 'replay confirmed · fail → pass',
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

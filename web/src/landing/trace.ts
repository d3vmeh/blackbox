/**
 * Landing-page demo spine — mirrors shared/fixtures/claim_run/trace.json
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
  { id: 's1', kind: 'tool_result', label: 'INTAKE read claim → amount $42,000' },
  { id: 's2', kind: 'decision', label: 'COVERAGE verify policy · amount passes' },
  { id: 's3', kind: 'decision', label: 'FRAUD risk check · low risk' },
  { id: 's4', kind: 'decision', label: 'ADJUDICATOR approve $42,000 payout' },
  { id: 's5', kind: 'final', label: 'PAYOUT sent to Acme Corp · oracle FAIL' },
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

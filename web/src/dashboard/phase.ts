import type { NodeStatus } from './types'
import type { ReplayResult } from '../types'

export type Phase = 'idle' | 'blast' | 'analyze' | 'confirm' | 'rejected'

export const PHASE_STATUS: Record<Phase, string> = {
  idle: 'trace recorded · awaiting analysis',
  blast: 'tracing blast radius…',
  analyze: 'localizing root cause…',
  confirm: 'fix confirmed · fail → pass',
  rejected: 'candidate rejected · no flip',
}

export function displayStatus(base: NodeStatus, phase: Phase): NodeStatus {
  if (phase === 'idle') return 'neutral'
  if (phase === 'confirm' && (base === 'root' || base === 'blast')) return 'pass'
  return base
}

export function phaseForReplay(result: ReplayResult): Phase {
  return result.flipped ? 'confirm' : 'rejected'
}

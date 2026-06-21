import type { NodeStatus, TrustState } from './types'
import type { ReplayResult } from '../types'

/**
 * The dashboard's beat machine:
 *   idle → blast → analyze → proving_decoy → proving_root → confirm
 * with `rejected` as the terminal state of a non-flipping replay.
 *
 * `proving_decoy` and `proving_root` are the two halves of the climax: the
 * monitor replays the decoy first (it must NOT flip — neutral rejected state),
 * then visibly re-targets the true root and replays it (which flips).
 */
export type Phase =
  | 'idle'
  | 'blast'
  | 'analyze'
  | 'proving_decoy'
  | 'proving_root'
  | 'confirm'
  | 'rejected'

export const PHASE_STATUS: Record<Phase, string> = {
  idle: 'trace recorded · awaiting analysis',
  blast: 'tracing blast radius…',
  analyze: 'localizing root cause…',
  proving_decoy: 'replaying decoy · no flip',
  proving_root: 'replaying root cause…',
  confirm: 'fix confirmed · fail → pass',
  rejected: 'candidate rejected · no flip',
}

/** TrustBadge state for each phase: it only becomes trusted on the confirmed flip. */
export const PHASE_TRUST: Record<Phase, TrustState> = {
  idle: 'untrusted',
  blast: 'untrusted',
  analyze: 'untrusted',
  proving_decoy: 'proving',
  proving_root: 'proving',
  confirm: 'trusted',
  rejected: 'untrusted',
}

export function trustForPhase(phase: Phase): TrustState {
  return PHASE_TRUST[phase]
}

export function displayStatus(base: NodeStatus, phase: Phase): NodeStatus {
  if (phase === 'idle') return 'neutral'
  // In the split-view fork, the original nodes keep their fault coloring during
  // confirm — they are the "before". The fork column shows the "after" (pass).
  return base
}

export function phaseForReplay(result: ReplayResult): Phase {
  return result.flipped ? 'confirm' : 'rejected'
}

import type { MonitorDecision, ReplayResult } from '../../types'

/**
 * STUB monitor decision for the Accounts-Payable overpayment trace
 * (see stubMultiAgentTrace.ts). The monitor replayed the corrected extractor
 * output (s2: $12,400.00 → $1,240.00); every re-run flipped fail→pass, so the
 * fix is trusted and can auto-apply.
 *
 * COORDINATION: MonitorDecision is a frontend-only mirror until shared/schema.py
 * gains the matching model via a coordinated backend PR (see types.ts).
 */
const ROOT_REPLAY: ReplayResult = {
  trace_id: 'ap_overpay',
  step_id: 's2',
  injected_value: { amount: 124000, currency: 'USD', raw_text: '1,240.00', confidence: 0.99 },
  n: 5,
  flipped: true,
  confirmation_rate: 1,
  outcomes: [true, true, true, true, true],
}

export const STUB_MONITOR_DECISION: MonitorDecision = {
  trace_id: 'ap_overpay',
  root_step_id: 's2',
  replay: ROOT_REPLAY,
  trusted: true,
  decision: 'auto_apply',
}

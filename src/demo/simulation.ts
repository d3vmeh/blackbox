export type StepStatus = 'ok' | 'fail' | 'intervened'
export type DemoMode = 'unprotected' | 'protected'

export interface DemoStep {
  id: number
  label: string
  detail: string
  status: StepStatus
  costDelta: number
  failureClass?: string
  responderAction?: string
  ledgerNote?: string
}

const UNPROTECTED_STEPS: DemoStep[] = [
  { id: 1, label: 'plan_task', detail: 'Decompose user request into tool plan', status: 'ok', costDelta: 0.012 },
  { id: 2, label: 'search_docs', detail: 'Retrieved 3 relevant passages', status: 'ok', costDelta: 0.018 },
  {
    id: 3,
    label: 'call_tool: get_weather_forecast_extended',
    detail: 'Tool not in schema — hallucinated name',
    status: 'fail',
    costDelta: 0.042,
  },
  {
    id: 4,
    label: 'retry: get_weather_forecast_extended',
    detail: 'Identical retry, same invalid tool',
    status: 'fail',
    costDelta: 0.048,
  },
  {
    id: 5,
    label: 'call_tool: check_inventory',
    detail: 'Response: "may be available, try again"',
    status: 'fail',
    costDelta: 0.055,
  },
  {
    id: 6,
    label: 'retry: check_inventory',
    detail: 'Ambiguous response triggered another loop',
    status: 'fail',
    costDelta: 0.062,
  },
  { id: 7, label: 'retry: check_inventory', detail: 'Third attempt, still ambiguous', status: 'fail', costDelta: 0.068 },
  { id: 8, label: 'finalize', detail: 'Partial answer with low confidence', status: 'ok', costDelta: 0.075 },
]

const PROTECTED_STEPS: DemoStep[] = [
  { id: 1, label: 'plan_task', detail: 'Decompose user request into tool plan', status: 'ok', costDelta: 0.012 },
  { id: 2, label: 'search_docs', detail: 'Retrieved 3 relevant passages', status: 'ok', costDelta: 0.018 },
  {
    id: 3,
    label: 'call_tool: get_weather_forecast_extended',
    detail: 'Blocked pre-execution — tool not in schema',
    status: 'intervened',
    costDelta: 0.022,
    failureClass: 'hallucinated_tool',
    responderAction: 'Blocked call · reinjected tool schema',
    ledgerNote: 'Saved ~$0.04 vs blind retry',
  },
  {
    id: 4,
    label: 'call_tool: get_weather',
    detail: 'Valid tool selected after schema reinjection',
    status: 'ok',
    costDelta: 0.028,
  },
  {
    id: 5,
    label: 'call_tool: check_inventory',
    detail: 'Ambiguous vendor response detected',
    status: 'intervened',
    costDelta: 0.034,
    failureClass: 'ambiguous_feedback_loop',
    responderAction: 'Rewrote response → FAILED (terminal)',
    ledgerNote: 'Stopped retry loop early',
  },
  {
    id: 6,
    label: 'fallback: cached_inventory',
    detail: 'Strategy switch after terminal failure',
    status: 'ok',
    costDelta: 0.041,
  },
  { id: 7, label: 'synthesize', detail: 'Merged weather + inventory context', status: 'ok', costDelta: 0.048 },
  { id: 8, label: 'finalize', detail: 'Complete answer delivered', status: 'ok', costDelta: 0.055 },
]

export function getSteps(mode: DemoMode): DemoStep[] {
  return mode === 'protected' ? PROTECTED_STEPS : UNPROTECTED_STEPS
}

export function getSummary(mode: DemoMode) {
  if (mode === 'protected') {
    return {
      total: 0.12,
      calls: 6,
      saved: 0.35,
      savedPct: 74,
      label: 'Fuse Breaker ON',
    }
  }
  return {
    total: 0.47,
    calls: 14,
    saved: 0,
    savedPct: 0,
    label: 'Unprotected',
  }
}

export const RECENT_RUNS = [
  { id: 'vendor-schema-drift', title: 'Vendor schema drift watch', time: '2m', status: 'armed' },
  { id: 'factor-decay', title: 'Momentum factor decay', time: '18m', status: 'done' },
  { id: 'eod-recon', title: 'EOD recon', time: '21:34', status: 'done' },
  { id: 'support-triage', title: 'Support triage loop', time: '1h', status: 'failed' },
]

export const AUDIT_LOG = [
  { who: 'classifier', action: 'hallucinated_tool', target: 'step 3', time: '09:42' },
  { who: 'responder', action: 'block + reinject schema', target: 'get_weather', time: '09:42' },
  { who: 'classifier', action: 'ambiguous_feedback_loop', target: 'step 5', time: '09:43' },
  { who: 'responder', action: 'terminal FAILED rewrite', target: 'check_inventory', time: '09:43' },
  { who: 'ledger', action: 'receipt emitted', target: '$0.35 saved', time: '09:43' },
]

export const TAXONOMY = [
  {
    class: 'hallucinated_tool',
    detect: 'Validate against live schema',
    fix: 'Block + reinject tool list',
  },
  {
    class: 'ambiguous_feedback_loop',
    detect: 'Pattern-match soft retry language',
    fix: 'Rewrite to SUCCESS / FAILED',
  },
  {
    class: 'non_convergent_repeat',
    detect: 'Same args + error vs history',
    fix: 'Strategy switch / cheaper model',
  },
  {
    class: 'context_rot_confusion',
    detect: 'Past long-horizon threshold',
    fix: 'Trigger compaction',
  },
]

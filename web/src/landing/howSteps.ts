export type StepTone = 'record' | 'root' | 'blast' | 'pass' | 'trust'

export const HOW_STEPS: ReadonlyArray<{
  no: string
  tone: StepTone
  title: string
  body: string
}> = [
  { no: '01', tone: 'record', title: 'Record', body: 'Capture the multi-agent run as one causal graph — every reasoning step, tool call, and hand-off payload passed between agents.' },
  { no: '02', tone: 'root', title: 'Localize', body: 'Find the earliest agent whose output is wrong given its own inputs — and the corrupted hand-off it propagated. Not where the run finally crashed.' },
  { no: '03', tone: 'blast', title: 'Blast radius', body: 'Slice the graph forward across agent boundaries — every later step, in any agent, that trusted the corrupted value.' },
  { no: '04', tone: 'pass', title: 'Confirm', body: 'Fork at the root, inject the corrected value, and re-run. Fail → pass confirms it; a decoy that doesn’t flip is rejected.' },
  { no: '05', tone: 'trust', title: 'Supervise', body: 'Only a replay-proven fix is trusted. The monitor auto-heals the run, or escalates to a human with a structured correction.' },
]

export type HowStep = (typeof HOW_STEPS)[number]

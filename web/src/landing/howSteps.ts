export type StepTone = 'record' | 'root' | 'blast' | 'pass' | 'trust'

export const HOW_STEPS: ReadonlyArray<{
  no: string
  tone: StepTone
  title: string
  body: string
  /** Label for the Figma export / mockup slot on this slide. */
  mockupLabel: string
  /** One-line art direction for Figma — paste into your prompt. */
  figmaBrief: string
}> = [
  {
    no: '01',
    tone: 'record',
    title: 'Record',
    body: 'Capture the multi-agent run as one causal graph — every reasoning step, tool call, and hand-off payload passed between agents.',
    mockupLabel: 'claim_adjudication · trace graph',
    figmaBrief: 'Dashboard with 5-agent pipeline (INTAKE→COVERAGE∥FRAUD→ADJUDICATOR→PAYOUT), all nodes neutral gray, oracle FAIL, log wall visible.',
  },
  {
    no: '02',
    tone: 'root',
    title: 'Localize',
    body: 'Find the earliest agent whose output is wrong given its own inputs — and the corrupted hand-off it propagated. Not where the run finally crashed.',
    mockupLabel: 'INTAKE root cause',
    figmaBrief: 'Same dashboard; INTAKE node amber (--root), inspector shows amount 42000 vs 4200, “ROOT CAUSE” badge.',
  },
  {
    no: '03',
    tone: 'blast',
    title: 'Blast radius',
    body: 'Slice the graph forward across agent boundaries — every later step, in any agent, that trusted the corrupted value.',
    mockupLabel: 'downstream poison',
    figmaBrief: 'Graph cascade: COVERAGE→PAYOUT nodes with rose blast color (--blast), poison edges between agents.',
  },
  {
    no: '04',
    tone: 'pass',
    title: 'Confirm',
    body: 'Fork at the root, inject the corrected value, and re-run. Fail → pass confirms it; a decoy that doesn’t flip is rejected.',
    mockupLabel: 'replay confirmed',
    figmaBrief: 'Split beat optional: left panel decoy ADJUDICATOR replay still FAIL; right panel INTAKE replay → PASS (sage --pass).',
  },
  {
    no: '05',
    tone: 'trust',
    title: 'Supervise',
    body: 'Only a replay-proven fix is trusted. The monitor auto-heals the run, or escalates to a human with a structured correction.',
    mockupLabel: 'trust gate · auto_apply',
    figmaBrief: 'Readout bar: PASS + pill “trust gate · auto_apply”, all agents green, payout $4,200 correct.',
  },
]

export type HowStep = (typeof HOW_STEPS)[number]

/** Figma canvas spec — export each frame at 2× for retina. */
export const FIGMA_SPEC = {
  frameWidth: 1280,
  frameHeight: 800,
  browserChromeHeight: 40,
  safePadding: 24,
  background: '#0A0C10',
  accentRoot: '#D9954A',
  accentBlast: '#D75C6C',
  accentPass: '#4FB98C',
} as const

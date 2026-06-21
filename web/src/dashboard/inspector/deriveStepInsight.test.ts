import { describe, expect, it } from 'vitest'
import { loadFixtureTrace } from '../data/loadFixture'
import { STUB_ATTRIBUTION } from '../data/stubAttribution'
import type { RunMeta } from '../data/loadMeta'
import { deriveStepInsight } from './deriveStepInsight'

describe('deriveStepInsight — claim_adjudication', () => {
  const trace = loadFixtureTrace()
  const meta: RunMeta = { runtime: 'multi-agent', engine: '5-agent pipeline', scenario: 'claim_adjudication' }

  it('root INTAKE shows billed_amount bad vs good', () => {
    const step = trace.steps.find((s) => s.id === 's1')!
    const insight = deriveStepInsight(step, trace.steps, STUB_ATTRIBUTION, meta)
    expect(insight.role).toBe('root')
    expect(insight.agentLabel).toBe('INTAKE')
    expect(insight.diffs).toEqual([
      { key: 'billed_amount', bad: '52000', good: '5200' },
    ])
  })

  it('coverage shows inherited poison, not local fault', () => {
    const step = trace.steps.find((s) => s.id === 's2')!
    const insight = deriveStepInsight(step, trace.steps, STUB_ATTRIBUTION, meta)
    expect(insight.role).toBe('blast')
    expect(insight.diffs[0]?.key).toBe('billed_amount')
    expect(insight.diffs[0]?.bad).toBe('52000')
  })

  it('adjuster decoy reads differently from intake', () => {
    const intake = deriveStepInsight(trace.steps[0], trace.steps, STUB_ATTRIBUTION, meta)
    const adjuster = deriveStepInsight(trace.steps[3], trace.steps, STUB_ATTRIBUTION, meta)
    expect(intake.role).toBe('root')
    expect(adjuster.role).toBe('decoy')
    expect(adjuster.headline).toMatch(/ADJUSTER/i)
  })

  it('payout surfaces oracle symptom', () => {
    const step = trace.steps.find((s) => s.id === 's5')!
    const insight = deriveStepInsight(step, trace.steps, STUB_ATTRIBUTION, meta)
    expect(insight.role).toBe('symptom')
    expect(insight.headline).toMatch(/tier|52/i)
  })
})

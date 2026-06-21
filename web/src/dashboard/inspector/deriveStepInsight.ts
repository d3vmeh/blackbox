import type { Attribution, Json, Step } from '../../types'
import { SCENARIO_MANIFEST } from '../../scenarios/manifest'
import type { RunMeta } from '../data/loadMeta'

export type StepRole = 'root' | 'blast' | 'decoy' | 'symptom' | 'clean'

export interface FieldDiff {
  key: string
  bad: string
  good: string
}

export interface StepInsight {
  role: StepRole
  agentId: string
  agentLabel: string
  agentRole: string
  headline: string
  diffs: FieldDiff[]
  problemNote: string
  solutionNote: string
}

function fmt(v: Json | undefined): string {
  if (v === undefined || v === null) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function objectDiffs(bad: Json, good: Json): FieldDiff[] {
  if (typeof bad !== 'object' || bad === null || Array.isArray(bad)) return []
  if (typeof good !== 'object' || good === null || Array.isArray(good)) return []
  const keys = new Set([...Object.keys(bad), ...Object.keys(good)])
  const diffs: FieldDiff[] = []
  for (const key of keys) {
    const b = (bad as Record<string, Json>)[key]
    const g = (good as Record<string, Json>)[key]
    if (JSON.stringify(b) !== JSON.stringify(g)) {
      diffs.push({ key, bad: fmt(b), good: fmt(g) })
    }
  }
  return diffs
}

function agentMeta(scenarioId: string | undefined, agentId: string) {
  const manifest = SCENARIO_MANIFEST.find((s) => s.id === scenarioId)
  const agent = manifest?.agents.find((a) => a.id === agentId)
  return {
    label: agent?.label ?? agentId.toUpperCase(),
    role: agent?.role ?? 'Pipeline agent',
    fault: manifest?.fault,
    decoy: manifest?.decoy,
    tagline: manifest?.tagline,
  }
}

function rootStep(steps: Step[], attribution: Attribution): Step | undefined {
  return steps.find((s) => s.id === attribution.root_step_id)
}

function inheritedPoison(
  step: Step,
  root: Step,
  attribution: Attribution,
  fixField: string,
): { field: string; bad: string; good: string } | null {
  const rootAgent = typeof root.raw.agent === 'string' ? root.raw.agent : null
  if (!rootAgent) return null
  const up = step.state?.up as Record<string, Record<string, Json>> | undefined
  const intake = up?.[rootAgent]
  if (!intake || !(fixField in intake)) return null
  const bad = intake[fixField]
  const good =
    root.correct_output && typeof root.correct_output === 'object' && !Array.isArray(root.correct_output)
      ? (root.correct_output as Record<string, Json>)[fixField]
      : attribution.suggested_fix && typeof attribution.suggested_fix === 'object' && !Array.isArray(attribution.suggested_fix)
        ? (attribution.suggested_fix as Record<string, Json>)[fixField]
        : undefined
  if (good === undefined || JSON.stringify(bad) === JSON.stringify(good)) return null
  return { field: fixField, bad: fmt(bad), good: fmt(good) }
}

export function deriveStepInsight(
  step: Step,
  steps: Step[],
  attribution: Attribution,
  runMeta?: RunMeta,
): StepInsight {
  const agentId = typeof step.raw.agent === 'string' ? step.raw.agent : 'agent'
  const meta = agentMeta(runMeta?.scenario, agentId)
  const agentLabel = String(step.raw.display ?? meta.label)
  const isRoot = step.id === attribution.root_step_id
  const decoyCandidate =
    attribution.candidates[1]?.step_id === step.id ? attribution.candidates[1] : undefined
  const isBlast = !isRoot && attribution.blast_radius.includes(step.id)
  const isFinal = step.kind === 'final'
  const root = rootStep(steps, attribution)
  const fixField =
    attribution.suggested_fix && typeof attribution.suggested_fix === 'object' && !Array.isArray(attribution.suggested_fix)
      ? Object.keys(attribution.suggested_fix as Record<string, Json>)[0]
      : meta.fault?.field ?? 'value'

  let role: StepRole = 'clean'
  if (isRoot) role = 'root'
  else if (decoyCandidate) role = 'decoy'
  else if (isFinal && !isRoot) role = 'symptom'
  else if (isBlast) role = 'blast'

  let diffs: FieldDiff[] = []
  if (step.is_injected_fault && step.correct_output != null) {
    diffs = objectDiffs(step.output, step.correct_output)
  } else if (step.correct_output != null) {
    diffs = objectDiffs(step.output, step.correct_output)
  }

  const candidate = attribution.candidates.find((c) => c.step_id === step.id)
  const poison = root ? inheritedPoison(step, root, attribution, fixField) : null
  const fixValue =
    attribution.suggested_fix && typeof attribution.suggested_fix === 'object' && !Array.isArray(attribution.suggested_fix)
      ? (attribution.suggested_fix as Record<string, Json>)[fixField]
      : attribution.suggested_fix

  switch (role) {
    case 'root':
      return {
        role,
        agentId,
        agentLabel,
        agentRole: meta.role,
        headline: candidate?.reason ?? 'Earliest corrupted hand-off',
        diffs,
        problemNote: diffs.length
          ? `This agent wrote the bad value that poisoned every downstream hand-off.`
          : fmt(step.output),
        solutionNote: attribution.suggested_fix
          ? `Replay injects ${fixField}=${fmt(fixValue)} at this step — oracle flips FAIL to PASS.`
          : 'Inject the corrected hand-off and re-run from this checkpoint.',
      }

    case 'blast':
      return {
        role,
        agentId,
        agentLabel,
        agentRole: meta.role,
        headline: 'Inherited the corrupted hand-off',
        diffs: poison ? [{ key: poison.field, bad: poison.bad, good: poison.good }] : diffs,
        problemNote: poison
          ? `${meta.fault?.agent?.toUpperCase() ?? 'Upstream'} passed ${poison.field}=${poison.bad}. This agent's own logic ran correctly on bad inputs.`
          : 'Downstream of the root fault — output reflects poisoned upstream state.',
        solutionNote: `Fix ${meta.fault?.agent ?? 'the root agent'} (${fixField}) — this step heals automatically when upstream is corrected.`,
      }

    case 'decoy':
      return {
        role,
        agentId,
        agentLabel,
        agentRole: meta.role,
        headline: decoyCandidate?.reason ?? 'Plausible suspect — not the root',
        diffs,
        problemNote: meta.decoy?.symptom ?? 'Looks suspicious in the trace, but replay here does not flip the oracle.',
        solutionNote: 'Monitor replays this candidate first → 0/n confirmation → re-targets to the true root.',
      }

    case 'symptom':
      return {
        role,
        agentId,
        agentLabel,
        agentRole: meta.role,
        headline: attribution.rationale || 'Oracle failure surfaces here',
        diffs,
        problemNote: `Final agent output triggers FAIL: ${fmt(step.output)}`,
        solutionNote: `Symptom only — root cause is ${meta.fault?.agent?.toUpperCase() ?? 'upstream'}. Fix there to heal this step.`,
      }

    default:
      return {
        role: 'clean',
        agentId,
        agentLabel,
        agentRole: meta.role,
        headline: 'Agent output looks consistent',
        diffs,
        problemNote: diffs.length
          ? 'Local output differs from reference, but this step is not ranked as root or blast.'
          : `${agentLabel} produced ${fmt(step.output)} — no localized suspicion on this step.`,
        solutionNote: poison
          ? `Inherited ${poison.field}=${poison.bad} in pipeline state, but this agent is not the fix site.`
          : 'Select INTAKE / the root agent to see the fault and replay fix.',
      }
  }
}

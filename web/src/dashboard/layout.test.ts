import { describe, it, expect } from 'vitest'
import { layout, STEP_Y, BAND_GAP, GUTTER_W, LANE_X, NODE_H } from './layout'
import { deriveBands } from './deriveBands'
import type { ActionGraph } from './types'
import type { StatusMap } from './nodeStatus'

// extractor (a0,a1) → matcher (a2) → handoff (a3, matcher→fraud) → fraud (a4)
const graph: ActionGraph = {
  nodes: [
    { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan', lane: 'reason', agentId: 'extractor' },
    { id: 'a1', stepIds: ['s1'], kind: 'tool_call', label: 'read', lane: 'tool', agentId: 'extractor' },
    { id: 'a2', stepIds: ['s2'], kind: 'tool_call', label: 'match', lane: 'tool', agentId: 'matcher' },
    { id: 'a3', stepIds: ['s3'], kind: 'handoff', label: 'handoff', lane: 'reason', agentId: 'matcher' },
    { id: 'a4', stepIds: ['s4'], kind: 'decision', label: 'score', lane: 'parallel', agentId: 'fraud' },
  ],
  edges: [
    { from: 'a0', to: 'a1', longHop: false }, // intra extractor
    { from: 'a1', to: 'a2', longHop: false }, // cross extractor→matcher
    { from: 'a2', to: 'a3', longHop: false }, // intra matcher (a3 is handoff kind → cross)
    { from: 'a3', to: 'a4', longHop: false }, // cross matcher→fraud (handoff kind)
  ],
}
const status: StatusMap = { a0: 'neutral', a1: 'neutral', a2: 'root', a3: 'neutral', a4: 'neutral' }

describe('layout — band-aware', () => {
  it('produces one BandLayout per deriveBands band', () => {
    const l = layout(graph, status)
    expect(l.bands.length).toBe(deriveBands(graph).length)
  })

  it('keeps STEP_Y spacing within a band and adds BAND_GAP between bands', () => {
    const l = layout(graph, status)
    const y = (id: string) => l.positions.find((p) => p.id === id)!.y
    // intra-band (extractor a0→a1)
    expect(y('a1') - y('a0')).toBe(STEP_Y)
    // inter-band (extractor a1 → matcher a2)
    expect(y('a2') - y('a1')).toBe(STEP_Y + BAND_GAP)
  })

  it('offsets node x by GUTTER_W on top of the lane x', () => {
    const l = layout(graph, status)
    const a0 = l.positions.find((p) => p.id === 'a0')!
    expect(a0.x).toBe(GUTTER_W + LANE_X.reason)
    const a4 = l.positions.find((p) => p.id === 'a4')!
    expect(a4.x).toBe(GUTTER_W + LANE_X.parallel)
  })

  it('records a separator between each pair of bands at the gap midpoint', () => {
    const l = layout(graph, status)
    expect(l.separators.length).toBe(l.bands.length - 1)
    // first separator lands between extractor band bottom and matcher band top
    const extractor = l.bands.find((b) => b.agentId === 'extractor')!
    const matcher = l.bands.find((b) => b.agentId === 'matcher')!
    const sep = l.separators[0]
    expect(sep.y).toBeGreaterThan(extractor.bottom - NODE_H)
    expect(sep.y).toBeLessThan(matcher.top)
  })

  it('flags crossAgent edges when endpoints differ or touch a handoff node', () => {
    const l = layout(graph, status)
    const edge = (from: string, to: string) => l.edges.find((e) => e.from === from && e.to === to)!
    expect(edge('a0', 'a1').crossAgent).toBe(false) // intra extractor
    expect(edge('a1', 'a2').crossAgent).toBe(true) // extractor → matcher
    expect(edge('a2', 'a3').crossAgent).toBe(true) // a3 is handoff kind
    expect(edge('a3', 'a4').crossAgent).toBe(true) // matcher → fraud + handoff
  })

  it('marks isRoot on the band containing the root-status node', () => {
    const l = layout(graph, status)
    const matcher = l.bands.find((b) => b.agentId === 'matcher')!
    const extractor = l.bands.find((b) => b.agentId === 'extractor')!
    expect(matcher.isRoot).toBe(true)
    expect(extractor.isRoot).toBe(false)
  })
})

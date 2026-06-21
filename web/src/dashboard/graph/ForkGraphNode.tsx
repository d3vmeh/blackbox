// web/src/dashboard/graph/ForkGraphNode.tsx
// A node in the corrected fork branch — always rendered with --pass styling.
// Shows a ✓ check and the corrected label. The root-cause fork node also
// previews the injected corrected output.
import type { ForkNode } from '../types'
import type { Json } from '../../types'

const KIND_TAG: Record<string, string> = {
  reason: 'RSN', tool_call: 'TOOL', tool_result: 'TOOL', decision: 'DEC', final: 'FIN',
  handoff: 'HOFF',
}

function OutputPreview({ output }: { output: Json }) {
  if (output === null || output === undefined) return null
  if (typeof output === 'object' && !Array.isArray(output)) {
    const entries = Object.entries(output).slice(0, 3)
    return (
      <div className="tg__fork-output">
        {entries.map(([k, v]) => (
          <span key={k} className="tg__fork-kv">
            <span className="tg__fork-k">{k}:</span>{' '}
            <span className="tg__fork-v">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
          </span>
        ))}
      </div>
    )
  }
  return <div className="tg__fork-output"><span className="tg__fork-v">{String(output)}</span></div>
}

export function ForkGraphNode({ node, style }: {
  node: ForkNode
  style: React.CSSProperties
}) {
  return (
    <div
      data-testid={`fork-${node.id}`}
      className="tg__node tg__node--fork"
      style={style}
    >
      <span className="nk">{node.originalId} · {KIND_TAG[node.kind] ?? node.kind} · FIX</span>
      <span className="nl">{node.label}</span>
      {node.correctedOutput !== undefined && (
        <OutputPreview output={node.correctedOutput} />
      )}
    </div>
  )
}

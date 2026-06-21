// web/src/dashboard/graph/GraphNode.tsx
import type { ActionNode, NodeStatus } from '../types'

const KIND_TAG: Record<ActionNode['kind'], string> = {
  reason: 'RSN', tool_call: 'TOOL', tool_result: 'TOOL', decision: 'DEC', final: 'FIN',
}

export function GraphNode({ node, status, selected, onSelect, style }: {
  node: ActionNode
  status: NodeStatus
  selected: boolean
  onSelect: (id: string) => void
  style: React.CSSProperties
}) {
  return (
    <button
      type="button"
      data-testid={`node-${node.id}`}
      data-status={status}
      data-selected={selected}
      className="tg__node"
      style={style}
      onClick={() => onSelect(node.id)}
    >
      <span className="nk">{node.id} · {KIND_TAG[node.kind]}</span>
      <span className="nl">{node.label}</span>
    </button>
  )
}

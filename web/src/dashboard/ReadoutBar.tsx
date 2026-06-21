import '../dashboard/dashboard.css'

export function ReadoutBar({ runId, task, verdict, meta }: {
  runId: string; task: string; verdict: 'FAIL' | 'PASS'; meta: string
}) {
  return (
    <div className="rb">
      <span className="rb__id"><b>{runId}</b> · {task}</span>
      <span className="rb__meta">{meta}</span>
      <span className="rb__spacer" />
      <span className="rb__eyebrow">oracle</span>
      <span className={`rb__verdict rb__verdict--${verdict.toLowerCase()}`}>{verdict}</span>
    </div>
  )
}

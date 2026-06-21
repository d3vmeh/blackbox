import type { Json } from '../../types'

export function Section({ title, aside, children }: {
  title: string; aside?: string; children: React.ReactNode
}) {
  return (
    <div className="insp__sec">
      <div className="insp__sech"><span>{title}</span>{aside && <span>{aside}</span>}</div>
      {children}
    </div>
  )
}

export function Field({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'bad' | 'good' | 'root' }) {
  return (
    <div className="insp__kv">
      <span className="insp__k">{k}</span>
      <span className={`insp__v${tone ? ` insp__v--${tone}` : ''}`}>{v}</span>
    </div>
  )
}

export function RawPayload({ value }: { value: Json }) {
  return <pre className="insp__pre">{JSON.stringify(value, null, 2)}</pre>
}

import { useCallback, useEffect, useState } from 'react'
import {
  AUDIT_LOG,
  getSteps,
  getSummary,
  RECENT_RUNS,
  TAXONOMY,
  type DemoMode,
  type DemoStep,
} from './demo/simulation'
import './App.css'

type View = 'product' | 'taxonomy' | 'ledger'

function App() {
  const [view, setView] = useState<View>('product')
  const [mode, setMode] = useState<DemoMode>('unprotected')
  const [running, setRunning] = useState(false)
  const [visibleSteps, setVisibleSteps] = useState<DemoStep[]>([])
  const [cost, setCost] = useState(0)

  const resetDemo = useCallback(() => {
    setRunning(false)
    setVisibleSteps([])
    setCost(0)
  }, [])

  const runDemo = useCallback(
    (nextMode: DemoMode) => {
      resetDemo()
      setMode(nextMode)
      setRunning(true)
    },
    [resetDemo],
  )

  useEffect(() => {
    if (!running) return

    const steps = getSteps(mode)
    let index = 0
    let accumulated = 0

    const tick = () => {
      if (index >= steps.length) {
        setRunning(false)
        return
      }

      const step = steps[index]
      accumulated += step.costDelta
      setVisibleSteps((prev) => [...prev, step])
      setCost(accumulated)
      index += 1
    }

    tick()
    const interval = window.setInterval(() => {
      if (index >= steps.length) {
        window.clearInterval(interval)
        setRunning(false)
        return
      }
      tick()
    }, 700)

    return () => window.clearInterval(interval)
  }, [running, mode])

  const summary = getSummary(mode)
  const latestIntervention = [...visibleSteps].reverse().find((s) => s.failureClass)

  return (
    <div className="app">
      <div className="grid-bg" aria-hidden="true" />

      <header className="nav">
        <div className="nav-inner">
          <a className="logo" href="#top">
            <span className="logo-mark" />
            Fuse Breaker
          </a>
          <nav className="nav-links">
            <a href="#product">Product</a>
            <a href="#modules">Modules</a>
            <a href="#taxonomy">Taxonomy</a>
          </nav>
          <div className="nav-actions">
            <button type="button" className="btn ghost">
              Login
            </button>
            <button type="button" className="btn primary" onClick={() => runDemo('protected')}>
              Run demo
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">Typed circuit breaker for AI agent loops</p>
          <h1>
            Build, run, and trust
            <br />
            <span className="gradient">autonomous agents.</span>
          </h1>
          <p className="hero-sub">
            Hard caps kill good runs along with bad ones. Fuse Breaker classifies why a loop is
            failing and applies the one fix proven for that failure — in real time, with a receipt
            for every dollar saved.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn primary lg" onClick={() => runDemo('protected')}>
              Book a demo
            </button>
            <button type="button" className="btn secondary lg" onClick={() => document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' })}>
              See the workspace
            </button>
          </div>
          <p className="trust-line">Trusted patterns from RunPod · Redis · Sentry hackathon tracks</p>
        </section>

        <section id="product" className="product-section">
          <div className="section-head">
            <span className="fig-label">Fig. 1 · Fuse Breaker Workspace</span>
            <h2>All in one unified control plane.</h2>
          </div>

          <div className="workspace-shell">
            <aside className="sidebar">
              <div className="sidebar-org">
                <span className="org-dot" />
                Blackbox Labs
              </div>
              <button type="button" className="sidebar-new" onClick={() => runDemo(mode)}>
                + New run
              </button>
              <ul className="sidebar-nav">
                {[
                  ['product', 'Workspace'],
                  ['taxonomy', 'Taxonomy'],
                  ['ledger', 'Ledger'],
                ].map(([id, label]) => (
                  <li key={id}>
                    <button
                      type="button"
                      className={view === id ? 'active' : ''}
                      onClick={() => setView(id as View)}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="sidebar-section">
                <span className="sidebar-label">Recent</span>
                <ul className="recent-list">
                  {RECENT_RUNS.map((run) => (
                    <li key={run.id}>
                      <span className="recent-title">{run.title}</span>
                      <span className="recent-meta">{run.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sidebar-user">
                <span className="avatar">jr</span>
                <div>
                  <div className="user-name">j. rao</div>
                  <div className="user-task">vendor-schema-drift · live</div>
                </div>
              </div>
            </aside>

            <div className="workspace-main">
              {view === 'product' && (
                <>
                  <div className="workspace-toolbar">
                    <div className="run-title">
                      <span className="live-dot" />
                      vendor-schema-drift · overnight
                    </div>
                    <div className="mode-toggle">
                      <button
                        type="button"
                        className={mode === 'unprotected' ? 'active danger' : ''}
                        onClick={() => {
                          setMode('unprotected')
                          resetDemo()
                        }}
                      >
                        Unprotected
                      </button>
                      <button
                        type="button"
                        className={mode === 'protected' ? 'active safe' : ''}
                        onClick={() => {
                          setMode('protected')
                          resetDemo()
                        }}
                      >
                        Fuse Breaker ON
                      </button>
                    </div>
                    <div className="toolbar-actions">
                      <button type="button" className="btn ghost sm" onClick={resetDemo} disabled={running}>
                        Reset
                      </button>
                      <button
                        type="button"
                        className="btn primary sm"
                        onClick={() => runDemo(mode)}
                        disabled={running}
                      >
                        {running ? 'Running…' : 'Run again'}
                      </button>
                    </div>
                  </div>

                  <div className="workspace-grid">
                    <div className="trace-panel">
                      <div className="panel-head">
                        <span>Agent trace</span>
                        <span className="mono dim">{visibleSteps.length} / 8 steps</span>
                      </div>
                      <div className="chat-thread">
                        <div className="chat-user">
                          <p>
                            Diff the feature graph against the last successful EOD run and ping
                            feed-health for each upstream vendor.
                          </p>
                        </div>
                        {visibleSteps.length === 0 && !running && (
                          <div className="chat-empty">Run the demo to watch the agent trace.</div>
                        )}
                        {visibleSteps.map((step) => (
                          <div key={step.id} className={`trace-step ${step.status}`}>
                            <div className="trace-meta">
                              <span className={`status-pill ${step.status}`}>
                                {step.status === 'ok' && '✓'}
                                {step.status === 'fail' && '✗'}
                                {step.status === 'intervened' && '⚡'}
                              </span>
                              <code>{step.label}</code>
                              <span className="step-cost mono">+${step.costDelta.toFixed(3)}</span>
                            </div>
                            <p>{step.detail}</p>
                            {step.failureClass && (
                              <div className="inline-tag warning mono">{step.failureClass}</div>
                            )}
                            {step.responderAction && (
                              <div className="inline-tag accent mono">{step.responderAction}</div>
                            )}
                          </div>
                        ))}
                        {running && (
                          <div className="typing-indicator">
                            <span />
                            <span />
                            <span />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="diag-stack">
                      <div className="metric-card hero-metric">
                        <span className="metric-label">Session cost</span>
                        <span className={`metric-value mono ${mode === 'protected' ? 'safe' : cost > 0.2 ? 'danger' : ''}`}>
                          ${cost.toFixed(2)}
                        </span>
                        {!running && visibleSteps.length > 0 && (
                          <span className="metric-sub">
                            Target {mode === 'protected' ? '~$0.12' : '~$0.47'} · {summary.calls} tool calls
                          </span>
                        )}
                      </div>

                      <div className="diag-card">
                        <div className="panel-head">
                          <span>Classifier</span>
                          <span className="badge mono">0 LLM calls</span>
                        </div>
                        {latestIntervention?.failureClass ? (
                          <div className="classifier-hit">
                            <span className="mono dim">detected:</span>
                            <code className="failure-code">{latestIntervention.failureClass}</code>
                          </div>
                        ) : (
                          <p className="dim">Watching tool calls…</p>
                        )}
                      </div>

                      <div className="diag-card">
                        <div className="panel-head">
                          <span>Responder</span>
                        </div>
                        {latestIntervention?.responderAction ? (
                          <p className="mono responder-line">{latestIntervention.responderAction}</p>
                        ) : (
                          <p className="dim">No intervention yet.</p>
                        )}
                      </div>

                      <div className="diag-card ledger-card">
                        <div className="panel-head">
                          <span>Ledger</span>
                          <span className="live-badge">live</span>
                        </div>
                        <ul className="ledger-list">
                          {visibleSteps
                            .filter((s) => s.ledgerNote)
                            .map((s) => (
                              <li key={s.id}>
                                <span className="mono">{s.failureClass}</span>
                                <span>{s.ledgerNote}</span>
                              </li>
                            ))}
                          {visibleSteps.filter((s) => s.ledgerNote).length === 0 && (
                            <li className="dim">Receipts appear on intervention.</li>
                          )}
                        </ul>
                      </div>

                      {!running && visibleSteps.length === 8 && (
                        <div className={`summary-banner ${mode === 'protected' ? 'safe' : 'danger'}`}>
                          <strong>{summary.label}</strong>
                          <span className="mono">
                            ${summary.total.toFixed(2)} total · {summary.calls} calls
                            {summary.saved > 0 && ` · $${summary.saved.toFixed(2)} saved (${summary.savedPct}%)`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {view === 'taxonomy' && (
                <div className="taxonomy-view">
                  <h3>Failure taxonomy</h3>
                  <p className="dim">Deterministic classification — no “ask an LLM if this seems bad.”</p>
                  <div className="taxonomy-grid">
                    {TAXONOMY.map((row) => (
                      <div key={row.class} className="taxonomy-row">
                        <code>{row.class}</code>
                        <span>{row.detect}</span>
                        <span className="fix">{row.fix}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view === 'ledger' && (
                <div className="ledger-view">
                  <h3>Audit log</h3>
                  <ul className="audit-log">
                    {AUDIT_LOG.map((entry, i) => (
                      <li key={i}>
                        <span className="audit-who mono">{entry.who}</span>
                        <span>{entry.action}</span>
                        <span className="dim">{entry.target}</span>
                        <span className="audit-time mono">{entry.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="modules" className="modules-section">
          <p className="eyebrow center">Modules for every layer of the agent stack</p>
          <h2 className="center">A unified foundation for robust, cost-aware agents.</h2>
          <div className="modules-grid">
            {[
              {
                tag: 'Interceptor',
                title: 'Middleware before every tool call',
                body: 'Framework-agnostic proxy layer. Table stakes infrastructure — built fast, not the pitch.',
              },
              {
                tag: 'Classifier',
                title: 'Typed diagnosis at zero LLM cost',
                body: 'Hallucinated tools, ambiguous retries, non-convergent loops, context rot — each detected deterministically.',
              },
              {
                tag: 'Responder',
                title: 'One fix per failure class',
                body: 'Not a kill switch. Block and reinject schema, rewrite ambiguous responses, switch strategy, compact context.',
              },
              {
                tag: 'Ledger',
                title: 'Structured receipt per intervention',
                body: 'Every dollar saved, traced. The audit trail that makes agent failure legible.',
              },
            ].map((mod) => (
              <article key={mod.tag} className="module-card">
                <span className="module-tag">{mod.tag}</span>
                <h3>{mod.title}</h3>
                <p>{mod.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="taxonomy" className="compare-section">
          <div className="compare-copy">
            <h2>Pre-call interception exists. Cost caps exist.</h2>
            <p>Nobody combines them into typed diagnosis. That is the seam we built for.</p>
          </div>
          <div className="compare-table">
            <div className="compare-row head">
              <span />
              <span>Observability</span>
              <span>Cost caps</span>
              <span className="highlight">Fuse Breaker</span>
            </div>
            {[
              ['When it acts', 'After the run', 'During the run', 'Before each tool call'],
              ['Diagnosis', 'Inferred (~14–53%)', 'None', 'Typed, deterministic'],
              ['Action', 'Log and scroll', 'Kill everything', 'Matched fix per class'],
              ['Cost signal', 'Post-hoc', 'Blunt limit', 'Receipt per save'],
            ].map(([label, a, b, c]) => (
              <div key={label} className="compare-row">
                <span className="row-label">{label}</span>
                <span>{a}</span>
                <span>{b}</span>
                <span className="highlight">{c}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-section">
          <h2>Stop agent loops from burning money.</h2>
          <button type="button" className="btn primary lg" onClick={() => runDemo('protected')}>
            Run protected demo
          </button>
        </section>
      </main>

      <footer className="footer">
        <span>Fuse Breaker · blackbox</span>
        <span className="dim">The black box that makes agent failure legible.</span>
      </footer>
    </div>
  )
}

export default App

# Blackbox — Architecture

> System architecture and build spec. For the **visual** design system see
> [DESIGN.md](./DESIGN.md); for day-to-day repo conventions see [AGENTS.md](./AGENTS.md).
> This document is the source of truth for *what we are building and why*.

---

## 1. The idea

Blackbox is a **causal debugger for AI agents**. An agent runs a long multi-step
task (~30 steps); when it fails, **one early mistake silently poisons every step
after it** and the final answer is confidently wrong. The symptom shows up far
from the cause, so today you scroll a wall of logs and guess.

Blackbox does four things:

1. **Record** the run as a structured trace — every reasoning step, tool call,
   and the data passed between steps.
2. **Localize** the *earliest* step that actually went wrong — not where the
   symptom surfaced.
3. **Trace the blast radius** forward — every later step that inherited the
   mistake.
4. **Prove it** by forking the run at that step, injecting the corrected value,
   and re-running. If the outcome flips fail→pass, the cause is confirmed.

### The one principle (everything serves this)

**Intervention-confirmed causality. Don't *claim* a root cause — *prove* it by
replay.** Attribution comes from the **graph + replay**, not from asking an LLM
"where did it fail?". The LLM is used narrowly: to judge whether *one* step's
output looks right given *only* that step's inputs. Delete the LLM and the spine
(graph slice + replay confirmation) still works.

### Why this is hard (our anti-wrapper armor)

Automatic step-level failure attribution is an open research problem (~14% step
accuracy for the best published method; <10% for naive "ask an LLM"). We compute
it from a provenance graph and **confirm by replay**. The fork→inject→re-run
primitive follows recent research (AgenTracer, arXiv 2509.03312; DoVer, arXiv
2512.06749). Our contribution is making it a **usable, interactive, confirmed
tool** with the confirm-flip as the UX centerpiece — the papers are offline
benchmarks; this is a real-time debugger a human watches.

### What makes the demo win (panel-reviewed)

The defensible, memorable beat is **not** the trace view (everyone has one) — it
is the **closed loop**: localize → fork → inject → replay *n* times →
confirm-or-reject → fall back to the next candidate. No commercial tool ships
this. Specifically:

- **Lead with the confirm-flip**, not the logs. The fail→pass state change is the
  emotional peak.
- **Show a false candidate getting rejected first.** Localize a plausible-but-wrong
  step, watch the replay *not* flip, then fall back to the true root and watch it
  flip. This single beat does triple duty: it's the creative climax, it proves
  causation-over-correlation, and it's the cheapest possible proof the loop is
  *live, not scripted* (kills the "did they hardcode it?" doubt).
- **Quantify the claim on screen:** "corrected step 4 → 5/5 pass; corrected step 6
  → 0/5 pass."

---

## 2. Architecture at a glance

```
┌─────────────────────────────────────── monorepo: blackbox/ ───────────────────────────────────────┐
│                                                                                                     │
│   web/  (Vite + React 19 + TS SPA)            Python backend (FastAPI + SSE)                         │
│   ┌───────────────────────────┐               ┌──────────────────────────────────────────────┐     │
│   │  Trace spine + inspector  │  ── SSE ──▶    │ api/        serve trace / attribution / replay │     │
│   │  blast-radius animation   │               │ agent/      LangGraph subject + capture        │     │
│   │  confirm-flip overlay     │ ◀── stream ──  │ attribution/ provenance graph + localize       │     │
│   └───────────────────────────┘               │ replay/     fork + inject + confirm            │     │
│        consumes the contracts                 │ eval/       oracle + metrics                    │     │
│        (web/src/types.ts mirrors              │ shared/     schema.py (contracts) + fixtures    │     │
│         shared/schema.py)                      └──────────────────────────────────────────────┘     │
│                                                          │                                           │
│                                              Redis (traces/graph) · Phoenix (spans) · Sentry (issue) │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Boundary rule:** the frontend is a pure consumer of the backend over SSE. It
owns visualization (the blast-radius animation, the confirm-flip); it never owns
business logic. All localization/replay/eval logic lives in the Python backend.
Within this monorepo the boundary stays unambiguous: if it computes attribution,
it is Python; if it renders a beat, it is `web/`.

---

## 3. Tech stack (use these; don't substitute)

| Concern | Choice | Why |
|---|---|---|
| Language / API | **Python, FastAPI, SSE** | Stream the demo beats to the SPA live. |
| Subject agent | **LangGraph (checkpointed)** + **Browserbase / Stagehand** | Checkpointing is *required* — it is the fork/replay mechanism. The web tool gives a real, non-deterministic agent worth debugging. |
| Tracing | **OpenTelemetry GenAI + OpenInference** → **Arize Phoenix**; plus LangGraph checkpoints → canonical `Trace` | Standards-based span capture; checkpoints give us fork points. |
| Storage | **Redis** | Traces, provenance graph, semantic edges. |
| Models | **Claude Haiku** (parallel node-judges — cheap, many at once); **Sonnet/Opus** (harder reasoning) | Cost-tiered: cheap local judgments vs. expensive reasoning. |
| Frontend | **React + Vite** SPA | One page consuming an SSE stream needs no SSR/routing/server tier. See [AGENTS.md](./AGENTS.md). |
| Error surface | **Sentry** | Confirmed root cause filed as an issue (the closing demo beat). |

**Sponsor-track map (one build, multiple eligibilities):** Claude Code →
Anthropic · Browserbase → Browserbase · Arize Phoenix → Arize · Sentry → Sentry ·
Redis → Redis.

**Honest weighting (panel-reviewed):** 3 of 5 SDKs are *structural* — LangGraph
(checkpointing **is** replay), Browserbase (the agent under test), Phoenix (the
trace substrate). **Sentry and Redis are thinner**: keep Sentry as the closer
only; give Redis a one-line justification (run storage / SSE fan-out) and don't
build the core state machine on it early — in-memory + the fixture gets to a
working demo faster, add Redis behind a flag for track coverage.

---

## 4. Repository structure (monorepo)

```
blackbox/
  ARCHITECTURE.md        # this file — system design + build spec
  DESIGN.md              # visual design system (UI canonical schema)
  AGENTS.md              # repo conventions + frontend boundary
  pyproject.toml         # Python backend deps + tooling

  shared/                # the contracts + fixtures — the seams between workstreams
    schema.py            #   the 5 Pydantic contracts — BUILD FIRST
    fixtures/
      flight_fail.json   #   hand-recorded failing trace — BUILD SECOND (unblocks everyone)

  agent/                 # P1 — subject agent + trace capture
    graph.py             #   checkpointed LangGraph agent (Browserbase/Stagehand)
    capture.py           #   spans + checkpoints -> canonical Trace
  replay/                # P1 — fork + inject + confirm
    replay.py            #   replay(trace, step_id, value, n) -> ReplayResult
  attribution/           # P2 — graph + localization
    provenance.py        #   build data-flow graph; backward/forward slices
    localize.py          #   slice + node-judge blend -> Attribution
    judges.py            #   per-step Haiku node-judge (parallel)
  api/                   # P4 — serving + Sentry
    main.py              #   FastAPI, SSE endpoints
    sentry_issue.py      #   file confirmed root cause as a Sentry issue
  eval/                  # P4 — metrics
    oracle.py            #   decides Trace.success
    metrics.py           #   localization accuracy on fixtures

  web/                   # P3 — React + Vite dashboard (the SPA)
    src/                 #   App shell, trace spine, inspector, animations
    index.html  vite.config.ts  package.json ...
```

---

## 5. The contracts (`shared/schema.py`)

Five Pydantic models are the seams. **Build them first; everyone codes against
them.** The frontend mirrors them in `web/src/types.ts`. Do not rename fields
without updating both.

- **`Step`** — one node: `inputs`, `output`, `state` (agent-state snapshot *after*
  the step, for fork/replay), and `parents` (**true data-flow edges** — this
  step's inputs were produced by those steps). The graph and both slices depend on
  `parents` being real provenance, not "the previous step".
- **`Trace`** — `steps`, `final_output`, `success` (None until the oracle runs).
- **`Candidate`** — a ranked suspect: `step_id`, `suspicion ∈ [0,1]`, `reason`.
- **`Attribution`** — `root_step_id`, `blast_radius` (forward slice), ranked
  `candidates` (so replay can fall back), `rationale`.
- **`ReplayResult`** — `flipped`, `confirmation_rate ∈ [0,1]`, `outcomes`
  (per-run). A **non-flip is a valid result**, never an error.

---

## 6. Data flow / pipeline

```
record                 localize                          confirm
──────                 ────────                          ───────
LangGraph run          provenance graph (Step.parents)   fork at root_step_id
  │ spans+checkpoints    │ backward slice from failure      │ inject corrected value
  ▼                      ▼ (implicated steps)               ▼ (LangGraph checkpoint)
to_trace() ──▶ Trace    parallel Haiku node-judges        re-run n times
                         │ "is this output right given      │ score each (oracle)
                         │  ONLY these inputs?"              ▼
                         ▼ blend + earliest-wins          ReplayResult
                        Attribution (root + blast_radius)   │ flipped? confirmation_rate?
                         │                                   ▼
                         └──── ranked candidates ───▶ flip? confirm : fall back to next
                                                              │
                                                     Sentry issue (on confirm)
```

---

## 7. Localization design (`attribution/`)

`attribute(trace) -> Attribution`:

1. **Provenance graph** from `Step.parents` (true data-flow edges).
2. **Backward slice** from the failing `final_output` → the steps that could have
   causally influenced the failure.
3. **Parallel node-judges (Haiku)** over the sliced steps: each judge sees *only*
   one step's inputs and output and answers "does this output follow correctly?"
   It must **not** see downstream steps or the final outcome — that isolation is
   what makes the verdict a local correctness signal rather than hindsight.
4. **Blend** the node-judge verdict with an **earliest-in-graph-order** prior →
   ranked `candidates`; the earliest high-suspicion step = `root_step_id`.
5. **Forward slice** from the root = `blast_radius`.

### On Ochiai / spectrum scoring — be honest

The original spec mentions Ochiai (spectrum-based fault localization). **On a
single failing trace Ochiai degenerates** — SBFL needs a coverage matrix over
*many* pass/fail executions; with one all-failing run every executed step gets an
identical, meaningless score. A sharp judge *will* ask "where's your coverage
matrix?" So:

- The **node-judge + earliest-in-graph-order is the load-bearing signal.** Keep
  `Candidate.suspicion` as the blended score.
- If we want real spectrum scoring later, the honest source of a multi-execution
  population is **our own replays** — each fork/inject/re-run is a new
  (pass/fail, coverage) row. Then Ochiai over {original run + N replays} is
  legitimate SBFL. Treat this as a stretch goal, not a demo dependency.
- The strong answer if challenged: *"Single trace, so SBFL degenerates — we lean
  on intervention confirmation instead."* That is more impressive than pretending
  the math works.

---

## 8. Replay & determinism (`replay/`)

`replay(trace, step_id, injected_value, n=5) -> ReplayResult`:

- Fork at `step_id` using the LangGraph checkpoint in `Step.state`
  (`graph.update_state(config, values, as_node=...)`), inject the corrected value
  into the right channel, resume (`graph.invoke(None, config)`), re-run `n` times,
  score each with `eval.oracle.evaluate`, return flip + `confirmation_rate`.

**Hard requirements:**

- **Non-flip is required, not optional.** If the injected fix does **not** flip
  the outcome, that candidate is *rejected* and replay moves to the next ranked
  candidate. Surface it cleanly in the UI; never crash on it. (This is also the
  demo's credibility beat — show a rejection.)
- **The web target is non-deterministic.** Re-run `n` times and report
  `confirmation_rate`, not a single boolean. A sub-1.0 rate (e.g. 4/5) actually
  *sells* the rigor.

### Demo-determinism (panel P0 — do not skip)

Do **not** bet the on-stage flip on a live Stagehand session driving a real site
(DOM drift, captcha, cold start, rate limits = the flakiest thing in the stack).
For the flight scenario, **replay from a pre-captured corrected trace** so the
on-stage flip is deterministic. Keep the *code path* fully real (fork →
update_state → resume → oracle → `ReplayResult`); only the underlying
re-execution reads a canned successful trace. Run one genuine live replay
**offline** for the backup video and to prove the seam. **The backup video is
itself a P0 mitigation.**

### Replay gotchas (carry budget here)

- `Step.id` ≠ LangGraph `checkpoint_id`. Capture a **mapping** (canonical step →
  checkpoint_id) in `to_trace()`. Underestimating this glue is where P1 time goes.
- `update_state` writes to graph **channels**, with `as_node` matching so
  downstream edges fire. Scope injection to the **one demo node** (the date parse);
  "inject at any step" is a P2 rabbit hole.
- Keep `Step.state` JSON-serializable. Reconstruct live resources (browser
  sessions, tool clients) fresh on resume — don't hydrate them from the snapshot.

---

## 9. Build order (dependency-respecting)

**Hour 0 — before parallel work:**
1. `shared/schema.py` — the 5 contracts. ✅ *(done)*
2. `shared/fixtures/flight_fail.json` — a hand-recorded failing trace conforming
   to `Trace`, with real `parents` edges and a decoy step. **The unblock-everyone
   move** — attribution, replay, and the UI all build against it without the live
   agent.
3. **Spike the scary part immediately:** a throwaway checkpointed LangGraph; prove
   `update_state(as_node=...)` + resume actually injects and changes the outcome.
   If this doesn't work by ~hour 3, fall back to fully-recorded replay and tell
   the team now.

**Then in parallel, all against the fixture first:**
- **P1** — `agent/` (LangGraph + capture) + `replay/`. Build live agent last among
  P1's tasks; develop replay against the fixture's `state` snapshots.
- **P2** — `attribution/`: `attribute(trace)` returns a correct `Attribution` on
  `flight_fail.json` (root = the misread-date step).
- **P3** — `web/`: render `flight_fail.json` + a stubbed `Attribution` + stubbed
  `ReplayResult`; nail the **blast-radius** and **confirm-flip** animations.
- **P4** — `api/` (SSE endpoints serving fixture/stubs), `eval/oracle.py`, Sentry
  closer.

**Integration:** swap stubs for live modules one seam at a time. The fixture path
must keep working as a fallback demo even after the live agent is wired.

---

## 10. Module interfaces (seams; bodies are stubs to fill)

```python
attribution/localize.py:  attribute(trace: Trace) -> Attribution
replay/replay.py:         replay(trace, step_id, injected_value, n=5) -> ReplayResult
agent/capture.py:         to_trace(spans, checkpoints) -> Trace
eval/oracle.py:           evaluate(final_output, task) -> bool
```

---

## 11. Guardrails / non-goals (do NOT gold-plate)

- **Single-root-cause, linear failures only.** One early wrong step poisoning a
  forward chain. No multi-cause / interacting-fault attribution.
- **One demo scenario:** a Browserbase web agent books a flight on the wrong date
  because an early step misread `07-12` as `Dec 7`; later steps inherit. Optimize
  the whole system for this case.
- **The non-flip case is required**, surfaced cleanly, never a crash.
- **Replay determinism:** re-run `n` times, report `confirmation_rate`; on stage,
  replay from the pre-captured trace.
- **No auth, no multi-user, no persistence beyond Redis, no settings/config UI.**
- **Do not abstract for "any agent framework" yet.** Hardcode to the LangGraph
  subject. Generalization is future work.
- **The fixture is the source of truth** until the live agent is proven. Never let
  live-agent flakiness block the other three modules.

---

## 12. Acceptance test = the 90-second demo

1. A web agent books a flight; it picks the **wrong date** (early step misread
   `07-12` as `Dec 7`); every later step inherits it; final output confidently
   wrong (show it at high confidence — the horror is failing *confidently*).
2. Show the **wall of logs** (status quo): "every other tool stops here."
3. **Analyze** → highlight the root-cause step (say *how*: "we walk the trace back
   to the first step whose output doesn't follow from its inputs") and animate the
   **blast radius**.
4. **Confirm** → replay first on a **decoy** candidate (does *not* flip → rejected),
   then fall back to the true root, inject the correct date, re-run → **outcome
   flips fail→pass** (show 5/5). Split-screen: frozen-red original vs. green
   counterfactual.
5. End on the agent **succeeding with the fix applied** (the emotional peak).
6. Cut to the **Sentry issue** Blackbox filed automatically.

**The single thing to remember:** we don't guess the cause — we localize it on a
graph and confirm it by replay. Everything else serves that loop.

---

## 13. Open risks (panel-flagged, ranked)

- **P0 — live on-stage replay flakiness** → pre-capture the corrected run; keep a
  backup video. (§8)
- **P1 — "how did you find the step?" credibility gap** → say the method in one
  sentence; show a decoy rejection. (§7, §12)
- **P1 — Ochiai claim** → demote to node-judge; have the honest answer ready. (§7)
- **P2 — framework lock-in / unsafe live-tool replay** → real-world concerns, out
  of hackathon scope but name them; the honest ingestion contract is OTel spans,
  and side-effecting tools would need record-replay/mocking in production.

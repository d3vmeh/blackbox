# Blackbox — Architecture

> System architecture and build spec. For the **visual** design system see
> [DESIGN.md](./DESIGN.md); for day-to-day repo conventions see [AGENTS.md](./AGENTS.md).
> This document is the source of truth for *what we are building and why*.
>
> **Revision (2026-06-20):** reframed from a single-agent causal debugger to a
> **monitor/supervisor for collaborating multi-agent systems**, whose brain is the
> same attribution + counterfactual-replay engine. The moat is unchanged
> (intervention-confirmed causality). Pending team sign-off; integrate via PR.

> ## STATUS — target vs current (read first)
> This document describes the **target** system; parts of the present-tense prose
> below are now **behind the as-built code**. Reconciled **2026-06-20** against `main`:
> - **Built & tested (backend):** `agent/ap_graph.py` (5-agent AP runtime,
>   MATCHER∥FRAUD), `agent/ap_scenarios.py` (10 labeled scenarios — faults injectable
>   at **any** agent), `agent/monitor.py`, `eval/ap_oracle.py`, `replay/replay.py`,
>   and all of `attribution/` (`localize.py` / `judges.py` / `provenance.py` /
>   `regression.py`). **None raise `NotImplementedError`.** The flight benchmark
>   (`shared/fixtures/benchmark/`, 30 labeled traces) scores **30/30** attribution
>   (the "~14%" comparison stat). `agent/converge_ap.py` shows the monitor localizes
>   **10/10 vs gold** across all five fault sites, P2 `attribute()` proven-convergent
>   (live node-judges need `ANTHROPIC_API_KEY`).
> - **Not yet built:** the **multi-agent dashboard** — `web/src/` is the basic landing
>   page and **`web/src/types.ts` does not exist yet**, so §7's frontend edits
>   (`'handoff'` in `StepKind`, `MonitorDecision`) are unstarted — and `agent/acp_proxy.py`
>   (§18, stretch).
> - **As-built divergences from the target prose below — do not be misled by present tense:**
>   - **Injection is generalized to ANY agent** (10 scenarios), not EXTRACTOR-only.
>     §2/§10/§12's "scope to EXTRACTOR / 'inject at any agent is a rabbit hole'" is
>     **superseded** — it ships deterministically, monitor 10/10.
>   - **The monitor is `investigate(trace, scn) -> Verdict`** using a **deterministic**
>     node-judge (`ap_graph.COMPUTE`) + `ap_graph.replay_ap` — **not** §3/§13's
>     `supervise() -> MonitorDecision` calling `attribute()`/`replay()`. This keeps the
>     loop deterministic (§10/§14); P2's `attribute()` is the **general** method, proven
>     to *converge* with the monitor (`converge_ap.py`), not the live localizer.
>   - No `kind="handoff"` steps, and no single `ap_fail.json` / `flight_fail.json`
>     fixtures: the AP path generates traces from `ap_scenarios.py`; flight uses
>     `shared/fixtures/benchmark/`. §6/§7/§12 references to those files are aspirational.
> - A capability marked **REAL** below means *intended end state*, not shipped; the §11
>   table carries explicit maturity labels.

---

## 1. The idea

Blackbox is a **supervisor for multi-agent systems that proves the root cause by
counterfactual replay before it lets an agent act or self-heal.**

Enterprise workflows increasingly run as **teams of agents collaborating on one
goal** — each owns a different sub-task and they pass **structured hand-offs** to
one another. When the workflow fails, **one agent's early mistake silently
corrupts a hand-off, and every downstream agent trusts it** and builds on it. The
final action (a payment, a booking, an email) is confidently wrong, and the
symptom surfaces far from the agent that caused it. Today you scroll a wall of
inter-agent logs and guess which agent to blame.

Blackbox does four things, and then acts on them:

1. **Record** the multi-agent run as a structured trace — every reasoning step,
   tool call, and **hand-off payload** passed between agents.
2. **Localize** the *earliest productive step whose output is wrong given its own
   inputs* — and report the adjacent corrupted hand-off it propagated through. Not
   where the symptom surfaced.
3. **Trace the blast radius** forward **across agent boundaries** — every later
   step, in any agent, that inherited the corrupted value.
4. **Prove it** by forking the run at that step, injecting the corrected value,
   and re-running. If the outcome flips fail→pass, the cause is confirmed.

Then the **monitor agent** acts on the proof: it **auto-applies the replay-proven
fix** (only when the corrected value is independently re-derivable — see §11) or
**escalates to a human** who supplies the correction via a structured form. A fix
is never trusted until replay flips the outcome.

### The one principle (everything serves this)

**Intervention-confirmed causality. Don't *claim* a root cause — *prove* it by
replay.** Attribution comes from the **graph + replay**, not from asking an LLM
"which agent failed?". This principle extends to *every* proposed repair: **agent
self-fixes and human suggestions are untrusted until replay confirms them.**

The LLM is used narrowly — to judge whether one step's output looks right given
*only* that step's inputs. **Delete the LLM and the spine still *runs*** — graph
slice, candidate set, and replay confirmation are pure code — **but localization
degrades** from precise to a coarse earliest-in-graph-order prior. Replay still
independently rejects wrong candidates: it sweeps the ranked candidates and only
the one whose corrected injection flips fail→pass is trusted. The LLM sharpens
*which candidate to test first*; **confirmation, not the LLM, decides the root.**

### Why this is hard (our anti-wrapper armor)

"Supervisor agent" is a crowded trope — usually an LLM watching other LLMs and
*guessing* a fix. We make it defensible by replacing the guess with **proof**:
the supervisor's diagnosis is automatic step-level failure attribution (an open
research problem — multi-agent step-attribution benchmarks report **~14%** step
accuracy for the best published method; <10% for naive "ask an LLM") and its trust
decision is gated on a **confirmed counterfactual**. The fork→inject→re-run
primitive follows recent research (AgenTracer, arXiv 2509.03312; DoVer, arXiv
2512.06749 — both multi-agent benchmarks).

**Honest scope of the number:** we *measure* our localization on the single-agent
flight trace (see §2); the multi-agent AP graph's accuracy is **not yet measured**.
On stage, claim a measured number only for flight and present AP as an existence
proof of the *same mechanism*.

### What makes the demo win (panel-reviewed)

The defensible, memorable beat is the **closed supervisory loop**: detect →
localize → replay *n* times → confirm-or-reject → **auto-heal or escalate**.

- **Lead with the confirm-flip**, gated *before* the monitor trusts a fix.
- **Show a false candidate rejected first.** Localize a plausible-but-wrong
  candidate, watch the replay *not* flip, then fall back to the true root and watch
  it flip. Proves causation-over-correlation and kills "did they hardcode it?".
- **Quantify on screen:** "corrected EXTRACTOR's amount → flips PASS; corrected the
  MATCHER guess → does not flip." (See §10 for the honest `confirmation_rate` framing.)
- **The trust gate is the loudest beat:** an unverified suggestion is marked
  *untrusted* until the replay proof turns it *trusted* (§3.1). That transition is
  what separates this from a generic self-healing framework.

---

## 2. Subject system (what is being monitored)

An enterprise **Accounts-Payable (AP)** pipeline — four collaborating agents
passing **structured hand-offs**, with a concurrent risk check:

```
 EXTRACTOR ──{vendor,amount,due_date,po}──▶ MATCHER ──{po_line,amount}──▶ APPROVER ──{approved,amount}──▶ PAYMENT
 reads invoice                              vs PO          ║ parallel        vs policy/limit              pay + notify finance
                                                      FRAUD / RISK check (concurrent on the same payload)
```

- Built by **regrouping the existing graph nodes** in `agent/`, so the
  `REPLAYABLE` fork sites, the deterministic oracle, and replay forking all
  survive. The monitor is a supervisory **control-loop module**
  (`agent/monitor.py`) observing the four AP agents — *not* a fifth LangGraph node.
- **Injected error:** EXTRACTOR mis-extracts `amount` (or `due_date`). The wrong
  value flows through every hand-off; downstream agents trust it → **wrong
  payment** → oracle FAIL.
- **Why AP:** a wrong *payment* has visceral, enterprise stakes; the MATCHER ∥
  FRAUD branch is a genuine "agents working at the same time" beat.

### Two domains, one method (TARGET vs CURRENT — be honest)

- **TARGET:** AP is the hero / live demo scenario; the dashboard only ever shows AP.
- **CURRENT:** the only built UI (`web/src/landing`) renders the single-agent
  **flight** spine. Building the AP multi-agent view is the **P3 critical path**.
- **The single-agent flight trace is the offline quantitative benchmark** (the
  "~14%" comparison stat). It is **n=1** — a single annotated fixture, not a
  held-out population — and is never shown on the demo screen.
- **AP localization accuracy is unmeasured.** If challenged "why two domains?":
  *the method is domain-agnostic — flight is the measured benchmark, AP is the live
  multi-agent demo.* Do not mix them on screen.

---

## 3. The monitor (Blackbox brain) — the climax

On oracle FAIL, the **monitor agent** runs a **deterministic** loop (load-bearing
for the moat — the monitor is *not* an LLM improvising):

1. build the provenance graph over the steps and hand-offs,
2. **localize** the earliest corrupted *productive* step — call P2 `attribute(trace)`,
3. **replay-confirm with an earliest-flip criterion** — call
   `replay(trace, step_id, corrected_value, n)` for candidates in
   **earliest-in-graph order**; the root is the **earliest** step whose injected
   correction flips at `confirmation_rate ≥ threshold`. A later-flipping in-blast
   step is *expected* (fixing any link repairs a linear chain) and is downstream of
   the confirmed root, not a competing root. `earliest-confirmed-flip = root` is a
   property of replay ordering, not of the LLM ranking.
4. only *then* **auto-apply** the proven fix (when re-derivable, §11), or
   **escalate** to a human who supplies the correction via a **structured form**
   (field + corrected value — *no LLM parses free text*).

**Mechanical, not magical.** The only LLM call in this loop is the per-step Haiku
node-judge inside `attribute()`. The localize→replay→decide control flow is plain
code. The UI must read as an instrument running a procedure, not a chatbot.

### 3.1 The trust gate, concretely (the product)

The monitor's output renders as a **TrustBadge** co-located with the verdict, with
three states (neutral until proven — never borrow a signal hue prematurely):

- **UNTRUSTED** — a proposed fix exists but is unconfirmed. Neutral only
  (`--text-dim`, dashed `--line`, **no** signal hue).
- **PROVING** — replay running; neutral + a live `n/n` counter.
- **TRUSTED** — replay flipped fail→pass. `--pass` + `--ring-pass`, co-timed with
  the `FAIL→PASS` verdict flip (the single focal moment); snaps instantly under
  `prefers-reduced-motion`.

> DESIGN.md must add the matching `TrustBadge` states/tokens (its Maintenance rule);
> tracked in §17 as a same-effort follow-up, since DESIGN.md is the closed-set
> source of truth and components may not invent values.

---

## 4. Architecture at a glance

```
┌─────────────────────────────────── monorepo: blackbox/ ───────────────────────────────────────────┐
│   web/  (Vite + React 19 + TS SPA)            Python backend (FastAPI + SSE)                         │
│   ┌───────────────────────────┐               ┌──────────────────────────────────────────────┐     │
│   │ agent-tagged spine         │  ── SSE ──▶   │ api/        serve trace / attribution / replay │     │
│   │ + monitor rail  [TODO]     │               │ agent/      AP runtime + capture + monitor.py  │     │
│   │ cross-agent blast  [TODO]  │               │             (supervise loop:                   │     │
│   │ trust gate + confirm [TODO]│ ◀── stream ── │              attribute()+replay()+act)         │     │
│   └───────────────────────────┘               │ attribution/ provenance graph + localize       │     │
│        consumes the contracts                 │ replay/     fork + inject + confirm            │     │
│        (web/src/types.ts mirrors              │ eval/       oracle(s) + metrics                 │     │
│         shared/schema.py)                      │ shared/     schema.py (contracts) + fixtures    │     │
│                                                └──────────────────────────────────────────────┘     │
│                                              Redis (traces/graph) · Phoenix (spans) · Sentry (issue) │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
`[TODO]` = target, not yet built (see STATUS banner).

**Boundary rule (unchanged):** the frontend is a pure consumer over SSE. It owns
visualization (the agent-tagged spine, cross-agent blast radius, confirm-flip,
trust gate); it never owns business logic.

### 4.1 UI geometry (reconciled with DESIGN.md)

DESIGN.md specifies one layout: a **single vertical trace spine** + inspector +
full-width overlay. The multi-agent view is a **variant of that spine, not a new
swimlane canvas**:

- Keep the **vertical spine as the time axis**; show agent membership via a **left
  agent gutter** (neutral mono uppercase label chip — `--font-mono`/`--t-label`/
  `--text-dim` on `--inset`). **Agents are differentiated by position + label,
  never by per-agent color** (that would add a 4th hue and break the reserved
  palette).
- Render **MATCHER ∥ FRAUD** as adjacent rows at the same time-index.
- The **MONITOR** is a pinned supervisory **rail** (observer), set apart by surface
  elevation (`--panel`/`--raised`), not hue — not a peer column.
- **Cross-agent blast** = the forward cascade recolored as it crosses gutters; the
  poison animates along the inter-lane hand-off connector *into* the next agent
  before that agent's steps flip (DESIGN.md Motion beat 1 must add the hand-off-edge
  animation — §17).
- **Forbid** a node-graph / drag-and-drop editor.

DESIGN.md gains a matching "multi-agent variant — same spine, agent gutter" block
in the same effort (§17).

---

## 5. Tech stack (use these; don't substitute)

| Concern | Choice | Why |
|---|---|---|
| Language / API | **Python, FastAPI, SSE** | Stream the demo beats to the SPA live. |
| Multi-agent runtime | **LangGraph (checkpointed)**; MATCHER ∥ FRAUD via **`asyncio`** | Checkpointing *is* the fork/replay mechanism; asyncio gives real concurrency on a controlled seed. |
| Subject agent realism | **Browserbase / Stagehand** *(decision — see §16)* | A real tool-using agent is "worth debugging" and earns the track **via recorded offline capture**, not live on stage. |
| Tracing | **OpenTelemetry GenAI + OpenInference** → **Arize Phoenix**; LangGraph checkpoints → canonical `Trace` | Standards-based span capture; checkpoints give fork points. |
| Storage | **Redis** | Traces, provenance graph, hand-off payloads. |
| Models | **Claude Haiku** for the in-loop node-judge (the *only* model in the live loop). **Sonnet/Opus offline only** — never in the live supervise loop. | Cost-tiered; keeps the loop mechanical. |
| Frontend | **React + Vite** SPA | One page consuming an SSE stream; no SSR/routing/server tier. |
| Error surface | **Sentry** | Confirmed root cause filed as an incident (the closing beat). |

**Sponsor-track map:** Anthropic · Browserbase · Arize Phoenix · Sentry · Redis.
**Honest weighting:** LangGraph (checkpointing **is** replay) and Phoenix (trace
substrate) are *structural* and run live. **Browserbase earns its track via the
recorded offline capture, not live on stage.** Sentry is the closer; Redis is run
storage / SSE fan-out — keep both thin.

---

## 6. Repository structure (monorepo)

```
blackbox/
  ARCHITECTURE.md  DESIGN.md  AGENTS.md  pyproject.toml

  shared/                # contracts + fixtures — the seams between workstreams
    schema.py            #   the 5 Pydantic contracts (+ additive MonitorDecision, §7)
    fixtures/
      flight_fail.json   #   EXISTS — single-agent offline benchmark (the ~14% stat; never shown)
      ap_fail.json       #   TO AUTHOR (does not yet exist) — Hour-0 gating deliverable; clone
                         #   flight_fail.json's 30-step shape + agent tags + cross-agent hand-off
                         #   parents + a decoy. Becomes the DEMO source of truth once authored.

  agent/                 # P1 — multi-agent runtime + capture + the monitor   [ap_graph/monitor: TO BUILD]
    graph.py             #   checkpointed LangGraph nodes
    ap_graph.py          #   TO BUILD — 4-agent AP runtime; explicit hand-off steps; MATCHER∥FRAUD via asyncio
    monitor.py           #   TO BUILD — supervise(): run → on FAIL attribute()+replay() → auto-fix/escalate
    capture.py           #   spans + checkpoints -> canonical Trace
  replay/  replay.py     # P1 — fork + inject + confirm (currently NotImplementedError)
  attribution/           # P2 — provenance.py / localize.py / judges.py (currently NotImplementedError)
  api/  main.py  sentry_issue.py     # P4 — SSE serving + Sentry incident closer
  eval/
    oracle.py            #   flight oracle (existing; offline benchmark path only)
    ap_oracle.py         #   TO BUILD (additive) — deterministic AP scoring; the DEMO path's Trace.success
    metrics.py           #   localization accuracy on the flight benchmark only
  web/                   # P3 — dashboard. CURRENT: single-agent flight spine. TARGET: AP agent-tagged spine + monitor rail.
```

---

## 7. The contracts (`shared/schema.py`)

The five existing Pydantic models remain the seams **without field renames**;
multi-agent is expressed **additively**. New optional fields or top-level types are
permitted **only via a single coordinated additive PR updating `schema.py` and
`web/src/types.ts` together**.

- **`Step`** — `inputs`, `output`, `state` (post-step snapshot, for fork/replay),
  `parents` (**true data-flow edges**). Multi-agent additions:
  - **Agent membership:** `Step.raw["agent"] = "extractor" | "matcher" | "fraud" |
    "approver" | "payment" | "monitor"`. `raw` is open on both sides — **genuinely
    zero-edit**.
  - **Hand-off:** an explicit `Step` with `kind="handoff"`, `output` = the payload
    dict, `parents` = the producing steps. `kind` is a free `str` in `schema.py`
    (no Python edit) — **but `web/src/types.ts` `StepKind` is a CLOSED union**
    (`'reason'|'tool_call'|'tool_result'|'decision'|'final'`); you **must add
    `'handoff'`** in the same PR or the SPA fails to typecheck (`any` is banned).
- **`Trace`** — `steps`, `final_output`, `success` (None until the oracle runs; for
  the **AP demo** `success` comes from `ap_oracle.evaluate()`, not the flight oracle).
- **`Candidate`** — ranked suspect: `step_id`, `suspicion ∈ [0,1]`, `reason`.
- **`Attribution`** — `root_step_id`, `blast_radius` (forward slice, may cross
  agents), ranked `candidates`, `rationale`.
- **`ReplayResult`** — `flipped`, `confirmation_rate ∈ [0,1]`, `outcomes`. A
  **non-flip is a valid result**, never an error.
- **`MonitorDecision`** *(NEW — additive sixth contract; add to `schema.py` +
  `web/src/types.ts` in the coordinating PR)* — what the UI renders for the trust
  gate: `trace_id`, `root_step_id`, `replay: ReplayResult`, `trusted: bool`,
  `decision: 'auto_apply' | 'escalate'`.

**Required additive frontend edits (same PR):** add `'handoff'` to `StepKind`; add
an `AgentId` union + `agentOf(step)` helper reading `raw['agent']`; add the
`MonitorDecision` type. Until done, "agent membership mirrored in `types.ts`" is
aspirational, not true.

---

## 8. Data flow / pipeline

```
record                      localize                          confirm + supervise
──────                      ────────                          ───────────────────
AP multi-agent run          provenance graph (parents +       fork at root (earliest-flip)
  │ spans+checkpoints         cross-agent hand-off edges)        │ inject corrected value
  │ hand-off payloads         │ backward slice from FAIL          ▼ (LangGraph checkpoint)
  ▼                           ▼ judge PRODUCTIVE steps only      re-run n times
to_trace() ──▶ Trace        (hand-offs carry edges, not          │ score each (ap_oracle)
                             correctness) → ranked candidates     ▼
                            Attribution (root + cross-agent     ReplayResult (flip? rate?)
                             blast) ──earliest-confirmed-flip──▶ MonitorDecision
                                                              │   trusted? auto_apply / escalate
                                                              ▼
                                                     Sentry incident (on confirm)
```

---

## 9. Localization design (`attribution/`)

`attribute(trace) -> Attribution` over a multi-agent graph:

1. **Provenance graph** from `Step.parents`, including **cross-agent hand-off
   edges**.
2. **Backward slice** from the failing `final_output` → steps (any agent) that
   could have causally influenced the failure.
3. **Classify before judging.** **PRODUCTIVE** steps (e.g. EXTRACTOR) transform a
   source artifact in their judged inputs — *only these are judged for
   correctness*. **HAND-OFF** steps (`kind="handoff"`) are pass-through carriers
   with no independent correctness signal — **not judged**; they only carry
   provenance edges. (An isolated judge of a pass-through trivially says "follows
   correctly", so judging them is meaningless.)
4. **Parallel node-judges (Haiku)** over the *productive* sliced steps: each sees
   *only* one step's inputs and output. Must **not** see downstream steps or the
   outcome. **Firewall:** annotation keys in `Step.raw` (`ROOT_CAUSE`, `DECOY`,
   `blast`) are **test-oracle labels, not inputs** — `attribute()`, the slices, and
   the judges **must not read them**; strip all of `raw` except `raw["agent"]` from
   the judge view, and assert their absence in tests.
5. **Blend** node-judge verdict with an **earliest-in-graph-order** prior → ranked
   `candidates`. If the node-judge is removed, suspicion **falls back to the
   graph-depth prior alone**, and replay over the top-k candidates selects the
   **earliest confirmed flip** (localization degrades but still functions).
6. Localization targets the **earliest productive step whose output is wrong given
   its source inputs**, and reports the **adjacent corrupted hand-off** as the
   propagating edge. Forward slice from the root = `blast_radius`.

### On Ochiai / spectrum scoring — be honest

On a single failing trace, SBFL degenerates (needs a coverage matrix over many
pass/fail runs). The **node-judge + earliest-in-graph-order is load-bearing.** The
honest multi-execution population, if we want real SBFL later, is **our own
replays**. Stretch goal. If challenged: *"single trace, so SBFL degenerates — we
lean on intervention confirmation instead."*

---

## 10. Replay, supervision & determinism (`replay/`, `agent/monitor.py`)

`replay(trace, step_id, injected_value, n=5) -> ReplayResult` — fork at `step_id`
via the LangGraph checkpoint in `Step.state`
(`graph.update_state(config, values, as_node=...)`), inject the corrected value,
resume (`graph.invoke(None, config)`), re-run, score with the **AP oracle**, return
flip + `confirmation_rate`.

**Hard requirements:**

- **Earliest-confirmed-flip = root.** Sweep candidates in earliest-in-graph order;
  the root is the earliest whose corrected injection flips. A later in-blast step
  also flipping is expected and downstream, not a competing root (§3 step 3).
- **Non-flip is required, not optional.** A rejected candidate falls back to the
  next; surface it cleanly, never crash.
- **The trust gate is the product.** No fix is applied until `replay()` confirms it.

### Demo-determinism (panel P0 — do not skip)

Do **not** bet the on-stage flip on a live agent driving a real service. For the
demo, the **re-execution is canned — but value-conditioned**, never a hardcoded
branch on `step_id`:

- Pre-capture **two** outcomes keyed on the injected value: corrected
  EXTRACTOR.amount → downstream inherits the right value → **PASS**; decoy MATCHER
  guess → downstream still inherits the bad amount → **FAIL**.
- **The non-flip MUST be a real causal consequence of the partial fix.** If
  `replay()` returns PASS regardless of `injected_value`, the decoy beat and the
  flip-vs-non-flip claim are dishonest — **do not ship that shortcut.**
- **Decoy-vs-root executes live:** the replay control flow **and** `ap_oracle`
  scoring run live against an offline-validated fork (`fork → update_state →
  resume → ap_oracle`), not a stored verdict; only deeper tool side-effects are
  canned. State this split aloud in the demo. *(Optional credibility flourish: let
  a judge type a wrong amount and watch it not flip.)*
- **`confirmation_rate` honesty:** if the canned read is a single deterministic
  trace, report it as **"1 deterministic confirmation"** — do **not** fabricate a
  length-5 `outcomes[]` / "5/5". Only claim n>1 if you genuinely run n seeded
  re-runs.
- Parallelism (MATCHER ∥ FRAUD) and self-heal run only on the **controlled seed**.
- Run one genuine live replay **offline** for the backup video. **The backup video
  is itself a P0 mitigation.**

### Replay gotchas (carry budget here)

- `Step.id` ≠ LangGraph `checkpoint_id`. Capture a **mapping** in `to_trace()`.
- `update_state` writes to graph **channels**, with `as_node` matching so
  downstream edges fire. Scope injection to the **one demo node** (EXTRACTOR's
  field); "inject at any agent" is a rabbit hole.
- **Deterministic ids for parallel nodes:** MATCHER ∥ FRAUD complete in
  nondeterministic order — assign `Step.id`/`index` **post-join in `to_trace()`,
  sorted by node name, not asyncio completion order**, or fixture-vs-live
  equivalence breaks. They are never fork sites; the single fork is pre-parallel
  EXTRACTOR.
- Keep `Step.state` JSON-serializable; reconstruct live resources fresh on resume.

---

## 11. Five supervisor capabilities — maturity, and what executes live

> **Status = intended end state.** As of 2026-06-20 every backend module is a stub;
> do not present a row as built until its module flips fail→pass on a real fixture.

| Capability | Maturity | How / **what executes live in the demo** |
|---|---|---|
| Inter-agent corrupted hand-off | REAL (planned) | EXTRACTOR's bad `amount` flows through real hand-off payloads |
| Monitor localizes earliest corruption | REAL (planned; `monitor.py`+`attribute()` are stubs today) | `attribute()` over the provenance graph |
| Replay-confirmed fix (flip) | REAL (planned; `replay()` is a stub today) | **`POST /replay` → real `replay()` → returned `ReplayResult` drives the trust flip & heal — not a pre-baked timeline** |
| Agents run in parallel | Staged | **real `asyncio` task completion drives swimlane/row timing**, on the controlled seed |
| Human → specific agent | Staged | **structured field+value form → real `replay()` injection** |
| Agents "self-heal" | Staged | monitor auto-applies the *replay-proven* fix → chain heals green |

**Staged ≠ fake — and ≠ scripted:** each staged capability issues a **real backend
call** whose `ReplayResult` drives the UI; only the underlying re-execution is
canned (§10). Any pure front-end animation MUST be labelled **"SCRIPTED (animation
only)."**

### Where the corrected value comes from (we do not invent it)

The corrected value is **re-derived from the source artifact** (re-extract the
field) or **supplied by the human** in the escalate path — **not** LLM-hallucinated,
**not** read from the oracle's answer key. The demo reads it from the pre-captured
trace only for determinism, but it *originates* from re-derivation. Therefore
**auto-apply only when the value is independently re-derivable; else escalate.**

---

## 12. Build order (dependency-respecting)

**Hour 0 — hard gates before parallel work:**
1. Contracts: use additively (`raw["agent"]`, `kind="handoff"`) — **and land the
   one required `types.ts` edit** (`'handoff'` in `StepKind`, `MonitorDecision`).
2. **`shared/fixtures/ap_fail.json` — does not exist yet; author it by adapting the
   conformant `flight_fail.json` (30-step shape + agent tags + cross-agent hand-off
   parents + a decoy + EXTRACTOR root). HARD GATE — unblocks everyone.** Fallback:
   a 2-agent EXTRACTOR→APPROVER trace if 4 agents aren't authorable in time.
3. **Spike the scary part:** confirm `update_state(as_node=...)` + resume injects at
   an AP node and changes the outcome. If not working by ~hour 3, fall back to
   fully-recorded value-conditioned replay and tell the team.

**Then in parallel, all against the fixture first:**
- **P1** — `agent/ap_graph.py`, `agent/monitor.py`, `eval/ap_oracle.py`.
  `monitor.supervise()` **integrates** `attribute()` (P2) and `replay()` (P1) and
  is therefore the **last seam to light up**; until both are real it runs against
  stubbed `Attribution`/`ReplayResult` (CLI-demoable in that stubbed form only).
- **P2** — `attribution/`: correct `Attribution` on `ap_fail.json` (root =
  EXTRACTOR's corrupted field) incl. cross-agent slices.
- **P3** — `web/`: render `ap_fail.json` as the **agent-tagged spine + monitor
  rail** + stubbed `Attribution`/`ReplayResult`/`MonitorDecision`; nail the
  cross-agent blast, the confirm-flip, the **trust gate**, and a real
  **status-quo log-wall** surface (the §15 step-2 contrast beat).
- **P4** — `api/` (SSE serving fixture/stubs), `sentry_issue.py` closer.

**P3 is unblocked by the fixture + stubs, not by the monitor.** The fixture path
must keep working as a fallback demo even after the live runtime is wired.

---

## 13. Module interfaces (seams; bodies are stubs to fill)

```python
attribution/localize.py:  attribute(trace: Trace) -> Attribution
replay/replay.py:         replay(trace, step_id, injected_value, n=5) -> ReplayResult
agent/capture.py:         to_trace(spans, checkpoints) -> Trace
agent/monitor.py:         supervise(trace: Trace) -> MonitorDecision   # localize→replay→apply/escalate
eval/ap_oracle.py:        evaluate(final_output, task) -> bool         # additive; demo path's Trace.success
```

### 13.1 Public API / SDK + CLI surface

> What the **package and the landing page** expose (the seams above are *internal*).
> **LangGraph-scoped today** — replay forks via checkpoints; broader frameworks are
> roadmap via OTel-span ingestion + the ACP proxy (§18). The public `supervise()`
> runtime wrapper is **distinct from** the internal `monitor.supervise(trace)`
> analysis (§13) — do not conflate the two names.

**SDK — `supervise()` (runtime capture context manager).**
```python
from blackbox import supervise

with supervise(team) as run:      # team = a LangGraph graph
    team.run(invoice)             # agents run unchanged; every hand-off recorded
```
Mechanics: on enter, ensure `team` is compiled with a **checkpointer**, start
**OTel/OpenInference tracing**, mint a `run_id`. During the run, spans + per-node
checkpoints feed **`to_trace()`**; agent→agent hand-offs become `kind="handoff"`
steps tagged via `raw["agent"]`. On exit, **`ap_oracle.evaluate()`** sets
`Trace.success` and the trace is persisted under `run_id`; on FAIL it may
auto-trigger the monitor. This is pure **capture orchestration** — it reuses
`to_trace()`, the checkpointer, and the oracle; **no new attribution logic.**

**CLI — `blackbox replay <run_id> [--confirm]` (the monitor loop, headless).**
```
$ blackbox replay ap_7c2 --confirm
```
Loads the stored `Trace` → `attribute()` → walks candidates **earliest-first**,
calling `replay(trace, step_id, corrected_value, n)` → the **earliest candidate
whose injection flips FAIL→PASS = confirmed root** → prints the `MonitorDecision`
(root, `confirmation_rate`, `trusted`, `auto_apply`/`escalate`) and files the Sentry
incident. `--confirm` runs the replay proof; without it, **localize-only (dry)**. On
the demo, replay reads the **value-conditioned pre-captured trace** (§10) — real
control flow + oracle, canned re-execution. The dashboard streams this *same*
pipeline over SSE; the CLI is the headless path.

**Honest scope:** both require a checkpointed **LangGraph** team — "any framework,
unchanged" is roadmap, not today (§14). Package name TBD (`blackbox` may be taken on
PyPI). The landing-page comment "your agents, unchanged" means *no logic rewrite of
your LangGraph team*, not zero instrumentation.

---

## 14. Guardrails / non-goals (do NOT gold-plate)

- **Single-root-cause, linear-ish failures only.** One early corrupted hand-off
  poisoning a forward chain across agents. No multi-cause attribution.
- **One demo scenario:** the AP pipeline mis-paying because EXTRACTOR mis-read a
  field. Optimize for this case.
- **The monitor stays mechanical.** localize→replay→decide is plain code; the only
  in-loop LLM is the node-judge. Never pitch it as "an AI that supervises."
- **The non-flip case is required**, surfaced cleanly, never a crash.
- **Replay determinism:** value-conditioned canned re-execution on stage; live
  control-flow + oracle for the decoy-vs-root pair; parallelism/self-heal on the
  seed; honest `confirmation_rate`.
- **Schema changes additive-only** — but note the **one required coordinated
  frontend edit** (`StepKind += 'handoff'`, `MonitorDecision`); see §7. No edits to
  other workstreams' folders except the *new* `eval/ap_oracle.py`.
- **No** auth, multi-user, production-scale monitoring, settings UI, general agent
  scheduler, arbitrary-framework support, semantic-memory/RAG store, or node-graph
  editor.
- **The AP demo fixture is the source of truth for the demo; flight is the offline
  benchmark.** Never let live flakiness block the other modules.

---

## 15. Acceptance test = the 90-second demo

1. The AP system runs **unprotected**: EXTRACTOR mis-reads the invoice `amount`; it
   flows through MATCHER → APPROVER → PAYMENT; a **wrong payment** is made at high
   confidence; verdict **FAIL**.
2. Show the **status-quo wall of inter-agent logs** — a *real rendered surface*
   (dense, all-neutral mono, no signal color) so the next beat visibly collapses it
   onto the one signalled step. "Every other supervisor stops here, or guesses."
3. **Localize** → the monitor highlights the earliest corrupted *productive* step
   (EXTRACTOR's field) and animates the **blast radius crossing agent gutters**
   (TARGET; CURRENT build animates down the single flight spine). Say *how*: "we
   walk the hand-off graph back to the first agent whose output doesn't follow from
   its inputs."
4. **Confirm** → replay a **decoy** candidate first (does *not* flip → rejected,
   rendered in the neutral rejected state with its `0/n` chip and visible
   re-target), then the true root → **flips fail→pass**. The confirm replay renders
   as DESIGN.md's **full-width overlay** (original-red → green-counterfactual as the
   overlay's before/after states, not a permanent split-screen).
5. **Supervise** → the **TrustBadge flips UNTRUSTED→TRUSTED co-timed with the
   FAIL→PASS verdict** (the single focal moment); the monitor auto-applies (or a
   human submits the structured correction); the chain **heals green** *after* as
   supporting motion.
6. Cut to the **Sentry incident** Blackbox filed automatically, with the structured
   hand-off payload.

**The single thing to remember:** we don't *guess* which agent failed — we localize
it on the hand-off graph and **prove** the fix by replay before any agent is
trusted to act.

---

## 16. Open risks & decisions (panel-flagged, ranked)

- **P0 — live on-stage replay flakiness** → value-conditioned pre-captured
  re-execution; live control-flow+oracle for decoy-vs-root; backup video;
  parallelism/self-heal on the seed. (§10)
- **P0 — "supervisor agent" reads as generic / an LLM guessing** → keep the monitor
  mechanical; show localize→replay→decide as a procedure; make the
  **UNTRUSTED→TRUSTED** transition the loudest beat. (§3, §3.1, §14)
- **P1 — "how did you find the agent?" credibility gap** → say the method in one
  sentence; show a decoy rejection. (§9, §15)
- **P1 — two-domain split-brain / unmeasured AP accuracy** → AP only on screen;
  flight is an offline n=1 stat; claim a measured number only for flight; AP is an
  existence proof. (§1, §2)
- **DECISION — real tool-using AP agent vs deterministic pipeline.** *Proposed:*
  keep a real Browserbase/Stagehand agent for **offline** capture, demo from the
  value-conditioned pre-captured trace (best of both). Judge-visible artifact: play
  the offline Browserbase run as the backup video to earn the track, then cut to
  the deterministic replay for the flip. Confirm with the team. (§5, §10)
- **P1 — Ochiai claim** → demote to node-judge; honest answer ready. (§9)
- **DECISION — AP domain** is proposed; easily swapped for another enterprise domain
  at low cost — the one easily-reversed choice here.
- **P2 — framework lock-in / unsafe live-tool replay** → name them; honest
  ingestion contract is OTel spans; side-effecting tools need record-replay/mocking
  in production.

---

## 17. Open coordination (follow-up, sibling docs — not in this doc's PR)

These keep the repo internally consistent and are tracked so they don't silently
drift (per AGENTS.md / DESIGN.md Maintenance rules):

- **`shared/fixtures/README.md` + `AGENTS.md`** — currently call `flight_fail.json`
  "the source of truth for the whole build." Reconcile to: **`ap_fail.json` = demo
  source of truth; `flight_fail.json` = offline benchmark only.**
- **`shared/schema.py` + `web/src/types.ts`** — add `MonitorDecision`; add
  `'handoff'` to `StepKind`; add `AgentId` + `agentOf()`; make `success` comments
  path-explicit (`ap_oracle` for the demo, `oracle.py` for the flight benchmark);
  update the `ReplayResult.n` comment ("deterministic on the demo seed; n>1 still
  reports `confirmation_rate` for rigor; non-deterministic only for offline capture").
- **`DESIGN.md`** — add the `TrustBadge` states/tokens (§3.1); the "multi-agent
  variant — same spine + agent gutter" layout block (§4.1); the hand-off-edge
  animation in Motion beat 1; a neutral **rejected/non-flip** treatment (never
  `--blast`/`--pass`); and sequence the confirm choreography (trust+verdict flip =
  focal moment, chain-heal after).

---

## 18. ACP proxy (stretch integration)

> **Decision: Option A** — the ACP proxy is a *secondary* capture/control surface
> bolted onto the multi-agent core, **not** a pivot to a single-agent product. It is
> a **stretch tier**: the AP prove-by-replay demo must stand alone without it.

Blackbox can run as a transparent **Agent Client Protocol (ACP)** proxy — a
man-in-the-middle on the editor↔agent JSON-RPC stream — giving **zero-instrumentation
live capture** and a **real channel to inject the replay-proven fix back to the
agent**.

### What ACP is (verified 2026-06 against agentclientprotocol.com)

ACP standardizes communication between **code editors/IDEs (the client)** and
**coding agents (the service)** — *LSP, but for agents*. Transport: **JSON-RPC over
stdio** for local agents (run as an editor subprocess); **HTTP/WebSocket** for remote
agents (work-in-progress). Representative methods: `initialize`, `session/new`,
`session/load`, `session/prompt`, `session/update` (streaming notifications),
`session/request_permission`, `tool/call`, `fs/read_text_file`, `terminal/execute`,
and — notably — `session/fork`. (See the §16 guardrail on `session/fork` below.)

### The proxy

```
  EDITOR (ACP client, e.g. Zed)  ⇄  [ blackbox ACP proxy ]  ⇄  AGENT (ACP server)
                                        │ tees every JSON-RPC message → to_trace()
                                        │ exposes inject(message) for the escalate/auto-apply path
```

### The honest seam (do not overclaim)

ACP is **editor ↔ ONE agent**. It does **not** carry **agent ↔ agent** hand-offs —
those stay internal to the AP runtime (the cross-agent attribution in §2/§9 does not
ride ACP). So the proxy is the **human/editor ↔ system surface** and a **per-agent
session recorder**; it **complements, does not replace,** the multi-agent story.
Never claim ACP transports the AP hand-offs.

### What Option A buys

1. **Zero-instrumentation live capture.** Sit on the wire and record `session/prompt`
   / `tool/call` / `session/update` traffic into canonical `Step`s (agent identity via
   `raw["agent"]`) — no SDK wrapping, no code change to the agent. The cleanest
   possible ingestion path, alongside the OTel-span contract (§16).
2. **A real injection channel.** §3's escalate ("a human messages the responsible
   agent") and the auto-apply both become an **injected/rewritten ACP message** sent
   back through the proxy — the proxy is where the supervisor *acts*. The injected
   value still originates from re-derivation or the human's structured form (§11), not
   from the proxy inventing it.
3. **"Runs inside a real editor" credibility.** Demoing blackbox as a proxy inside a
   real ACP client (e.g. Zed) is a strong "plugs into your actual tools" beat and a
   possible editor/track angle. (The team's earlier plan listed ACP as "don't build /
   stretch," so shipping it is a differentiator, not table stakes.)

### Contracts (additive, zero schema change)

ACP messages map to the canonical `Trace` through a **new capture adapter** — no new
contract: `session/prompt`, `tool/call`, and `session/update` become `Step`s; agent
membership rides `raw["agent"]`; the injection reuses the existing corrected-value
path. Mirrors the §16 "ingestion contract is OTel spans" philosophy — ACP is just a
second adapter.

### Guardrails

- **Replay stays on LangGraph checkpoints — NOT ACP `session/fork`.** ACP exposes a
  `session/fork`, but our deterministic fork→inject→re-run is the checkpoint mechanism
  (§10). The proxy is **observe + inject only**; do not route the replay flip through a
  live ACP session (reintroduces on-stage nondeterminism).
- **Stretch tier, recorded fallback.** Like Browserbase (§5/§16): demo live if solid,
  else play a recorded "blackbox proxying an ACP agent in Zed" clip to earn the
  credibility/track without risking the core flip.
- **Moat stays prove-by-replay.** The failure mode is the demo becoming "we built an
  ACP thing." ACP is the substrate; intervention-confirmed causality is the headline.

### Additive seam / ownership

`agent/acp_proxy.py` (P1/P4) — a thin JSON-RPC MITM that spawns/bridges the agent
(stdio subprocess locally; HTTP/WS for remote), tees traffic to `to_trace()`, and
exposes `inject(message)` for the escalate/auto-apply path. No contract change; rides
`raw` + `to_trace`. Out of scope for the core demo; build only after the AP
prove-by-replay loop is solid.


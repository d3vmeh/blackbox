# Blackbox — Build Plan & Issue List

> Prioritized, assignable tickets. Priority = demo impact, not effort.
> **P0** = the demo dies without it. **P1** = the demo is weak without it.
> **P2** = polish / sponsor coverage, cut first if time runs out.
> Everything builds against `shared/fixtures/flight_fail.json` (root=`s3`, decoy=`s14`,
> 24-step blast radius). See [ARCHITECTURE.md](./ARCHITECTURE.md) and [DEMO.md](./DEMO.md).

Legend: 🟥 P0 · 🟧 P1 · 🟦 P2 · ⛔ blocked-by · ✅ done

---

## Hour 0 — de-risk before going wide (whole team watches these two)

- ✅ **#1 Contracts** — `shared/schema.py` (5 Pydantic models).
- ✅ **#2 Fixture** — `shared/fixtures/flight_fail.json`, validated.
- 🟥 **#3 Replay spike (P1).** Throwaway checkpointed LangGraph; prove
  `update_state(values, as_node=...)` + `invoke(None, config)` actually injects a
  value at a node and changes the final output. **Decision gate:** if not working
  by ~hour 3 → switch replay to fully-recorded traces and tell the team. *This is
  the biggest unknown; do it first.*
- 🟥 **#4 Frontend types.** Mirror `schema.py` into `web/src/types.ts` (no `any`).
  Unblocks all of P3. ⛔ #1.

---

## P2 workstream — Attribution (`attribution/`)

- 🟥 **#10 Provenance graph + slices** (`provenance.py`). Build adjacency from
  `Step.parents`; `backward_slice(final)` and `forward_slice(root)`. Acceptance:
  `forward_slice("s3")` returns the 24 blast-radius ids; `s5/s6` excluded. ⛔ #1,#2.
- 🟥 **#11 Node-judges** (`judges.py`). Parallel Haiku calls; each sees **only**
  one step's `inputs`+`output` (never downstream/outcome). Returns
  (is_correct, reason). Acceptance: flags `s3` wrong ("July 12" → "2024-12-07");
  passes ordinary steps. ⛔ #1.
- 🟥 **#12 `attribute(trace)`** (`localize.py`). Backward slice → node-judges →
  blend with earliest-in-graph-order prior → ranked `candidates`; earliest
  high-suspicion = `root_step_id`; forward slice = `blast_radius`. **Acceptance:
  root=`s3`, blast=24 steps, and the decoy `s14` appears as a lower-ranked
  candidate.** ⛔ #10,#11.
- 🟧 **#13 Candidate ranking sanity.** Ensure `s14` (decoy) ranks as a *plausible*
  candidate (so the demo rejection is motivated) but below `s3`. Tune the blend.
- 🟦 **#14 Localization metric** (`eval/metrics.py` already stubbed). Report
  root-hit on the fixture. Honesty artifact for judges.
- 🟦 **#15 Spectrum-from-replays (stretch).** Only if replay is cheap: feed
  replay pass/fail rows in as an execution population for *real* SBFL. Do not
  block anything on this. (See ARCHITECTURE.md §7.)

---

## P1 workstream — Agent + Replay (`agent/`, `replay/`)

- 🟥 **#20 `replay()` on fixture** (`replay.py`). Fork at a step using
  `Step.state`, inject value, evaluate via oracle, return `ReplayResult` over
  `n=5`. **Must handle non-flip** (flipped=False is valid, not an error).
  Acceptance: inject correct date at `s3` → flip (5/5); inject at decoy `s14` →
  **no flip**. ⛔ #3,#2,#31.
- 🟥 **#21 Deterministic demo replay.** For the flight scenario, replay reads a
  **pre-captured corrected trace** so the on-stage flip is deterministic. Code
  path stays real; only re-execution is canned. ⛔ #20. *(Panel P0.)*
- 🟧 **#22 LangGraph subject agent** (`graph.py`). Checkpointed agent that books
  the flight via Stagehand. Real, but **last** among P1 tasks.
- 🟧 **#23 `to_trace()`** (`capture.py`). Spans + checkpoints → canonical `Trace`,
  **including the `Step.id` ↔ `checkpoint_id` mapping** replay needs. ⛔ #22.
- 🟧 **#24 Capture the corrected run** offline → fixture for #21, and record the
  **backup demo video** end-to-end. *(Backup video is itself a P0 mitigation.)*
- 🟦 **#25 Phoenix export.** Emit OTel/OpenInference spans to Phoenix as a
  side-channel (sponsor track). Off the critical path — screenshot-grade is fine.

---

## P3 workstream — Frontend (`web/`)

- 🟥 **#30 Trace spine + inspector.** Render all 30 steps top→down per
  [DESIGN.md](./DESIGN.md) (mono, dim ordinary steps); click → inspector shows
  `inputs`/`output`/`state`. ⛔ #4.
- 🟥 **#31 Blast-radius animation.** On Analyze: snap-focus the root (`--root`
  ring), then forward cascade neutral→`--blast` down the 24 poisoned steps
  (`staggerChildren`). ⛔ #30, attribution data (#12 or stub).
- 🟥 **#32 Confirm-flip moment.** Replay overlay: poisoned chain heals
  `--blast`→`--pass` in sequence; verdict flips **FAIL→PASS** on a spring. The
  heaviest motion in the app. ⛔ #30, replay data (#20 or stub).
- 🟥 **#33 Decoy rejection beat.** Show `s14` replay **not** flipping (stays red,
  marked rejected), then fall back to `s3` and flip. The credibility beat. ⛔ #32.
- 🟧 **#34 Counterfactual readout.** At the flip, show injected value
  before/after + the `n=5` outcomes (✓✓✓✓✓ → 100%) + suspicion scores. Cheap;
  converts "we prove it" into something on-screen. ⛔ #32.
- 🟧 **#35 Split-screen flip.** Frozen-red original timeline vs. green
  counterfactual growing from the fork point. The memorable closing frame. ⛔ #32.
- 🟧 **#36 Confidence-high-while-wrong.** Show "Booked ✓ 98% confident" next to the
  wrong Dec 7 date pre-analysis. Free tension. ⛔ #30.
- 🟦 **#37 SSE wiring.** Consume live `/attribute` and `/replay` streams instead of
  static fixture. ⛔ #41,#42.

---

## P4 workstream — API + Eval + Sentry (`api/`, `eval/`)

- 🟥 **#40 `oracle.evaluate()`** (`oracle.py`). Deterministic: did it book
  depart `2024-07-12`? Used by both `Trace.success` and every replay re-run.
  Acceptance: fixture → False; corrected → True. ⛔ #1.
- 🟥 **#41 `GET /trace/{id}` + `GET /attribute/{id}`.** Serve the fixture and the
  `Attribution` (SSE-stream candidates). Must serve fixture as fallback. ⛔ #1,#2.
- 🟥 **#42 `POST /replay`.** Stream per-run outcomes, return `ReplayResult`. Wraps
  #20/#21. ⛔ #20.
- 🟧 **#43 Sentry closer** (`sentry_issue.py`). On confirm, file a structured
  issue (trace id, root step, injected fix, n, confirmation_rate). ~30 min.
- 🟦 **#44 Redis.** Thin read/write of traces/results for the sponsor track. In-
  memory is fine until the end; do not build core state on it early.

---

## Integration order (swap stubs for live, one seam at a time)
1. Frontend on **static fixture** (no backend) → proves the animations.
2. API serves fixture over SSE → frontend consumes the stream.
3. Live `attribute()` replaces the stubbed `Attribution`.
4. Live `replay()` (deterministic, #21) replaces the stubbed `ReplayResult`.
5. Live agent (#22) feeds `to_trace()` — last, behind a flag. **Fixture path must
   keep working as the fallback demo throughout.**

## Cut order if time runs short (drop from the bottom)
#44 Redis → #25 Phoenix → #15 spectrum → #35 split-screen → #43 Sentry.
**Never cut:** #3, #12, #20, #21, #31, #32, #33.

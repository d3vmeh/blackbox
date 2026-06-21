# sashiLog — P2 Attribution Changes

Track of every change made to the repo by P2 (Attribution workstream).

---

## Session 2 — 2026-06-20

### Context
P1 merged `p1-impl` → `main`. Schema now includes:
- `Step.is_injected_fault` / `Step.correct_output` — ground-truth labels for eval only
- `Trace.gold_root_step_id` — correct answer, used only in regression eval
- 30 benchmark fixtures in `shared/fixtures/benchmark/` (12 parse, 10 select, 8 email)

### Files written (attribution/ only — no other folders touched)

| File | Action | What it does |
|---|---|---|
| `attribution/provenance.py` | Replaced stub | `build_provenance_graph`, `backward_slice`, `blast_radius` via networkx |
| `attribution/judges.py` | Replaced stub | Async Claude Haiku per-step judge; `judge_all_suspects` runs all concurrently |
| `attribution/rationale.py` | Created | Claude Sonnet one-sentence root-cause explanation |
| `attribution/localize.py` | Replaced stub | `position_score`, `rank_suspects`, async `attribute()` — main pipeline |
| `attribution/regression.py` | Created | `save_regression_case`, `run_regression_suite` across all fixtures |
| `attribution/main.py` | Created | Smoke test on bench_parse_00 + full regression suite runner |
| `attribution/__init__.py` | Updated | Exports `attribute` from localize |

### Other files changed

| File | Change |
|---|---|
| `pyproject.toml` | Added `networkx>=3.0` dependency |

### Algorithm design

```
attribute(trace):
  failing_step = last step with kind=="final" (or trace.steps[-1])
  G = build_provenance_graph(trace)          # networkx DiGraph from Step.parents
  suspects = backward_slice(G, failing_step) # nx.ancestors + failing step
  judge_scores = judge_all_suspects(...)     # parallel Haiku calls — local correctness only
  candidates = rank_suspects(...)            # (1-correctness)*0.7 + position_score*0.3
  root = candidates[0].step_id
  blast = blast_radius(G, root)              # nx.descendants in topological order
  rationale = generate_rationale(...)        # Sonnet, ≤40 words
  save_regression_case(trace, result)        # → shared/fixtures/regression/{id}.json
```

### Constraints honoured
- `is_injected_fault`, `correct_output`, `gold_root_step_id` are **never** read inside
  `attribute()` or the judges — those fields exist only in `regression.py` for eval.
- `shared/schema.py`, `agent/`, `replay/`, `eval/`, `api/` — **not touched**.

### Verified (no API key needed)
- `backward_slice(s10)` on bench_parse_00 = all 10 steps ✓
- `blast_radius(s4)` = `[s5, s6, s7, s8, s9, s10]` ✓
- Simulated ranking: s4 wins parse, s5 wins select, s9 wins email ✓

### Known limitation
`bench_select` fixtures: s5's inputs only contain `departure` date, not the flights
list, so the Haiku judge may be uncertain (~0.5). Meanwhile s8 (book_flight with
input=UA-441 but output=AA-218) is unambiguously wrong (~0.05). This could cause
the algorithm to rank s8 over s5 for select fixtures. Regression suite will report
real accuracy. A fix would be to include `step.state` in the judge context.

---

## Session 3 — 2026-06-20

### Bug fix: passive step filtering

**Problem:** `tool_result` steps with empty inputs `{}` were scored 0.00 by the Haiku judge
(empty inputs look incorrect), causing s3 to outrank s4 (the real fault step) on parse fixtures.

**Root cause:** `tool_result` steps are passive receivers — they receive data from external tool
calls and cannot introduce reasoning errors. Judging them like active reasoning steps is wrong.

**Fix (two files):**

`attribution/localize.py`:
- Added `PASSIVE_KINDS = {"tool_result"}` constant
- Added `filter_active_suspects(suspects, trace)` — strips passive steps from the suspect set
- `attribute()` now calls `filter_active_suspects` before `judge_all_suspects`

`attribution/judges.py`:
- Extended `_SYSTEM` prompt: "tool_call steps produce a function call string as output,
  not a reasoned result. Judge only whether the correct tool was called with correct parameters."

**Effect:** s3 (`tool_result`) is filtered out before judging on all fixtures.
s4 (the actual wrongly-parsed date step) now ranks highest as intended.

### Bug fix: judge missing agent state context

**Problem:** Select fixtures predict s1 instead of s5 (15/30 = 50% after passive filter fix).
Root causes:
1. `select_flight` (s5) inputs only contain `departure` date — the flights list is in `step.state`.
   Judge sees uncertain input→output mapping and scores s5 ~0.5.
2. s1 (plan, index=0) has position_score=1.0 and beats s5 when judge is uncertain.
   Email s9 also had date flip not caught in some runs.

**Fix (`attribution/judges.py`):** Include `step.state` in the judge prompt as "Agent state
(shared memory at this point)". State for s5 contains the full results list and
`selected_flight: UA-441`; output says "selected AA-218 @ $999" — mismatch is now obvious
to the judge (expected score ~0.0). State for email s9 contains `email_date: 2026-07-12`
but output has "depart 2026-12-07" — date swap is now visible. Judges question updated
to reference both inputs AND state.

---

## Session 1 — 2026-06-20 (discarded, pre-P1-merge)

Earlier session created `attribution/core.py`, `attribution/graph.py`, `attribution/judge.py`,
`attribution/loader.py`, `attribution/rank.py`, `attribution/rationale.py`, and a root-level
`main.py` against a hand-rolled `shared/fixtures/flight_fail.json`. All discarded when P1
merged real fixtures and schema into `main`. Session 2 rebuilds cleanly against P1's work.

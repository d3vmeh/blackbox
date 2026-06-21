"""P1 — Generate real coding-pipeline JSON artifacts for the dashboard (P1 → P3).

Writes shared/fixtures/code_run/{trace,attribution,replay}.json from one deterministic
run (no API key). The Attribution is MONITOR-derived (code/monitor.py is 7/7 correct),
not attribute() (which mislocalizes this scenario). Run: python -m agent.code.export_run
"""
from __future__ import annotations

import json
from pathlib import Path

from attribution.provenance import blast_radius, build_provenance_graph
from eval.code_oracle import evaluate_code
from shared.schema import Attribution, Candidate, ReplayResult

from . import monitor
from .graph import _strip_code, replay_code, run_code
from .scenarios import DEFAULT, CodeScenario

_OUT = Path("shared/fixtures/code_run")
_N = 5


def _step_for_agent(trace, agent: str):
    return next(s for s in trace.steps if s.raw.get("agent") == agent)


def _replay_result(scn: CodeScenario, step_id: str, agent: str, override: dict,
                   explanation: str | None = None) -> ReplayResult:
    base_failed = not replay_code(scn, None, None).success   # deterministic — compute once
    outcomes = [bool(replay_code(scn, agent, override).success and base_failed) for _ in range(_N)]
    return ReplayResult(trace_id="code_run", step_id=step_id, injected_value=override,
                        n=_N, flipped=any(outcomes), explanation=explanation,
                        confirmation_rate=sum(outcomes) / len(outcomes), outcomes=outcomes)


def _fix_explanation(scn: CodeScenario, agent: str, field: str, bad, good, think) -> str:
    """One plain-English sentence on WHY restoring `field` to `good` fixes the run.
    Uses the LLM when `think` is wired (live), else a deterministic template."""
    if think is not None:
        out = think("You explain a one-line code fix for a debugger UI. Reply with ONE plain "
                    "sentence, no preamble.",
                    f"Task: {scn.requirement}\nThe {agent} produced {field}={bad!r}, but it should "
                    f"be {good!r}. Why does correcting {field} to {good!r} make the code pass its "
                    f"hidden acceptance tests?")
        if out and out.strip():
            return out.strip()
    return (f"Correcting {agent}'s {field} from {bad!r} to {good!r} restores the right value, so "
            f"every downstream step and the acceptance test pass.")


def _llm_repair(scn: CodeScenario, buggy_code: str, think) -> str | None:
    """Have the model REPAIR its own buggy code, shown the tests it fails. The patch is verified
    separately by the oracle (the model never decides 'fixed' — the deterministic tests do).
    Returns the patched code, or None in mock mode / on an empty reply."""
    if think is None:
        return None
    patched = think(
        "You are a Python engineer fixing a bug. Return ONLY the corrected, runnable code (no "
        "markdown, no prose) that defines the function. Fix the underlying logic — do NOT "
        "special-case the test inputs.",
        f"This {scn.function_name} implementation fails its tests:\n\n{buggy_code}\n\n"
        f"It must pass all of:\n{scn.acceptance_tests}\nReturn the corrected function.")
    patched = _strip_code(patched)
    return patched if f"def {scn.function_name}" in patched else None


def _natural_artifacts(trace, scn: CodeScenario, think) -> dict:
    """NATURAL-FAILURE path: no fault was injected, so the bug is the live implementer's own
    code. Localize + confirm DETERMINISTICALLY over the recorded trace — the recorded code fails
    the hidden tests, the reference code passes, so the implementer is the root and swapping its
    code flips the run. (Only the implementer's code reaches the oracle, and the model self-corrects
    ambiguous specs upstream, so a natural failure always lands here.)"""
    final_code = trace.final_output["code"]
    if evaluate_code(final_code, scn):
        empty = Attribution(trace_id="code_run", root_step_id="", blast_radius=[], candidates=[],
                            rationale="No failure this run — the model happened to resolve the "
                                      "ambiguous requirement correctly. Re-run to surface the bug.")
        return {"trace": trace.model_dump(), "attribution": empty.model_dump(), "replays": {}}

    impl = _step_for_agent(trace, "implementer")
    ref_code = monitor._reference_output(scn, "implementer")["code"]

    # THE FIX (natural scenarios): let the model repair its OWN code, then VERIFY with the oracle.
    # The deterministic tests decide "fixed", not the model. Fall back to the known-correct
    # reference if the model's patch doesn't pass (keeps the demo reliable).
    patched = _llm_repair(scn, final_code, think)
    if patched and evaluate_code(patched, scn):
        fix_code, by_model = patched, True
    else:
        fix_code, by_model = ref_code, False

    blast = blast_radius(build_provenance_graph(trace), impl.id)
    reason = ("the implementer's own code fails the hidden tests — a real bug the model "
              "introduced, with NO fault injected")
    candidates = [Candidate(step_id=impl.id, suspicion=0.95, reason=reason)]
    candidates += [Candidate(step_id=sid, suspicion=0.30, reason="inherited the buggy output")
                   for sid in blast[:2]]
    rationale = ("No fault was injected — this is the live model's own mistake on an ambiguous "
                 "requirement. The hidden tests expect the human-intuitive convention, but the "
                 "model's code resolves the ambiguity differently, so the tests fail. Replacing "
                 "only the implementer's code with a correct version flips the run to PASS.")
    attribution = Attribution(trace_id="code_run", root_step_id=impl.id, blast_radius=blast,
                              candidates=candidates, rationale=rationale)

    flipped = (not evaluate_code(final_code, scn)) and evaluate_code(fix_code, scn)
    why = _fix_explanation(scn, "implementer", "code", final_code, fix_code, think)
    if by_model:
        why = "Claude repaired its own code; the acceptance tests confirm it. " + why
    replay = ReplayResult(trace_id="code_run", step_id=impl.id, injected_value={"code": fix_code},
                          n=1, flipped=flipped, confirmation_rate=1.0 if flipped else 0.0,
                          outcomes=[flipped], explanation=why)
    return {"trace": trace.model_dump(), "attribution": attribution.model_dump(),
            "replays": {impl.id: replay.model_dump()}}


def build_artifacts(scn: CodeScenario = DEFAULT, *, think=None) -> dict:
    """Run the pipeline once and return {trace, attribution, replays} as plain dicts.

    `think` (from agent.llm.make_think) makes the AGENTS real Claude calls; localization and
    replay stay deterministic (fast). A passing run (the clean control) has no root cause, so
    it returns an empty-but-valid Attribution and no replays."""
    trace = run_code(scn, think=think, trace_id="code_run")
    if scn.natural:                                  # no injected fault — the LLM's own bug
        return _natural_artifacts(trace, scn, think)
    verdict = monitor.investigate(trace, scn)
    root = next((s for s in trace.steps if s.raw.get("agent") == verdict.root_agent), None)
    if not verdict.failed or root is None:
        # No failure (clean control), OR a failure the monitor couldn't pin to one step
        # (e.g. a live run that failed naturally / a self-corrected fault) — return a
        # valid-but-empty Attribution instead of crashing.
        msg = ("No failure — every agent produced correct output." if not verdict.failed
               else "Run failed, but the cause could not be localized to a single step.")
        empty = Attribution(trace_id="code_run", root_step_id="", blast_radius=[],
                            candidates=[], rationale=msg)
        return {"trace": trace.model_dump(), "attribution": empty.model_dump(), "replays": {}}

    # blast = forward slice from the root over real parents edges
    G = build_provenance_graph(trace)
    blast = blast_radius(G, root.id)

    # candidates + rationale from the root's ground-truth wrong->correct diff
    correct = root.correct_output or {}
    diffs = ((k, root.output.get(k), correct.get(k))
             for k in correct if root.output.get(k) != correct.get(k))
    try:
        field, bad, good = next(diffs)
    except StopIteration:
        raise ValueError(f"root step {root.id} has no output↔correct_output diff to attribute")
    # For code/multi-line fields, DON'T dump the value into the prose (repr() escapes newlines into
    # an unreadable blob) — the actual before→after is rendered in the WHAT HAPPENED / THE FIX diff.
    # Short scalar faults (e.g. unit='minutes') keep the inline before→after, which reads cleanly.
    codeish = field in ("code", "tests") or (isinstance(bad, str) and "\n" in bad)
    if codeish:
        reason = f"{verdict.root_agent} wrote {field} that fails the hidden tests — see the diff"
        rationale = (f"The {verdict.root_agent}'s {field} is wrong (shown in WHAT HAPPENED / THE FIX); "
                     f"every downstream step inherited it and the acceptance test failed.")
    else:
        reason = f"{verdict.root_agent} set {field}={bad!r}; should be {good!r}"
        rationale = (f"The {verdict.root_agent} set {field}={bad!r} (should be {good!r}); every "
                     f"downstream step inherited it and the acceptance test failed.")
    candidates = [Candidate(step_id=root.id, suspicion=0.92, reason=reason)]
    candidates += [Candidate(step_id=sid, suspicion=0.30, reason="inherited the wrong value")
                   for sid in blast[:2]]
    attribution = Attribution(trace_id="code_run", root_step_id=root.id, blast_radius=blast,
                              candidates=candidates, rationale=rationale)

    # root flip (with a "why this fix works" explanation) + decoy non-flip
    # (test_writer's output never reaches the oracle, so correcting it does not flip)
    decoy = _step_for_agent(trace, "test_writer")
    why = _fix_explanation(scn, verdict.root_agent, field, bad, good, think)
    replays = {
        root.id: _replay_result(scn, root.id, verdict.root_agent, {field: good}, explanation=why),
        decoy.id: _replay_result(scn, decoy.id, "test_writer",
                                 monitor._reference_output(scn, "test_writer")),
    }
    return {"trace": trace.model_dump(),
            "attribution": attribution.model_dump(),
            "replays": {k: v.model_dump() for k, v in replays.items()}}


def main() -> None:
    art = build_artifacts(DEFAULT)
    _OUT.mkdir(parents=True, exist_ok=True)
    (_OUT / "trace.json").write_text(json.dumps(art["trace"], indent=2))
    (_OUT / "attribution.json").write_text(json.dumps(art["attribution"], indent=2))
    (_OUT / "replay.json").write_text(json.dumps(art["replays"], indent=2))
    print(f"wrote {_OUT}/ : trace.json, attribution.json, replay.json")


if __name__ == "__main__":
    main()

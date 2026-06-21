"""P1 — Dashboard artifacts for the software-team (billing) subject. Returns the same
{trace, attribution, replays, meta, monitor} shape the demo domains emit, so the redesigned
dashboard renders this subject identically. Causal artifacts come from a deterministic
run + replay; `think` makes the 3 leaf modules real Claude calls (localization/replay stay
deterministic)."""
from __future__ import annotations

from shared.schema import Attribution, Candidate, MonitorDecision, ReplayResult

from . import monitor
from .graph import replay_team, run_team
from .scenarios import DEFAULT, TeamScenario

_N = 5
_AGENT_LABELS = {"architect": "ARCHITECT", "pricing": "PRICING", "discount": "DISCOUNT",
                 "tax": "TAX", "integrator": "INTEGRATOR", "test_writer": "TESTS",
                 "reviewer": "REVIEW", "ci": "CI"}
_PARALLEL = ["pricing", "discount", "tax"]


def _step_for_agent(trace, agent: str):
    return next(s for s in trace.steps if s.raw.get("agent") == agent)


def _replay_result(scn: TeamScenario, step_id: str, agent: str, override: dict,
                   explanation: str | None = None) -> ReplayResult:
    base_failed = not replay_team(scn, None, None).success   # deterministic — compute once
    outcomes = [bool(replay_team(scn, agent, override).success and base_failed)
                for _ in range(_N)]
    return ReplayResult(trace_id="team_run", step_id=step_id, injected_value=override, n=_N,
                        flipped=any(outcomes), explanation=explanation,
                        confirmation_rate=sum(outcomes) / len(outcomes), outcomes=outcomes)


def _fix_explanation(agent: str, field: str, bad, good) -> str:
    return (f"Restoring {agent}'s {field} from {bad!r} to {good!r} makes the integrator compose "
            f"the modules in the right order, so the receipt total matches the acceptance suite.")


def _meta(scn: TeamScenario, root_agent: str, decision: str, live: bool) -> dict:
    engine = "8-agent software team · " + ("Claude Haiku 4.5" if live else "deterministic")
    return {"runtime": "multi-agent", "domain": "software team · billing", "engine": engine,
            "pipeline": ["record", "localize", "confirm", "supervise"],
            "agent_labels": _AGENT_LABELS, "scenario": scn.name,
            "parallel_agents": _PARALLEL, "fork_agent": root_agent,
            "monitor_decision": decision}


def _empty(scn: TeamScenario, trace, live: bool, msg: str) -> dict:
    empty = ReplayResult(trace_id="team_run", step_id="", injected_value=None, n=0,
                         flipped=False, confirmation_rate=0.0, outcomes=[])
    mon = MonitorDecision(trace_id="team_run", root_step_id="", replay=empty,
                          trusted=True, decision="auto_apply")
    attr = Attribution(trace_id="team_run", root_step_id="", blast_radius=[], candidates=[],
                       rationale=msg)
    return {"trace": trace.model_dump(), "attribution": attr.model_dump(), "replays": {},
            "meta": _meta(scn, "", "auto_apply", live), "monitor": mon.model_dump()}


def build_artifacts(scn: TeamScenario = DEFAULT, *, think=None) -> dict:
    live = think is not None
    trace = run_team(scn, think=think, trace_id="team_run")
    verdict = monitor.investigate(trace, scn)   # deterministic localize, even on live runs
    root = next((s for s in trace.steps if s.raw.get("agent") == verdict.root_agent), None)
    if not verdict.failed or root is None:
        msg = ("No failure — every agent produced correct output." if not verdict.failed
               else "Run failed, but the cause could not be localized to a single step.")
        return _empty(scn, trace, live, msg)

    blast = monitor.poisoned_path(trace)   # honest blast: integrator -> reviewer -> ci
    correct = root.correct_output or {}
    diffs = ((k, root.output.get(k), correct.get(k))
             for k in correct if root.output.get(k) != correct.get(k))
    try:
        field, bad, good = next(diffs)
    except StopIteration:
        return _empty(scn, trace, live, "Run failed, but no decision diverged from the reference.")

    reason = f"{verdict.root_agent} set {field}={bad!r}; should be {good!r}"
    rationale = (f"The {verdict.root_agent} chose {field}={bad!r} (should be {good!r}); the "
                 f"integrator composed the modules in that order, so every downstream step "
                 f"inherited the wrong total and the acceptance suite failed.")
    candidates = [Candidate(step_id=root.id, suspicion=0.93, reason=reason)]
    candidates += [Candidate(step_id=sid, suspicion=0.30, reason="inherited the wrong total")
                   for sid in blast[:2]]
    why = _fix_explanation(verdict.root_agent, field, bad, good)
    attribution = Attribution(trace_id="team_run", root_step_id=root.id, blast_radius=blast,
                              candidates=candidates, rationale=rationale,
                              suggested_fix={field: good})

    root_replay = _replay_result(scn, root.id, verdict.root_agent, {field: good}, explanation=why)
    decoy = _step_for_agent(trace, "test_writer")          # tests never reach the oracle -> no flip
    decoy_replay = _replay_result(scn, decoy.id, "test_writer",
                                  monitor._reference_output(scn, "test_writer"))
    trusted = root_replay.flipped and root_replay.confirmation_rate >= 0.5
    decision = "auto_apply" if trusted else "escalate"
    mon = MonitorDecision(trace_id="team_run", root_step_id=root.id, replay=root_replay,
                          trusted=trusted, decision=decision)

    trace = trace.model_copy(update={"gold_root_step_id": root.id})
    return {"trace": trace.model_dump(),
            "attribution": attribution.model_dump(),
            "replays": {root.id: root_replay.model_dump(),
                        decoy.id: decoy_replay.model_dump()},
            "meta": _meta(scn, verdict.root_agent, decision, live),
            "monitor": mon.model_dump()}

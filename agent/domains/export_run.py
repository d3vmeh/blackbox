"""Export dashboard artifacts for the four demo domains."""
from __future__ import annotations

import json
from pathlib import Path

from attribution.provenance import blast_radius, build_provenance_graph
from shared.schema import Attribution, Candidate, MonitorDecision, ReplayResult
from shared.scenarios.manifest import BY_ID, DOMAINS, HERO_ID

from .engine import localize, replay_pipeline, run_pipeline
from .pipelines import SPECS, get_spec

_N = 5
_TRUST_THRESHOLD = 0.5
_FIXTURES = Path("shared/fixtures")


def _step_for_agent(trace, agent: str):
    return next(s for s in trace.steps if s.raw.get("agent") == agent)


def _replay_result(spec, step_id: str, agent: str, override: dict) -> ReplayResult:
    baseline = replay_pipeline(spec, None, None)
    base_fail = not spec.oracle(baseline.final_output)
    outcomes = [
        spec.oracle(replay_pipeline(spec, agent, override).final_output) and base_fail
        for _ in range(_N)
    ]
    rate = sum(outcomes) / len(outcomes) if outcomes else 0.0
    return ReplayResult(
        trace_id=spec.domain_id,
        step_id=step_id,
        injected_value=override,
        n=_N,
        flipped=any(outcomes),
        confirmation_rate=rate,
        outcomes=outcomes,
    )


def _monitor(root_replay: ReplayResult) -> MonitorDecision:
    trusted = root_replay.flipped and root_replay.confirmation_rate >= _TRUST_THRESHOLD
    return MonitorDecision(
        trace_id=root_replay.trace_id,
        root_step_id=root_replay.step_id,
        replay=root_replay,
        trusted=trusted,
        decision="auto_apply" if trusted else "escalate",
    )


def _meta(spec, root_agent: str, monitor: MonitorDecision) -> dict:
    domain = BY_ID[spec.domain_id]
    parallel = [list(g) for g in domain.parallel_groups]
    return {
        "runtime": "multi-agent",
        "domain": spec.domain_tag,
        "engine": spec.engine,
        "pipeline": list(spec.pipeline_stages),
        "agent_labels": spec.display_labels,
        "scenario": spec.domain_id,
        "parallel_agents": parallel[0] if parallel else [],
        "fork_agent": root_agent,
        "monitor_decision": monitor.decision,
    }


def _clean_artifacts(spec, trace) -> dict:
    """A live domain run where the model happened to produce the correct output — no root cause."""
    empty = ReplayResult(trace_id=spec.domain_id, step_id="", injected_value=None, n=0,
                         flipped=False, confirmation_rate=0.0, outcomes=[])
    monitor = MonitorDecision(trace_id=spec.domain_id, root_step_id="", replay=empty,
                              trusted=True, decision="auto_apply")
    attribution = Attribution(trace_id=spec.domain_id, root_step_id="", blast_radius=[],
                              candidates=[], rationale="No failure this run — the live agent chose "
                              "the correct option. Re-run to surface the natural error.")
    return {"trace": trace.model_dump(), "attribution": attribution.model_dump(),
            "replays": {}, "monitor": monitor.model_dump(), "meta": _meta(spec, "", monitor)}


def build_artifacts(domain_id: str = HERO_ID, *, think=None) -> dict:
    spec = get_spec(domain_id)
    trace = run_pipeline(spec, trace_id=domain_id, think=think)
    if trace.success:
        # deterministic domains always fail (injected); a live domain can pass if the model is right
        return _clean_artifacts(spec, trace)

    found = localize(trace, spec)
    if found is None:
        raise ValueError(f"could not localize root for {domain_id}")
    step, agent, field, wrong, correct = found

    root = step
    decoy = _step_for_agent(trace, spec.decoy_agent)
    G = build_provenance_graph(trace)
    blast = blast_radius(G, root.id)

    domain = BY_ID[domain_id]
    labels = spec.display_labels
    candidates = [
        Candidate(
            step_id=root.id,
            suspicion=0.92,
            reason=(f"{labels.get(agent, agent)} set {field}={wrong!r}; should be {correct!r}"),
        ),
        Candidate(
            step_id=decoy.id,
            suspicion=0.45,
            reason=f"{labels.get(spec.decoy_agent, spec.decoy_agent)} looks suspicious but replay does not flip",
        ),
    ]
    if blast:
        candidates.append(Candidate(
            step_id=blast[0], suspicion=0.30, reason="inherited the corrupted hand-off",
        ))

    attribution = Attribution(
        trace_id=domain_id,
        root_step_id=root.id,
        blast_radius=blast,
        candidates=candidates,
        rationale=domain.primary_fault.symptom,
        suggested_fix={field: correct},
    )

    root_replay = _replay_result(spec, root.id, agent, {field: correct})
    decoy_replay = _replay_result(spec, decoy.id, spec.decoy_agent, spec.decoy_override)
    monitor = _monitor(root_replay)

    trace = trace.model_copy(update={"gold_root_step_id": root.id, "success": False})
    replays = {root.id: root_replay, decoy.id: decoy_replay}

    meta = _meta(spec, agent, monitor)
    if think is not None and agent in spec.live:
        # this run's root agent actually ran on a real model — say so (honest LIVE label)
        meta["engine"] = f"{spec.engine} · LIVE · Claude Haiku 4.5"
        meta["live_agent"] = agent

    return {
        "trace": trace.model_dump(),
        "attribution": attribution.model_dump(),
        "replays": {k: v.model_dump() for k, v in replays.items()},
        "monitor": monitor.model_dump(),
        "meta": meta,
    }


def write_fixtures(domain_id: str = HERO_ID, out_dir: Path | None = None) -> Path:
    art = build_artifacts(domain_id)
    dest = out_dir or (_FIXTURES / domain_id)
    dest.mkdir(parents=True, exist_ok=True)
    for name in ("trace", "attribution", "replay", "monitor", "meta"):
        key = "replays" if name == "replay" else name
        (dest / f"{name}.json").write_text(json.dumps(art[key], indent=2))
    return dest


def write_all_fixtures() -> list[Path]:
    return [write_fixtures(d.id) for d in DOMAINS]


def main() -> None:
    paths = write_all_fixtures()
    for p in paths:
        print(f"wrote {p}/")


if __name__ == "__main__":
    main()

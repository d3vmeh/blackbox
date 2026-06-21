"""Emit four demo-domain traces to Arize AX (FAIL + healed pair per domain).

Deterministic pipelines only — same engine as the dashboard fixtures.
"""
from __future__ import annotations

import os

from shared.schema import MonitorDecision, Trace

from agent.domains.engine import localize, replay_pipeline, run_pipeline
from agent.domains.export_run import _monitor, _replay_result
from agent.domains.pipelines import get_spec
from shared.scenarios.manifest import DOMAINS, ScenarioDomain

from .. import tracing
from ..otel import emit_trace


def _monitor_meta(
    domain: ScenarioDomain,
    *,
    root_step_id: str,
    fork_agent: str,
    monitor: MonitorDecision,
    healed: bool = False,
) -> dict:
    return {
        "runtime": "multi-agent",
        "domain_id": domain.id,
        "domain": domain.label,
        "scenario": domain.id,
        "fork_agent": fork_agent,
        "root_step_id": root_step_id,
        "expected": {
            "oracle_pass": True,
            "primary_fault": domain.primary_fault.field,
            "symptom": domain.primary_fault.symptom,
        },
        "arize_evaluators": list(domain.arize.evaluators),
        "replay_confirmed": monitor.replay.flipped,
        "confirmation_rate": monitor.replay.confirmation_rate,
        "monitor_decision": monitor.decision,
        "healed": healed,
    }


def emit_domain_pair(domain_id: str) -> list[str]:
    """Export one domain's fail (+ healed when replay flips). Returns trace ids emitted."""
    spec = get_spec(domain_id)
    domain = next(d for d in DOMAINS if d.id == domain_id)

    fail = run_pipeline(spec, trace_id=domain.arize.fail_trace_id)
    found = localize(fail, spec)
    if found is None:
        raise ValueError(f"could not localize root for {domain_id}")
    step, agent, field, _wrong, correct = found
    monitor = _monitor(_replay_result(spec, step.id, agent, {field: correct}))
    fail = fail.model_copy(update={"gold_root_step_id": step.id, "success": False})

    meta_fail = _monitor_meta(domain, root_step_id=step.id, fork_agent=agent, monitor=monitor)
    emit_trace(fail, backend="arize", monitor=meta_fail, flush=False)

    ids = [fail.id]
    if monitor.replay.flipped:
        healed = replay_pipeline(spec, agent, {field: correct}, trace_id=domain.arize.healed_trace_id)
        healed = healed.model_copy(update={"gold_root_step_id": step.id, "success": True})
        meta_healed = _monitor_meta(domain, root_step_id=step.id, fork_agent=agent, monitor=monitor, healed=True)
        emit_trace(healed, backend="arize", monitor=meta_healed, flush=False)
        ids.append(healed.id)

    return ids


def emit_all_domains(*, setup_tracing: bool = True) -> list[str]:
    """Export FAIL+healed pairs for all four manifest domains. Returns all trace ids."""
    if setup_tracing:
        tracing.setup_tracing()
    all_ids: list[str] = []
    for domain in DOMAINS:
        all_ids.extend(emit_domain_pair(domain.id))
    ok = tracing.flush_tracing()
    tracing.shutdown_tracing()
    project = os.environ.get("ARIZE_PROJECT_NAME", "blackbox")
    print(f"[arize] project={project!r} domains={[d.id for d in DOMAINS]} traces={all_ids} -> https://app.arize.com")
    if not ok:
        print("[arize] flush returned False — check ARIZE_SPACE_ID / ARIZE_API_KEY")
    return all_ids

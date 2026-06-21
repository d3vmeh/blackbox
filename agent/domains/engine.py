"""Generic deterministic multi-agent pipeline engine for demo domains."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, Union

from shared.schema import Trace

from agent.capture import Recorder

ComputeFn = Callable[[dict[str, Any]], dict[str, Any]]
OracleFn = Callable[[Any], bool]
RunStep = Union[str, tuple[str, ...]]


@dataclass(frozen=True)
class Fault:
    agent: str
    field: str
    bad_value: Any
    good_value: Any


@dataclass(frozen=True)
class PipelineSpec:
    domain_id: str
    task: str
    domain_tag: str
    engine: str
    display_labels: dict[str, str]
    parents: dict[str, tuple[str, ...]]
    kinds: dict[str, str]
    compute: dict[str, ComputeFn]
    oracle: OracleFn
    primary_fault: Fault
    decoy_agent: str
    decoy_override: dict[str, Any]
    run_order: tuple[RunStep, ...]
    pipeline_stages: tuple[str, ...] = ("record", "localize", "confirm", "supervise")


@dataclass
class RunContext:
    spec: PipelineSpec
    rec: Recorder
    up: dict[str, dict] = field(default_factory=dict)
    last: dict[str, str] = field(default_factory=dict)
    fork_agent: Optional[str] = None
    override: Optional[dict] = None


def _ne(a: Any, b: Any) -> bool:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) > 0.005
    return a != b


def _compute(ctx: RunContext, agent: str) -> tuple[dict, bool, dict]:
    correct = ctx.spec.compute[agent](ctx.up)
    out = dict(correct)
    fault = ctx.spec.primary_fault
    if fault.agent == agent:
        out[fault.field] = fault.bad_value
    is_fault = fault.agent == agent
    return out, is_fault, correct


def _emit(ctx: RunContext, agent: str, out: dict, is_fault: bool, correct: dict) -> None:
    labels = ctx.spec.display_labels
    parents = ctx.spec.parents[agent]
    sid = ctx.rec.record(
        node=agent,
        agent=agent,
        kind=ctx.spec.kinds[agent],
        inputs={"from": list(parents)} if parents else {"task": ctx.spec.task},
        output=out,
        state={"up": dict(ctx.up)},
        parents=[ctx.last[p] for p in parents],
        correct_output=correct,
        is_injected_fault=is_fault,
    )
    ctx.rec._steps[-1] = ctx.rec._steps[-1].model_copy(update={
        "raw": {
            **ctx.rec._steps[-1].raw,
            "runtime": "multi-agent",
            "domain": ctx.spec.domain_tag,
            "display": labels.get(agent, agent.upper()),
        },
    })
    ctx.last[agent] = sid
    ctx.up[agent] = out
    if ctx.fork_agent == agent and ctx.override:
        merged = dict(ctx.up[agent])
        for k, v in ctx.override.items():
            if isinstance(v, dict) and isinstance(merged.get(k), dict):
                merged[k] = {**merged[k], **v}
            else:
                merged[k] = v
        ctx.up[agent] = merged


def _produce(ctx: RunContext, agent: str) -> None:
    _emit(ctx, agent, *_compute(ctx, agent))


def _run_parallel(ctx: RunContext, agents: tuple[str, ...]) -> None:
    with ThreadPoolExecutor(max_workers=len(agents)) as pool:
        results = {a: pool.submit(_compute, ctx, a) for a in agents}
        for agent in agents:
            _emit(ctx, agent, *results[agent].result())


def run_pipeline(spec: PipelineSpec, *, trace_id: str, fork_agent: Optional[str] = None,
                 override: Optional[dict] = None) -> Trace:
    ctx = RunContext(spec=spec, rec=Recorder(trace_id, spec.task),
                     fork_agent=fork_agent, override=override)
    for step in spec.run_order:
        if isinstance(step, tuple):
            _run_parallel(ctx, step)
        else:
            _produce(ctx, step)
    final_agent = spec.run_order[-1]
    if isinstance(final_agent, tuple):
        final_agent = final_agent[-1]
    final = ctx.up[final_agent]
    return ctx.rec.finish(final_output=final, success=spec.oracle(final))


def replay_pipeline(spec: PipelineSpec, fork_agent: Optional[str], override: Optional[dict],
                    *, trace_id: str = "replay") -> Trace:
    return run_pipeline(spec, trace_id=trace_id, fork_agent=fork_agent, override=override)


def localize(trace: Trace, spec: PipelineSpec) -> Optional[tuple[Any, str, str, Any, Any]]:
    up: dict[str, dict] = {}
    for step in trace.steps:
        agent = step.raw.get("agent")
        if agent not in spec.compute:
            continue
        expected = spec.compute[agent](up)
        out = step.output if isinstance(step.output, dict) else {}
        for k, ev in expected.items():
            if _ne(out.get(k), ev):
                return step, agent, k, out.get(k), ev
        up[agent] = out
    return None

"""Export canonical Traces as OpenTelemetry spans.

Backends:
  phoenix  — local `phoenix serve` at http://localhost:6006 (default for --otel)
  arize    — Arize AX cloud at https://app.arize.com (use --arize)

    python -m agent.flight.run --arize    # flight benchmark -> Arize AX
    python -m agent.ap.run --arize        # AP demo -> Arize AX (needs .env keys)
    python -m agent.ap.run --otel         # AP demo -> local Phoenix
    phoenix serve && python -m agent.ap.run --otel
"""
from __future__ import annotations

import json
import os
from typing import Any, Literal

from openinference.semconv.trace import OpenInferenceMimeTypeValues, OpenInferenceSpanKindValues, SpanAttributes
from shared.schema import Step, Trace

Backend = Literal["phoenix", "arize"]
_PHOENIX_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:6006/v1/traces")
_PHOENIX_HINT = "pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http arize-phoenix"
_JSON = OpenInferenceMimeTypeValues.JSON.value
_TEXT = OpenInferenceMimeTypeValues.TEXT.value
_MAX = 4000


def _clip(text: str, limit: int = _MAX) -> str:
    return text if len(text) <= limit else text[: limit - 3] + "..."


def _as_json(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return _clip(value)
    return _clip(json.dumps(value, default=str))


def _phoenix_setup():
    try:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter  # type: ignore
        from opentelemetry.sdk.resources import Resource  # type: ignore
        from opentelemetry.sdk.trace import TracerProvider  # type: ignore
        from opentelemetry.sdk.trace.export import BatchSpanProcessor  # type: ignore
    except Exception:
        return None
    provider = TracerProvider(resource=Resource.create({"service.name": "blackbox"}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=_PHOENIX_ENDPOINT)))
    return provider, provider.get_tracer("blackbox")


def _io_attrs(*, inp: Any = None, out: Any = None, json_out: bool = True) -> dict[str, str]:
    attrs: dict[str, str] = {}
    if inp is not None and inp != {}:
        attrs[SpanAttributes.INPUT_VALUE] = _as_json(inp)
        attrs[SpanAttributes.INPUT_MIME_TYPE] = _JSON if isinstance(inp, (dict, list)) else _TEXT
    if out is not None:
        attrs[SpanAttributes.OUTPUT_VALUE] = _as_json(out)
        attrs[SpanAttributes.OUTPUT_MIME_TYPE] = _JSON if json_out and not isinstance(out, str) else _TEXT
    return attrs


def _step_kind(step: Step) -> str:
    if step.kind in {"tool_call", "tool_result"} or step.tool_name:
        return OpenInferenceSpanKindValues.TOOL.value
    if step.kind in {"reason", "decision"}:
        return OpenInferenceSpanKindValues.AGENT.value
    return OpenInferenceSpanKindValues.TOOL.value


def _step_name(step: Step) -> str:
    if step.raw.get("agent"):
        return str(step.raw["agent"]).upper()
    if step.raw.get("node"):
        return str(step.raw["node"])
    return step.id


def _write_spans(tracer, trace: Trace, *, monitor: dict | None = None) -> int:
    from opentelemetry.trace import SpanKind, Status, StatusCode  # type: ignore

    verdict = "PASS" if trace.success else "FAIL"
    root_name = trace.id
    root_input: Any = trace.task
    if monitor and monitor.get("invoice_text"):
        root_input = {
            "scenario": monitor.get("scenario", trace.task),
            "invoice": monitor["invoice_text"],
            "expected": monitor.get("expected"),
        }
    root_attrs = {
        SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.CHAIN.value,
        "blackbox.trace_id": trace.id,
        "blackbox.verdict": verdict,
        "blackbox.success": bool(trace.success),
        SpanAttributes.SESSION_ID: trace.id,
        SpanAttributes.TAG_TAGS: json.dumps(["blackbox", trace.id, verdict.lower()]),
        **_io_attrs(inp=root_input, out=trace.final_output),
    }
    if trace.gold_root_step_id is not None:
        root_attrs["blackbox.gold_root_step_id"] = trace.gold_root_step_id
    if monitor:
        for k, v in monitor.items():
            if v is not None:
                root_attrs[f"blackbox.{k}"] = _as_json(v) if isinstance(v, (dict, list)) else v
        root_attrs[SpanAttributes.METADATA] = _as_json(monitor)

    with tracer.start_as_current_span(root_name, kind=SpanKind.INTERNAL) as root:
        root.set_attributes(root_attrs)
        if trace.success is False:
            root.set_status(Status(StatusCode.ERROR, f"blackbox verdict: {verdict}"))
        elif trace.success is True:
            root.set_status(Status(StatusCode.OK))

        for s in trace.steps:
            span_name = _step_name(s)
            kind = _step_kind(s)
            attrs: dict[str, Any] = {
                SpanAttributes.OPENINFERENCE_SPAN_KIND: kind,
                "blackbox.step_id": s.id,
                "blackbox.kind": s.kind,
                "blackbox.parents": json.dumps(s.parents),
                **_io_attrs(inp=s.inputs or None, out=s.output),
            }
            if s.raw.get("agent"):
                attrs[SpanAttributes.AGENT_NAME] = str(s.raw["agent"])
            if s.raw.get("node"):
                attrs["blackbox.node"] = s.raw["node"]
            tool = s.tool_name or (s.raw.get("node") if kind == OpenInferenceSpanKindValues.TOOL.value else None)
            if tool:
                attrs[SpanAttributes.TOOL_NAME] = str(tool)
            if s.is_injected_fault:
                attrs["blackbox.injected_fault"] = True
                root.add_event("injected_fault", {"step_id": s.id, "node": s.raw.get("node") or s.raw.get("agent") or ""})

            with tracer.start_as_current_span(span_name, kind=SpanKind.INTERNAL) as sp:
                sp.set_attributes(attrs)
                if s.is_injected_fault:
                    sp.set_status(Status(StatusCode.ERROR, "injected fault (gold root cause)"))

    return len(trace.steps) + 1


def emit_trace(
    trace: Trace,
    *,
    backend: Backend = "phoenix",
    monitor: dict | None = None,
) -> bool:
    """Emit one Trace as spans. Returns False if backend unavailable."""
    if backend == "arize":
        from . import tracing

        tracing.setup_tracing()
        tracer = tracing.get_tracer("blackbox")
        n = _write_spans(tracer, trace, monitor=monitor)
        tracing.flush_tracing()
        print(f"[arize] emitted {n} spans for {trace.id!r} -> https://app.arize.com")
        return True

    setup = _phoenix_setup()
    if setup is None:
        print(f"[otel] OpenTelemetry not installed — to emit spans: {_PHOENIX_HINT}")
        return False
    provider, tracer = setup
    n = _write_spans(tracer, trace, monitor=monitor)
    provider.force_flush()
    print(f"[otel] emitted {n} spans for {trace.id!r} -> {_PHOENIX_ENDPOINT}")
    print("       view in Phoenix: http://localhost:6006")
    return True

"""Emit a captured Trace as OpenTelemetry GenAI spans for Arize Phoenix (the Arize track).

Lazy + graceful: if OpenTelemetry isn't installed it prints how to enable and no-ops, so the
offline pipeline stays dependency-free.

To view spans:
    pip install arize-phoenix opentelemetry-sdk opentelemetry-exporter-otlp-proto-http
    phoenix serve                      # serves OTLP at http://localhost:6006
    python -m agent.run --otel         # emits a run's spans; open http://localhost:6006

Note: OTel's GenAI message-content attributes are experimental; we set them directly here
since we're the producer. The `gen_ai.operation.name` enum isn't stable, so step typing uses
our own `blackbox.*` attributes.
"""
from __future__ import annotations

import json
import os

from shared.schema import Trace

_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:6006/v1/traces")
_INSTALL_HINT = ("pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http "
                 "arize-phoenix  (then `phoenix serve`)")


def _setup():
    try:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter  # type: ignore
        from opentelemetry.sdk.resources import Resource  # type: ignore
        from opentelemetry.sdk.trace import TracerProvider  # type: ignore
        from opentelemetry.sdk.trace.export import BatchSpanProcessor  # type: ignore
    except Exception:
        return None
    provider = TracerProvider(resource=Resource.create({"service.name": "blackbox-subject-agent"}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=_ENDPOINT)))
    return provider, provider.get_tracer("blackbox")


def emit_trace(trace: Trace) -> bool:
    """Emit `trace` as a span tree to the OTLP endpoint. Returns True if emitted."""
    setup = _setup()
    if setup is None:
        print(f"[otel] OpenTelemetry not installed — to emit spans: {_INSTALL_HINT}")
        return False
    provider, tracer = setup

    from opentelemetry.trace import SpanKind  # type: ignore

    with tracer.start_as_current_span("invoke_agent", kind=SpanKind.CLIENT) as root:
        root.set_attribute("gen_ai.agent.name", "blackbox-subject-agent")
        root.set_attribute("gen_ai.operation.name", "invoke_agent")
        root.set_attribute("blackbox.trace_id", trace.id)
        root.set_attribute("blackbox.task", trace.task)
        root.set_attribute("blackbox.success", bool(trace.success))
        if trace.gold_root_step_id is not None:
            root.set_attribute("blackbox.gold_root_step_id", trace.gold_root_step_id)

        for s in trace.steps:
            with tracer.start_as_current_span(s.name) as sp:
                sp.set_attribute("blackbox.step_id", s.id)
                sp.set_attribute("blackbox.kind", s.kind.value)
                sp.set_attribute("blackbox.parent_ids", json.dumps(s.parent_ids))
                if s.inputs:
                    sp.set_attribute("gen_ai.input.messages", json.dumps(s.inputs)[:1500])
                if s.output is not None:
                    sp.set_attribute("gen_ai.output.messages", str(s.output)[:1500])
                if s.is_injected_fault:
                    sp.set_attribute("blackbox.injected_fault", True)

    provider.force_flush()
    print(f"[otel] emitted {len(trace.steps) + 1} spans for {trace.id!r} -> {_ENDPOINT}  "
          f"(view in Phoenix: http://localhost:6006)")
    return True

"""Emit a captured Trace as OpenTelemetry GenAI spans for Arize Phoenix (the Arize track).

Lazy + graceful: if OpenTelemetry isn't installed it prints how to enable and no-ops.

    pip install arize-phoenix opentelemetry-sdk opentelemetry-exporter-otlp-proto-http
    phoenix serve                  # OTLP at http://localhost:6006
    python -m agent.run --otel     # emits a run's spans; open http://localhost:6006
"""
from __future__ import annotations

import json
import os

from shared.schema import Trace

_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:6006/v1/traces")
_HINT = "pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http arize-phoenix"


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
    setup = _setup()
    if setup is None:
        print(f"[otel] OpenTelemetry not installed — to emit spans: {_HINT}")
        return False
    provider, tracer = setup
    from opentelemetry.trace import SpanKind  # type: ignore

    with tracer.start_as_current_span("invoke_agent", kind=SpanKind.CLIENT) as root:
        root.set_attribute("gen_ai.agent.name", "blackbox-subject-agent")
        root.set_attribute("gen_ai.operation.name", "invoke_agent")
        root.set_attribute("blackbox.trace_id", trace.id)
        root.set_attribute("blackbox.success", bool(trace.success))
        if trace.gold_root_step_id is not None:
            root.set_attribute("blackbox.gold_root_step_id", trace.gold_root_step_id)

        for s in trace.steps:
            with tracer.start_as_current_span(s.raw.get("node", s.id)) as sp:
                sp.set_attribute("blackbox.step_id", s.id)
                sp.set_attribute("blackbox.kind", s.kind)
                sp.set_attribute("blackbox.parents", json.dumps(s.parents))
                if s.inputs:
                    sp.set_attribute("gen_ai.input.messages", json.dumps(s.inputs)[:1500])
                if s.output is not None:
                    sp.set_attribute("gen_ai.output.messages", json.dumps(s.output, default=str)[:1500])
                if s.is_injected_fault:
                    sp.set_attribute("blackbox.injected_fault", True)

    provider.force_flush()
    print(f"[otel] emitted {len(trace.steps) + 1} spans for {trace.id!r} -> {_ENDPOINT}  "
          f"(view in Phoenix: http://localhost:6006)")
    return True

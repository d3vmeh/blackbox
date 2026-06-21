"""Arize AX cloud tracing — register OTel with app.arize.com.

    export ARIZE_SPACE_ID=... ARIZE_API_KEY=...   # from Space Settings → API Keys
    export ARIZE_PROJECT_NAME=blackbox-ap

Call setup_tracing() once before emitting spans; flush_tracing() before exit.
Anthropic auto-instrumentation is enabled for P2 judge runs (attribution/).
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from opentelemetry.sdk.trace import TracerProvider

_tracer_provider: TracerProvider | None = None
_INSTRUMENTED = False


def setup_tracing() -> None:
    """Register OpenTelemetry with Arize AX. Idempotent."""
    global _INSTRUMENTED, _tracer_provider
    if _INSTRUMENTED:
        return

    from dotenv import load_dotenv  # load .env so creds resolve under pytest / CLI alike
    load_dotenv()

    space_id = os.environ.get("ARIZE_SPACE_ID")
    api_key = os.environ.get("ARIZE_API_KEY")
    if not space_id or not api_key:
        raise RuntimeError(
            "Set ARIZE_SPACE_ID and ARIZE_API_KEY in .env "
            "(Space Settings → API Keys at https://app.arize.com)"
        )

    project_name = os.environ.get("ARIZE_PROJECT_NAME", "blackbox-ap")

    from arize.otel import register

    _tracer_provider = register(
        space_id=space_id,
        api_key=api_key,
        project_name=project_name,
    )

    # Optional: auto-capture Anthropic calls (P2 attribution judges).
    try:
        from openinference.instrumentation.anthropic import AnthropicInstrumentor

        AnthropicInstrumentor().instrument(tracer_provider=_tracer_provider)
    except ImportError:
        pass

    _INSTRUMENTED = True
    print(f"[arize] tracing on · project={project_name!r} · view at https://app.arize.com")


def flush_tracing(timeout_ms: int = 30_000) -> bool:
    """Export pending spans before a short-lived CLI exits. Returns True if flush succeeded."""
    if _tracer_provider is None:
        return True
    if not hasattr(_tracer_provider, "force_flush"):
        return True
    ok = bool(_tracer_provider.force_flush(timeout_millis=timeout_ms))
    if not ok:
        print("[arize] warning: span export did not complete — check network/VPN and retry")
    return ok


def shutdown_tracing() -> None:
    """Release the OTel provider after a batch export."""
    global _INSTRUMENTED, _tracer_provider
    if _tracer_provider is not None and hasattr(_tracer_provider, "shutdown"):
        _tracer_provider.shutdown()
    _tracer_provider = None
    _INSTRUMENTED = False


def get_tracer(name: str = "blackbox"):
    from opentelemetry import trace

    return trace.get_tracer(name, "1.0.0")

"""Persist traces. Redis when available (Redis sponsor track); local JSON fallback."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from shared.schema import Trace

_LOCAL_DIR = Path(__file__).parent.parent / ".traces"
_KEY = "blackbox:trace:{}"


def _redis(url: Optional[str]):
    try:
        import redis  # type: ignore
    except Exception:
        return None
    try:
        client = redis.Redis.from_url(url or os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        client.ping()
        return client
    except Exception:
        return None


def save_trace(trace: Trace, redis_url: Optional[str] = None) -> None:
    client = _redis(redis_url)
    if client is not None:
        client.set(_KEY.format(trace.id), trace.model_dump_json())
        return
    _LOCAL_DIR.mkdir(exist_ok=True)
    (_LOCAL_DIR / f"{trace.id}.json").write_text(trace.model_dump_json(indent=2))


def load_trace(trace_id: str, redis_url: Optional[str] = None) -> Optional[Trace]:
    client = _redis(redis_url)
    if client is not None:
        raw = client.get(_KEY.format(trace_id))
        return Trace.model_validate_json(raw) if raw else None
    path = _LOCAL_DIR / f"{trace_id}.json"
    return Trace.model_validate_json(path.read_text()) if path.exists() else None


# TODO(P1): also index step embeddings in Redis vector search for P2's semantic edges.

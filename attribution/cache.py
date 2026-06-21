"""P2 — Persistent hash-based cache for LLM node-judge scores.

First run hits Claude Haiku for every step; subsequent runs are instant and free.
Cache key = SHA-256 of (inputs, output, state, kind). Storage = single JSON file.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Optional

from shared.schema import Step

_CACHE_PATH = Path("shared/fixtures/.judge_cache.json")
_cache: dict[str, float] = {}
_hits = 0
_misses = 0


def _load() -> None:
    """Load cache from disk on first access."""
    global _cache
    if _cache:
        return
    if _CACHE_PATH.exists():
        try:
            _cache = json.loads(_CACHE_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            _cache = {}


def _key(step: Step) -> str:
    """Deterministic hash of the step's judge-relevant fields."""
    payload = json.dumps({
        "inputs": step.inputs,
        "output": step.output,
        "state": step.state,
        "kind": step.kind,
    }, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def cache_get(step: Step) -> Optional[float]:
    """Return cached judge score or None on miss."""
    global _hits, _misses
    _load()
    key = _key(step)
    if key in _cache:
        _hits += 1
        return _cache[key]
    _misses += 1
    return None


def cache_set(step: Step, score: float) -> None:
    """Persist a judge score to the cache."""
    _load()
    key = _key(step)
    _cache[key] = score
    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(json.dumps(_cache, indent=2))


def cache_stats() -> dict[str, int]:
    """Return hit/miss counts for the current session."""
    return {"hits": _hits, "misses": _misses}

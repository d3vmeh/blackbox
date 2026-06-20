"""Tiny helpers for loading recorded traces (fixtures)."""
from __future__ import annotations

import json
from pathlib import Path

from .schema import Trace

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> Trace:
    """Load a recorded trace fixture by name, e.g. load_fixture("flight_fail")."""
    if not name.endswith(".json"):
        name += ".json"
    path = FIXTURES_DIR / name
    return Trace.model_validate_json(path.read_text())


def list_fixtures() -> list[str]:
    return sorted(p.stem for p in FIXTURES_DIR.glob("*.json"))

"""Thin Claude wrapper for the subject agent's reasoning nodes.

Uses the official Anthropic SDK directly. `make_think(use_real_llm=False)` returns a
`think()` that no-ops (returns None) so nodes fall back to deterministic output — the
whole agent then runs offline, no API key required.
"""
from __future__ import annotations

from typing import Callable, Optional

# Default to Sonnet for cost (Opus is too expensive for this project). Switch to
# "claude-haiku-4-5" for even cheaper, high-volume eval/benchmark runs.
SUBJECT_MODEL = "claude-sonnet-4-6"

# think(system, user) -> text, or None in mock mode.
Think = Callable[[str, str], Optional[str]]


def make_think(use_real_llm: bool = False, model: str = SUBJECT_MODEL,
               max_tokens: int = 400) -> Think:
    """`max_tokens` defaults to 400 (short field answers, e.g. the flight agent); raise it
    for tasks that emit longer output such as code generation, or replies get truncated."""
    client = None
    if use_real_llm:
        from dotenv import load_dotenv  # type: ignore
        import anthropic  # type: ignore

        load_dotenv()
        client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

    def think(system: str, user: str) -> Optional[str]:
        if client is None:
            return None  # mock mode -> caller uses its deterministic fallback
        resp = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system + " Respond with ONLY the requested value, no preamble.",
            messages=[{"role": "user", "content": user}],
        )
        return "".join(b.text for b in resp.content if b.type == "text").strip()

    return think

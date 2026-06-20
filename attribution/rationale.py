"""P2 — One-sentence root-cause rationale via Claude Sonnet."""
from __future__ import annotations

import json

import anthropic

from shared.schema import Trace

_client = anthropic.AsyncAnthropic()
_MODEL = "claude-sonnet-4-6"


async def generate_rationale(root_step_id: str, blast: list[str], trace: Trace) -> str:
    """Explain in ≤40 words what went wrong and what downstream steps it poisoned."""
    step_map = {s.id: s for s in trace.steps}
    root = step_map.get(root_step_id)
    if root is None:
        return f"Root step {root_step_id} not found in trace."

    root_name = root.raw.get("node", root.id)
    blast_names = [step_map[sid].raw.get("node", sid) for sid in blast if sid in step_map]

    prompt = (
        f"Task: {trace.task}\n\n"
        f"Root cause step: {root_name}\n"
        f"  Inputs: {json.dumps(root.inputs)}\n"
        f"  Output: {json.dumps(root.output)}\n\n"
        f"Downstream steps poisoned: {', '.join(blast_names)}\n\n"
        "In ONE sentence under 40 words, explain what went wrong in the root cause "
        "step and which downstream steps it affected. Be specific and technical."
    )
    try:
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=120,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except anthropic.APIError:
        return (
            f"Step '{root_name}' produced incorrect output that "
            f"propagated through {len(blast)} downstream steps."
        )

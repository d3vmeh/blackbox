"""P2 — Root-cause rationale + suggested fix via Claude Sonnet."""
from __future__ import annotations

import json
from typing import Any, Optional

import anthropic

from shared.schema import Trace

_client = anthropic.AsyncAnthropic()
_MODEL = "claude-sonnet-4-6"


async def generate_rationale(
    root_step_id: str, blast: list[str], trace: Trace
) -> tuple[str, Optional[Any]]:
    """Explain what went wrong and suggest a corrected output for the root step.

    Returns (rationale_str, suggested_fix_value). The suggested_fix is the
    corrected output the root step SHOULD have produced — directly usable as
    replay's injected_value.
    """
    step_map = {s.id: s for s in trace.steps}
    root = step_map.get(root_step_id)
    if root is None:
        return f"Root step {root_step_id} not found in trace.", None

    root_name = root.raw.get("node", root.id)
    blast_names = [step_map[sid].raw.get("node", sid) for sid in blast if sid in step_map]

    prompt = (
        f"Task: {trace.task}\n\n"
        f"Root cause step: {root_name}\n"
        f"  Kind: {root.kind}\n"
        f"  Inputs: {json.dumps(root.inputs)}\n"
        f"  Output: {json.dumps(root.output)}\n"
        f"  Agent state: {json.dumps(root.state)}\n\n"
        f"Downstream steps poisoned: {', '.join(blast_names)}\n\n"
        "Respond with a JSON object containing exactly two keys:\n"
        '1. "rationale": In ONE sentence under 40 words, explain what went wrong '
        "in the root cause step and which downstream steps it affected. Be specific.\n"
        '2. "suggested_fix": The corrected output value that this step SHOULD have '
        "produced given its inputs and state. Match the original output's format "
        "(string, dict, list, number — whatever the step originally returned).\n\n"
        "Return ONLY the JSON object, no markdown fences, no extra text."
    )
    try:
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown fences if the model wraps them
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        parsed = json.loads(raw)
        rationale = parsed.get("rationale", raw)
        suggested_fix = parsed.get("suggested_fix")
        return rationale, suggested_fix
    except (json.JSONDecodeError, KeyError):
        # Model returned plain text instead of JSON — use as rationale, no fix
        return raw, None
    except anthropic.APIError:
        return (
            f"Step '{root_name}' produced incorrect output that "
            f"propagated through {len(blast)} downstream steps.",
            None,
        )


"""P2 — Per-step LLM node-judge (Claude Haiku), run in parallel.

Each judge sees ONLY one step's inputs and output — nothing downstream,
no final outcome, no other steps. That isolation makes the verdict a
local correctness signal rather than hindsight.
"""
from __future__ import annotations

import asyncio
import json

import anthropic

from shared.schema import Step, Trace

_client = anthropic.AsyncAnthropic()
_MODEL = "claude-haiku-4-5-20251001"

_SYSTEM = (
    "You are a judge evaluating one step in an AI agent pipeline in isolation. "
    "You see only this step's inputs and output — nothing downstream, "
    "no final outcome, no other steps. Judge only local correctness. "
    "Note: tool_call steps produce a function call string as output, not a reasoned result. "
    "Judge only whether the correct tool was called with correct parameters given the inputs."
)


async def judge_step(step: Step) -> float:
    """Return (is_output_correct_given_inputs, short_reason)."""
    node_name = step.raw.get("node", step.id)
    state_str = json.dumps(step.state, indent=2) if step.state else "{}"
    user_msg = (
        f"Step name: {node_name}\n"
        f"Agent state (shared memory at this point): {state_str}\n"
        f"Inputs: {json.dumps(step.inputs, indent=2)}\n"
        f"Output: {json.dumps(step.output, indent=2)}\n\n"
        "Does this output correctly and accurately follow from the inputs and agent state?\n"
        "Reply with a single float between 0.0 and 1.0 ONLY.\n"
        "0.0 = clearly wrong given the inputs and state\n"
        "1.0 = clearly correct given the inputs and state\n"
        "No explanation. No text. Just the number."
    )
    try:
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=16,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        text = msg.content[0].text.strip()
        score = float(text)
        return max(0.0, min(1.0, score))
    except (ValueError, IndexError, anthropic.APIError):
        return 0.5


async def judge_all_suspects(suspects: set[str], trace: Trace) -> dict[str, float]:
    """Run judge_step concurrently for all suspect step ids."""
    step_map = {s.id: s for s in trace.steps}
    ids = [sid for sid in suspects if sid in step_map]
    scores = await asyncio.gather(*[judge_step(step_map[sid]) for sid in ids])
    return dict(zip(ids, scores))

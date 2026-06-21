from agent.code.graph import _LLM, _llm_impl, _llm_spec, _strip_code
from agent.code.scenarios import SCENARIOS

PARSE = next(s for s in SCENARIOS if s.name == "parse_duration_units")


def test_all_four_agents_have_llm_impls():
    assert set(_LLM) == {"spec_interpreter", "implementer", "test_writer", "reviewer"}


def test_llm_spec_normalizes_model_unit():
    fake = lambda system, user: "Minutes."          # noqa: E731 — model reply with noise
    out = _llm_spec(PARSE, {}, fake)
    assert out["unit"] == "minutes"


def test_llm_impl_strips_markdown_fences():
    fake = lambda system, user: "```python\ndef parse_duration(s):\n    return 0\n```"  # noqa: E731
    up = {"spec_interpreter": {"signature": "def parse_duration(s)", "unit": "seconds"}}
    out = _llm_impl(PARSE, up, fake)
    assert "def parse_duration" in out["code"]
    assert "```" not in out["code"]


def test_llm_impl_rejects_unusable_reply():
    fake = lambda system, user: "I cannot help with that."  # noqa: E731
    up = {"spec_interpreter": {"signature": "x", "unit": "seconds"}}
    assert _llm_impl(PARSE, up, fake) is None     # → caller falls back to the reference


def test_strip_code_passes_plain_code_through():
    assert _strip_code("def parse_duration(s):\n    return 0").startswith("def parse_duration")

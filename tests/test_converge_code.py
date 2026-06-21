import asyncio
from agent.converge_code import main, _gold_agent
from agent.code_scenarios import SCENARIOS


def test_gold_agent_reads_fault():
    spec = next(s for s in SCENARIOS if s.name == "celsius_spec")
    clean = next(s for s in SCENARIOS if s.name == "parse_duration_clean")
    assert _gold_agent(spec) == "spec_interpreter"
    assert _gold_agent(clean) is None


def test_monitor_localizes_all_seven_vs_gold():
    # offline: the deterministic monitor must match gold on every scenario (no key needed)
    result = asyncio.run(main())
    assert result["n"] == 7
    assert result["monitor_correct"] == 7

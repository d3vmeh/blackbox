from agent.team.graph import _assemble, replay_team, run_team
from agent.team.scenarios import DEFAULT


def test_injected_run_fails_at_the_architect():
    trace = run_team(DEFAULT)
    assert trace.success is False
    arch = next(s for s in trace.steps if s.raw["agent"] == "architect")
    assert arch.is_injected_fault is True
    assert arch.output["op_order"] == "tax_first"
    assert arch.correct_output["op_order"] == "discount_first"
    # 8 agents -> 8 steps, ci is last and is the failing 'final' node
    assert len(trace.steps) == 8
    assert trace.steps[-1].raw["agent"] == "ci"


def test_parents_are_real_edges():
    trace = run_team(DEFAULT)
    by_agent = {s.raw["agent"]: s for s in trace.steps}
    integ = by_agent["integrator"]
    assert by_agent["pricing"].id in integ.parents
    assert by_agent["architect"].id in integ.parents


def test_replay_fix_at_architect_flips_to_pass():
    # baseline keeps the fault -> fail; injecting the correct op_order downstream -> pass
    assert replay_team(DEFAULT, None, None).success is False
    fixed = replay_team(DEFAULT, "architect", {"op_order": "discount_first"})
    assert fixed.success is True


def test_assemble_collects_five_files():
    trace = run_team(DEFAULT)
    up = {s.raw["agent"]: s.output for s in trace.steps}
    mods = _assemble(up)
    assert set(mods) == {"contract.py", "pricing.py", "discount.py", "tax.py", "receipt.py"}

from agent.team.graph import run_team
from agent.team.monitor import (Verdict, _reference_output, investigate, localize,
                                 poisoned_path)
from agent.team.scenarios import DEFAULT


def test_localize_points_at_the_architect_op_order():
    trace = run_team(DEFAULT)
    step, agent, field, bad, good = localize(DEFAULT, trace)
    assert agent == "architect" and field == "op_order"
    assert bad == "tax_first" and good == "discount_first"


def test_investigate_confirms_architect_by_replay():
    trace = run_team(DEFAULT)
    v = investigate(trace, DEFAULT, n=3)
    assert v.failed is True
    assert v.root_agent == "architect"
    assert v.replay_confirmed is True
    assert v.confirmation_rate == 1.0


def test_poisoned_path_is_integrator_downstream_only():
    trace = run_team(DEFAULT)
    by_agent = {s.raw["agent"]: s.id for s in trace.steps}
    path = poisoned_path(trace)
    # honest blast: the integrator and everything downstream of it — NOT the correct leaf modules
    assert by_agent["integrator"] in path
    assert by_agent["reviewer"] in path and by_agent["ci"] in path
    assert by_agent["pricing"] not in path and by_agent["tax"] not in path


def test_reference_output_for_architect_is_correct():
    assert _reference_output(DEFAULT, "architect")["op_order"] == "discount_first"

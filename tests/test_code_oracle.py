from agent.code.scenarios import DEFAULT, _CORRECT_CODE, _MINUTES_CODE
from eval.code_oracle import evaluate_code

def test_correct_code_passes():
    assert evaluate_code(_CORRECT_CODE, DEFAULT) is True

def test_minutes_code_fails():
    assert evaluate_code(_MINUTES_CODE, DEFAULT) is False

def test_broken_code_fails_not_raises():
    assert evaluate_code("def parse_duration(s):\n    return None\n", DEFAULT) is False

def test_oracle_uses_scenario_function_name():
    from agent.code.scenarios import CodeScenario
    scn = CodeScenario(
        name="square", requirement="square(x)", reference={}, function_name="square",
        acceptance_tests="assert square(3) == 9\n",
    )
    assert evaluate_code("def square(x):\n    return x * x\n", scn) is True
    assert evaluate_code("def square(x):\n    return x + x\n", scn) is False

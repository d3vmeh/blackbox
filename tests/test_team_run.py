from agent.team import run as team_run


def test_cli_main_runs_deterministically(capsys):
    team_run.main([])
    out = capsys.readouterr().out
    assert "root cause" in out
    assert "architect" in out
    assert "FAIL->PASS" in out

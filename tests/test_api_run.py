from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_scenarios_lists_the_coding_tests():
    r = client.get("/api/scenarios")
    assert r.status_code == 200
    names = [s["name"] for s in r.json()]
    assert "parse_duration_units" in names and "parse_duration_clean" in names

def test_run_deterministic_localizes_spec_interpreter():
    r = client.post("/api/run", json={"scenario": "parse_duration_units", "live": False})
    assert r.status_code == 200
    body = r.json()
    assert body["attribution"]["root_step_id"] == "s1"
    assert body["replay"]["s1"]["flipped"] is True

def test_run_clean_is_a_pass_with_empty_attribution():
    r = client.post("/api/run", json={"scenario": "parse_duration_clean", "live": False})
    assert r.json()["trace"]["success"] is True
    assert r.json()["attribution"]["root_step_id"] == ""

def test_run_unknown_scenario_is_404():
    r = client.post("/api/run", json={"scenario": "nope", "live": False})
    assert r.status_code == 404

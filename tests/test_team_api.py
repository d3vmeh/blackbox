from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_scenarios_list_includes_the_team_subject():
    names = [s["name"] for s in client.get("/api/scenarios").json()]
    assert "billing_op_order" in names


def test_run_team_scenario_deterministic():
    r = client.post("/api/run", json={"scenario": "billing_op_order", "live": False})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"trace", "attribution", "replay", "meta", "monitor"}
    root_id = body["attribution"]["root_step_id"]
    root = next(s for s in body["trace"]["steps"] if s["id"] == root_id)
    assert root["raw"]["agent"] == "architect"
    assert body["meta"]["parallel_agents"] == ["pricing", "discount", "tax"]
    assert body["monitor"]["trusted"] is True

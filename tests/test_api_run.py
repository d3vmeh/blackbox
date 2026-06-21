from fastapi.testclient import TestClient
from api.main import app
from shared.scenarios.manifest import DOMAINS, HERO_ID

client = TestClient(app)

def test_scenarios_lists_domains_then_coding():
    r = client.get("/api/scenarios")
    assert r.status_code == 200
    names = [s["name"] for s in r.json()]
    # the 4 deterministic demo domains come first (HERO first) ...
    assert names[: len(DOMAINS)] == [d.id for d in DOMAINS]
    assert names[0] == HERO_ID
    assert "prior_auth" in names
    # ... then the live coding pipeline scenarios are reconnected
    assert "round_half_natural" in names
    assert "merge_intervals_impl" in names


def test_run_coding_scenario_deterministic():
    # a coding scenario routes to the agent.code pipeline and emits coding meta + monitor
    r = client.post("/api/run", json={"scenario": "parse_duration_impl", "live": False})
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["scenario"] == "parse_duration_impl"
    assert body["meta"]["runtime"] == "multi-agent"
    assert body["attribution"]["root_step_id"]            # localized to a step
    assert body["monitor"]["decision"] in ("auto_apply", "escalate")

def test_run_claim_adjudication_localizes_intake():
    r = client.post("/api/run", json={"scenario": "claim_adjudication", "live": False})
    assert r.status_code == 200
    body = r.json()
    assert body["trace"]["id"] == "claim_adjudication"
    assert body["meta"]["scenario"] == "claim_adjudication"
    assert body["attribution"]["root_step_id"] == "s1"
    assert body["replay"]["s1"]["flipped"] is True
    decoy_id = next(k for k in body["replay"] if k != "s1")
    assert body["replay"][decoy_id]["flipped"] is False

def test_run_prior_auth_research_domain():
    r = client.post("/api/run", json={"scenario": "prior_auth", "live": False})
    assert r.status_code == 200
    body = r.json()
    assert body["trace"]["id"] == "prior_auth"
    assert body["attribution"]["root_step_id"].startswith("s")
    assert any(v["flipped"] for v in body["replay"].values())

def test_run_unknown_scenario_is_404():
    r = client.post("/api/run", json={"scenario": "nope", "live": False})
    assert r.status_code == 404

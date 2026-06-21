from agent.team.export_run import build_artifacts
from agent.team.scenarios import DEFAULT


def test_build_artifacts_localizes_architect_and_confirms():
    art = build_artifacts(DEFAULT)
    assert set(art) == {"trace", "attribution", "replays", "meta", "monitor"}
    trace, attr = art["trace"], art["attribution"]
    root_id = attr["root_step_id"]
    root_step = next(s for s in trace["steps"] if s["id"] == root_id)
    assert root_step["raw"]["agent"] == "architect"
    assert trace["gold_root_step_id"] == root_id
    # root replay flips fail->pass; the trust gate auto-applies
    assert art["replays"][root_id]["flipped"] is True
    assert art["monitor"]["trusted"] is True
    assert art["monitor"]["decision"] == "auto_apply"


def test_meta_advertises_the_parallel_band_and_deterministic_engine():
    art = build_artifacts(DEFAULT)
    meta = art["meta"]
    assert meta["parallel_agents"] == ["pricing", "discount", "tax"]
    assert meta["fork_agent"] == "architect"
    assert "deterministic" in meta["engine"]


def test_blast_radius_is_the_poisoned_path():
    art = build_artifacts(DEFAULT)
    trace = art["trace"]
    by_agent = {s["raw"]["agent"]: s["id"] for s in trace["steps"]}
    blast = art["attribution"]["blast_radius"]
    assert by_agent["integrator"] in blast
    assert by_agent["pricing"] not in blast   # correct module, not poisoned

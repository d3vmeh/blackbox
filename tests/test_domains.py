"""Smoke tests for the four demo domain pipelines."""
from shared.scenarios.manifest import DOMAINS

from agent.domains.export_run import build_artifacts, write_all_fixtures


def test_all_domains_build_artifacts():
    for d in DOMAINS:
        art = build_artifacts(d.id)
        trace = art["trace"]
        attr = art["attribution"]
        replays = art["replays"]
        assert trace["id"] == d.id
        assert trace["success"] is False
        assert attr["root_step_id"]
        root = attr["root_step_id"]
        assert replays[root]["flipped"] is True
        decoy_ids = [k for k in replays if k != root]
        assert decoy_ids
        assert all(not replays[k]["flipped"] for k in decoy_ids)


def test_write_all_fixtures():
    paths = write_all_fixtures()
    assert len(paths) == len(DOMAINS)
    for p in paths:
        assert (p / "trace.json").exists()
        assert (p / "replay.json").exists()

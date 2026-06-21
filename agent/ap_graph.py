"""Compat shim — canonical home is agent/ap/graph.py. Kept for eval/ (P4); delete once migrated."""
from agent.ap.graph import *  # noqa: F401,F403
from agent.ap.graph import run_ap, replay_ap, COMPUTE, PARENTS, KIND, APContext  # noqa: F401

"""Compat shim — canonical home is agent/ap/run.py. Kept for eval/ (P4); delete once migrated."""
from agent.ap.run import *  # noqa: F401,F403
from agent.ap.run import _scenario_meta, main  # noqa: F401  (eval imports _scenario_meta; main for the CLI)

if __name__ == "__main__":
    main()

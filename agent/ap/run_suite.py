"""P1 — Run the monitor across a labeled suite of AP scenarios.

    python -m agent.ap.run_suite

Each scenario injects a fault at a (possibly different) agent. For each, we run the
system, let the monitor localize + replay-confirm, and check it fingered the RIGHT agent.
Prints a per-scenario table + overall localization accuracy and replay-confirmation rate.
This is the AP analogue of the flight benchmark: proof the monitor isn't hardcoded.
"""

from __future__ import annotations

from . import graph
from .scenarios import SCENARIOS
from .monitor import investigate


def main() -> None:
    print("=" * 82)
    print(f"{'SCENARIO':<20}{'INJECTED FAULT':<26}{'LOCALIZED':<22}{'RESULT'}")
    print("-" * 82)

    loc_hits = faulted = confirmed = 0
    for scn in SCENARIOS:
        trace = graph.run_ap(scn)
        v = investigate(trace, scn, n=5)

        injected = f"{scn.fault.agent}.{scn.fault.field}" if scn.fault else "— (clean)"
        if scn.fault is None:
            ok = not v.failed
            localized = "— (passed)" if not v.failed else f"!! {v.root_agent}"
            result = "✓ no false alarm" if ok else "✗ false positive"
        else:
            faulted += 1
            hit = v.failed and v.root_agent == scn.fault.agent
            loc_hits += hit
            confirmed += bool(v.replay_confirmed)
            localized = f"{v.root_agent}.{v.field}" if v.root_agent else "(none)"
            flip = f"{sum(v.outcomes)}/{len(v.outcomes)}" if v.outcomes else "0/0"
            result = (f"✓ root + {flip} flip" if hit and v.replay_confirmed
                      else "✗ MISLOCALIZED" if not hit else f"~ root, {flip} flip")
        print(f"{scn.name:<20}{injected:<26}{localized:<22}{result}")

    print("-" * 82)
    print(f"localization accuracy: {loc_hits}/{faulted} faulted scenarios   ·   "
          f"replay-confirmed: {confirmed}/{faulted}")
    print("=" * 82)


if __name__ == "__main__":
    main()

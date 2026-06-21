# Blackbox — 90-Second Demo Script

> The target everyone builds toward. Driven by `shared/fixtures/flight_fail.json`
> (root=`s3` misread date, decoy=`s14`, 24-step blast radius). Beats map to the
> animations in [DESIGN.md](./DESIGN.md) and the tickets in [BUILD_PLAN.md](./BUILD_PLAN.md).
>
> **Golden rule:** the on-stage flip replays from a pre-captured corrected trace
> (BUILD_PLAN #21). Nothing in the live demo depends on a live browser. A backup
> video of the full flow is recorded (#24) and cut to if anything stalls.

---

## The arc (memorize the shape)
**A confident wrong answer → we find the lie → we prove it by re-running history → it flips → it's filed.**

| Time | Beat | On screen | What you say |
|---|---|---|---|
| **0:00–0:12** | **Hook** | Agent's final message: *"All set! Booked SFO→JFK, departing **December 7**."* next to a big **98% confident** badge. | "This agent just booked a flight to the wrong date — and it's 98% sure it nailed it. The user asked for **July 12**." |
| **0:12–0:25** | **Status quo** | The full 30-step trace spine scrolls — a wall of dim mono log rows. | "Here's the whole run. Every other tool stops here — a wall of logs, and *you're* the detective. The mistake is one of these thirty steps. Good luck." |
| **0:25–0:30** | **Analyze (method, not magic)** | Click **Analyze**. | "Blackbox walks the trace **backward** to the first step whose output doesn't follow from its inputs." |
| **0:30–0:40** | **Localize** | Snap-focus `s3`: `--root` amber ring ignites; neighbors dim. Inspector shows input *"July 12 2024"* → output *"2024-12-07"*. | "Step 3. The date normalizer read 'July 12' as **December 7** — swapped month and day. That's the lie." |
| **0:40–0:50** | **Blast radius** | Forward cascade: 24 steps flip neutral→`--blast` crimson down the chain, staggered. `s5/s6` (browser open) stay neutral. | "And here's the damage — every step that *inherited* that date. Twenty-four steps poisoned by one mistake. The agent never noticed; it kept verifying against its own wrong answer." |
| **0:50–1:05** | **Confirm — reject the decoy first** | Replay `s14` (the "allow a layover" step). Re-runs; verdict **stays FAIL** (0/5). `s14` marked *rejected*. | "Now we don't *guess* — we **prove**. A plausible suspect: step 14 broke the 'direct flight' rule. Fork there, inject the fix, re-run five times… **still fails.** Not the cause. Rejected." |
| **1:05–1:20** | **Confirm — the flip (peak)** | Fall back to `s3`. Inject `2024-07-12`. **Split-screen**: frozen-red original left; green counterfactual re-runs right, healing `--blast`→`--pass` step by step. Verdict springs **FAIL → PASS**. Readout: **5/5 confirmed (100%)**. | "Fall back to step 3. Inject the **correct** date — July 12 — and re-run history. Watch it heal… **fail flips to pass. Five out of five.** That's not a hunch. That's the proven root cause." |
| **1:20–1:30** | **Close + Sentry** | Agent's corrected final: *"Booked SFO→JFK, departing **July 12**."* Cut to the **Sentry issue** Blackbox auto-filed (root step, injected fix, 5/5). | "The agent succeeds with the fix applied — and Blackbox already filed the root cause to Sentry. We localized it on a graph and **confirmed it by replay.**" |

---

## Opening line (use verbatim)
> "This AI agent just booked a flight to the wrong date — and it's 98% sure it nailed it. One misread date, twenty-four poisoned steps, one confident, wrong answer. Watch us find the exact step that lied — and prove it by re-running history."

## Closing line
> "We don't guess the cause. We localize it on a graph and prove it by replay."

---

## Director's notes (where demos die)
- **Don't let the flip happen instantly** — it reads as fake. Let the re-run
  visibly heal the chain step-by-step so the flip feels *earned* (#32/#35).
- **The decoy rejection is non-negotiable.** It's the proof the loop is live, not
  scripted, and it's the most-cited differentiator from the review. Keep it even
  if you cut other beats.
- **Say the method out loud at 0:25.** The single biggest silent doubt is "did
  they hardcode the answer?" One sentence kills it.
- **Numbers on screen** (0/5 rejected, 5/5 confirmed) make "proof" tangible —
  cheap to render (#34), high payoff.
- **If anything stalls, cut to the backup video** and keep narrating. Never debug
  live.

## Cut-down to 60s (if the slot shrinks)
Keep: Hook → Localize → Blast radius → Decoy-reject → Flip. Drop: the status-quo
dwell (0:12–0:25 → 5s) and the Sentry tag (mention verbally, don't cut to it).

"""Prompts for generating the Fuse Breaker demo UI via html_helpers."""

BASE_SYSTEM_PROMPT = """
You are an expert frontend engineer skilled at crafting beautiful, performant frontend applications.

<tech_stack>
Use vanilla HTML, CSS, & Javascript. Use Tailwind CSS via CDN for styling.
All CSS and JavaScript must be inline in the single HTML file — no external files except Tailwind CDN and Google Fonts.
</tech_stack>

<output>
Generate complete, self-contained HTML code for the requested frontend application.

CRITICAL: You must wrap your HTML code in triple backticks with html language identifier like this:
```html
<!DOCTYPE html>
<html>
...
</html>
```

Our parser depends on this format - do not deviate from it!
</output>
"""

DISTILLED_AESTHETICS_PROMPT = """
<aesthetics>
Design direction: premium developer-tool landing page (think Linear, Vercel, Raycast) — NOT generic SaaS purple gradients.

Typography:
- Headings: "DM Sans" from Google Fonts
- Data, logs, labels: "JetBrains Mono" from Google Fonts
- Never use Inter, Roboto, or Arial as primary fonts

Color palette (use CSS variables on :root):
- --bg: #09090b
- --surface: #131316
- --surface-raised: #1a1a1f
- --border: #27272a
- --text: #fafafa
- --muted: #71717a
- --accent: #22d3ee (cyan — primary CTA and "protected" state)
- --success: #4ade80 (confirmed steps, savings)
- --danger: #f87171 (failures, cost bleeding)
- --warning: #fbbf24 (interventions)

Layout & feel:
- Dark mode only. Subtle grid or dot pattern on hero background at ~3% opacity.
- Generous whitespace. Max content width ~1200px, centered.
- Cards: 1px border, subtle backdrop, rounded-xl, no heavy drop shadows.
- Buttons: clear primary/secondary; primary has subtle glow on hover.
- Section rhythm: hero → live demo → how it works → taxonomy → footer.

Motion (CSS only, no libraries):
- Smooth transitions on toggle and counter color changes.
- Demo cost counter should animate counting up when "Unprotected" and flatline when "Fuse Breaker ON".
- Use requestAnimationFrame or setInterval for the demo simulation — fully client-side, no API calls.

Avoid: stock photo placeholders, lorem ipsum, purple-to-blue hero gradients, cookie-cutter three-column feature icons from icon packs.
</aesthetics>
"""

USER_PROMPT = """
Build a single-page marketing + interactive demo site for **Fuse Breaker** — a typed circuit breaker for AI agent loops.

Product one-liner:
"Hard caps kill good runs along with bad ones. Fuse Breaker classifies WHY an agent loop is failing and applies the one fix proven for that failure."

---

## Page sections (in order)

### 1. Nav
- Logo text: "Fuse Breaker"
- Links: Demo, How it works, Taxonomy (anchor scroll)
- CTA button: "View on GitHub" (href="#")

### 2. Hero
- Headline: "Stop agent loops from burning money."
- Subhead: 2 sentences explaining typed diagnosis vs blunt kill switches.
- Two buttons: "See live demo" (scroll to demo) + "Read the taxonomy"
- Small trust line: "Built for RunPod · Redis · Sentry hackathon tracks"

### 3. Live demo (most important — make this the visual centerpiece)

Split panel or stacked layout with a **mode toggle** at top:
- **Unprotected** (default off Fuse Breaker)
- **Fuse Breaker ON**

When user clicks "Run demo" (or toggles mode), simulate an 8-step agent loop with realistic log lines. Use hardcoded scripted data — no backend.

**Left / top: Agent trace**
Show scrolling step log, e.g.:
- Step 1: `plan_task` ✓
- Step 2: `search_docs` ✓
- Step 3: `call_tool: get_weather_forecast_extended` ✗ (tool not in schema)
- Step 4: retry same call...
- etc.

**Right / bottom: Diagnostics panel**
- **Cost counter** (large, monospace): starts at $0.00, increments per step
  - Unprotected: climbs quickly to ~$0.47 by step 8
  - Protected: flatlines around ~$0.12 after interventions
- **Classifier** box: when Fuse Breaker ON, show detected labels appearing in real time:
  - `hallucinated_tool` at step 3
  - `ambiguous_feedback_loop` at step 5
- **Responder** box: show matched fix applied:
  - "Blocked call · reinjected tool schema"
  - "Rewrote tool response → FAILED (terminal)"
- **Ledger** receipt list: 2–3 compact rows with timestamp, failure class, tokens saved

Color-code steps in the trace: green = ok, red = failure, amber = intervened.

The demo must be **interactive**: toggle between Unprotected and Fuse Breaker ON re-runs or resets the simulation with different behavior. Add a "Run again" button.

### 4. How it works
Four cards in a row (stack on mobile):
1. **Interceptor** — "Middleware before every tool call. Table stakes."
2. **Classifier** — "Typed diagnosis. Zero LLM cost. The innovation."
3. **Responder** — "One fix per failure class. Not a kill switch."
4. **Ledger** — "Structured receipt for every intervention."

Each card: title, one sentence, small monospace example.

### 5. Failure taxonomy
Table or 2x2 grid of the four failure classes:
| Class | Detection | Fix |
| hallucinated_tool | Validate against live schema | Block + reinject tool list |
| ambiguous_feedback_loop | Pattern-match soft retry language | Rewrite response to SUCCESS/FAILED |
| non_convergent_repeat | Same args + error vs history | Strategy switch / cheaper model |
| context_rot_confusion | Past long-horizon threshold | Trigger compaction |

Style the class names as monospace pills.

### 6. Footer
- "Fuse Breaker · blackbox repo"
- Tagline: "Pre-call interception exists. Cost caps exist. Typed diagnosis doesn't."

---

## Demo simulation requirements (JavaScript)

Implement `runSimulation(mode)` where mode is `"unprotected"` | `"protected"`:
- 8 steps, ~800ms apart when running
- Unprotected: cost += random-ish increments ($0.04–$0.08 per bad step), no classifier labels until end
- Protected: classifier fires at steps 3 and 5, responder fixes, cost increase slows dramatically
- End state: show summary banner
  - Unprotected: "Total: $0.47 · 14 tool calls · 2 failure loops"
  - Protected: "Total: $0.12 · 6 tool calls · $0.35 saved (74%)"

All simulation data hardcoded in JS arrays. Must work offline after page load.

---

## Copy tone
Confident, technical, honest. No hype words like "revolutionary" or "game-changing". Write like a senior infra engineer pitching to VCs who know the space.
"""

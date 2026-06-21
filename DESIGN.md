# blackbox — Design System

> **Canonical design schema. Single source of truth. Do not drift.**
> Identity: **forensic instrument** — IDE debugger themes, flight-data recorders,
> oscilloscopes. Dark, high-contrast, technical. **Never** generic SaaS / "AI slop"
> (no purple-on-white, no Inter/Roboto, no timid evenly-distributed palettes, no
> predictable SaaS layouts). Commit fully; never hedge toward light SaaS.
>
> **The one test** — a judge glancing at the screen must instantly see **WHERE** the
> failure is and feel the **WEIGHT** of the confirmed fix. If a change doesn't serve
> that, it doesn't belong.

## Principles (fallback when no rule covers a case)

1. **Ordinary recedes; the signal dominates.** 30 innocent steps stay neutral so the
   root cause / blast radius / fix are unmistakable.
2. **Color is semantic, never decorative.** The three signals mean one thing each.
3. **Hierarchy by extremes** — weight + size + color tiers, not nuance.
4. **Restraint everywhere except the three motion beats**, so those land.
5. **Constraint is the feature.** Few tokens, obeyed exactly, beat many ad-hoc choices.

## How to use this file (rules for any agent/dev)

- **Closed set. Never invent values.** Every color, space, radius, font-size, shadow,
  duration, and easing **must** reference a token below. If you need a value that
  doesn't exist, add it here first, then use it.
- Components reference **semantic** tokens (`--text-dim`, `--root`), not raw hex.
- ❌ `padding: 12px; color: #FF4361; border-radius: 10px`
  ✅ `padding: var(--space-3); color: var(--blast); border-radius: var(--r-3)`
- Selection/hover = **neutral brighten + border only**. Never introduce a 4th hue.
- Animate **`transform` + `opacity` only**. Respect `prefers-reduced-motion`.

---

## Tokens — paste into `globals.css` `:root` (the source of truth)

```css
:root {
  /* ---- Neutral base: ordinary steps recede here ---- */
  --bg:           #0A0C10;  /* canvas, near-black w/ faint blue (never #000) */
  --panel:        #0F1217;  /* elevated surface / inspector */
  --inset:        #15181B;  /* sunken data wells */
  --raised:       #1A1F27;  /* popovers / menus (lighter = higher) */
  --overlay:      #21262F;  /* modals / the confirm replay layer */
  --line:         #1E232C;  /* hairline border, 1px */
  --line-hi:      rgba(255,255,255,0.06); /* top-edge highlight on raised */
  --edge:         #283039;  /* graph connector stroke (neutral, non-signal) */
  --grid:         rgba(255,255,255,0.022); /* faint graph-paper backdrop */

  /* ---- Text tiers (high / med / low emphasis) ---- */
  --text-bright:  #EAEEF3;  /* focused / selected (~87%) */
  --text:         #C7CDD2;  /* default readable (~70%) */
  --text-dim:     #59636F;  /* ORDINARY step text — deliberately quiet (~45%) */
  --text-faint:   #39414B;  /* disabled / scaffolding (~30%) */

  /* ---- Three reserved signals (warm → warm → cool) — nothing else uses these ----
     Desaturated for a calm instrument read; bright neon flooding looks "AI". */
  --root:         #D9954A;  /* ROOT CAUSE    muted amber/ochre (origin) */
  --blast:        #D75C6C;  /* BLAST RADIUS  dusty rose-red (the poison spreading) */
  --pass:         #4FB98C;  /* CONFIRMED FIX sage emerald (the heal / relief) */
  --root-glow:    #D9954A1F;
  --blast-glow:   #D75C6C1F;
  --pass-glow:    #4FB98C1F;

  /* ---- Spacing (4/8pt grid) ---- */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* ---- Radius (tight = instrument) ---- */
  --r-1: 3px; --r-2: 5px; --r-3: 8px; --r-4: 12px;
  /* nested radius rule: inner = outer − padding */

  /* ---- Elevation: shadow (subtle, Y-offset) + glow as dark-mode accent ---- */
  --shadow-1:   0 1px 2px rgba(0,0,0,0.40);
  --shadow-2:   0 4px 12px rgba(0,0,0,0.50);
  --shadow-pop: 0 8px 30px rgba(0,0,0,0.60);
  --ring-root:  0 0 0 1px var(--root),  0 0 24px var(--root-glow);
  --ring-pass:  0 0 0 1px var(--pass),  0 0 24px var(--pass-glow);
  --focus-ring: 0 0 0 2px var(--bg), 0 0 0 3px var(--text-dim); /* neutral, no hue */

  /* ---- Z-index (named, ordered — no 9999 arms race) ---- */
  --z-base: 0; --z-trace: 10; --z-inspector: 20; --z-overlay: 100; --z-toast: 1000;

  /* ---- Type ---- */
  --font-display: "Archivo Variable", sans-serif;   /* verdicts: font-stretch:125% = Expanded */
  --font-mono:    "IBM Plex Mono", monospace;       /* all data/trace */
  /* size scale, ratio ~1.2, 13px UI workhorse */
  --t-label:   11px; --t-step: 13px; --t-body: 15px; --t-h3: 20px;
  --t-h2:      32px; --t-verdict: 72px;
  /* line-height */
  --lh-tight: 1.05; --lh-data: 1.3; --lh-body: 1.5;
  /* tracking */
  --track-display: -0.03em;  /* big display, tighter as size grows */
  --track-verdict: -0.04em;
  --track-upper:    0.08em;  /* uppercase eyebrow labels open up */

  /* ---- Motion ---- */
  --dur-micro: 140ms;  /* hover, color, small fades */
  --dur-base:  220ms;  /* popovers, dropdowns, enters */
  --dur-slow:  360ms;  /* large surfaces, the confirm replay */
  --stagger-blast: 60ms; /* per-step poison cascade */
  --ease-out:   cubic-bezier(0.16, 1, 0.30, 1);   /* enter: snappy then settles */
  --ease-in:    cubic-bezier(0.40, 0, 1, 1);      /* exit: faster than enter */
  --ease-inout: cubic-bezier(0.65, 0, 0.35, 1);   /* loops / property changes */
  /* framer-motion spring (JS, not CSS): { stiffness: 360, damping: 34, mass: 1 } */

  /* ---- Hairlines & separators (Linear-validated: 0.5px retina hairline; elevation
     reads as a lighter surface + a low-alpha white top edge, never a heavy border) ---- */
  --hair:       0.5px;                       /* retina hairline weight (sub-pixel, sharp) */
  --line-soft:  rgba(255,255,255,0.035);     /* ultra-faint inner separator / top edge */

  /* ---- Selection: neutral brighten + border only (NEVER a 4th hue) ---- */
  --sel-bg:     #161B22;
  --sel-line:   #2A323C;

  /* ---- Shadow stack: crisp lift for popovers/menus without an "AI glow" ---- */
  --shadow-stack:
    0 0 0 0.5px rgba(0,0,0,0.55), 0 1px 1px rgba(0,0,0,0.28),
    0 3px 6px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.28);

  /* ---- Dashboard rails & bars (three-column case-file layout) ---- */
  --rail-nav:   256px;   /* left: case navigator */
  --rail-insp:  336px;   /* right: inspector */
  --h-bar:      53px;    /* readout header height */

  --glyph:      13px;    /* status ring glyph (the small circular marker) */
  --track-tight: -0.01em; /* tighten small mono labels; open only true eyebrows */

  /* ---- Iconography (lucide-react): neutral affordance only, never a signal hue ---- */
  --icon:        16px;           /* lucide icon box */
  --icon-stroke: 1.5px;          /* lucide strokeWidth */
  --gap-icon:    var(--space-2); /* icon -> label gap */
}
```

**Breakpoints:** desktop-first single dashboard; design for ≥1280px, degrade gracefully
to ≥1024px. Not a mobile product — don't spend effort below 1024px.

---

## Typography craft

Calm and engineered, not shouty. Refined weights beat 900-everywhere; a big bold
two-tone headline reads as generic AI marketing.

| Role | Font | Size / weight | Line-h | Tracking |
|---|---|---|---|---|
| Verdict (FAIL/PASS) | Archivo (normal width) | 24px / 700 | `--lh-tight` | `--track-verdict` |
| Hero headline | Archivo | clamp ~32–46px / 700, **monochrome** | `--lh-tight` | `--track-display` |
| Run headline / H2 | Archivo | `--t-h2` / 700 | `--lh-tight` | `--track-display` |
| Section eyebrow | IBM Plex Mono | `--t-label` / 600 **UPPERCASE** | `--lh-data` | `--track-upper` |
| Step rows / data | IBM Plex Mono | `--t-step` / 400–500 | `--lh-data` | normal |
| Inspector body | IBM Plex Mono | `--t-body` / 400 | `--lh-body` | normal |

- **No color-swapped words in headings.** Let the product/instrument carry color;
  headlines stay one neutral color. Don't use Archivo *Expanded* — normal width.
- **All numeric/data:** `font-variant-numeric: tabular-nums slashed-zero;` so digits
  share width and don't jump as values update; right-align numeric columns.
- **Weights are restrained:** 400 read · 500 emphasis · 600 label · 700 display.
- Banned faces: Inter, Roboto, Open Sans, Arial, system-ui, Space Grotesk.
- Self-host both fonts (no Google CDN) — fits the static SPA + instrument feel.

## Color semantics — when NOT to use

The three signals are **reserved**. Do not use `--root`/`--blast`/`--pass` for buttons,
links, icons, charts axes, focus, or "nice accent." If a step is ordinary it stays
neutral (`--text-dim`). Mapping:

- `--root` → exactly one step: the localized root cause.
- `--blast` → only downstream steps poisoned by the root cause.
- `--pass` → only the confirmed-fix / fail→pass state.

**Restraint — signal with edge + text, not full fills.** Mark a signalled step with a
thin colored left-edge bar (`box-shadow: inset 2–3px 0 0 <hue>`) + colored text +
marker, on an otherwise neutral row. Do **not** flood rows with tinted backgrounds —
that neon-on-black look reads as generic AI. Only the single root step earns a faint
glow/tint as the lone focal accent. Ordinary steps stay fully neutral.

Dark-UI rules: elevation reads via **lighter surfaces** (`--inset`→`--overlay`), not
bigger shadows; accents already desaturated to sit calm; hairlines are low-alpha white
(`--line-hi`) on raised surfaces; a faint colored **glow** is the accent on focus/active.

## Layout — the trace is the spine, framed as a case file (three columns)

The spine stays the center of gravity; we frame it with a left **case navigator** and a
right **inspector** so the screen reads like a forensic case file (structure borrowed
from Linear's nav · content · properties layout — we take the *spatial rhythm and
hairline/surface craft, not the indigo accent*; blackbox keeps its closed 3-signal set).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ READOUT BAR  ◐ blackbox · trace id · task ............... ORACLE  VERDICT  │  --h-bar, glassy hairline
├───────────────────┬──────────────────────────────────┬─────────────────────┤
│ CASE NAVIGATOR    │ TRACE SPINE (vertical)            │ INSPECTOR           │
│ --rail-nav        │ 30-step chain, top→down           │ --rail-insp         │
│ · run identity    │ mono, dim by default              │ selected step:      │
│ · pipeline steps  │ (blast cascades down)             │ in/out · why ·      │
│   (status glyphs) │ root snaps into focus on analyze  │ provenance · judge  │
│ · ranked suspects │                                   │ + replay action     │
│ · shortcut chips  │                                   │                     │
├───────────────────┴──────────────────────────────────┴─────────────────────┤
│ LOG DOCK  chronological readout · root line marked                          │
└──────────────────────────────────────────────────────────────────────────┘
        confirm-flip replay = full-width overlay (--z-overlay)
```
- 8pt grid; **`--hair` (0.5px) `--line` borders**; separate regions by surface-step +
  hairline before reaching for a heavier border. Dense trace/nav rows (~28–32px) so the
  chain fits; spacious inspector with compact key→value property rows.
- **Left rail = navigation analog.** Run identity → the **debug pipeline** as a vertical
  stepper (record · blast · analyze · confirm) with neutral **status-ring glyphs** that
  advance with `phase` → **ranked suspects** (candidates) as selectable rows with a tiny
  suspicion meter; the leading suspect carries `--root`, the rest stay neutral.
- Background: `--bg` + a very faint graph-paper grid + soft central radial vignette →
  "instrument readout." Quiet enough that trace + accents dominate.

### Status-ring glyph (Linear's signature element, neutralized)

A small circular SVG ring (`--glyph`, ~13px) encoding state by **shape + fill**, never by
color alone: `pending` = faint hollow ring, `active` = partial pie, `done` = filled ring
with check. Used for the pipeline stepper and suspect rows. Glyphs are **neutral
affordance** (text tiers) — the one exception is the confirmed root suspect, which earns
`--root` because it *is* the localized root cause (per the color-mapping rule).

### Iconography (lucide-react)

Icons come from **lucide-react** at `--icon` (16px) with `strokeWidth` = `--icon-stroke`
(1.5px); icon→label gap is `--gap-icon`. Icons are **neutral affordance only**: default
`--text-dim`, `--text` on hover/active — **never** a signal hue (`--root`/`--blast`/`--pass`)
and never a 4th hue. State is carried by the status-ring **Glyph** (shape + fill), not by
icon color. Use icons to label/clarify rows and actions, not to signal failure.

### TrustBadge states (monitor verdict, reuses existing tokens — no new hue)

The TrustBadge tracks the monitor's `TrustState` and reuses existing tokens only:

- **untrusted** (idle / decoy rejected): `--text-dim` text on `--inset`, **dashed** `--line`
  border. The lone calm/off state — no fill, no signal hue.
- **proving** (replaying decoy then root): still neutral `--text-dim`, shows an `n/n`
  confirmation count as it accrues. No `--blast`/`--pass` while proving.
- **trusted** (the confirmed flip): `--pass` text + `--ring-pass`. This is the single focal
  heal moment, co-timed on one spring with the FAIL→PASS verdict.

**Rejected / non-flip treatment.** A candidate that does NOT flip on replay (the decoy)
renders **neutral rejected**: `--text-dim`, dashed `--line`, a `0/n` chip. It is **never**
`--blast` (it was never poisoned) and **never** `--pass` (it did not heal). Only the true
root cause's confirmed flip earns `--pass`.

## Patterns

Validated against dark AI dev-tool landing pages (Linear, Modal, Braintrust, Langfuse).

- **Two-tone verdict.** In the readout bar, color **only** the verdict word
  (`FAIL` → `--blast`, `PASS` → `--pass`); the rest of the line stays neutral
  (`--text` / `--text-dim`). The verdict is the single saturated word on screen —
  the eye lands on it. Never color the surrounding labels.
- **Keyboard-shortcut chips.** blackbox is keyboard-driven (e.g. `j`/`k` to move
  between steps, `↵` to inspect, `r` to replay). Surface the keys as small chips:
  `--font-mono`, `--t-label`, `--text-dim` on `--inset`, `--r-1`, 1px `--line`.
  Shows "serious instrument," not a toy. Chips are affordance only — never a signal hue.

## Motion — framer-motion, three beats only

Everything else stays restrained (`--dur-micro`, `--ease-out`, no scattered hover
bounces) so these land. Enter = `--ease-out`; exit = `--ease-in` (faster); animate
`transform`/`opacity` only.

1. **Blast radius** — poison propagates **forward** down the chain via
   `staggerChildren: --stagger-blast`; each downstream step flips neutral→`--blast`
   with a scale pulse. The audience *sees* it spread.
2. **Analyze** — a deliberate spring **snap/focus** onto the root step (`--ring-root`
   ignites, neighbors dim further). A localization, not a fade.
3. **Confirm (peak)** — poisoned chain **heals** `--blast`→`--pass` in sequence;
   verdict flips **FAIL→PASS** on the satisfying spring. Heaviest motion in the app.

What makes motion read "expensive": custom easing over default `ease`, asymmetric
in/out, short confident durations, coordinated stagger, one focal point at a time.

## Accessibility

- Contrast floor: WCAG **4.5:1** body / **3:1** large (≥24px or bold). Verify signal
  colors on `--bg`. Don't rely on color alone — pair signals with icon/label/shape.
- Visible **focus** on every interactive element (`--focus-ring`); never remove outlines.
- Honor `prefers-reduced-motion`: replace the three beats with instant state changes
  (no cascade/heal animation), keeping the same final colors.

## Maintenance

This file is the source of truth, loaded via `CLAUDE.md`. Change tokens here first,
then in code. When you add/rename/remove a token or rule, update this file in the same
commit so it never drifts from the implementation.

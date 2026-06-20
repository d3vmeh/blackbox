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

  /* ---- Text tiers (high / med / low emphasis) ---- */
  --text-bright:  #EAEEF3;  /* focused / selected (~87%) */
  --text:         #C7CDD2;  /* default readable (~70%) */
  --text-dim:     #59636F;  /* ORDINARY step text — deliberately quiet (~45%) */
  --text-faint:   #39414B;  /* disabled / scaffolding (~30%) */

  /* ---- Three reserved signals (warm → warm → cool) — nothing else uses these ---- */
  --root:         #FF9D2E;  /* ROOT CAUSE    hot amber beacon (origin, brightest) */
  --blast:        #FF4361;  /* BLAST RADIUS  crimson (the poison spreading) */
  --pass:         #34E3A0;  /* CONFIRMED FIX mint/emerald (the heal / relief) */
  --root-glow:    #FF9D2E26;
  --blast-glow:   #FF436126;
  --pass-glow:    #34E3A026;

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
  --font-display: "Archivo", sans-serif;            /* +"Archivo Expanded" for verdicts */
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
}
```

**Breakpoints:** desktop-first single dashboard; design for ≥1280px, degrade gracefully
to ≥1024px. Not a mobile product — don't spend effort below 1024px.

---

## Typography craft

| Role | Font | Size / weight | Line-h | Tracking |
|---|---|---|---|---|
| Verdict (FAIL/PASS) | Archivo Expanded | `--t-verdict` / 900 | `--lh-tight` | `--track-verdict` |
| Run headline / H2 | Archivo | `--t-h2` / 800 | `--lh-tight` | `--track-display` |
| Section eyebrow | IBM Plex Mono | `--t-label` / 600 **UPPERCASE** | `--lh-data` | `--track-upper` |
| Step rows / data | IBM Plex Mono | `--t-step` / 400–500 | `--lh-data` | normal |
| Inspector body | IBM Plex Mono | `--t-body` / 400 | `--lh-body` | normal |

- **All numeric/data:** `font-variant-numeric: tabular-nums slashed-zero;` so digits
  share width and don't jump as values update; right-align numeric columns.
- **Weights are restrained:** 400 read · 500 emphasis · 600 label · 800/900 display only.
- Banned faces: Inter, Roboto, Open Sans, Arial, system-ui, Space Grotesk.
- Self-host both fonts (no Google CDN) — fits the static SPA + instrument feel.

## Color semantics — when NOT to use

The three signals are **reserved**. Do not use `--root`/`--blast`/`--pass` for buttons,
links, icons, charts axes, focus, or "nice accent." If a step is ordinary it stays
neutral (`--text-dim`). Mapping:

- `--root` → exactly one step: the localized root cause.
- `--blast` → only downstream steps poisoned by the root cause.
- `--pass` → only the confirmed-fix / fail→pass state.

Dark-UI rules: elevation reads via **lighter surfaces** (`--inset`→`--overlay`), not
bigger shadows; accents already desaturated to sit calm; hairlines are low-alpha white
(`--line-hi`) on raised surfaces; a faint colored **glow** is the accent on focus/active.

## Layout — the trace is the spine (vertical)

```
┌─────────────────────────────────────────────┐
│ READOUT BAR  run id · agent · VERDICT (huge) │  thin instrument header
├──────────────────────────┬──────────────────┤
│ TRACE SPINE (vertical)   │ INSPECTOR         │
│ 30-step chain, top→down  │ selected step:    │
│ mono, dim by default     │ in/out, why,      │
│ (blast cascades down)    │ payload           │
└──────────────────────────┴──────────────────┘
        confirm-flip replay = full-width overlay (--z-overlay)
```
- 8pt grid; 1px `--line` borders; dense trace rows (~30px) so 30 steps fit; spacious
  inspector. Prefer surface-step / spacing for separation before reaching for a border.
- Background: `--bg` + a very faint graph-paper grid + soft central radial vignette →
  "instrument readout." Quiet enough that trace + accents dominate.

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

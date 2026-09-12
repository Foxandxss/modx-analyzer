# Handoff: MODX Analyzer — phase 1 UI

## Overview

The interface of a desktop tool (**Tauri + Angular, Windows**) for **learning FM-X synthesis** by
watching, live, what comes out of a Yamaha MODX8: waveform, spectrum, harmonics, waterfall, the
operator diagram read from the keyboard over SysEx, and a panel that overlays theory (Bessel
functions) on the measurement.

The user is a pianist who does not know FM. The app teaches. Everything drawn corresponds to data the
phase-0 spikes already proved the app can obtain.

**Hard constraint from the project owner:** this is an audio app, not an office app. No form grids, no
`input type=number` as a primary control, no settings tables, no native checkboxes or selects, no
white cards with shadows. Mandatory: dark surface, colour with intent, curved geometry, and states
communicated by **light and shape** before text. An ON/OFF is not a checkbox: it is a drawing that
lights up and goes out.

The visual direction is **decided: A · Bancada**.

## Precedence — read this before anything disagrees

When two parts of this handoff disagree:

1. **`GLOSSARY.md` §6 wins on any user-visible string.** It is the only authority on copy. If a
   Spanish string is not in §6, it has no approved English form yet — **ask, never invent**. (The one
   deliberately open row, `FE Line`, is **closed**: it is the feedback row, `FB n · OP n`. §4b.)
2. **The current text of a section wins over any historical note inside it.** Where a section carries
   a superseded figure or an earlier decision, it is labelled as such and the live rule is the one
   stated in the section body.
3. **`design-tokens.css` is the source of truth for values**, with no exception. The five values
   round 9 had to leave marked stale were **applied in session 2** along with the two ceiling-datum
   tokens it proposed; both copies of the file carry identical values, the accidental third copy under
   `design/` is deleted, and no marker is left. See `CONCERNS.md` §29, resolved.
4. **Where the paper and the measurement disagree, the measurement wins.** Where the phase-0 spikes
   and the running build disagree, **the build wins** — it is measuring the instrument on the desk.

**Reading order for whoever implements this**: `GLOSSARY.md` (the vocabulary and the renames) →
`CONCERNS.md` (5 minutes, saves you from assumptions) → `DESIGN.md` (the "why" and the limits) →
`design-tokens.css` → the system sheet open beside the code.

## State of the package — 2026-09-12, after round 10

**The repository's `design_handoff/` is the only copy of the package**: there is no designer-side
folder for it to be behind, and nothing is read from a second copy (`HANDOFF.md`, *What is
deliberately not in here*). Brought up to date by #105 (2026-09-12), after ADR-0008; what changed
since round 9 is under *Since round 9* below.

**The whole handoff is in English**, and that was a naming pass rather than a translation. The reason
was never internationalisation: after using the running app the owner still could not say what
`TEORÍA` meant on an operator node, and `THEORY` would have been exactly as opaque. So every term was
re-derived from the fact its number represents. The decisions that carry the most weight:

| was | is | why |
|---|---|---|
| `MIRAR` / `MEDIR` | **`LIVE`** / **`CAPTURE`** | not two verbs from one family — a **state** and an **act**, so the grammar separates them before the reading does. And `CAPTURE` gives the app the noun it never had: *a capture*, with a window, an age and a note |
| `TEORÍA` | **`PREDICTED`** | the only candidate that implies the number **can be wrong**, which is the entire point of stamping it |
| `SONDEADO` / `CADUCO` | **`POLLED`** / **`POLLED · 0.40 s`** | stale is not a separate source: it is polled **plus age**, and both halves were already drawn |
| `DOCUMENTADO` | **`DOCUMENTED`** | **the build's own word, and it was right** — the routes come from Yamaha's table, which is a fourth source. Neutral ink: *paper has no colour* |
| `PÁNICO` / `CALLA` | **`HUSH`** | also the build's instinct, also right: *panic* names the user's emotion, and every other failure here names what happens |
| `INVALIDADO` | *(a dash in a kept outline)* | round 6 already drew it; writing `VOID` next to a dash labels a blank |
| `CREAR` | **`BUILD`** | `CREATE` is the vaguest verb in software; you are assembling a sound out of eight parts |

**Provenance is four words and two shapes** — `MEASURED`, `PREDICTED`, `POLLED`, `DOCUMENTED`, plus a
broken outline for stale and a dash for void. The distinction is untouched; only its ink cost changed.
Full table and reasoning in `GLOSSARY.md` §1–§2, the implementer's table in `DESIGN.md` §20.7, drawn
in `8b`.

**The `design/` files carry English names now** (`Main-screen`, `Round3-screens`, …, `Index`) and every
cross-reference is updated. **Screen ids never changed** — `3a`…`8h` mean exactly what they always
meant, in every document and in the pieces.

**Round 8's design changes**, all resolved inside surfaces that already existed and two of them by
**removing** things — no new screen in round 8, and nothing at all added in round 9:

| piece | what changed |
|---|---|
| `8a` | header: the naming pass on screen; the anchor's debug eyebrow **removed**; the two disabled mode buttons **removed** |
| `8b` | the stamps reduced to four words and two shapes |
| `8c` | the operator node gets its bars back, keeps a **linear 0–99** fill against one shared **ceiling datum**, draws the spectral form as a glyph instead of a name, drops the miniature AEG (six facts in a five-fact box), and grows **the corner** — the visible path to the operator editor |
| `8d` | the measured column before the first capture: a **contract**, not a hole |
| `8e` | the **scope contract** in writing (which period, how many cycles, what it draws when it cannot lock) and the waterfall's hardcoded prose caption **removed** |
| `8f` | the algorithm became the primary surface — 1232×400 — **automatically** whenever nothing was measured, with `KEEP IT BIG` to pin it — **retired** by #54/#58: the ranuras choose the composición (ADR-0007) |
| `8g` | the **bench drawer**: one 52 px handle for every temporary instrument, each wearing its ticket number |
| `8h` | **every answer checked against the running build** — four figures and a count corrected, one answer changed |

**Checked against the running build.** Confirmed: six of the eight operator levels are identical to the
eye, the ratio row reads `×0.50 ...` in **all eight** nodes, the scope is flat under `2 CYCLES ·
43.8 Hz`, and role is genuinely unreadable from position in the 683 px diagram. **Corrected**: noise
floor **−58 to −66 dB** on the live stream (not −104, which is the same formula on the golden WAVs
offline — both relative to the peak), wide ring **10.0–10.4 Hz** (not 12.2), reread set **384**
requests of which 383 answer (not 416), bulk dump **19 003 B / 123 msg** (not 7 669 B), and the
temporary readout is **five blocks** (not three) — so round 7's stale thresholds become 0.40 s and
0.80 s, while the *rule* behind them survives untouched. **One answer changed**: the build's
`DOCUMENTADO` stamp is a provenance source the glossary was missing.

**Round 9 was editorial**: the round-8 chapter was folded into the sections it corrected so that every
rule is stated once, the remaining documents were translated, and **no rule changed**. What folding
cost is `CONCERNS.md` §36 — four decisions the owner should check.

**Since round 9**, four things happened that an implementer has to know; everything else is pointed
at. **Session 2** applied the token values round 9 had to leave marked (#26, precedence rule 3
above) and corrected the handoff in the four places the build proved it wrong (#49). **Session 3**
decided that the two ranuras choose the composición and a capture moves nothing (ADR-0007, #58),
and gave the fill a track to measure against (#67). **Round 10** — specified in #73, landed as
#74–#89 and #93, decided in ADR-0008 (#84) — turned the Level onto the axis its composición
declares, made a drawing that cannot hold its facts fold its facts and never its positions, took
parking out of the stack, gave the window a width floor and turned the fill's ink with the axis;
its verification list and every verdict are ADR-0008 §8's, and this readme does not repeat them.
**The documents** were brought into agreement with the drawing: this readme's own sweep in #97,
`DESIGN.md`, `GLOSSARY.md` and `CONTEXT.md` in #87.

**Open: §17 and §23.1.** None blocks implementation. §32 (the 125 % viewport) is deferred by
the owner, which is not the same as open.

| open | what is missing | whose it is |
|---|---|---|
| §17 · not designed | saving to the MODX's memory (today everything is the edit buffer) and the patch library / DX7 corpus. **Not holes: scope**, out by the owner's decision | later phase |
| §23.1 · the anchor's blind spot | **the only real hole**: ~1.5 s per capture, during which the anchor cannot poll. Declared, not drawn, twice by decision | phase 1 |

Two rows left this table, each with a record. §29 was applied in session 2 (precedence rule 3
above; `CONCERNS.md` §29, resolved). §31 was measured — the worst case is eight rows, reached by the
66, and eight operators on one row, reached by the 1 (`DESIGN.md` §10; `CONCERNS.md` §31,
resolved).

### The app has two first-class modes

- **LEARN** — the tutor leads step by step and writes to the keyboard itself. Low density, and a
  **warm sub-register** (serif + cream ink) on everything read in order to *understand*. It is not a
  second theme: measured figures stay in mono and phosphor there too.
- **BUILD** — nobody holds your hand. High density, all the FM at once, and **ALL EIGHT** as the
  primary surface. This is the mode that gets used for hours.

And a third that is a **mode of the main screen**, not a screen: **A/B**, for comparing two values of
the same parameter.

**Only what exists is rendered.** Today that is one label, `BUILD` — not a three-way switch with two
dead thirds. A mode with no code behind it is absent, not greyed out; see `DESIGN.md` §3.1.

Two pieces cross **every** screen and must be implemented once:

- **HUSH** — the app's only octagon, 56 px, at the far right of every header, no confirmation. See
  `4d`.
- **The player** — the app playing the keyboard itself (note-on → hold → capture → note-off). Seven
  states. See `4c`.

## About the Design Files

The files in `design/` are **design references written in HTML** — prototypes showing the intended look
and behaviour, **not production code to copy**. They are static: no audio logic, no MIDI, no real
state.

The task is to **recreate these designs in the project's environment** (Angular on Tauri, with its
established patterns and libraries). If the project has no UI yet, build the phase-1 UI in Angular
following `design-tokens.css` as the source of truth for values.

A technical note on the format: the files are ordinary HTML (they open on a double click) but they were
written in a prototyping runtime that loads `design/support.js`. **Do not port that runtime.** What you
read from them is the layout, the values and the visual hierarchy — the internal markup is not a
fidelity target.

## Fidelity

**High fidelity.** Colours, typography, spacing, radii, strokes and intensities are final and live in
`design-tokens.css` with semantic names. Recreate the UI precisely using the tokens, not the literals
you see in the HTML.

Two things are **real data, not decoration**, and must be computed in the app rather than copied:

- The waveform is `sin(2πt + I·sin(2π·2t))` with I = 2.8.
- The spectrum is the `|J_n(I)|` amplitudes at `|fc ± k·fm|` (partials at `1 ± 1.41n` and `2 ± 7n`).
- The waterfall is the frames of an actual capture, with the index decaying. **Its caption is computed
  from that capture** — frame count and duration — and says nothing about the shape of what is drawn.

The example values on screen come from the spikes and serve as a test case: algorithm 6, feedback 3 on
Op5; Op1 carrier 99 ×1.00 Sine, Op2 at 0, Op3 modulator 90 ×1.41 Odd 1, Op4 carrier 99 ×2.00, Op5
modulator 72 ×2.00 Res 1, Op6 modulator 64 ×7.00, Op7 at 0, Op8 carrier 55 ×0.50 All 1. fc = 261.763 Hz,
fm = 369.175 Hz, measured ratio 1.4103 (the keyboard's screen says 1.41, Δ 0.4 ¢), I = 2.81, 11
partials, peak −18 dBFS, and a 2756.25 Hz comb that is **marked `NOT A HARMONIC`** rather than hidden.

## Target canvas

- **1280 × 800 CSS px**, ~**1280 × 740 usable** full-screen once the Tauri window frame is deducted.
  14" laptop, 1920×1200 panel at 150 % Windows scaling.
- That 740 px budget **is tight on two screens** (ALL EIGHT and the Part). See `CONCERNS.md` before
  adding anything to them.
- **`devicePixelRatio` = 1.5.** Hard consequence: signal, diagram, curves and grids must be **vector
  (SVG) or canvas scaled by DPR**; no fixed-size bitmaps. And **no 1 px hairlines** — at 1.5× they look
  dirty: rules at 2 px (`--rule-min`) or separation by surface colour and air.
- **Touchscreen, and mouse too.** See "Interactions".
- The Waveshare ESP32-S3 / 1024×600 target **is cancelled**: there is no small breakpoint. Scaling up
  on an external monitor (>1600 CSS px) is an escape case, not a design case.
- **The 125 % option (1536 × 960) is deferred** by the owner and is not part of this package. Nothing
  here assumes extra room. `CONCERNS.md` §32.

## Screens / Views

### 1. The main screen — "the instrument" (`4a`)

File: `design/Main-screen.dc.html`, section `4a`. Composition after the round-3 rebalance, which is
what gets implemented. (The first main screen is archived as `Direccion-A-Bancada.dc.html` and is not
implemented; `3e` in `Round3-screens.dc.html` documents the rebalance that produced `4a`.)

**Purpose.** This is the screen you look at while playing. Three zones coexisting without any of them
being a sidebar shoved into a corner.

**Layout.** A vertical column of 1280×800:

- **Top bar**, 58 px tall, `padding: 0 16px`, `border-bottom: 2px solid rgba(255,255,255,.09)`,
  background `linear-gradient(#0b0f11,#080b0d)`, `display:flex; align-items:center; gap:18px`.
  Left to right: connection dot (9 px, `--signal-primary`, 10 px glow) + a mono line with the port; the
  **anchor** — the patch name at 17 px **and nothing else** (see `6a`); the algorithm pill
  (`ALGORITHM 06`, border `rgba(243,177,63,.4)`, radius 999, figure at 15 px in `--carrier`);
  `FB 3 · OP5` in mono 11 px; the **mode label**; flexible spacer; the **chain chip**; the
  **transport** (below); and **HUSH**, isolated.
- **Warning strip** (conditional, `flex: 0 0 auto`): 10 px 22 px, background `rgba(255,122,92,.1)`,
  bottom border `1px solid rgba(255,122,92,.35)`, a 20 px square with a `--alert` border + glow, and
  mono 12 px text. It appears in the unhappy states.
- **Body**, `flex:1`, `display:grid; grid-template-columns: 700px 1fr 214px; gap:2px`, gap background
  `rgba(255,255,255,.07)` (so the "rule" is a 2 px gap, not a 1 px border):
  - **Column 1 — the operator diagram** (the hero), 700 px. `padding: 12px 16px 0`. Header:
    `ALGORITHM` (12 px, tracking .22em, `--ink-secondary`), and on the right the provenance —
    `POLLED · SysEx 49 op 1A · 10 Hz` for the parameters and **`ROUTES · DOCUMENTED`** for the
    topology, which comes from Yamaha's table and not from the keyboard. Node canvas on an SVG of
    routes. Legend foot: **four** samples — carrier, modulator, level 0 and the **ceiling datum** with
    `THE LOUDEST OPERATOR IN THIS PATCH` — plus `5 of 43 facts shown · the corner opens the other 38`,
    which is **held back in the build** until the operator editor exists.
  - **Column 2 — signal views**: two equal panels stacked (`flex:1` each, `padding: 12px 14px`),
    separated by `border-bottom: 2px solid rgba(255,255,255,.09)`. **SCOPE** on top with its contract
    caption (`LOCKED 349.23 Hz · 4 CYCLES · 11.5 ms`), **SPECTRUM** below (`LOG 1×–32× · FLOOR −66 dB`
    — **absolute dBFS**, not relative to the peak; see `DESIGN.md` · *The scope contract*).
    View frame: `border: 1px solid rgba(255,255,255,.07)`, `border-radius: 14px`, background
    `linear-gradient(#0a0f10,#070a0b)`.
  - **Column 3 — measured figures**: `padding: 12px 13px`, `gap: 10px`. The **HARMONICS** panel on top
    (permanent, with the Bessel curve overlaid on the measured bars); below, a stack of cells separated
    by 1 px gaps over `rgba(255,255,255,.05)`: `MEASURED RATIO` (29 px, `--signal-primary`, subtitle
    `keyboard shows 1.41 · Δ 0.4 ¢`), `fc / fm`, `INDEX I · FITTED` (20 px, `--carrier`),
    `WORST PARTIAL`, and `LAST CAPTURE` (`65536 · 14 s ago`, `C4 held · peak −18 dBFS`).
    **Before the first capture this column is a contract, not a hole** — see `8d` and `DESIGN.md` §10.1.
- **Waterfall / scope**, `flex: 0 0 156px`, shared in a tabbed panel of `--hit-tab` (44 px),
  `border-top: 2px solid rgba(255,255,255,.09)`. Header: `WATERFALL · 22 FRAMES · 0 → 712 ms` — **an
  illustration; both figures are computed at runtime**, the count from the rows actually drawn (the
  panel keeps 14) and the span from per-row time stamps, last minus first — and on the right
  `TIME ↓ · FREQUENCY →`. Ridgelines in an
  SVG with `preserveAspectRatio="none"`, colour from `#eafff4` (newest) to `#1e7351` (oldest), stroke
  1.4 → 1 px with `vector-effect: non-scaling-stroke`.

**Tab criterion**: the waterfall is the **default as soon as a note is sounding**; the scope is asked
for.

**Key components on this screen.**

- **Operator node** — 118×108 (which is also its touch target), 116 tall for nodes carrying a measured
  ratio. **Five facts, no more** — see `DESIGN.md` §9 for why the miniature AEG came out.
  - *Carrier*: `border: 2px solid var(--carrier)`, `border-radius: 26px` (fully curved), background
    `#0d1214`, glow `0 0 30px -8px rgba(243,177,63,.7)`.
  - *Modulator*: `border: 1.5px solid var(--modulator)`, `border-radius: 5px` (live corner), background
    `#0a1013`, glow `0 0 26px -7px rgba(88,200,245,.75)`.
  - *Level 0*: `border: 1.5px dashed var(--inert)`, no fill, background `#070a0b`, figures at `#3f4d4a`.
  - *Level fill*: the axis is the composición's — height in the grid, length in both wide boxes —
    **linear 0–99**, dense at the origin and faint at the far end (`DESIGN.md` §9; ADR-0008 §2.1,
    §2.6). **Level IS the fill's length**; the figure only confirms. The stop pairs and their reason
    are under *Design Tokens* below.
  - *The ceiling datum*: a repeated mark on identical boxes at the patch's highest Level, at the same
    fraction of the track, aligned into a rule where cards share an origin (ADR-0008 §2). Real
    patches cluster between 71 and 99, so the eye reads **the gaps**, not the lengths.
  - Content: `OP1` label (mono 11 px) + role (`CARR` / `MOD` / `ZERO`, 8 px, tracking .14em) on top;
    below, the Level figure (mono 25 px), the ratio and the **spectral form as a glyph** (≤5 strokes at
    18×14 — never a name, because a name ellipsises), and the operator's Hz stamped `PREDICTED`.
  - *The corner*: a 44 × 44 open corner mark at the bottom right — two 2 px strokes, the visible path to
    the operator editor. Same mark on all eight; the words appear once, in the legend.
- **Diagram routes** — SVG. Active modulation: `--modulator`, 2 px (not 2–2.6: `vector-effect:
  non-scaling-stroke`, so the stroke does not grow with the viewBox), with an arrow marker. Output
  bus: `--signal-primary`, 2 px, to `OUT L/R`. Feedback: `--carrier`, 2 px, an arc labelled `FB 3`.
  **Inert is either end of a route**, one rule for five cases: a route out of an operator at 0, its
  drop to the bus, the feedback arc at `FB 0` (#57), a route *into* a parked operator (#83, ADR-0008
  §2.5) and the parked operator's stub — all `--inert`, 1.5 px, on `--dash-inactive` (`4 5`); the
  stub has no arrow and ends in a bar. In the wide composition only, a route *out of* a parked
  operator is not drawn at all; the grid draws it cut (ADR-0008 §2.5). **The routes are
  `DOCUMENTED`, not polled**: the app polls which algorithm is loaded and reads who-feeds-whom out
  of the FM-X table.
- **Transport — `LIVE` and `CAPTURE` are two different acts, and that has to be visible.**
  - *LIVE (a state)*: pill `padding: 12px 16px`, `border: 1px solid rgba(125,240,176,.28)`, background
    `rgba(125,240,176,.06)`, a 7 px dot with `animation: livePulse 1.4s ease-in-out infinite` (opacity
    .35 → 1), text `LIVE · 30 fps`. Continuous, free, and **produces nothing you can quote**. Its
    **second line is the audio the app actually opened** — `Line (MODX) · 44100 Hz · 2 ch`, three
    measured facts off the stream, nothing hardcoded. `MAIN L/R` is the keyboard's routing, which the
    stream cannot report: it is `DOCUMENTED` and lives on the check screen (`4e`).
  - *CAPTURE (an act)*: button `padding: 13px 22px 13px 16px`, `border: 1.5px solid var(--carrier)`,
    `border-radius: 999px 8px 8px 999px`, background `linear-gradient(180deg, rgba(243,177,63,.22),
    rgba(243,177,63,.06))`, shadow `0 0 28px -8px rgba(243,177,63,.7)`; inside, a "shutter" (26 px
    circle, 2 px border, `radial-gradient(circle, #f3b13f 34%, transparent 36%)`), the label `CAPTURE`
    (mono 14 px, tracking .2em, `#ffd08a`) and, past a vertical rule, `65536 / NEEDS A HELD NOTE` in
    mono 9 px. One press, one artefact, with an age.
- **Marking what is not a harmonic** — non-harmonic partials are painted in `--alert` with
  `stroke-dasharray: 3 3` and carry a `NOT A HARMONIC · 2756 Hz` chip in the panel's top right corner.
  **They are not hidden and are not counted as harmonics.** The `9TH HARMONIC · PEAK` label goes in the
  left corner so they do not collide. And **never a chip without its frequency**: the Hz is what tells a
  generator comb from mains hum or aliasing, so a warning without a number cannot be acted on. The
  build makes that unrepresentable — the chip's `hz` is a required input.
  **The floor does not gate these chips.** The generator's comb sits *below* the live floor and they
  still fire, because the partial picker has its own **absolute** threshold and never consults the
  floor figure. That is why `FLOOR` being absolute dBFS changes what the readout says and changes
  nothing about what is marked.

### 2. Directions B · Nébula and C · Plotter — ARCHIVED

Not in the package and not to be implemented. The chosen direction is **A · Bancada**; the four reasons
are in `DESIGN.md` §2. The only thing that survives from C is its **warm register** (Georgia serif,
cream ink, vermilion accent), now the sub-register of the lesson screens inside A — see the
`--font-lesson` and `--lesson-*` tokens, and screen `3d`.

### 3. System sheet (direction A)

File: `design/System-sheet.dc.html` — a long page, scrolled. 1280 wide.

It contains, in this order: a cover with the three context chips (canvas, DPR, touch); palette and
typography; **the operator in four states** (active carrier / active modulator / level 0 / focused, the
last with a `--signal-primary` border and a 40 px glow); **controls** (continuous knob, bipolar, the
Freq Mode drawing-toggle, the Spectral Form selector); **the operator editor** (AEG, PEG and Level
Scaling); **theory versus measurement**; **state badges**; the "the tutor just touched your keyboard"
state; the full **tutor mode**; **the four unhappy states**; and the **finger and mouse interaction**
section.

Control details (each with its finger/mouse note on the sheet itself):

- **Continuous knob** — a 160×160 SVG. Track `rgba(255,255,255,.08)` at 10 px, value arc in the role's
  colour with `stroke-dasharray` and `stroke-linecap: round`, inner cap r=44 at `#0d1416`, a 3 px index
  mark rotated to the value, and **the value always visible in the centre** (mono 27 px) with the label
  below (10 px). Drag grab 160 px (`--grip-knob`).
- **Bipolar control (Detune, centre 15)** — a 58 px tall track (`--track-bipolar`),
  `border-radius: 12px`, background `#0a1013`. Centre line `rgba(255,255,255,.28)` at 1 px, a deviation
  bar from the centre with a gradient in the role's colour, a 3 px position mark with glow, the ends
  `−15` / `+15` in mono 9 px and the value (`+7`, 20 px) centred above. **The centre is seen, not
  remembered.**
- **The Freq Mode drawing-toggle (the exemplary ON/OFF)** — two ~150×112 cards side by side. Lit:
  `border: 2px solid var(--carrier)`, background `linear-gradient(180deg, rgba(243,177,63,.16),
  rgba(243,177,63,.03))`, shadow `0 0 30px -10px`, and **a drawing of what Coarse and Fine are going to
  mean**: six harmonic partials under a dashed envelope labelled `× fundamental`. Off (`FIXED`):
  `border: 1.5px solid #2b3436`, background `#080c0d`, one grey partial and `absolute Hz`. Switching to
  Fixed **also moves the Coarse** → warn on the switch.
- **Spectral Form selector** — seven ~52×72 cells with `gap: 7px`; each is the **resulting spectrum**
  drawn in a 44×34 SVG (Sine, All 1, All 2, Odd 1, Odd 2, Res 1, Res 2) with the name below in mono 9 px
  (never in a tooltip). Selected: `border: 2px solid var(--modulator)`, role-gradient background, shadow
  `0 0 26px -8px`. Skirt and Resonance **modify the selected drawing live** (Skirt widens the skirt,
  Resonance moves the peak: 0 = fundamental, 99 = harmonic 100); only Res 1 / Res 2 enable them.
- **Envelope editor** — panels of `border-radius: 16px`, background `#0a0f10`, with the SysEx address in
  the header (AEG `49 op 10-18`, PEG `49 op 0C-0F`). *AEG*: a `--signal-primary` polyline at 2.4 px with
  `rgba(125,240,176,.08)` fill, draggable r=11 points (`fill: #06080a; stroke: 2.4px`), a dashed `r=22`
  grab halo on the active point, a vertical **key off** mark in dashed `rgba(243,177,63,.5)`, levels
  labelled beside the point (99 / 72 / 58) and times as labels below (`ATK 18 · DEC1 42 · DEC2 55 ·
  REL 30 · HOLD 0`) — **not as fields**. *PEG*: the same but in `--modulator`, with a dashed **centre
  50** line at mid height and the bipolar value labelled (`+34`).
- **Level Scaling** — **it is a curve over the keyboard and it is drawn as one**: two curve segments in
  `--carrier` (2.2 px) meeting at the **Break Point**, marked with a dashed `--signal-primary` vertical
  and the label `BREAK B3`; the curves labelled with their type and value (`−Exp · 32`, `+Lin · 48`);
  and **a keyboard drawn below** (a 14 px rectangle with the black keys at `#1b2426`), ends `A-1` and
  `C8`. Its own scale, base A-1, not MIDI.
- **Theory versus measurement** — the project's reason to exist. Measurement bars
  (`--signal-primary`, 7 px, opacity .85) and **on top of them** the predicted `|J_n(I)|` curve as a
  `--carrier` polyline of 2 px with `stroke-dasharray: 5 4` and a hollow circle per point. The legend
  tells the two apart with a line sample (`PREDICTED` dashed with a circle / `MEASURED · 65536` solid and
  thick). **Where it does not match, it is boxed and explained**: a 1.4 px `--alert` rectangle around
  n=2, a leader line, and two sentences: "n=2 · measured 10 dB low" / "the Part's filter is missing from
  the model". Foot with `MEAN ERROR 1.8 dB`, `WORST PARTIAL n=2 · 10 dB`, `FITTED I 2.81`.
- **Provenance badges** — pills of `padding: 6px 13px`, mono 10 px, tracking .12em: `LIVE · 30 fps`
  (phosphor, with a beating dot), `MEASURED · 65536` (phosphor, solid), `POLLED · 10.4 Hz` (cyan),
  `DOCUMENTED` (**neutral — paper has no colour**), `WRITTEN AND VERIFIED` (cyan),
  `NOT A HARMONIC · 2756 Hz` (alert, square), `POLLED · 0.40 s` (**broken outline, no word for stale**),
  `PREDICTED` (amber, dashed). Every figure on screen carries one. **Void has no badge at all**: the
  dash inside the kept outline is the stamp.

### 4. Tutor mode

On the system sheet. A `border-radius: 20px` panel in three columns
(`grid-template-columns: 250px 1fr 330px`):

- **Steps**: a list of 5 with a 26 px circle — done (`✓`, border `rgba(125,240,176,.5)`), current
  (filled `--signal-primary` circle with the number in `#06110a`, row with `rgba(125,240,176,.09)`
  background and a border), pending (`dashed --inert` border). Below, **← BACK TO STEP 2**: going back
  restores a known state, **with no penalty**.
- **Current step**: title 26 px, explanation 15 px / 1.65 with the formula `|fc ± k·fm|` in mono, and two
  buttons — `YOU DO IT, I'LL LISTEN` (cyan, lit) and `I'LL DO IT MYSELF` (neutral). Comparative foot:
  `TARGET 1.41` (amber) vs `YOUR KEYBOARD NOW 1.4103 measured` (phosphor) + a `MATCHES` badge.
- **Where to look on the MODX**: the app **cannot navigate the keyboard's menus**, so it shows the path
  as an indented ladder in mono 13 px (`[EDIT] → Part 1 → Operator 3 → [Form/Freq]`, the last leg in
  phosphor) and waits. Below, the precondition verified at startup: `Receive Bulk` is not in Protect.
- **The "the tutor just touched your keyboard" state** (badge column): a card with
  `border: 1.5px solid rgba(88,200,245,.55)` and `animation: writeFlash 2.2s ease-in-out infinite`. It
  lists the three written parameters with `✓ read back` in phosphor per line, and offers "back to what I
  was doing". It is information the user has to **notice even while looking at something else**.

### 5. States that are not happy

Four cards of `border-radius: 18px`, a 1.5 px border in their severity's colour, background
`linear-gradient(180deg, <colour> .09, <colour> .02)`, `padding: 20px`, each with an SVG drawing of
primitive shapes on top (never an invented icon), an 18 px title, a 13 px / 1.55 explanation, a mono
11 px diagnostic line and its action.

1. **Keyboard not connected / disconnected mid-session** (`--alert`). The `MODX-1` port is missing or
   another app has it exclusively. Audio is still coming in: you can look, not read the patch. →
   `DIAGRAM FROZEN · LAST POLL 4 s`, button `RETRY`.
2. **No audio coming in** (`--carrier`). **It is not silence: it is exact digital zeroes**, so there is
   no cable or no route. Almost always `Part Output = USB1&2`, which does not exist outside ASIO. →
   `REAL SILENCE ≠ A CABLE IN THE WRONG PLACE`, button `SEE THE INIT DISCIPLINE`.
3. **The write did not apply** (`--alert`). The MODX **fails silently**: writing with the wrong length
   gives no error and changes nothing. Every write is verified by reading back; here 1 of 3 did not come
   back. → `49 20 09 · UNCONFIRMED`, button `REPAIR AND VERIFY`.
4. **I am about to overwrite your patch** (`--modulator`). The step writes 11 parameters into the edit
   buffer the user has half-finished; a `0E 25 00` dump is saved first (byte-for-byte restoration). →
   two buttons: `SAVE AND CONTINUE` / `DON'T TOUCH IT`.

### 6. ALL EIGHT — the choreography of the patch (`3a`)

File: `design/Round3-screens.dc.html`, section `3a`. **The primary surface of BUILD mode.**

**Purpose.** An operator has 43 parameters; the main screen shows five and the full editor shows one.
This screen shows **five facts about all eight at once**, and above all the **comparison**: who attacks
first, who decays fast, who is loudest.

**Layout.** A 58 px bar with a segmented switch (AEG · LEVEL / PEG · FORM/FREQ / SPECTRUM PER OP); below,
a curve panel (`flex: 1`, ~330 px) and a row of groups of `flex: 0 0 296px`.

- **Eight AEGs on one pair of axes.** SVG `viewBox="0 0 1240 340"`, `preserveAspectRatio="none"`, X axis
  = 0→2 000 ms, dashed amber key-off vertical at 1 400 ms. The focused operator at
  `--curve-focus-stroke` (3.4 px) with a glow and **draggable `--grip-curve` points** with a dashed
  `--grip-halo`; the other seven at `--curve-ghost-stroke` (1.4 px) and `--curve-ghost-alpha` (.5),
  **in their role's colour**. Operators at 0 are a dashed `--inert` line along zero: present, not
  deleted.
- **The name is written on the curve, on its plateau** (`OP1 99`, `OP4 99`, `OP8 55`…), in the role's
  colour. No legend to match and no tooltip — with a finger there is no "above".
- **Grouped by the role the algorithm gives them**, not by number: `CARRIERS · YOU HEAR THESE` (amber
  frame), `MODULATORS · THEY COLOUR IT` (cyan frame), `AT ZERO · SILENT` (dashed frame), each with its
  count.
- **Operator card** of `--op-strip-w` (128 px): label + role, ratio in mono 20 px, a **luminous
  draggable Level column** of `--op-level-col-w` (30 px, fill height = Level, with a 2 px mark and a glow
  on the value), the Level figure at 26 px, the **spectral form drawn** in a 76×34 SVG, its name, **and
  its own miniature AEG** — this card has the room the main-screen node does not.
- **This is also where following leaves a trace** rather than moving focus — see `7b`.

**The trap to avoid was the spreadsheet**, and it is avoided like this: **no cell holds a bare number**.
Every value comes with its shape — column height, position on a curve, or the drawing of a spectrum. If
a grid of cells appears when implementing it, it has been done wrong.

**Editable from here**: dragging the Level column changes it; touching the card brings focus to its
curve. The rest of the 43 live in the operator editor — this screen **is not its replacement**.

### 7. The Part — what sits between the FM and your ears (`3b`)

Section `3b`. **Its main job is to warn, not to mix.**

The project rests on comparing the measured spectrum against Bessel. A filter with resonance moves
amplitudes without anyone asking, and then the prediction does not match and you do not know whether the
analysis is wrong. This screen says so with light and shape.

- **The chain as a horizontal tape** (`flex: 0 0 118px`): FM-X OPERATORS → FILTER → INSERT A/B → EQ →
  SENDS → MAIN L/R, with arrows between stages. A **transparent stage is drawn straight** (a horizontal
  line) with a dashed `--inert` outline and the word `TRANSPARENT`; one that **intervenes is drawn with
  its shape** (the filter curve in miniature) in `--chain-dirty` with a glow and the word `INTERVENES`.
  The shape says the state before the colour does.
- **Chain stamp in the bar**: `CLEAN CHAIN` (filter at Thru, sends at 0, inserts out, EQ flat) or
  `DIRTY CHAIN · THIS IS NOT PURE FM` in `--alert` with a glow, and a `CLEAN THE CHAIN` button beside
  it. **The stamp travels to the main screen as a small chip** and **the theory-versus-measurement panel
  reads it**: with a dirty chain the mean error is 1.8 dB and is attributed to the filter; clean, the
  same capture gives 0.4 dB.
- **The filter is edited by drawing its response.** A 620×210 SVG with the `LPF12+HPF12` curve, **cutoff
  and resonance as draggable `--grip-curve` points** with halos, and the **Thru line as a flat dashed
  phosphor reference** ("flat = Thru = pure FM"). The types are **drawn chips** of `--hit-chip` (36 px),
  not a dropdown of 19. Addresses and path in the header: `48 00 0B / 0C(2) / 0F` ·
  `[Pitch/Filter] → [Filter Type]`.
- **Watch the units**: Cutoff is **0-255 in two bytes**, not hertz, and Resonance is 0-127. The curve's
  axis *is* frequency (it is a response), but **the control's figure is the parameter**:
  `CUTOFF 178 · RES 42 / 127`.
- **FEG** (`48 00 17–2C`): an envelope with draggable points and key-off. Its level is **bipolar in
  cents, ±9 600** — labelled `+52 · +3 931 ¢`, which is what it actually does to the spectrum. With the
  FEG active the spectrum changes over time for reasons that are not FM: the waterfall will see it and
  Bessel will not explain it.
- **2nd LFO** (`48 00 47–4E`): the wave drawn, and `AMP MOD 18` flagged in alert because it makes the
  amplitude breathe — a capture on a held note comes out differently depending on when you trigger it.
- **Note and velocity limits** (`31 00 1C–1F`): the note **on a drawn keyboard** with the active range
  lit and its two marks in phosphor; velocity as a **wedge** with its two dashed limits. Not four numeric
  fields.

**Not present**: Arpeggio, Motion Seq, Part LFO, Control Assign, Receive SW — they do not affect what is
measured. EQ and inserts appear **only as state**, because the only thing that matters about them is
whether they are in the way.

### 8. Copies and the diff between two (`3c`)

Section `3c`. The snapshots the "I am about to overwrite your patch" warning promises, given a home.
**The diff between two is the most valuable screen in the project**, and it is designed as what it is:
the script for a lesson.

**Layout.** Grid `392px 1fr` with a 2 px gap over `rgba(255,255,255,.07)`.

- **Left column, the list.** Each snapshot carries **provenance** (`BEFORE THE APP TOUCHED ANYTHING`,
  `INIT`, `STEP n · LESSON m`, `BY HAND`), age, and **its form**: a bulk dump or a parameter set —
  because they do not restore alike. The two chosen for the diff are marked `A · FROM` in amber and
  `B · TO` in cyan, with a 2 px border and a glow.
- **Copies carry Performance provenance** (round 6): one from another sound is **not disabled** — its
  button changes text and says what it would overwrite.
- **Restoring is one touch, no dialog**: a single message and 20 ms. But **one touch, not two**, and
  what you were using is saved first — nothing destructive goes through a double tap.
- **Right column, the diff.** Header `Init FM-X → The bell I like` and "14 parameters change, grouped
  into five things to understand". Each group is a card with a **step number** (34 px circle), a
  **sentence in human language** ("OP3 · the modulator that gives the bell") and **drawn evidence**:
  delta bars with the old value in `--ink-inert` and the new one in `--signal-primary`, the **envelope
  before and after superimposed** (the old one dashed in grey, the new one in phosphor with a glow), and
  the spectrum of the new form.
- **The 402 identical parameters are not listed** — only what changes is information. And the group that
  **is not FM** (the filter that crept in, the Amp Mod) is marked in dashed `--alert` with an
  `EXCLUDE FROM THE LESSON` button: it is session noise, not part of the sound.
- A `TURN INTO A 5-STEP LESSON` button in the header closes the loop. Steps are reordered by dragging.

**It is not a `git diff`**: no columns, no ± per line, no monospace by default in the prose.

### 9. The tutor index (`3d`)

Section `3d`. The level that was missing above the steps: "step 3 of 5 of lesson 2 of 9".

- **Nine lessons as a path with a spine**, not a grid of cards: a column of 34 px circles joined by a
  2 px vertical line running from phosphor (done) to `rgba(255,255,255,.09)` (pending).
- **The lesson in progress is open** (`flex: 1`) with its **five steps visible** as cards, the current
  one filled in phosphor, and two buttons: `RESUME AT STEP 3` and `← BACK TO STEP 2`. Going back restores
  a known state, **with no penalty**. The other lessons are closed with their count (`0 / 4`).
- **A nine-segment progress bar** in the header, with the current one half filled.
- **This is where the warm sub-register lives**: titles and prose in `--font-lesson` (Georgia) over
  `--lesson-surface`, with `--lesson-ink` / `--lesson-ink-dim` and `--lesson-accent`. **But measured
  figures stay in mono and phosphor** (`YOUR KEYBOARD 1.4103` against `TARGET 1.41` in vermilion, with a
  `MATCHES` badge). Serif for what is read, mono for what is measured — inside a lesson too.
- The right column explains **where the unwritten lessons come from**: from subtracting two copies, with
  a link to `3c`. And it repeats the precondition verified at startup: `Receive Bulk` is not in Protect
  (`[UTILITY]` → `[Settings]` → `[Advanced]`).

### 10. The main screen when there is no capture on it

_(Retired by #54 and #58; the live rule is ADR-0007's.)_ Not a separate screen: **the main screen is
two compositions of the same elements, and the two ranuras decide which one you get.** The glass
column holds two ranuras, each of which holds one of the four live views or nothing; the composition
is wide when both are empty or when the pin is down, and narrow otherwise (`composition.ts`).
Whether a capture exists plays no part: a capture landing moves nothing, and there is a test that
says so.

- The column has **three shapes** (`column-geometry.ts`): `ranuras` — the narrow composition, the
  diagram at 700 px as the 3 × 3 grid; `rail` — both ranuras empty, the column collapsed to a 52 px
  handle and the diagram at 1 016 px; `gone` — the pin down, no column at all and the diagram at
  1 070 px of the 1 280. `wide()` is `shape() !== 'ranuras'`, never "no capture".
- **`KEEP IT BIG` is a pin, not a mode.** It forces the wide composition without touching the stored
  pair, and letting it up restores the pair exactly. It persists, as does the pair.
- The column's move runs over `--dur-settle` (420 ms), and it is always a press — on a ranura's
  chooser, a rail handle or the pin — that causes it. Nothing on this screen moves that the pianist
  did not move.
- The factory pair is `SCOPE` and empty, so the app opens **narrow**; the wide composition is the
  one you ask for. The grid is described by ADR-0007.
- Sized by the worst case eight operators can produce, now measured: `CONCERNS.md` §31, resolved,
  and `DESIGN.md` §10 for the maxima.
- In the big composition, **role reads from position**: carriers touch the output bus, every arrow points
  down, operators at zero are parked to the right on a dashed stub.

`8f` drew the retired rule. Written up in `DESIGN.md` §10. `CONCERNS.md` §30 is the risk the retired
rule carried, marked retired there.

### 11. The player (`4c`) — a cross-cutting piece

File: `design/Round4-pieces.dc.html`, section `4c`. **Implement once**: A/B, the audio check and any
parameter sweep all use it.

What it does: **note-on → hold → capture → note-off**. It does not play a file: **it performs a gesture
on a physical instrument that is sounding in the room.**

**Seven states**, drawn in a row with their transitions:

| state | shape | what is true |
|---|---|---|
| 1 · rest | hollow triangle in `--inert` | nobody is playing; the keyboard belongs to its owner |
| 2 · armed | `--carrier` triangle with a glow | the parameter is written **and verified by reading back**; nothing sounds yet |
| 3 · holding | pause in `--modulator`, the card **beats** (`holdGlow` 1.6 s) | there is a live note put there by the app |
| 4 · capturing | filled `--carrier` shutter | FFT 65536 over the held note |
| 5 · releasing | release curve with a key-off mark | note-off sent, **the AEG tail is still sounding** (~460 ms) |
| 6 · looping | circular `--modulator` arrow | back to 2 with the other value; `--play-hold` / `--play-gap` |
| 7 · failed | **octagon** in `--alert` | the write did not come back on the read. **The note is released first, the warning second** |

State 5 exists for a design reason, not an engineering one: **the waterfall is watching that tail**, so
releasing is not the same as being at rest.

**What gets played, without a form**: the note is chosen by **touching a drawn keyboard** (340×52, the
active key lit in `--modulator` with its two marks) and velocity by **dragging a wedge** (1→127, a 2.6 px
mark and the value in a pill above, never under the finger). The spikes' reference: C4 held, velocity
100.

**Who is playing** — the non-obvious part. `Local Control` stays `on`: the keyboard sounds on its own
while the app writes to it, and the owner may be playing at the same time. Three states with their own
colour:

- `THE APP IS PLAYING · C4` in `--who-app` (cyan) — and this chip **lives in the header**, not here.
- `YOU ARE PLAYING · 3 NOTES` in `--who-hands` (phosphor, like every incoming signal). **Counted by
  pitch, not by message**: a key on four channels in 28 ms is one note.
- **`A NOTE OF MINE IS STILL SOUNDING`** in `--alert` with a dashed outline — the only state that
  **lights HUSH on its own**.

**`LIVE` ≠ `CAPTURE` still holds**: the player feeds both, but while it holds the note the live view runs
at 30 fps and the capture is the shutter of step 4 — deliberate, and stamped.

**And the cost is shown rather than hidden**: rereading the watch set costs **~0.9 s in silence and
~5.5 s with notes** (measured, phase 0c). So the diagram's poll badge **drops from `--probe-idle` to
`--probe-playing`** while the player holds, and it is said. No animation faking fluency.

### 12. HUSH (`4d`) — a cross-cutting piece

Section `4d`. **It is not a player control**: it is the button for when everything else has failed. The
stuck notes in phase 0c were not left by anyone playing — they were left by a bug in the code that
generated them, so a button depending on the player would have been as broken as it was.

**Non-negotiable specification:**

- `--hit-panic` (56×56) at **the far right of the header of EVERY screen**, including those that play no
  notes.
- `--shape-panic` — an octagon by `clip-path`. It is the **only octagonal shape in the app**; everything
  else is a pill, a circle or a rectangle. The shape identifies it without reading.
- **Isolation instead of confirmation**: a 2 px rule + `--gap-isolate` (16 px, twice the normal
  `--hit-gap`) to its left, nothing actionable inside that strip, and it is the last element before the
  window edge.
- **Three states**: hollow over `--panic-idle-bg` at rest; **filled with a glow** over `--panic-live-bg`
  when a note is live; and `DONE` in `--signal-primary` for `--panic-ack` (1.5 s) after pressing it.
- **No confirmation.** An "are you sure?" turns an emergency into two steps.
- **It acts on finger-up inside** (`pointerup` within the target). Touch it by accident and drag off
  before releasing and nothing happens. The one concession, and it costs no time: the natural gesture is
  touch and lift.
- **What it does**: `All Sound Off` + `All Notes Off` + 2 048 explicit `Note Off` (measured, phase 0c).
  And **not one parameter**: it does not lose the patch, does not cancel a saved capture, does not close
  the port, does not change mode.
- **What it says afterwards**: "3 notes silenced · your patch is intact". Nothing to undo, and the
  acknowledgement **clears itself** — it does not ask for a second touch to close.
- **It survives the error state**: the header is the last thing replaced, and the four unhappy-state
  cards are drawn **below** it, never over it. If the keyboard disconnects, the button is still there and
  still sends the messages in case the port comes back.
- **The word is `HUSH`, not `PANIC`**: *panic* names the user's emotion, and every other failure state in
  this app names what happens.

### 13. Connection and startup check (`4e`) — two faces

Section `4e`. It is where `RETRY` on the "keyboard not connected" state leads.

**Face 1 — the sequence.** Runs at startup and when something breaks. Grid `1fr 452px`. Six checks
**ordered from most to least serious**; the ones that pass collapse to a ~62 px line with their measured
figure, and **the one that fails stays at the end and large** (`flex: 1`), with the full menu path
inside:

| test | real datum on screen |
|---|---|
| MIDI port | `MODX-1` open · Device Number `all` |
| Responds and accepts writes | median **2.0 ms** · worst case 22.6 · timeout 100 |
| Poll reliability | **0 lost of 24 320** |
| Audio really coming in | `Line (MODX)` 2 ch · 44 100 · peak −18 dBFS · floor −66 |
| Clean chain | 4 of 4 · `48 00 0B = 15` (Thru) |
| `Receive Bulk` | **fails** — probed, because it cannot be read over SysEx |

The failure card carries the literal path in mono on a warm background:
`[UTILITY]` → `[Settings]` → `[Advanced]` → `Receive Bulk` = `On`. And the diagnostic reasoning, because
it is what stops you searching blind: **parameter writes do not go through Receive Bulk**, so "writing
works and restoring does not" isolates the culprit unambiguously.

**This face is also the anchor's home for debug provenance** — poll rate and `31 00 00`, plus
`TEMPO 90 BPM · background 40 msg/s`, which are properties of the loaded sound. Touching the anchor opens
this screen.

**Face 2 — rest.** It is **a chip in the header**, the one that already existed, and touching it opens
this screen. **There is no permanent status panel**: six green lights taking up space inform nobody. When
something fails, the chip **says the consequence, not the fault** — `I CAN'T GIVE YOU YOUR PATCH BACK`,
not `Receive Bulk in Protect`.

**Order of seriousness, which is a design criterion and not decoration:**

- **No MIDI port** — the app does nothing. The only one that blocks.
- **No audio** — it half works: the diagram serves, the four signal views do not.
- **`Receive Bulk` in Protect** — everything works **except giving you your patch back**, which is
  exactly what the app promised before touching it. **The worst**, because it is not noticed until you
  want to go back.
- **Dirty chain** — not a failure, a warning: you are not measuring pure FM.

**No failure says "error".** They all say what to do, and the ones fixed on the keyboard bring the whole
menu path. The header does not say "5 of 6 OK" either: a counter is a datum, a consequence is
information.

**What is chosen here**: MIDI port and audio device, as **44 px chips**, not dropdowns — they are two or
three options, not a list.

### 14. A/B mode (`4b`)

File: `design/Main-screen.dc.html`, section `4b`. **A mode of the main screen, not a separate screen.**

It reuses the `4a` frame and changes only three things: the signal panels become a comparison, the
figures column becomes deltas, and the bottom strip hosts the looping player + the two waterfalls.

- **Parameter selector** (`flex: 0 0 auto`, `--signal-primary` frame): the parameter's name, and a
  **track with two draggable ends** — A on the left with its value dimmed, B on the right luminous, and
  the band between them filled. Its SysEx address beside it (`49 20 1A`). Plus a
  `SWEEP 0→99 IN 8 STEPS` button for the more-than-two-values case.
- **Spectrum A over B, superimposed**: A in 7 px bars at `--ab-a-ink` with `--ab-a-alpha`; B in 3 px bars
  at `--ab-b-ink` with a glow. **Same frequencies, radically different amplitude distribution** — which
  is literally what phase 0 measured.
- **Harmonics A against B**: pairs of `--ab-bar-w` bars per harmonic (A hollow and dimmed, B solid and
  luminous) **and the two predicted curves**, `|J_n(0.62)|` and `|J_n(2.81)|`, both dashed in
  `--theory` — B's more pronounced. Dashed **still means predicted**; A and B are told apart by fill, not
  by colour.
- **The difference is labelled, not deduced**: pills reading "the fundamental LOSES 14 dB" and "the 9th
  GAINS 31 dB" anchored to the peaks involved.
- **The column says what does NOT change** — fc 261.763, fm 369.175, ratio 1.4103, C4 vel 100, identical
  in A and B — because that is what makes the comparison valid. And the deltas: I from 0.62 to 2.81, peak
  from "fundamental" to "9th harmonic", partials from 3 to 11.
- **Both are captures**, each with its `MEASURED · 65536` badge and its age. Never a measurement against
  an estimate.
- `FREEZE AND KEEP · as a lesson step`: a good A/B **is** a lesson step.
- **Bottom strip**: the looping player (`A · 20` off / `B · 90 · HOLDING` lit, pass 7, hold 1.4 s, pause
  0.4 s) and the **two waterfalls facing each other** — A's nearly flat, B's with the bright attack. The
  lesson is visible there without reading a figure.

### 15. The operator editor (`5a`)

File: `design/Round5-screens.dc.html`, section `5a`. It opens by touching an operator from `3a`, from the
diagram in `4a`, or **by the node's corner**. **This is the screen you live in in BUILD mode.**

**Layout.** 58 px header · body `grid-template-columns: 296px 1fr 316px` · bottom strip of
`--editor-once-h` (172 px).

- **Header**: `← ALL EIGHT`, the name (`OP3`) with its role chip, and the **rail of the eight
  operators** — eight `--op-rail-hit` (32 px) targets carrying their role's shape (pill = carrier, live
  corner = modulator, dashed = at zero), the current one lit. Then LIVE, CAPTURE and HUSH.
- **Column 1 — context and Level.** At the top, `WHERE YOU ARE`: a 186 px mini-diagram with **only your
  branch** (OP5 → OP3 → OP1) and the real algorithm's arrows; at the sides, at 9 px, `OP5 modulates you`
  / `you modulate OP1`, and below, `and OP1 goes out`. Under it, the **Level knob** of `--knob-level`
  (190 px) with the figure at 40 px **in the centre** and the arc in the role's colour.
- **Column 2 — the two envelopes, full width.** AEG on top (`flex: 1.15`, `--modulator` frame, labelled
  "in a modulator, this *is* the timbre's envelope") and PEG below (`flex: 1`, neutral, bipolar with its
  centre-50 line). `--grip-curve` points with halos, key-off in dashed `--carrier`, times as labels under
  the curve.
- **Column 3 — form and frequency.** The seven **Spectral Forms drawn** in a 4-column `grid` (plus a cell
  saying "you pick the drawing"); **Skirt as eight skirt widths** (`--skirt-steps`), **disabled because
  the form is Odd 1** — present, not absent, and **not dimmed with container opacity**; and the
  **Freq Mode** block with its two drawings, Coarse/Fine and the measured ratio.
- **Bottom strip — `SET ONCE, THEN FORGET`**, with the label saying so: **Level Scaling over a drawn
  keyboard** (draggable break point, labelled curves), the **bipolar Detune** with its visible centre,
  and four chips for Time/Key, Lvl/Vel, Pitch/Vel and Key On Reset.

**The four rules this screen has to respect:**

1. **Hierarchy in the composition, not in tabs.** The daily stuff takes 78 % of the height; the
   set-once stuff lives at the bottom, small **and touchable**. Nothing hidden.
2. **The finger covers what it drags.** The active point's value goes in a pill **above and to the side**
   (`ATK · level 99 · time 18`), never under the point; the knob's goes in its centre.
3. **Context is never lost**: your branch always visible + the rail of the eight.
4. **Zero forms.** There is not one `label: field` list on the whole screen. If one appears, it has been
   done wrong.

**The Freq Mode warning** is didactic, not an error: with Fixed, Coarse and Fine **do not change value,
they change meaning** — from multiplier to hertz — and the keyboard will also **move the Coarse**.
Measured in phase 0c. A dashed box in `--carrier`, not in `--alert`.

### 16. The sweep (`5b`)

Section `5b`. The result of `SWEEP 0→99 IN 8 STEPS` in `4b`.

- **The axis is the trajectory per harmonic**, not the spectrum per step: eight polylines (n0…n7) over
  `viewBox="0 0 900 340"`, x = Level 0→99 (the eight steps), y = amplitude with **zero at mid height** so
  the curves can cross it. n0 in white at `--traj-stroke`; the rest in the phosphor scale, thinning.
- **Prediction is overlaid on the same curve**, in `--theory` with `--dash-theory`, one per harmonic.
  Because those trajectories **are** the Bessel functions: you are not comparing two charts, you are
  comparing one line with another on top of it.
- **The moment that teaches**: around Level 77 the n0 trace **crosses zero** — the first zero of J₀ at
  `--bessel-zero` (I ≈ 2.405). It is boxed in `--alert` and explained in one sentence: *this is not a
  measurement failure, it is the lesson*.
- **A draggable vertical line** (in `--carrier`) marks the shown step and **pulls its spectrum** into the
  right-hand panel, with its `|J_n|` on top. You go from the map down to the detail only when needed.
- **The "running" state** takes a 64 px strip: eight cards, the done ones in phosphor, **the running one
  widened (`flex: 1.6`) and beating** (`stepGlow`) with its internal progress bar, and beside it the
  sub-phases with their real times (write ✓ · verify ✓ · hold 1.4 s · capture 1.5 s · release 0.46 s ·
  pause 0.4 s). The header says `STEP 6 OF 8 · CAPTURING` and `~8 s LEFT`.
- **If cancelled halfway**: the captured steps **stay** and the map is drawn with them marked as
  incomplete, it can be resumed from the next one, **and Level goes back where it was** — the sweep saves
  a copy before the first step.
- **Duration**: `--sweep-step-s` (~3.1 s) × `--sweep-steps` ≈ **25 s** with one capture per step. See
  `CONCERNS.md` §15: averaging several captures near the zeros pushes it to minutes, and the progress
  design holds both scales without changing.
- **Confidence grades** (`6e`) belong to this screen: the map is drawn complete, with doubtful points as
  **a hollow circle with a dashed halo** in prediction amber, and a refined point shows `×3 AVERAGED`
  **with its spread** (`−43.8 ±0.6`).

### 17. The SysEx console and the bench drawer (`5c`)

Section `5c`. **A drawer, not a screen**: it opens from a chip in the header and unfolds over the bottom
strip **without replacing the screen behind it** — you have to see the verification while it happens, or
you cannot see the cause (the knob you just turned).

- **A `--drawer-grab` (52 px) handle**, `--drawer-lift` shadow upward and a top border in
  `--signal-primary` at 28 %.
- **By default it is not a log.** It opens on the `UNCONFIRMED · 2` tab: one card per unconfirmed write,
  with **the human sentence** ("OP3 · Level = 90 did not come back on the read"), **the bytes sent**,
  **what the keyboard returned** and its 44 px `REPAIR AND VERIFY` button. The wrong-length no-op case has
  its own card ("the parameter is 1 byte, not 2").
- **`ALL TRAFFIC · 1 216`** is the second tab. Never the first thing.
- **Three stable figures**: median 2.0 ms, p99 3.3 ms, lost 0. **No live counters, no latency graphs, no
  dump scrolling by itself** — nothing moving in competition with the signal.
- **It records each repair with who overwrote whom**: "48 00 48 · 2nd LFO Speed · 00 → 1E — writing
  48 00 52 had zeroed it". It is `CONCERNS.md` §18 made visible, and the place where any missing pairs
  would appear.
- **The header chip only calls when there is something**: `SysEx` neutral when nothing is pending,
  `SysEx · 2 UNCONFIRMED` in `--alert` with a 2 px border when there is.
- **The didactic bonus**: the eleven bytes **in labelled `--byte-box` boxes** — `F0` start · `43` Yamaha ·
  `10` write · `7F` to all · `1C 07` MODX · `49` operator · `20` op3·part1 · `1A` Level · `5A` = 90 · `F7`
  end — with the value byte highlighted in phosphor, right beside "OP3 · Level = 90". It is the app's only
  lesson in **how it talks** to the keyboard.
- **What it is NOT**: the home of `Receive Bulk`. That is a failure with a consequence and lives in `4e`.
  Here only what is repaired with one touch.

**The bench drawer** (`8g`) generalises this affordance. The bridge, startup, audio and port readouts
(#16, #5) and the sweep readout (#8) are declared temporary and are the largest blocks of text in the app
today — **five of them in the running build**. Same handle, same lift, same rule about opening over the
bottom strip. **One chip per instrument, wearing its ticket number**: a panel labelled `#5` is visibly on
its way out, so nobody designs around it, and closing the ticket has an obvious consequence — the chip
disappears and the drawer gets one item shorter. **The console is the one chip with no ticket**, because
it is permanent. Alert behaviour belongs to the console alone: a bridge log with 0 drops has nothing to
say and stays quiet. When the last ticket closes, the handle goes with it and no layout is rethought — it
was always 52 px on the outside.

**The numbers on `8g`'s chips are illustrative.** What a chip wears is the number of the ticket that
actually retires it, and each has a **retirement condition** rather than a phase-1 default: SWEEP
(#43) when the operator/part addressing rule is confirmed off Part 1 and written into `CONTEXT.md`;
BRIDGE (#44) when the capture path is trusted end to end; STARTUP (#45) when the copies screen lands;
AUDIO (#46) when the check screen lands; PORT (#47) when the check screen lands **and** no pending
measurement needs the polling switch or the note generator. Full table in `DESIGN.md` §16.1. The
chips are **tabs** — one instrument on screen at a time — and nothing inside is rendered while the
drawer is shut.

### 18. Round 6 — the patch changes underneath

File: `design/Round6-screens.dc.html`. Five pieces, and **the big work of that round**.

The starting point is a zero measured twice (phases 0d and 0e): **loading another Performance emits not
one byte** — no Program Change, no Bank Select, no SysEx, with `Bank Select` and `Pgm Change` `ON`, in raw
mode, and with the Part name verified before and after the window. So the app **has no event** telling it
the sound was changed underneath, and it polls the Part 1 name (`31 00 00`–`13`, 20 ASCII addresses,
~40 ms) at **1 Hz** as an anchor.

**`6a` · The anchor.** The Performance name **is not new furniture**: it was already in the header. What
changed is that it is now the thing everything else is judged against, at a deliberately low weight —
17 px of ink. **In rest it is the name and nothing else**: the poll rate and `31 00 00` are debug
provenance and live in the check screen (`4e`), which the anchor already opens on touch. Three states:
rest; **just changed** (the new name with the old struck through beside it, the 2 200 ms flash the tutor's
writes already use, and everything polled put on hold); and **reread**, which **does not return to rest**
— it stays at `NOT MEASURED IN THIS SOUND`.

**Known properties of the anchor**, all three together so there are no surprises in phase 1: it costs
**~40 ms every second** (20 ASCII addresses at 1 Hz); it detects the change **in under a second**; and it
has **a ~1.5 s blind spot per capture** — the name poll **cannot run inside the 65 536-sample window**
(1.486 s) without putting traffic into the capture, so if the sound changes exactly there the app finds
out **when the capture ends**, not during. The design survives it without an extra screen: as soon as the
anchor comes back the capture is marked as belonging to another sound, which is the correct behaviour. It
is the only real hole and it is here deliberately — a documented hole is a decision. `CONCERNS.md` §23.1.

**`6b` · The moment of the change.** The rule that orders the screen: **the map dies** (polled) and **the
capture dies** (it belonged to another sound), but **the live view never dies**, because it is audio
arriving right now — scope and spectrum stay in phosphor with their `STILL TRUE · THIS IS AUDIO` chip;
what disappears from the spectrum is the Bessel curve, because there is no I until there is a capture. A
void value **keeps its shape and loses its figure** (neutral outline and a dash): nothing is dimmed with
opacity. A reread strip with the real count, and the cut drawn on the waterfall. **With nothing in
progress it blocks nothing**, there is no "reread" button, and numbers are not replaced without passing
through the dash.

**`6c` · The ugly case.** Four things end up **voided, not paused**, and the asymmetry governs all four
exits: **the app can write parameters but cannot load Performances**. Sweep: a cut vertical, **no
"resume"**, three exits. A/B: the premise broke, and repeating A costs ~3 s, so discarding is not offered
first. Lesson: the app states **the literal path for what only the user can do**. Copies: snapshots carry
Performance provenance and the button **is not disabled** — it changes text and says what it would
overwrite. It blocks **only what broke**, anchored to that thing, never a modal.

**`6d` · Read-only.** The console's third failure mode. `30 4B 00` (Super Knob) reads, transmits and will
not accept a write, so `REPAIR AND VERIFY` **does not appear**: retrying would never work. Its own state in
**dashed amber, not alert** (it is not broken, it just cannot be done), and **the app learns it**, because
the keyboard cannot be asked: reserved addresses answer a read exactly like real ones. Two tries and stop,
never an automatic third. **It remembers and re-probes once per session** (4 ms); the re-probe is silent
when it confirms and reported when the address turns out to accept — the app had learned something false
and corrected itself. Beside it, the reserved list from the paper (`48 0p 51–55`). And the vocabulary of
the observable control: **a knob with no grip mark**, chip `SENDS · WON'T TAKE`.

### 19. Round 7 — following: the app knows where your hands are

File: `design/Round7-pieces.dc.html`. **Two behaviour pieces, no new screen.**

The keyboard **notifies nothing about navigation** (phase 0d, raw): changing the focused operator, the page
or the Part emits not one byte. But the watch set the app already polls is **40 addresses — five parameters
across the eight operators**. If `49 60 1A` moves in one round, the app does not know you are looking at
OP7: it knows you **just touched something on OP7**. Following **costs not one extra request**.

**`7a` · The rail that follows you.** A `FOLLOW ME` switch with a drawing of what it does (a key, an arrow,
the rail's dot), in phosphor because following is reading an incoming signal; at rest it says nothing else.
The operator with activity is marked on the rail with a beating ring, and a band offers `GO TO OP7` /
`STAY HERE` (both 44 px). **Suggestion, not jump**, and the reason is not reversibility — the rail already
gives that — but that **a gesture cannot be interrupted**: a focus jump halfway through dragging an AEG
point breaks the curve mid-stroke. Three rules written on the piece itself: **it detects changes, not
visits** (so the sentence never says "you are on", it says "you just touched something on"); **its own
writes do not count as yours** (a change coinciding with a pending read-back is not the user's, and when
the tutor writes, focus **does not move**); and **one suggestion at a time, the last one**, clearing itself
after 6 s.

**`7b` · ALL EIGHT as a mirror.** In `3a` following moves nothing — all eight are already on screen — so it
**leaves a trace**: each card says what you touched, from what to what and how long ago
(`LEVEL 56 → 71 · 0.3 s AGO`), and in the Level column the old value stays as a **dashed mark**. It is not
a history: it is the last gesture; the others say `NOTHING FROM YOU`. Provenance uses the vocabulary that
already exists — **phosphor for what comes from outside** (your hands, like every measured signal),
**cyan for what the app wrote**. This is BUILD mode in its purest form: the user makes the sound by hand
and the app is the mirror.

**The two rings, and the consequence that gets said.** To know where the hands are you have to watch all
eight; to keep the open operator current, its 43 parameters. Two sets, two cadences, and **they share the
channel**, so **opening an operator slows following down**. Therefore **stale is four times the period of
its own ring** — written as a rule and not as two numbers, which is exactly why the corrected poll rate
changed the labels and nothing else. The cadence is labelled **once per zone in its header**
(`ALL EIGHT · 10 Hz`), and **there is no new badge** — a second stamp per figure is what was already
rejected for the tempo.

## Interactions & Behavior

**Touch as the base case, mouse as a superset.** One design for both pointers; there is **no** "touch mode"
and "desktop mode" to maintain separately. The left hand is on the MODX.

- **Touch targets**: minimum **44 px** (`--hit-min`) for anything actionable; **56 px** (`--hit-touch`) on
  controls used by touch often; minimum separation **8 px** (`--hit-gap`). On this panel (14" @ 150 %)
  44 CSS px ≈ 9 mm physical: **nothing needs inflating**.
- **Nothing depends on `:hover`** — not for discovery, not to show a value, not to reveal a control. The
  usual audio-app pattern ("move over the knob and the number appears") is **forbidden**: the value is
  **always visible** or appears **on touch**.
- **The finger covers what it drags.** On knobs, sliders and curve editors the value and the active point
  go **above and to the side** (`--value-offset: -34px`), never under the point. The drag point is drawn at
  22 px (`--grip-handle`) with a 44 px grab zone (`--grip-hit`).
- **No right-click as the only route** and **no hidden gestures**. If there is a context menu or a gesture,
  it is a shortcut for something that already has a touchable button.
- **No double tap for anything destructive.** Overwriting the patch always goes through the warning with a
  snapshot.
- **Hover exists, as refinement**: it highlights, previews or brings forward a breakdown that **also**
  opens on touch (`--hover-lift`). It is never the only carrier of a value, a control or a state.
- **Mouse extras, always an additional layer**: wheel ±1 on a knob, a modifier (Alt) for ×0.1 fine steps,
  double click to return to the default, keyboard shortcuts for `CAPTURE` and for switching views.
  **Removing the mouse removes no function.**

**A disabled control is not dimmed with container opacity.** It is drawn dashed in `--inert` at full
opacity, and its explanatory text stays readable. Container opacity multiplies over descendants and takes
the prose down with it. Fractional opacity is legitimate only on **signal strokes**, where there is no text
inside. *(A mode with no code behind it is a different case: it is absent from the switch, not disabled in
it.)*

**Gestures per control**

| control | finger | mouse adds |
|---|---|---|
| continuous knob | vertical drag, 160 px grab | wheel ±1, Alt ×0.1, double click = default |
| bipolar | tap jumps to that value, drag refines | wheel ±1, double click returns to 15 |
| envelope point | drag, value above the point | drag with a modifier for precision |
| Spectral Form | tap the cell | hover previews the spectrum |
| operator | tap to edit | hover highlights its route branch |
| the corner | tap opens the operator editor | — |
| CAPTURE | tap | keyboard shortcut |

**Animation.** Nothing animated competes with the signal — what really moves here is the signal. Only two
exist: the `LIVE` heartbeat (`--dur-heartbeat` 1400 ms) and the tutor-write flash (2200 ms). State
transitions ≤ 180 ms (`--dur-state`) with `--ease-instrument`; a new capture landing 420 ms
(`--dur-settle`), which is also the glass column's move when a ranura or the pin is pressed (§10) —
never a capture. **Forbidden**: a measured number that blinks on its own.

**Frame budget.** No UI operation may cost more than **33 ms** (`--frame-live`, 30 fps). If a panel does
not fit the budget, the panel is simplified.

## State Management

The prototypes are static, but direction A declares the states the implementation needs:

- `state: 'live' | 'no-audio' | 'disconnected' | 'dirty-patch'` — controls the top warning strip and which
  unhappy-state card applies.
- `markNonHarmonics: boolean` — whether non-harmonic partials are painted in `--alert`.
- `hasCapture: boolean` — **this is the one that decides the main screen's composition** (§10) and whether
  the measured column shows figures or its contract.

What the real app will have to hold, by zone:

- **Polled patch** (SysEx): algorithm, feedback, and per operator — role (carrier/modulator, derived from
  the topology), Level 0-99, Coarse, Fine, Detune, Freq Mode, Spectral Form, Skirt, Resonance, AEG, PEG,
  Level Scaling. With **a timestamp per read**: after a few seconds the datum becomes stale and is painted
  as such (broken outline + the seconds, no word).
- **Documented topology**: who feeds whom, read from Yamaha's FM-X table given the polled algorithm number.
  **Not polled and not measured** — its own provenance.
- **Live view** (30 fps): waveform buffer, FFT 4096, frame queue for the waterfall.
- **Capture** (explicit trigger): FFT 65536 over a held note → partials, fc, fm, measured ratio, fitted
  index I, list of non-harmonics, and the capture's age.
- **Prediction**: `|J_n(I)|` computed, mean error and worst partial against the capture.
- **Tutor**: current step, completed steps, the previous patch's snapshot (`0E 25 00`), and a write queue
  with its read-back verification.
- **Writing**: every write to the keyboard is *pending → read back → confirmed | failed*. An unconfirmed
  write **is painted in alert, not in green**.

## Design Tokens

Source of truth: **`design-tokens.css`** (semantic names, not literals). Its comments are English and
**no token name has ever changed** — with one dated exception: #93 (2026-09-11) reshaped the three
`--*-fill` gradients into `--*-fill-dense` / `--*-fill-faint` stop pairs, same values, because a
gradient token carries an axis and the axis is the composición's (ADR-0008 §2.6). The five values
round 9 had to leave marked stale were applied in
session 2, together with the two ceiling-datum tokens — see `CONCERNS.md` §29, resolved. **Nothing in
the file is stale and the two copies are identical in values.** Summary:

**Surfaces** — `--surface-base #06080a`, `--surface-panel #0a0f10`, `--surface-raised #0f1417`,
`--surface-sunken`. Rules: `--rule-min: 2px`, `--rule-color: oklch(1 0 0 / .09)`,
`--rule-color-strong: … / .16`; preferred alternative `--rule-by-space`.

**Ink** — `--ink-primary #d6e2dd`, `--ink-secondary #8fa39d`, `--ink-tertiary #6f817c`,
`--ink-inert #5d6d69`.

**FM roles** (the three accents share chroma and lightness, only the hue changes) —
`--signal-primary oklch(.87 .155 155)` ≈ `#7df0b0` (measured audio, phosphor);
`--carrier oklch(.80 .150 75)` ≈ `#f3b13f` (carrier: you hear it);
`--modulator oklch(.79 .140 235)` ≈ `#58c8f5` (modulator: it colours);
`--inert #3d4a48` (Level 0); `--alert oklch(.72 .160 35)` ≈ `#ff7a5c`; `--theory: var(--carrier)`
(**PREDICTED**). Plus the level fill's ink as stop pairs, `--carrier-fill-dense` / `-faint`,
`--modulator-fill-dense` / `-faint`, `--signal-fill-dense` / `-faint` — never a gradient, because a
gradient carries a direction and the direction is the composición's (ADR-0008 §2.6, #93).
**`DOCUMENTED` uses neutral ink** — paper has no colour — and needs no accent of its own.

**Typography** — `--font-ui: 'Helvetica Neue', Helvetica, Arial, sans-serif`;
`--font-num: ui-monospace, 'Cascadia Mono', Consolas, monospace` for **every measured figure** (tabular).
Scale: display 44 / title 26 / section 20 / body 15 / label 12 / **micro 10 (the floor for anything a
figure is read from; three labels sit at 8 px on purpose — the node's role word, the mode's roadmap
line and `HUSH`'s label)**; readout-xl 30, readout 22, node 25. Tracking: label .14em, eyebrow .24em; leading 1.55.

**Spacing** — base 4: 4 / 8 / 12 / 16 / 20 / 26 / 34 / 44.

**Touch** — `--hit-min 44px`, `--hit-touch 56px`, `--hit-gap 8px`, `--grip-handle 22px`, `--grip-hit 44px`,
`--grip-knob 160px`, `--track-bipolar 58px`, `--value-offset -34px`.

**Radii (meaningful)** — `--radius-carrier 26px` (fully curved = carrier) and `--radius-modulator 5px`
(live corner = modulator) are **semantic, not decorative**; plus `--radius-panel 16px`, `--radius-view
14px`, `--radius-pill 999px`.

**Elevation: light, not a black shadow** — `--glow-carrier`, `--glow-modulator`, `--glow-signal`,
`--glow-alert`, `--glow-trace` (a filter for traces), `--inset-panel`, `--hover-lift`.

**Signal strokes** — `--stroke-trace 2px`, `--stroke-partial 3px`, `--stroke-ridge 1.2px`,
`--stroke-theory 2px`; `--dash-theory: 5 4` (**PREDICTED is ALWAYS dashed**), `--dash-inactive: 4 5` (a
route from an operator at Level 0). In SVG, `vector-effect: non-scaling-stroke` so the stroke does not
fatten when the viewBox stretches.

**Motion** — `--ease-instrument cubic-bezier(.2,.8,.2,1)`, `--ease-mechanical cubic-bezier(.4,0,.2,1)`;
`--dur-instant 90ms`, `--dur-state 180ms`, `--dur-settle 420ms`, `--dur-heartbeat 1400ms`,
`--frame-live 33.3ms`.

**Diagram** — `--op-node-w 118px`, `--op-node-h 108px` (`--op-node-h-tall 116px` for nodes with a measured
ratio), `--op-col-gap 82px`, `--op-row-gap 28px`, `--op-bus-offset 30px`, and the ceiling datum's
`--datum-ceiling-stroke 2px` / `--datum-ceiling-color oklch(1 0 0 / .3)`. **The node's size is the
narrow composition's**: in the 1232 × 400 drawing it is the layout that sizes the node, from the room
the algorithm's own depth leaves — `DESIGN.md` §10.

**HUSH** — `--hit-panic 56px`, `--gap-isolate 16px`, `--shape-panic` (the only octagon),
`--panic-idle-bg` / `--panic-live-bg`, `--panic-ack 1500ms`.

**The player** — `--play-hold 1400ms`, `--play-gap 400ms`, `--probe-idle` / `--probe-playing` (poll rate in
Hz when silent and when holding; `--probe-idle` is **10**, the rate the build achieves),
`--who-app` (cyan: the app is playing) / `--who-hands` (phosphor: you are playing).

**A/B comparison** — `--ab-a-ink` + `--ab-a-alpha` (hollow and dimmed), `--ab-b-ink` (solid and luminous),
`--ab-bar-w 13px`. **A and B are told apart by fill, not by colour**: dashed stays reserved for prediction.

**ALL EIGHT / comparison** — `--op-strip-w 128px`, `--op-level-col-w 30px`, `--curve-focus-stroke 3.4px`,
`--curve-ghost-stroke 1.4px`, `--curve-ghost-alpha .5`.

**The drawer** — `--drawer-grab 52px`, `--drawer-lift`, `--byte-box 6px`. Round 8 generalises these into
the bench drawer; no new token was needed.

**Lesson register** — `--font-lesson` (Georgia), `--lesson-surface`, `--lesson-ink`, `--lesson-ink-dim`,
`--lesson-accent`. **Never on a measured figure.**

## Assets

**None.** There are no images, no library icons, no fonts to download:

- **System** typefaces (Helvetica Neue / Helvetica / Arial, Georgia in direction C, and the system mono).
  No webfonts, no CDN.
- All graphics are **inline SVG of primitive shapes** (circle, rectangle, line, arc, polyline) or CSS
  (gradients, `repeating-linear-gradient` for C's hatching). No hand-drawn iconography beyond that.
- No emoji.

Where a real image is needed in future, a marked gap goes in — not an invented icon.

## Files

In `design/`:

| file | what it is |
|---|---|
| `Index.dc.html` | the index, with links to every screen — **start here** |
| `Main-screen.dc.html` | **the main screen** (`4a`) and **A/B mode** (`4b`) |
| `Round3-screens.dc.html` | **five screens** on a pannable canvas: `3a` ALL EIGHT · `3b` the Part · `3c` copies and their diff · `3d` the tutor index · `3e` the rebalanced main screen, promoted to `4a` |
| `Round4-pieces.dc.html` | `4c` the player and its seven states · `4d` HUSH · `4e` connection and startup check |
| `Round5-screens.dc.html` | `5a` the full-screen operator editor · `5b` the sweep result · `5c` the SysEx console |
| `Round6-screens.dc.html` | **round 6** — `6a` the anchor in the header · `6b` the moment the Performance changes · `6c` the four voided things · `6d` read-only · `6e` confidence grades |
| `Round7-pieces.dc.html` | **round 7** — `7a` the rail that follows you · `7b` ALL EIGHT as a mirror. Two behaviour pieces, no new screen |
| `Round8-pieces.dc.html` | **round 8** — `8a` the header and the naming pass · `8b` the stamps · `8c` the operator node · `8d` the unmeasured column · `8e` the scope contract · `8f` the algorithm surface · `8g` the bench drawer · `8h` checked against the running build |
| `Round10-operator-diagram.dc.html` | **round 10** — `10a` what is on screen today, at 1:1 · `10b` question 1 — what form the ceiling reference takes · `10c` question 2 — the width stays, and the route's room comes out of the height · `10d` question 3 — fold the facts, never the positions · `10e` the two defects, as constraints on the gap and the gutter · `10f` three conditions on the rotation. Needs `support.js` beside it |
| `System-sheet.dc.html` | system sheet: components, operator editor, theory vs measurement, tutor, unhappy states, finger/mouse interaction |
| `support.js` | prototype runtime — **do not port** |

**Archived, not implemented**: directions B · Nébula and C · Plotter, and the first main screen
(`Direccion-A-Bancada.dc.html`), replaced by `4a`. They ship in the folder only so the index's links
resolve, and they **keep their Spanish filenames** deliberately — they are dated artefacts nobody
builds from. From C, its **warm register** survives as the lesson sub-register (`--font-lesson` and
`--lesson-*`).

In `screenshots/` (reference captures, in case you would rather not open the HTML): one PNG per screen at
2× (`4a-principal.png`, `4b-modo-ab.png`, `4c-reproductor.png`, `4d-panico.png`, `4e-arranque.png`,
`5a-editor-operador.png`, `5b-barrido.png`, `5c-consola-sysex.png`, `6a-ancla.png`, `6b-cambio.png`,
`6c-invalidado.png`, `6d-solo-lectura.png`, `6e-confianza.png`, `7a-rail-que-te-sigue.png`,
`7b-espejo.png`, `R3a-los-ocho.png`, `R3b-la-part.png`, `R3c-copias-y-resta.png`, `R3d-indice-tutor.png`,
`R3e-principal-rebalanceada.png`) plus `Sistema-A-componentes.png` (the full system sheet at 1×).

**The screenshot filenames stay in Spanish**: they are dated artefacts of the rounds that produced them,
nothing links to them by name, and renaming binary files buys nothing an implementer can use. The screen
ids in them are the stable reference.

Two of them are not mockups:

| file | what it is |
|---|---|
| `RUNNING-app-scope.jpg` | **the running app** — SCOPE tab, showing `2 CICLOS · 43.8 Hz` over a flat line |
| `RUNNING-app-waterfall.jpg` | **the running app** — WATERFALL tab, with the hardcoded caption sitting on live data |

They are **captures of the real build** (Tauri + Angular against the MODX8) and are the evidence behind
round 8 and `CONCERNS.md` §35. **The captures predate the round-8 changes**, so they still show the
Spanish copy — that is the point of them.

The captures are **visual reference, not the specification**: the exact values are in `design-tokens.css`
and in this README. To inspect measurements, open the HTML.

In `sources/` are the data sources, unmodified: `modx.md` (master document), `datalist_fmx_tables.md`
(Yamaha's official tables: offsets, ranges, enums and defaults), `rm_pantallas_fmx.md` (which MODX screen
corresponds to each address), `fase0c_RESULTS_mapa.md` (SysEx measured against the real keyboard),
`fase0_RESULTS.md` (the audio spike: device, format, working levels, noise floor and the origin of the
2756 Hz artefact), `spm_conceptos_fmx.md` (Yamaha's definitions: the filter analogy and the seven spectral
forms), `fase0d_RESULTS_notificaciones.md` (what the keyboard notifies and what it does not — keys yes,
navigation no, the Performance change **no**; the map verified outside Op3, 12 of 12; Feedback at
`48 0p 50`; and the watch set's real cadence) and `fase0e_RESULTS_falsacion.md` (the falsification of that
zero in raw mode, the first read-only address, and the discovery that the MODX's Parameter Change
transmitter exists and works but Yamaha only wired it to the Super Knob).

**When the paper and the measurement disagree, the measurement wins. When the spikes and the running build
disagree, the build wins.**

Two things from `spm_conceptos_fmx.md` are design material rather than engineering material:

- **The filter analogy**: the modulator's level acts as a cutoff frequency and its envelope as a filter
  envelope. It is the literal script of the canonical A/B in `4b` and the reason lesson 2 is that one and
  not another. Cited in `3d`.
- **The seven spectral forms are defined in a checkable way** (Sine with no harmonics, All/Odd wide or
  narrow, Res with a displaced peak). Each definition is a claim the analyzer can verify, so **the
  theory-versus-measurement panel works as-is for Spectral Form**, not only for Bessel.

`fase0b_RESULTS_sysex.md` is not included: it is superseded by 0c and contains a 14-21 ms latency that
turned out to be a measurement artefact (it is 2 ms). What survives of it is already in `modx.md`.

At the package root:

| file | what it is |
|---|---|
| `GLOSSARY.md` | **read this first.** The product's vocabulary: one term per row with its definition and where it appears on screen, the defence of each chosen word, and in §6 **the rename list the code follows** |
| `CONCERNS.md` | **read this second.** What is not closed, what is still to be designed, and the data risk |
| `DESIGN.md` | the chosen direction and why, the rules to respect, the provenance of every datum, and what was deliberately **not** done |
| `design-tokens.css` | **source of truth** for values; phase 1 consumes it as-is |
| `README.md` | this document |

**Dated, not the specification.** Two more files sit at the package root and are the round-10
delivery, not part of the handoff. `ROUND10-PROPOSAL.md` is the round-10 proposal (2026-09-10,
`4cbf397`): landed as #74–#89 and #93 and decided by ADR-0008 (#84); **its figures are superseded
by the ADR and its §6 is not the diff to build from** — the decision is read from ADR-0008 and the
rules from `DESIGN.md`. `HANDOFF.md` is the delivery note that shipped with it and says the same
(*What is agreed and what is not*). The runtime the round-10 sheet loads is the `support.js` listed
in the `design/` table — do not port.

**Start implementing here**, in this order, because each step unblocks the next:

1. **The `4a` frame** with its header — including **HUSH**, which crosses everything else.
2. **The operator node** and the polled diagram: it is the most reused component (`4a`, `3a`, `3c`). Five
   facts, the ceiling datum, and the corner.
3. **The signal views** and every figure's provenance stamp — the four words and two shapes of
   `DESIGN.md` §20.7. **Do this once, properly**: it is the app's spine and retrofitting it is what
   produced the round-8 corrections.
4. **The anchor** (`6a`) and the reread of `6b`. It goes here, early and before the player, because it is
   **cheap** (one address, 1 Hz) and because **everything drawn afterwards has to know how to die**: if the
   void state does not exist from the start, it creeps into every panel as a patch.
5. **The player** (`4c`), which unblocks A/B and the audio check.
6. **The check** (`4e`) and the chain chip, which is what makes the theory panel credible.
7. **The operator editor** (`5a`), where BUILD mode lives, reusing every control from the system sheet.
8. **The sweep** (`5b`) with its **confidence grades** (`6e`) and the **SysEx console** (`5c`) with its
   **three** failure modes (`6d`), the two that depend on everything above working.
9. **What gets voided** (`6c`), which can only be done once the things that get voided exist: sweep, A/B,
   lesson and copies.
10. **Following** (`7a`, `7b`), last and not because it is unimportant: it **needs not one new request**, so
    it can be added once polling and the write cycle already work. Before that there would be nothing to
    tell your change from the app's own.

The two round-8 pieces that are not on this list because they are properties of the pieces above rather
than steps of their own: **the algorithm surface** (§10, part of step 1) and **the bench drawer** (part of
whichever step first needs a temporary instrument — in practice step 1, since the bridge log exists
already).

**One thing that has to be built before a capture is drawn at all**, and it is not on the list because
it is a rule rather than a screen: **the capture Aval**. A capture is `MEASURED` only when the anchor
vouches for both ends of its 1.5 s window; without it, a Performance change in the second before the
press produces a measurement of the old sound attributed to the new patch. `CONCERNS.md` §23.1.

## What was decided NOT to do

Summarised from `DESIGN.md` §21, so it does not creep back in:

- **No settings sidebar.** Every parameter lives next to the thing it changes — inside the node or on its
  curve. The moment a "properties" column exists, the app is an office app.
- **No small breakpoint** and no embedded layout: one canvas, 1280×800, scaling upward.
- **The 88 algorithms are not drawn.** The diagram is a layout by chain depth that serves any topology read
  from the keyboard; drawing 88 plates is data work.
- **No routing matrix and no algorithm editor**: the algorithm is a number that gets written.
- **No light theme.** An audio app with a keyboard in front of it is not looked at in white.
- **No rack skeuomorphism**: no screws, no brushed metal, no leather.
- **No 3D waterfall**: the flat ridgeline teaches more and perspective lies about amplitudes.
- **No tooltips as carriers of information** — with a finger they do not exist.
- **No DX7 corpus and no patch library**: last phase.
- **No prose caption anywhere.** The one that existed was removed rather than recomputed. Where a
  caption states figures, they are computed from what is actually drawn — the sheets' own numbers
  (`22 FRAMES · 0 → 712 ms`, and `8f`'s four annotations about the bus) are illustrations, not copy.
- **No settings surface for the temporary instruments.** The bench drawer holds them and does not grow
  options.

## Provenance note

The eight sources are in `sources/`. With them, **almost nothing drawn is invention** — but it is worth
knowing which is which:

- **Measured against the keyboard** (`fase0c_RESULTS_mapa.md`, and the master): ratio 1.4103 against 1.41
  on the MODX's screen, fc 261.763 / fm 369.175 ±0.005, 11 partials, I = 2.81, the 2756.25 Hz comb as a
  non-harmonic, the `0E 25 00` bulk dump, the snapshot's parameter set with its repair pass, `48 00 4F` for
  the algorithm, median latency 2.0 ms and a recommended timeout of 100 ms.
- **Documented, not measured** (`datalist_fmx_tables.md`, `rm_pantallas_fmx.md`): the 47 operator offsets
  with range and default, the 86 of the Part block, the 19 filter types, the whole FEG, the 2nd LFO,
  feedback at `48 0p 50`, the menu paths, **and the algorithm topology itself** — which is why
  `DOCUMENTED` is a provenance stamp and not a footnote. **Writing with the wrong length is a silent
  no-op**, so nothing here is taken as true until the keyboard answers.
- **Plausible invention, inside documented ranges**: the dirty-example values on the Part screen, the eight
  AEG times, operators Op5–Op8 of the example patch, and the titles of the nine lessons. Full list in
  `DESIGN.md` §24.
- **Measured in round 6** (`fase0d`, `fase0e`): the zero on a Performance change (twice, raw, with the
  anchor inside the window), that **the MODX does transmit keys over USB** (11 On / 11 Off on channel 1,
  velocity 32 to 106, real 14-bit pitch bend, full CC 1), that one key in `MIDI I/O = Multi` **gives one
  Note On per Part** (four in 28 ms), the effective poll rates with **0 lost of 4 000**, background traffic
  of 40 msg/s at 90 BPM (**it scales with tempo**), the map's semantics verified on Op5 and Op7 (12 of 12,
  with the prediction written before looking), Feedback at `48 0p 50` **per Part**, that reserved addresses
  **answer a read**, and that `30 4B 00` is **read-only**.
- **Measured by the running build** (round 8, the two `RUNNING-app-*.jpg` captures): noise floor −58 to
  −66 dB relative to the peak, wide ring 10.0–10.4 Hz, reread set **384** requests of which 383 answer,
  bulk dump 19 003 B in 123 messages. **These supersede the spike figures** wherever they conflict; the
  superseded values are listed once, in `DESIGN.md` §22. Session 2 added the 88-algorithm maxima —
  8 rows, 8 columns, reached by the **66** and the **1** — computed from the transcribed table and so
  `DOCUMENTED` rather than measured (`CONCERNS.md` §31).

Three data corrections the sources uncovered and that are already applied: **Spectral Skirt is 0-7** (not
0-99, and that changes the control: eight positions, not a continuous knob), **the filter Cutoff is 0-255
in two bytes** (not hertz) and **the FEG level is bipolar in cents, ±9 600**.

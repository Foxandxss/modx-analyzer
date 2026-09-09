# MODX Analyzer — phase 1, session 2: the language pass and the fixes the running build asked for

You are the implementer. The app runs, the audio bridge works, the SysEx probing works, and the
screen is laid out. This session does **not** add a feature. It does two things:

1. **Moves every user-visible string in the app to English**, following one authority.
2. **Fixes the places where the running build shows something that is wrong, empty, or invented** —
   all of which are now specified in the design handoff.

The design is closed. Argue with anything here that is wrong or has a better route — this was written
by someone reading your code, not compiling it — but do not redesign. Where you disagree with the
handoff, say so and implement what it says unless told otherwise.

---

## Read this first, in this order

The handoff lives in `design_handoff/`. It was reworked specifically so that it can be read top to
bottom by an implementer, which was not true of the previous version.

1. **`design_handoff/GLOSSARY.md`** — the vocabulary and the rename list. §6 is the working list.
2. **`design_handoff/README.md`** — starts with the precedence rules. Four lines, read them.
3. **`design_handoff/DESIGN.md`** — the specification. One section per screen, each rule stated once.
4. **`design_handoff/CONCERNS.md`** — organised `CLOSED` / `OPEN` / `DEFERRED`. Read `OPEN` and
   `DEFERRED`; skim `CLOSED` only when you want the reasoning behind a rule.
5. `design_handoff/design/*.dc.html` — the drawn pieces. Visual reference, not specification.
6. `design_handoff/screenshots/RUNNING-app-*.jpg` — the current build, which the handoff argues with.

**Precedence, from `README.md`:** `GLOSSARY.md` §6 wins on any user-visible string. The current text
of a section wins over any historical note inside it. Where paper and measurement disagree, the
measurement wins; where the phase-0 spikes and the running build disagree, **the build wins**.

Two known defects in the handoff itself, so they do not cost you time:

- The `DESIGN.md` section numbers **cited inside `GLOSSARY.md` are stale** — the round-9 edit folded
  and renumbered `DESIGN.md` without updating those pointers. Navigate by section *title*, not number.
- `design-tokens.css` exists **three times**: `design_handoff/design-tokens.css`,
  `design_handoff/design/design-tokens.css` (an accidental duplicate) and
  `ui/src/styles/design-tokens.css`. Only the last one compiles. See "Tokens" below.

---

## Job 1 — the app speaks English

### The rule

`GLOSSARY.md` §6 is **the only authority** on copy. It carries roughly sixty strings covering every
screen designed so far, not just the ones on screen today.

**If a Spanish string is not in §6, it has no approved English form. Ask — never invent.** Collect
them and report them at the end of the session rather than stopping.

### What is not translated

`GLOSSARY.md` §5 lists these; the short version:

- **The keyboard's own names**, printed on the instrument or in Yamaha's manual: `LPF24D`, `HPF12`,
  `BPF12D`, `BEF12`, `LPF18`, `LPF12+HPF12`, `Thru`, `INIT`, `MODX-1`, `Init Normal (FM-X)`, and menu
  paths like `[UTILITY]` → `[Settings]` → `[Advanced]`. Translating these breaks the one thing the
  user can check against the hardware in front of them.
- **`FE Line`** — the small grey readout beside `ALG 37` in the header. Nobody knows what it stands
  for, including the owner, so it stays literal. `GLOSSARY.md` §4b holds it open.
- Screen ids (`3a`…`8h`) and token names.

### Where the strings are

Every file below carries Spanish copy today. This is a starting list from a grep, not a guarantee of
completeness — sweep for yourself:

```
app/panels/figures-column/figures-column.{ts,html}
app/panels/operator-diagram/operator-diagram.{ts,html,scss}
app/panels/signal-views/signal-views.{ts,scss}
app/panels/tab-panel/tab-panel.ts
app/shell/header/header.{ts,html,scss}
app/shell/dev-readout/dev-readout.ts
app/shell/sweep-readout/sweep-readout.ts
app/provenance/{provenance,theory,freshness}.ts
app/audio/{audio-service,bridge,audio.worker}.ts
app/backend/{backend-gateway,fake-backend-gateway,tauri-backend-gateway}.ts
```

Specs carry the same strings and must move with them.

### Identifiers and comments — your call, with a recommendation

`GLOSSARY.md` §5 leaves source identifiers to you. One is worth doing and one is not:

- **`trama` → `frame`.** It appears as `tramas`, `tramasWritten`, `TRAMA_HISTORY` and in a dozen
  comments across `bridge.ts`, `audio.worker.ts`, `live-canvas.ts` and `waterfall.ts`. It is the app's
  central noun, it now has an English name on screen, and leaving it Spanish in the code means every
  future reader translates in their head. Mechanical, well covered by specs. **Do it.**
- Comment prose is already mostly English and is being improved incrementally. **Do not sweep it.**

---

## Job 2 — the fixes

Each of these is specified in `DESIGN.md`. The section titles are given; read the section before
implementing, because the reasoning matters more than the shape.

### 2.1 · The scope draws a flat line and does not say so — `DESIGN.md` §8.2 "The scope contract"

**Highest priority in this list.** In the running build the scope reads
`TRIGGER ↑0 · 2 CICLOS · 43.8 Hz` while the carrier is at 349.23 Hz. 43.8 is almost exactly 349.23/8:
the trigger has locked onto a sub-harmonic, most likely by counting zero crossings, which bright FM
crosses many times per period. The result on screen is a near-flat line that looks like a valid
measurement. That is the exact failure this project exists to prevent.

The contract has three parts and the caption **is** the specification:

1. **Lock to the fundamental of the held note** — fc from the last capture when there is one, the
   note's own pitch when there is not. **Never a zero-crossing count.**
2. **Exactly four cycles, always**, period boundaries drawn, and the caption states the resulting
   window in ms. Four and not two: two periods of bright FM is 5.7 ms and does not visibly repeat.
3. **When it cannot lock** it says `NO LOCK`, draws the raw window in the predicted register
   (amber-dashed — the time axis has become a claim), and names the reason: `no held note` /
   `pitch unstable` / `no capture yet`. If peak-to-peak sits under floor + 6 dB it draws the noise
   floor band and says `SIGNAL BELOW FLOOR`. **The flat line gets labelled flat.**

Locked caption: `LOCKED 349.23 Hz · 4 CYCLES · 11.5 ms`.

Related, and worth checking while you are in the audio path: the build reports `FLOOR −58 dB` where
the phase-0 spikes measured −104 dB. Forty decibels is a lot, and the floor is what decides whether a
line is real. It may be nothing more than input gain, but the `NOT A HARMONIC` chips are firing at
levels the generator comb should sit below, so establish which number is right.

### 2.2 · The waterfall caption is invented — `DESIGN.md` §8.3

`tab-panel.ts:54` hardcodes `el ataque brillante apagándose · 14 tramas · 0 → 460 ms`. That sentence
described a mock. It now sits over live data that is neither 14 frames nor 460 ms, which makes the
app's only line of prose its only lie.

Replace with two figures computed from the actual capture plus the axis labels, and **no prose**:

```
WATERFALL · 22 FRAMES · 0 → 712 ms          TIME ↓ · FREQUENCY →
```

Whether an attack is bright is a property of the sound, not of the panel. If the app ever describes
the shape of a capture, that is a derived claim, gets stamped `PREDICTED`, and is a feature — not
caption copy.

### 2.3 · The operator node — `DESIGN.md` §9 "The operator node"

The node was grown from 100×92 to 118×108 in an earlier round specifically to carry drawn values, and
today it renders them as text that ellipsises (`×0.50 ...` in the screenshots). Full rebuild:

- **Exactly five facts**: label + role (carried by the node's own shape), Level, ratio, spectral form,
  and the operator's Hz stamped `PREDICTED`. The miniature AEG is **out** — it moves to the `ALL
  EIGHT` card and the operator editor. Do not add a sixth.
- **Level → fill height, linear 0–99.** Do not expand or curve the mapping: a fill height that stops
  meaning the figure is the spreadsheet trap in a new costume.
- **The ceiling datum.** A shared 2 px dashed line across all eight nodes at the patch's highest
  Level. This is what makes the fills readable: the build's own patch is `90 · 90 · 71 · 90 · 90 · 85
  · 90 · 99`, six of eight identical to the eye, and the datum turns eight absolute heights into seven
  readable gaps. Needs a new token — see "Tokens".
- **The spectral form is a glyph, never a name.** At 18×14, at most five strokes: one stroke = Sine,
  evenly spaced descending = All, gapped = Odd, one tall stroke offset right = Res, Skirt as stroke
  width. **A word that ellipsises is worse than no word.**
- **The open corner**: 44×44 at the bottom right, two 2 px strokes — the visible path from a node to
  its editor. Not an icon, not a menu, not a chevron. The node body still opens the editor. The words
  appear once, in the diagram legend: `5 of 43 facts shown · the corner opens the other 38`.

### 2.4 · The measured column never says what fills it — `DESIGN.md` §10.1

`figures-column.html` binds the first cells to `dead` and the column stays dead for the whole session.
That is correct behaviour — the column must be empty until something is captured — but nothing tells
the user that `CAPTURE` is what fills it, and the build repeats a variant of "not in this session"
under five separate cells, which makes the emptiest region of the screen also the wordiest.

- **This state is permanent and recurring**, not onboarding: the column returns to dashes every time
  the Performance changes. Design it as a resting state.
- **Every cell keeps its label and its unit and loses only its figure** — reuse the void vocabulary of
  §17.3, do not invent a second appearance.
- **One sentence, not five**, plus the shared dashed-shutter glyph at the head of the column and the
  `CAPTURE` button repeated at its foot:
  `Hold a note and press CAPTURE. One 1.5 s window fills every cell below.`
- **Never a zero and never a plausible placeholder.** A ratio reading `0.00` before anything was
  measured is precisely the failure this project exists to prevent.

Also missing from the column today and specified in the handoff: the `CLEAN CHAIN` chip and the
`WORST PARTIAL` cell.

### 2.5 · The algorithm becomes the primary surface when nothing is measured — `DESIGN.md` §10

The spectrum and harmonics panels say nothing until a capture exists; the algorithm is legible the
moment a patch loads. So the main screen is **two compositions of the same elements**, chosen by
whether a capture exists.

- **A panel that expands, not a screen of its own**: the algorithm stays in place and takes the slack.
  **1232 × 400 when nothing is measured, back to 700 px when there is a capture.** Same component.
- **Automatic**, with `KEEP IT BIG` in the algorithm's own header to pin the big composition; the pin
  persists. A capture brings the panels back over `--dur-settle` (420 ms).
- **At 1232 px, role reads from position**: a carrier is a node that touches the output bus; every
  arrow points down and depth is height; operators at zero park to the right on a dashed stub, drawn
  and never deleted.
- Size the layout by the bound eight operators can produce — up to 6 depth levels, up to 4 parallel
  branches at one level. **Do not invent which of the 88 algorithms is the worst case**; that needs a
  histogram over the FM-X table and is open as `CONCERNS.md` §31.

Risk accepted by design and worth watching in use: the swap is automatic. `CONCERNS.md` §30.

### 2.6 · The scaffolding goes behind a handle — `DESIGN.md` §16.1 "The bench drawer"

The bridge, startup, audio, port and sweep readouts are five temporary instruments and are the largest
blocks of text in the app today — roughly a fifth of an 800 px screen. They are honestly declared
temporary in the code, but the body has a 360 px floor and there is no air left.

One drawer, generalised from the SysEx console's: 52 px handle (`--drawer-grab`), opens **over** the
bottom strip without replacing the screen behind it, closed by default, nothing inside animates.

- **One chip per instrument on the handle, wearing its ticket number.** A panel labelled `#5` is
  visibly on its way out, and closing the ticket makes the chip disappear.
- **The SysEx console is the one chip with no ticket**, because it is permanent.
- **Alert behaviour belongs to the console alone.** A bridge log with 0 drops has nothing to say.

### 2.7 · The mode switch renders only what exists — `DESIGN.md` §3.1

Today it is three buttons with two `[disabled]`. Three buttons with two dead thirds reads as a broken
control. The app's own rule that a disabled control stays readable is for a control that **will work
once its precondition is met**; a mode with no code behind it has no precondition.

Render one label, `BUILD`, with the roadmap line under it at 8 px: `the only mode built`. It becomes a
two-way switch when A/B lands, three when LEARN lands.

### 2.8 · The header — `DESIGN.md` §8.1

Left to right: port, anchor, algorithm pill, mode label, chain chip, the `LIVE` pill with its frame
rate, the `CAPTURE` shutter with `65536` and `NEEDS A HELD NOTE`, and — isolated by `--gap-isolate`
and a 2 px rule — the single octagon, `HUSH`.

- The anchor carries **no poll rate and no SysEx address** in the header. `ANCLA · 1 Hz · 31 00 00`
  is debug provenance; it moves to the check screen, which the anchor already opens on touch.
- `44 100 Hz · MAIN L/R` was in the original header design and is absent from the build. It tells the
  user what is being measured. It is not in the round-9 AFTER composition either — **raise it, do not
  silently decide it**.

### 2.9 · The harmonics panel and the `PREDICTED` overlay — `DESIGN.md` §8.4 and the `PREDICTED` entry

`harmonics.ts` refuses to draw the Bessel overlay with the comment "No Bessel overlay". The *reason*
is right — you do not draw theory beside a measurement that does not exist — but the rule is stated
too broadly: it also suppresses the overlay once there **is** a capture, which is when the design asks
for it. The rule is **"no overlay until there is a capture"**, not "never".

With it, restore the `MEASURED` / `PREDICTED` legend, which is what makes the panel readable as a pair.
`NOT A HARMONIC · <n> Hz` chips stay: **marked, never hidden, never counted as a harmonic**, and always
with the frequency, because the Hz is what distinguishes a generator comb from mains hum from aliasing.

---

## Tokens

`ui/src/styles/design-tokens.css` is the file that compiles; the handoff copies are reference. Values
are the source of truth — do not use literals.

**Six values need to change, and the handoff deliberately did not change them** (`CONCERNS.md` §29:
design would rather the owner change them than discover that design had). The owner has approved
these. Five are stale because the running build measures something different:

```
--probe-idle:      12      →  10      /* the build achieves 10.0–10.4 Hz */
--ring-wide-hz:    12.2    →  10      /* same */
--stale-wide-s:    0.33    →  0.40    /* 4 × the real ring period */
--stale-narrow-s:  0.66    →  0.80    /* same */
--reread-total:    416     →  383     /* the build rereads 383 of 384 */
```

And one is new, needed by the ceiling datum in 2.3:

```
--datum-ceiling-stroke: 2px;
--datum-ceiling-color: oklch(1 0 0 / .3);
```

Apply these to `ui/src/styles/design-tokens.css` **and** to `design_handoff/design-tokens.css` so the
two stop disagreeing, and delete the accidental duplicate `design_handoff/design/design-tokens.css`.
Everything else in this session reuses existing tokens: `--drawer-grab` and `--drawer-lift` for the
drawer, `--dur-settle` for the algorithm swap, `--hit-min` for the corner, `--theory` and
`--dash-theory` for the `PREDICTED` overlay and the no-lock scope.

---

## Out of scope

- **The viewport stays 1280 × 800 CSS at DPR 1.5.** The 125 % question is deferred by the owner
  (`CONCERNS.md` §32). Do not author fluid.
- **No new screens.** The operator editor, A/B and the tutor are not this session.
- **Do not touch `design_handoff/sources/`.** Those are the owner's measurements.
- **Do not rename screen ids or token names.**
- **Do not re-litigate closed decisions.** `PREDICTED`, `LIVE`/`CAPTURE`, `HUSH`, `DOCUMENTED`, four
  words and two shapes, the linear Level, the node losing its AEG, the open corner, the bench drawer
  and the algorithm surface are all settled. Disagree in your report, implement what is written.

---

## Report at the end

1. **Spanish strings with no row in §6** — the ask-never-invent list.
2. **Anything in the handoff you believe is wrong**, with your reasoning.
3. **The floor question** from 2.1: which number is right, −58 or −104, and why.
4. **`FE Line`** — if reading the code tells you what it is, say so. It is the last open row in the
   glossary.
5. What you did not finish, and what it is blocked on.

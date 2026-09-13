# MODX Analyzer — visual direction (phase 1 UI)

A design deliverable. None of it touches the app's code.

**Reference canvas: 1280 × 800 CSS px** (14" laptop, 1920×1200 panel at 150 % Windows scaling),
**~1280 × 740 usable** full-screen once the window frame is deducted. `devicePixelRatio = 1.5`.
**Touchscreen**, and mouse as well. The Waveshare ESP32-S3 target is cancelled: there is no
1024×600 breakpoint anywhere.

**Language.** Every user-visible string in this document comes from `GLOSSARY.md` §6, which is the
only authority on copy. If a string is not in §6, it has no approved form — **ask, never invent**.
The keyboard's own names (`LPF24D`, `Thru`, `Receive Bulk`, `Init Normal (FM-X)`, the menu paths) are
never translated; they have to match what is printed on the instrument.

## What is in this folder

| file | what it is |
|---|---|
| `Index.dc.html` | the index, with links to every screen — **start here** |
| `Main-screen.dc.html` | **the main screen** (`4a`, promoted from 3e) and **A/B mode** (`4b`) |
| `Round3-screens.dc.html` | **round 3** — ALL EIGHT, the Part, copies and their diff, the tutor index, and the rebalanced main screen (now `4a`) |
| `Round4-pieces.dc.html` | **round 4** — `4c` the player and its seven states · `4d` HUSH · `4e` connection and check |
| `Round5-screens.dc.html` | **round 5** — `5a` the operator editor · `5b` the sweep · `5c` the SysEx console |
| `Round6-screens.dc.html` | **round 6** — `6a` the anchor in the header · `6b` the moment the Performance changes · `6c` what gets voided · `6d` read-only · `6e` confidence grades on the sweep |
| `Round7-pieces.dc.html` | **round 7** — `7a` the rail that follows you · `7b` ALL EIGHT as a mirror |
| `Round8-pieces.dc.html` | **round 8** — `8a` the header and the naming pass · `8b` the stamps · `8c` the operator node · `8d` the unmeasured column · `8e` the scope contract · `8f` the algorithm surface · `8g` the bench drawer · `8h` checked against the running build |
| `System-sheet.dc.html` | the component sheet for the recommended direction + operator editor + theory/measurement + tutor mode + the four unhappy states + **finger and mouse interaction** |
| `design-tokens.css` | semantic tokens (colour, type, spacing, radii, elevation, curves, touch targets) |
| `Direccion-A-Bancada.dc.html` | the earlier main screen — **archived**, not maintained |
| `Direccion-B-Nebula.dc.html` | direction B — **archived**, not maintained |
| `Direccion-C-Plotter.dc.html` | direction C — **archived**; its warm register survives in the lesson screens |

They all open on a double click: no build, no CDN, system typefaces (Helvetica/Georgia + mono).

Example data is what the spikes measured. Algorithm 6, feedback 3 on Op5. Op1 carrier 99 ×1.00,
Op2 at 0, Op3 modulator 90 ×1.41 Odd 1, Op4 carrier 99 ×2.00, Op5 modulator 72 ×2.00 Res 1,
Op6 modulator 64 ×7.00, Op7 at 0, Op8 carrier 55 ×0.50. Spectrum with the eleven partials of
`|fc ± k·fm|`, fc = 261.763 Hz, fm = 369.175 Hz, measured ratio 1.4103 (1.41 on screen, Δ 0.4 ¢),
I = 2.81, and the 2756.25 Hz comb marked `NOT A HARMONIC` rather than hidden. **Where the running
build reports a different figure, the build wins — see §22.**

---

## 1 · The three directions

**A · Bancada** — *laboratory bench: graphite, phosphor and amber; the figure accompanies, it does
not lead.* Three bands: the operator diagram on the left as the hero, scope and spectrum stacked in
the centre, waterfall full-width below, measured figures in a right-hand column. The transport is
split into two distinct acts: the green pill that beats, and the amber shutter on a held note.

**B · Nébula** — *the algorithm as a bloom: depth in the chain is distance from the centre.* The
patch reads as concentric rings around an output core; Level is an arc around each operator and the
routes are curved cables. The four signal views are glass panels on the right. It tells the topology
best at a glance (you can see who is far from the output) and it is the most memorable.

**C · Plotter** — *chart recorder: warm ink on dark paper, not one glow.* The one that walks away
from the obvious: no neon. Warm graphite, a single vermilion accent, pen strokes, hatching instead
of a luminous fill for Level, serif for what explains and mono for what is measured. The waterfall
is a continuous roll taking half the screen, like a recorder strip.

### How the three hold at 1280×800

All three were rebuilt and looked at that size. The canvas is **landscape and short**, so the
problem is never the width: it is the height.

- **A** holds comfortably without losing a single view: the waterfall stays full-width, the four
  views coexist, and the figures column narrows without shrinking the body of the numbers.
- **B** holds **recomposed**, not shrunk: the bloom went from three radial rings to three branches
  with angular separation (the deep node steps 26° off its branch instead of lining up), the core
  dropped to r=66 and the signal rail to 560 px. Shrinking it to 86 % would have put labels under
  10 px; recomposing costs nothing and keeps the idea. It is still the one with the least air.
- **C** holds and suffered least, because its operator sheet was already in percentages: it reflows
  by itself. What shortens is the waterfall roll, which loses some of its "long strip" charm — the
  price of a short canvas.

None of them needs 1440. Scaling up on an external monitor is welcome and provided for in the
tokens, but **the design case is 1280×800**.

## 2 · Recommendation: **A · Bancada** — accepted (round 3)

B and C are **archived**: not maintained, not updated. One thing survives from C, by explicit
invitation: its **warm register** (serif + cream ink + vermilion accent) is now the sub-register of
the lesson screens inside A. See `--font-lesson` and the `--lesson-*` tokens.

The four reasons, for the record:

1. **It is the only one that holds the four signal views and the diagram at once, comfortably, at
   1280×800.** The entire project is justified by watching the waterfall while you turn a knob and
   seeing the diagram that goes with it. B manages it by squeezing; C gives half the screen to the
   roll and compresses the spectrum.
2. **The hierarchy is the trade's.** A measuring instrument: neutral ground, luminous signal,
   discreet grid, monospaced figures. The eye goes to the signal because it is the only thing that
   glows — which is exactly the brief's criterion.
3. **Meaning does not depend on colour.** Carrier = fully curved; modulator = live corner; Level 0 =
   dashed outline. It works in grey and with colour blindness.
4. **It is the best to touch.** A grid diagram gives rectangular targets with regular separation;
   B's bloom has round nodes at uneven distances with labels around them, which is easier to miss
   with a finger.

What choosing A costs: B's visual punch (a bloom is more memorable than three bands) and C's
personality (A looks more like other analyzers; that is the price of looking like an instrument).

**C deserves a second look** for tutor mode and for print: warm ink and a serif explain better than
phosphor. It is not ruled out as the lesson sub-register.

---

## 3 · Two first-class modes

**LEARN** — the tutor leads step by step, writes to the keyboard, the user listens. Low density, a
lot of accompaniment, and a **warm sub-register** (serif + cream ink, inherited from direction C) on
everything read in order to *understand*. It is not a second app: it is the same system with a
different role and a different voice. Measured figures stay in mono and phosphor there too.

**BUILD** — nobody holds your hand. High density, all the FM at once, and **ALL EIGHT** as the
primary surface. This is the mode that gets used for hours.

They are not two themes or two parallel navigations: they are two densities of accompaniment, and
you enter and leave through a visible button in the bar (`GO TO BUILD →` / `GO TO LEARN →`).

### 3.1 · An unbuilt mode is not a disabled button

Three buttons with two of them disabled reads as a broken control, and it is. The app's own rule
(§20 · *Rules an implementer must respect*, rule 4) that a disabled control keeps full opacity and
stays readable is for a control that **will work once its precondition is met** — a mode with no code
behind it has no precondition.

So **the switch renders only what exists.** Today that is one label, `BUILD`, and not a segmented
control with two dead thirds. When A/B lands the label becomes a two-way switch; when LEARN lands,
three. The roadmap line sits under the label at 8 px (`the only mode built`), where it costs nothing
and promises nothing. That 8 px is one of the three deliberate exceptions to the type floor of §20,
rule 17 — see the rule, which now names them.

**What the build removed with the two dead thirds: the frame around them.** A segmented-control
border and a filled *selected* state around one static label still read as something that can be
pressed, which is the same lie the disabled thirds told at a third of the size. So the switch is
typography in the vocabulary of the readouts beside it — the mono label, the roadmap line under it —
and not a pill with one item in it.

---

## 4 · ALL EIGHT — the choreography of the patch

The most important screen. An FM-X operator has 43 parameters; the main screen shows five and the
full editor shows one operator. This screen shows **five facts about all eight at once** and, above
all, the **comparison**.

- **Eight AEGs on one pair of axes.** The focused operator at `--curve-focus-stroke` with its
  draggable points; the other seven at `--curve-ghost-stroke` and `--curve-ghost-alpha`, in their
  role's colour. The ones at 0 are a dashed line along zero — present, not deleted. At a glance you
  see who attacks first and who dies first, which is what makes it sound like a bell.
- **The name is written on the curve**, on its plateau. No legend to match up and no tooltip: with a
  finger there is no "above".
- **Grouped by the role the algorithm gives them**, not by number: `CARRIERS · YOU HEAR THESE` /
  `MODULATORS · THEY COLOUR IT` / `AT ZERO · SILENT`, each group with its frame and its count.
- **Five facts per operator**, on a `--op-strip-w` card: ratio, Level (a draggable luminous column of
  `--op-level-col-w`), Freq Mode, the spectral form **drawn**, and its own miniature AEG. The rest of
  the 43 live in the operator editor — this screen is not its replacement.
- **Comparison-axis switch**: AEG · LEVEL / PEG · FORM/FREQ / SPECTRUM PER OP. One surface serves the
  three comparisons that matter.

The spreadsheet trap is dodged like this: **no cell holds a bare number**. Every value comes with its
shape — column height, position on a curve, or the drawing of a spectrum.

**This is also where following leaves its trace rather than moving focus — see §18.2.**

---

## 5 · The Part — what sits between the FM and your ears

Its main job **is to warn**, not to mix.

- **The chain as a horizontal tape**: OPERATORS → FILTER → INSERT A/B → EQ → SENDS → MAIN L/R. A
  transparent stage is **drawn straight** with a dashed outline; one that intervenes is drawn **with
  its shape** and in `--chain-dirty`. The shape says the state before the colour does.
- **Chain stamp**: `CLEAN CHAIN` (filter at Thru, sends at 0, inserts out, EQ flat) or
  `DIRTY CHAIN · THIS IS NOT PURE FM` in the bar, with a `CLEAN THE CHAIN` button beside it. The
  stamp travels to the main screen as a small chip, and **the theory-versus-measurement panel reads
  it**: with a dirty chain the n=2 error is attributed to the filter and not to the analysis (1.8 dB
  dirty vs 0.4 dB clean, on the same capture).
- **The filter is edited by drawing its response**: a 620×210 curve with cutoff and resonance as
  draggable `--grip-curve` points, the Thru line as a flat dashed phosphor reference ("flat = pure
  FM"), and the types as **drawn chips** of `--hit-chip`, not a dropdown of 19.
  The readout is `CUTOFF 178 · RES 42 / 127`. **Both figures are parameter values, not hertz** —
  cutoff is 0–255 in two bytes (`48 0p 0C`), resonance 0–127 (`0F`). The curve's axis stays frequency
  because a curve is a response; the readout is the parameter.
- **FEG, 2nd LFO, note and velocity** complete what can dirty a capture: the FEG moves cutoff over
  time, Amp Mod makes the amplitude breathe (a capture comes out differently depending on when you
  trigger it), and the note and velocity limits are drawn **on a keyboard and a wedge**, not as four
  fields. The FEG level is bipolar in cents, ±128 → ±9 600 ¢, so it is labelled `+52 · +3 931 ¢`,
  which is what it actually does to the spectrum.

---

## 6 · Copies — and the diff between two

The snapshots that the "I am about to overwrite your patch" warning promises, given a home.

- **A list with provenance and age**: `BEFORE THE APP TOUCHED ANYTHING`, `INIT`, `STEP n · LESSON m`,
  `BY HAND`. Each says its form (a bulk dump, or a parameter set) because they do not restore alike.
- **Restoring is one touch**, with no dialog: it is a single message and 20 ms. But **one touch, not
  two**, and what you were using is saved first — nothing destructive goes through a double tap.
- **The diff between two is the most valuable screen in the project**, and it is designed as what it
  is: **the script for a lesson**. 14 changed parameters group into **five things to understand**,
  each with its step number, its sentence in human language ("OP3 · the modulator that gives the
  bell") and its drawn evidence — delta bars, the envelope before and after superimposed, the
  spectrum of the new form. A `TURN INTO A 5-STEP LESSON` button closes the loop.
- The 402 identical parameters **are not listed**. And the group that is not FM (the filter that crept
  in, the Amp Mod) is flagged in alert and can be **excluded from the lesson**: it is session noise.
- **Copies carry Performance provenance** (round 6). One from another sound is not disabled: **its
  button changes text** — `RESTORE HERE · WOULD OVERWRITE CFX + FM EP 2`. Disabling it would hide the
  only way out if you really do want that patch back.

## 7 · The tutor index

The level that was missing above the steps. Nine lessons as a **path with a spine**, not a grid of
cards: the done ones marked, the current one open with its five steps visible and its
`RESUME AT STEP 3` button, the next ones closed with their count. This is where the warm sub-register
lives, and the right-hand column explains where the unwritten lessons come from: from subtracting two
copies.

---

## 8 · The main screen (`4a`)

The composition after the round-3 rebalance. The waterfall came down from **194 px always** to
**156 px shared** with the scope in a tabbed panel of `--hit-tab`. What that freed up:

- The **diagram went from 556 to 700 px**, with nodes of `--op-node-w` × `--op-node-h` (118×108) —
  see §9.
- The **harmonics stopped being a thumbnail** and became a permanent panel, with the Bessel curve
  overlaid on the measured bars. It is the view that really teaches what is happening, and it now
  sits beside the spectrum, which is its context.

**The one qualification**: the waterfall was the least actionable view, not the least valuable — it
is the only one that sees time. So it shares space but **it is the default tab as soon as a note is
sounding**: the scope is asked for, the waterfall appears. What is lost is the simultaneous
scope↔waterfall comparison, and I do not miss it: they are the same signal in two domains, not two
things to cross-reference.

### 8.1 · The header

Left to right: port, the anchor (§17.1), the algorithm pill, the mode label (§3.1), the chain chip,
the `LIVE` pill with its frame rate, the `CAPTURE` shutter with `65536` and `NEEDS A HELD NOTE`, and
— isolated by `--gap-isolate` and a 2 px rule — the one octagon, `HUSH`.

**The chain chip's slot is reserved and empty in the build.** `CLEAN CHAIN` reads four conditions
that live in the Part common block; the wide ring watches none of them, and adding the addresses
costs about 1.6 Hz of its cadence. A chip that can be minutes stale is worse than no chip, so the
slot in the order above holds nothing until the ring budget is decided. Nothing is drawn void there —
that would be §3.1's rule about the unbuilt mode applied to a readout. It goes between the mode label
and the `LIVE` pill when it lands.

**The `LIVE` pill's second line is the audio the app actually opened**, and it is kept: `Line (MODX) ·
44100 Hz · 2 ch` — the device name the stream reported, the rate it is running at, the channel count
it delivers. All three are **measured**, none is hardcoded, and if the stream says 48 000 the pill
says 48 000. **`MAIN L/R` is not shown and cannot be**: that is the keyboard's own routing, which the
audio stream has no way to report. It is `DOCUMENTED` routing and belongs on the check screen (§13)
beside the anchor's poll rate and address, and it renders nowhere until that screen exists.

**`LIVE` and `CAPTURE` are a state and an act, and that is the point of the pair.** The live view is
continuous, free, always on, and produces **nothing you can quote**. The capture is one 65 536-sample
window on a held note and is the **only** thing that produces the partials table, fc, fm, the measured
ratio and the fitted index. One press, one artefact, with an age. Full reasoning in `GLOSSARY.md`.

Nothing else earns header space. In particular the anchor carries **no poll rate and no SysEx
address** there — see §17.1.

### 8.2 · The scope contract

A scope that silently draws a flat line is the failure mode this whole project exists to prevent, so
the scope states what it guarantees and **the caption is the specification**.

1. **Which period.** It locks to the **fundamental of the held note** — fc from the last capture when
   there is one, the note's own pitch when there is not. **Never a zero-crossing count**: bright FM
   crosses zero many times per period, which is how a 349.23 Hz carrier gets reported as 43.8 Hz,
   almost exactly one eighth of it.
2. **How many cycles.** Exactly **four**, always, with the period boundaries drawn, and the caption
   states the resulting window in ms so the time axis is never ambiguous. Four and not two, because
   two periods of bright FM is 5.7 ms and does not visibly repeat — it cannot show the one thing a
   scope is for, which is that the waveform *is* periodic.
3. **When it cannot lock.** It says `NO LOCK`, draws the raw window in the predicted register
   (amber-dashed, because the time axis has become a claim), and names the reason. And if peak-to-peak
   sits under floor + 6 dB it draws the noise floor band and says `SIGNAL BELOW FLOOR` — **the flat
   line gets labelled flat.**

Caption in the locked case: `LOCKED 349.23 Hz · 4 CYCLES · 11.5 ms`.

**The reasons the build ships are three, and `no capture yet` is not one of them.** They are `no held
note`, `pitch unstable` and `MORE THAN ONE NOTE` — the last because with two distinct held pitches
there is no fundamental to lock to. `no capture yet` cannot fire until fc-from-capture exists, and a
string that no state can produce is dead copy the next sweep has to explain; it ships in the same
commit as the fit. The build also **verifies** the lock rather than asserting it: autocorrelation at
the lag of the locked period has to clear the periodicity threshold, and `pitch unstable` is what it
says when it does not.

**`FLOOR` is absolute dBFS, here and everywhere else the word appears.** One word, one meaning, so a
floor figure on the spectrum can be compared with the floor the scope tests against. It is the median
bin level of a Hann 4096 in dBFS — *not* relative to the peak, which is how the phase-0 figures were
quoted; every one of those keeps its "relative to the peak" qualifier where it appears.

### 8.3 · The waterfall caption is computed, and short

**No prose.** The caption is two figures computed from the actual capture, plus the axis labels:

```
WATERFALL · 22 FRAMES · 0 → 712 ms          TIME ↓ · FREQUENCY →
```

**Both figures above are an illustration, not a specification.** The panel keeps **14 rows**, and the
count is how many are actually drawn — fewer than 14 early in a session and after a silence. The span
is computed from **per-row time stamps**, last minus first, and not from count × hop: rows are only
pushed when there is a curve, so a played phrase with pauses in it spans more than 14 × 30 ms. Nobody
should implement `22` or `712`, and nobody should implement `460`/`462 ms` either — those were the
same arithmetic done on paper. The two numbers are whatever the stamps say.

Nothing describes the *shape* of what is drawn. Whether an attack is bright is a property of the
sound, not of the panel, so a sentence like "the bright attack dying away" cannot survive live data —
it is a claim about one particular patch, and hardcoding it makes the panel lie. If the app is ever
going to describe the shape of a capture, that is a derived claim, gets stamped `PREDICTED` like every
other derived claim, and is a feature rather than caption copy.

The waterfall also **keeps the cut drawn** in dashed cyan when the sound changes underneath: above the
line, another sound (§17.2).

### 8.4 · The spectrum

Partials at `|fc ± k·fm|` drawn at `--stroke-partial`. Anything that is not at a predicted partial is
marked `NOT A HARMONIC · 2756 Hz` with a dashed alert stroke — **marked, never hidden, and never
counted as a harmonic**. The chip is useless without its frequency: the Hz is what tells a generator
comb from mains hum from aliasing.

---

## 9 · The operator node

118 × 108, and it is also a touch target. **It holds exactly five facts**, because that is what fits:

| fact | how it is drawn |
|---|---|
| label + role | the node's own shape — `--radius-carrier` fully curved, `--radius-modulator` live corner, dashed outline at zero |
| Level | fill length along the axis its composición declares + the figure in mono |
| ratio | figure |
| spectral form | a glyph, never a name |
| the operator's Hz | figure, stamped `PREDICTED` |

**Round 3 asked for six and the box holds five.** The sixth was the miniature AEG, and it is the one
that comes out: it has room on the 128 px card of ALL EIGHT, where comparing envelopes is the entire
point of the screen, and a full panel in the operator editor. On the main screen it was the fact that
pushed the other five into ellipsis.

_(Retired by #80 and #93; the live rule is ADR-0008 §2's.)_ **Level → fill length is linear 0–99,
along the axis its composición declares**: the node's height in the narrow grid, its length in both
wide boxes — the stacked node and the batten alike (ADR-0008 §2.1). Any expanded or non-linear
mapping makes the fill stop meaning the figure, which is the spreadsheet trap in a new costume: a
shape that lies is worse than a number on its own.

**The fill is measured against a track, not against the card.** _(Corrected by the build, #67.)_ This
rule was doing two jobs at once and only one of them was load-bearing. "Level is the height of the
fill" is the semantic claim — linear, zero-anchored, comparable across the eight — and it stands
unchanged. "The fill is the card" was an implementation detail that happened to be true, and it is
exactly the detail that made the ceiling undrawable at the top of its own range: at Level 99 of 99
the fill left one percent of the card above it, so the ceiling datum landed inside the card's own
2 px border. On `Init Normal (FM-X)` — `99 · 14 · 16 · 99 · 99 · 99 · 9 · 53`, the patch the app
boots into and the first thing anyone opens — there was nothing on screen to see.

So the fill's scale is the card's interior less a constant inset **at the far end of the carrying
axis**, and nowhere else: under the ceiling in the grid, past the tip in the wide composición. The
inset is in pixels and never a share: headroom that scaled with the card would give the datum
different clearance in every column shape, and close back up at the composition where the card is
smallest. It is **8 px in the grid and 7 px in the wide composición**, each earned against the
narrowest card of its composición — `levelTrackInset()` over `narrowestGridCard()` and
`narrowestWideCard()`, the wide card being the 111 px card at the width floor (ADR-0008 §5) — and
recomputed from those constants rather than written down, so that moving a floor again re-derives it
instead of leaving a number about a card that no longer exists.

**This is a correction, not a precedent.** The handoff is edited here for the same reason as in
`46a041c`: the build proved a sentence wrong. What is being separated is a claim from an accident
that was riding underneath it, which is the opposite of the rule bending — the claim came out of it
narrower and harder to misread. A change that reversed §20.2 rather than sharpening it would need an
ADR, and this one deliberately does not.

**The ceiling datum.** Real patches cluster their operators between 71 and 99 — the running build's
patch reads `90 · 90 · 71 · 90 · 90 · 85 · 90 · 99`, six of the eight identical to the eye — so
eight fills each with their own private baseline are unreadable. One shared **ceiling datum** — the
patch's highest Level, drawn in every node at the same fraction of an identical track — turns eight
absolute lengths into seven readable **gaps**. It is **a repeated mark on identical boxes**, one
origin and one scale, and a common rule only where the cards are stacked and share an origin: it
reads per node in the grid and wherever the wide drawing puts cards side by side, and where the wide
drawing stacks them in a column the marks line up into a rule the eye can sight along (ADR-0008 §2).
At real pixels on the wide composición's narrowest card — a 113 px card, a 102 px track, 1.02 px per
Level point — 99 against 96 is 3.1 px of surface before the rule, which is a notch once there is a
rule to measure it from.

Three boxes, and each is **told** its axis — declared as `DiagramLayout.levelAxis` by its layout
module (ADR-0008 §2.1) and never read off the box's proportions, because the wide boxes are
`viewBox` units the panel stretches and a window resize would otherwise turn a measurement round
with nothing failing:

| box | when | Level runs along |
|---|---|---|
| the grid node | narrow composición, always | its **height** |
| the wide stacked node | wide, 3 rows or fewer — 64 of the 88 | its **length** |
| the batten | wide, 4 rows or more — 24 of the 88 | its **length** |

No unit figure for either wide box is written here: the narrowest card is recomputed from the
layout's own constants (ADR-0008 §9), and a copy would be a second declaration of a derived number.

**The spectral form is a glyph and never a name.** At 18 × 14 what survives is at most five strokes,
which is the seven-way selector's drawing with its detail decimated: one stroke = Sine, evenly spaced
descending = All, gapped = Odd, one tall stroke offset right = Res, with Skirt as stroke width. Nobody
learns the families from an 18 px glyph — they learn them once in the editor and **recognise** them
here, which is all this drawing has to do. **A word that ellipsises is worse than no word.**

**Skirt as stroke width cannot be built yet, and the build draws a constant instead.** `Spectral
Skirt` (`49 op 0A`) is **not on the wide ring**, which reads five addresses per operator — Level,
Coarse, Fine, Frequency Mode, Spectral Form — and nothing else. A stroke width drawn off a value
nobody polled is exactly the failure the provenance rules exist to prevent, so all four family glyphs
are drawn at `--rule-min` until the Skirt is actually read. The channel is designed, dormant and
documented; it is not eight widths waiting in the code.

**And a spectral form nobody read draws a dash, not a Sine.** `Sine` is the form every operator of
`Init Normal (FM-X)` starts in, which is precisely why falling back to it would be a claim about the
patch instead of a blank.

**The corner.** Every node carries a 44 × 44 open corner at the bottom right — two 2 px strokes, the
mark for *there is more behind this*. It is the visible path from a node to its editor, and it is not
an icon, not a menu and not a chevron. Touching the node body still opens the editor as it always
did; the corner is what makes that discoverable without teaching it. **The words appear once**, in the
diagram legend: `5 of 43 facts shown · the corner opens the other 38`.

**In the build the corner is drawn and inert, and the legend line is held back.** The operator editor
is not built, so the node body opens nothing either; a caption naming a path no press can walk is the
same lie as a disabled mode button (§3.1), one register quieter. The 44 px zone is what becomes the
control when the editor lands — not the 22 px mark — and the line ships in that same commit.

**The legend has four entries, not three.** The ceiling datum is a mark on every node with nothing
on it to say what it is of, so it gets its own swatch and its own words beside the carrier,
modulator and level-0 samples: `THE LOUDEST OPERATOR IN THIS PATCH`.

---

## 10 · The main screen when there is no capture on it

_(Retired by #54 and #58; the live rule is ADR-0007's.)_ The spectrum and harmonics panels say
nothing until a capture exists, while the algorithm is legible the moment a patch loads. The answer
is not to delete the spectrum and not to add a mode: **the main screen is two compositions of the
same elements, and the two ranuras decide which one you get.** The glass column holds two ranuras,
each of which holds one of the four live views or nothing (`composition.ts`); the composition is
wide when both are empty or when the pin is down, and narrow otherwise. Whether a capture exists
plays no part: a capture landing moves nothing, and there is a test that says so.

- **A panel that expands, not a surface of its own.** A separate screen would mean navigating away
  from the signal views to see the topology, and the main screen's whole justification is watching
  the waterfall while you turn a knob. So the algorithm stays in place and takes what the column
  leaves. The column has **three shapes** (`column-geometry.ts`): `ranuras` — the narrow
  composition, the diagram at 700 px as the 3 × 3 grid; `rail` — both ranuras empty, the column
  collapsed to a 52 px handle and the diagram at 1 016 px; `gone` — the pin down, no column at all
  and the diagram at 1 070 px of the 1 280. `wide()` is `shape() !== 'ranuras'`, never "no capture".
  Same panel, same component, two drawings — the grid is ADR-0007's.
- **The ranuras decide, with one pin.** The factory pair is `SCOPE` and empty, so the app opens
  **narrow**; the wide composition is the one you ask for, by emptying both ranuras or by pressing
  **`KEEP IT BIG`** in the algorithm's own header. The pin is a pin and not a mode: it forces the
  wide composition without touching the stored pair, and letting it up restores the pair exactly. It
  persists — in `localStorage`, behind a `try`, because it is a UI preference and not data; a
  webview that refuses storage costs the pin and nothing else — and the pair persists on the same
  path. The risk the retired rule carried is `CONCERNS.md` §30, marked retired there.
- **Nothing moves that the pianist did not move.** The column's move runs over `--dur-settle`
  (420 ms), and it is always a press — on a ranura's chooser, a rail handle or the pin — that causes
  it. A capture landing and a Performance change move nothing; the retired rule's *regrowth waits*
  has no successor, because there is no regrowth.
- **Sized by the worst case, which is now measured rather than assumed.** Drawability was never in
  question — the MODX draws all 88 algorithms on a smaller screen. What varies is room, and the bound
  this section used to assume (**up to 6 depth levels with up to 4 parallel branches at one level**,
  which at 150 px nodes and 30 px rows is 1232 × 400 with the bus) is **low in both halves**. The
  histogram over the transcribed FM-X table has since been taken — `CONCERNS.md` §31, now resolved —
  and the real maxima are **8 rows** (algorithm **66**, the single chain of eight), **8 operators on
  one row** (algorithm **1**, eight carriers on the bus), 7 operators of one branch on one row
  (algorithm **68**) and 8 branches side by side (again the **1**).

  _(Retired by #82; the live rule is ADR-0008 §4's.)_ **The card keeps its width, because the width
  is the measurement; the gap between rows comes out of the height and gains a floor** (ADR-0008
  §2.2). Eight rows of a 120 px node is 960 px of the 400 there are, and what gives is neither a row
  nor the card's length: a drawing that cannot hold its facts **folds its facts and never its
  positions**. One mechanism, two triggers, a `||` at `foldsFacts()` judged on the unfolded drawing
  so the decision never rests on its own consequence (ADR-0008 §4):

  - *too deep for its rows* — the gap between rows has fallen under what a gap has to hold, its
    arrowhead plus a visible segment (rule 20). The threshold is derived, `rowGapFloor()`, and
    evaluated at the body's floor, so the floor and the threshold cannot chase each other.
  - *too narrow for its five facts* — the card is narrower than the grid card the same five facts
    are known to fit, `fittedCardWidth()`, judged at the design window: a comparison and not a
    threshold, so both sides move together and neither can be tuned until an algorithm folds.

  Who folds, forced by number in `wide-layout.spec.ts`: `rows ≥ 6` is exactly {37, 66}; the **1**
  folds at the factory window in both lanes; and since #83 a parked operator counts as a row, so the
  55 folds with one. The band keeps identity, the Level at full length against the same rule, and
  **one** stamp, the weakest of the ones behind it. The fold does not remove the legibility floor:
  folding the facts does not widen the card by a pixel (ADR-0008 §5). Under three rows the card
  stops growing, three being the narrow composition's own row count. **The layout decides this and
  not a CSS container query**: the layout is the only thing that knows how many rows had to share
  the height, and one rule in units beats a rule in units plus a second one in pixels that can
  disagree about the same node. No press unfolds the band today — that is #92 — and nothing here
  promises one.

  **`1232` is the drawing's coordinate space, not its width on screen.** The figures column stays in
  this composition — it is the one thing that says what a capture would fill (§10.1), and `before any
  capture` is exactly the state that produces it — so 1232 + 208 does not fit the 1280 the viewport is
  fixed at. What the algorithm takes is the two live views' room and no more — 1 016 px in the rail
  shape, 1 070 pinned, the shapes listed above — and the 1232 × 400 viewBox stretches into it.
- _(Retired by #83; the live rule is ADR-0008 §2.4–2.5's.)_ **Role reads from position, and shape
  confirms it.** At 700 px the node had to carry its own role; with room the layout carries it.
  **Who is a carrier: it touches the output bus** — that is the definition, drawn, and it has **no
  exception**: a test over the transcribed table asserts that in all 88 the operators at chain depth
  0 are exactly the carrier list. **Who feeds whom: one downward read** — every arrow points down,
  depth is height. **Who is at zero: out of the depth stack** — it has no depth in the chain, so it
  is not on that axis — into a band above the deepest row at the origin end of the Level axis, on
  its dashed stub, drawn and never deleted (ADR-0008 §2.4). The round-3 vocabulary survives
  underneath, so there is nothing new to learn.
- **The stub ends nowhere, and a parked operator's routes are drawn one way and not the other.** A
  route **into** a parked operator is drawn, inert — `--inert` on `--dash-inactive`, the ink `FB 0`
  has used since #57 — onto the bar that closes its stub, and it is the only line in the drawing
  that climbs; a route **out of** one is not drawn, in the wide composición only — the narrow grid
  draws them cut (ADR-0008 §2.5). Two facts, two predicates, `sends()` and `deadEnds()`. The reason
  is geometric and not audibility: parking has moved the operator onto its bar, so an inbound edge
  lands where it now lives and an outbound edge would run back into the chain it was removed from.
  The cost is stated: an outbound route is a documented route the drawing does not show, acceptable
  because the drawing is of the algorithm as configured. What the stub gets is `8f`'s own drawing: a
  dashed drop closed by a short bar. **It never reaches the bus and never takes the bus row**,
  because touching the bus is the entire definition of a carrier in this composition and a dead end
  touching it would put a hole in the one thing the drawing says. Parking costs **a row, not
  columns**: the stack closes behind the operator that leaves and the band takes the row it left,
  one for any number of parked, so eight rows stay the deepest drawing there is (ADR-0008 §2.4).
- **`8f`'s annotations are the sheet teaching its own reader, and none of them is app copy.**
  `ABOVE THE BUS — THESE FEED SOMEBODY`, `DOWN ON THE BUS — THESE ARE THE CARRIERS`, `STUB ENDS
  NOWHERE — AT ZERO, ON NO BRANCH` and `THE OUTPUT BUS — TOUCHING IT IS WHAT MAKES AN OPERATOR A
  CARRIER` are drawn in the ink of the thing each one points at, and none ships. The composition
  exists precisely so that position says it without a caption. Same standing as the waterfall
  caption's `22 FRAMES` (§8.3): an illustration on the sheet, not a string to implement.

### 10.1 · The measured column before the first capture

The column is born empty and stays empty until something is captured, which is correct. What was
missing is that nothing said `CAPTURE` is what fills it.

This state is **not onboarding and does not go away**: the column returns to dashes every time the
Performance changes (§17.2), which is many times an hour. So it is a permanent, recurring state and is
designed as one — **every cell keeps its label and its unit and loses only its figure**, which is the
void vocabulary of §17.3 reused rather than a new drawing. Two states, one appearance.

What makes it an invitation is one sentence and one shared glyph. The dashed shutter at the head of
the column is the same drawing as the shutter inside the `CAPTURE` button; the button repeats at the
column's foot, where the eye already is; and the sentence states the price out loud:

```
Hold a note and press CAPTURE. One 1.5 s window fills every cell below.
```

A 1.5 s price is small enough that saying it removes hesitation rather than causing it. The unit lines
do real work too: `no I, no Bessel curve` under the index is the reason the harmonics panel has no
dashed overlay yet, said where somebody would otherwise wonder.

**The rule this state must not break: never a zero and never a plausible placeholder.** A ratio reading
`0.00` before anything was measured is the exact failure this project exists to prevent. And **one
sentence, not five** — the running build repeats a variant of "not in this session" under four
separate cells plus a fifth under the last, which makes the emptiest region of the screen also the
wordiest without any of the five saying what fills it.

---

## 11 · The player (`4c`) — it does not play a file, it plays an instrument that is in the room

The piece that A/B, the audio check and any sweep share. **Seven states in a row**, because it is a
sequence and not a still:

1. **Rest** — nobody is playing, the keyboard belongs to its owner. Hollow triangle in `--inert`.
2. **Armed** — the parameter is written **and verified by reading it back**. Nothing sounds yet.
3. **Holding** — there is a live note put there by the app. This is the state that beats.
4. **Capturing** — the shutter, over the held note. FFT 65536.
5. **Releasing** — note-off sent, but **the AEG tail is still sounding** (~460 ms). Its own state,
   because the waterfall is watching it.
6. **Looping** — back to 2 with the other value. `--play-hold` of hold, `--play-gap` of pause.
7. **Failed** — the write did not come back on the read. **The note is released first and the warning
   comes second.**

**What gets played, without a form**: the note is played on a **drawn keyboard** and velocity is
dragged on a **wedge**. Not one numeric field. The spikes' reference is a sustained C4.

**Who is playing** — this is the part that is not obvious. `Local Control` stays on, so the keyboard
sounds on its own while the app writes to it, and the owner may be playing at the same time. Three
states with their own colour: `THE APP IS PLAYING` in `--who-app` (cyan, and the chip lives in the
header), `YOU ARE PLAYING` in `--who-hands` (phosphor, like every incoming signal), and
`A NOTE OF MINE IS STILL SOUNDING` in alert — the only state that lights HUSH on its own.

**Note counting is by pitch, not by message.** A key arriving on four channels within 28 ms is **one
note**, because the pitch is what sounds and the channel is transport. Correct in `Single` and in
`Multi` without knowing which one you are in; the raw per-channel counts still exist, but only in the
console drawer (§16), which is where traffic lives.

**`LIVE` ≠ `CAPTURE` still holds**: the player feeds both, but while it holds the note the live view
runs at 30 fps and the capture is the shutter of step 4 — deliberate, and stamped.

## 12 · HUSH (`4d`)

All Sound Off + All Notes Off + 2 048 explicit Note Offs. **It touches no parameter.** What is not
negotiable for the implementer: `--hit-panic` (56 px) at **the far right of every header**,
`--shape-panic` (the only octagon in the app), `--gap-isolate` (16 px) of air and a 2 px rule to its
left, three states (hollow / filled with a glow when a note is live / green for 1.5 s after being
pressed), **no confirmation**, it acts on finger-up inside, and it changes nothing about the patch.

The word is `HUSH` and not `PANIC` because *panic* names the user's emotion, while every other failure
state in this app names what happens. Isolation instead of confirmation: no dialog, just air.

## 13 · Connection and check (`4e`) — two faces

**The sequence** runs at startup and when something breaks: six checks **ordered from most to least
serious**, the ones that pass collapsed to a line with their measured figure, and the one that fails
at the end, large, with **the whole menu path inside it** (`[UTILITY]` → `[Settings]` → `[Advanced]` →
`Receive Bulk` = `On`).

Each check carries its real datum: port `MODX-1`; median latency **2.0 ms** (worst case 22.6, timeout
100); **0 lost of 24 320**; audio `Line (MODX)` 2 ch / 44 100 with peak −18 dBFS and the noise floor;
and clean chain 4 of 4.

**This screen is also where the anchor's debug provenance lives** — poll rate and `31 00 00`, plus the
figures that are properties of the loaded sound: `TEMPO 90 BPM · background 40 msg/s`. Touching the
anchor opens this screen, so nothing became unreachable when the header eyebrow was removed (§17.1).

**It is also the only home `MAIN L/R` can have.** The audio stream reports its device name, its rate
and its channel count and the `LIVE` pill shows those three as measured facts (§8.1); where the
keyboard is routing its Part output is not observable from the stream at all. So `MAIN L/R` is
`DOCUMENTED` routing and is drawn here, next to the datum it qualifies — and **nowhere** until this
screen exists. Inventing that fourth fact in the one line whose point is that nothing in it is
invented would be the exact failure the provenance rules are for.

**Rest is a chip in the header** — the one that already existed. No permanent status panel: six green
lights taking up space inform nobody. When something fails the chip **says the consequence, not the
fault**, and touching it opens this screen.

**Order of seriousness, which is a design criterion**: with no MIDI port the app does nothing (the only
one that blocks); with no audio it half works (the diagram serves, the signal views do not); with
`Receive Bulk` in Protect everything works **except giving you your patch back** — the worst, because
it is not noticed until you want to go back; and a dirty chain is not a failure, it is a warning.

**No failure says "error".** They all say what to do.

## 14 · A/B (`4b`) — a mode, not a screen

- **A and B by fill, not by colour** (`--ab-a-ink` hollow and dimmed, `--ab-b-ink` solid and luminous).
  Dashed still belongs to `PREDICTED`, and here there are **two** predictions, one per index.
- **The difference is labelled**, not deduced: "the fundamental loses 14 dB", "the 9th gains 31 dB".
- **The column says what does NOT change** — fc, fm, ratio, note and velocity identical — because that
  is what makes the comparison valid.
- **Both sides are captures**, each with its `MEASURED · 65536` badge and its age. Never a measurement
  against an estimate.
- `FREEZE AND KEEP` as a lesson step: a good A/B **is** a lesson step.
- When the sound changes underneath, the first action **is not discard**: repeating A costs one write
  and one turn of the player, ~3 s (§17.3).

---

## 15 · The operator editor (`5a`) — where you live in BUILD mode

It opens by touching an operator from ALL EIGHT, from the diagram, or by the node's corner (§9). Four
decisions, in order of difficulty:

**1. Context, which was the interesting decision.** I discarded the eight-node diagram (it does not
fit beside two envelopes) and the breadcrumb (`Part 1 › OP3` loses the topology, which is exactly what
matters). What is there is **your branch and only your branch**: who modulates you, you, and who you
modulate, with the real algorithm's arrows and everything else reduced to a note. Plus the **rail of
the eight** in the header — eight 32 px targets carrying their role's shape (pill = carrier, live
corner = modulator, dashed = at zero) — which is context and navigation at once.

**2. Hierarchy in the composition, not in tabs.** What gets touched every minute takes 78 % of the
height: Level as a 190 px knob with the value in its centre, the **two envelopes full-width** with
`--grip-curve` points, and the spectral form as seven drawings. What is set once lives in a **172 px
bottom strip whose label says so** (`SET ONCE, THEN FORGET`): Level Scaling over the keyboard, the
bipolar Detune, and four chips for Time/Key, Lvl/Vel, Pitch/Vel and Key On Reset. **Present and
touchable, small because they are** — zero tabs.

**3. The finger covers what it drags.** The active point's value appears in a pill **above and to the
side**, never under the point; the knob's lives in its centre. Written on the screen itself so it does
not get lost in implementation.

**4. Skirt appears disabled, not absent**, because the form is Odd 1 and only Res 1 / Res 2 enable it.
And it is **eight bars of increasing width**, not a knob: the range is 0-7.

**The Freq Mode warning** is didactic and not an error: with Fixed, Coarse and Fine **do not change
value, they change meaning** — from multiplier to hertz — and the keyboard will also **move the
Coarse**. Measured in phase 0c.

**The trap avoided**: in ALL EIGHT it was the spreadsheet; here it is the property column. There is not
one `label: field` list anywhere on this screen.

## 16 · The SysEx console and the bench drawer (`5c`)

A drawer, not a screen. It opens from a chip in the header and **unfolds over the bottom strip without
replacing the screen behind it**: you have to see the verification while it happens, or you cannot see
the cause.

- **By default it is not a log**: it opens on the **unconfirmed writes**, each with its human sentence,
  the bytes that were sent, what the keyboard returned, and its `REPAIR AND VERIFY`.
- **Full traffic is the second tab**, never the first thing.
- **Three stable figures** and nothing else: median, p99, lost. No live counters, no graphs.
- **It records each repair with who overwrote whom** (`48 00 52` → `48 00 48`), which is where any
  missing pairs would show up.
- **The header chip only calls when there is something**: neutral when nothing is pending, in alert
  with the count when there is.
- **The didactic bonus**: the eleven bytes **decomposed and labelled** (`F0` start · `43` Yamaha · `10`
  write · `7F` to all · `1C 07` MODX · `49` operator · `20` op3·part1 · `1A` Level · `5A` = 90 · `F7`
  end) beside "OP3 · Level = 90". It is the app's only lesson in **how it talks** to the keyboard.
- **What it is NOT**: the home of `Receive Bulk`. That is a failure with a consequence and lives in
  §13. Here only what is repaired with one touch.

### 16.1 · The bench drawer — one home for every temporary instrument

The bridge, startup, audio and port readouts (#16, #5) and the sweep readout (#8) are declared
temporary and are the largest blocks of text in the app today — five of them in the running build.
They do not need a design each; they need one affordance, and this drawer is it, generalised.

- Same `--drawer-grab` (52 px) handle, same `--drawer-lift`, same phosphor top edge, same rule about
  opening **over** the bottom strip — you have to watch an instrument while the thing it measures
  happens.
- **One chip per instrument on the handle, wearing its ticket number.** That is the point of the whole
  affordance: a panel labelled `#5` is visibly on its way out, so nobody designs around it, and closing
  the ticket has an obvious consequence — the chip disappears and the drawer gets one item shorter.
  When the last one goes, the handle goes with it and no layout is rethought: it was always 52 px on
  the outside. **The numbers in `8g` are illustrative** — `#16`, `#5` and `#8` are the phase-1
  defaults the sheet was drawn with, and what a chip actually wears is the number of the ticket that
  retires it.
- **Each chip has a retirement condition, and it is not "the end of phase 1".** An instrument retires
  when the question it was built to answer is answered *and written somewhere permanent*. That is what
  makes the number on the chip mean something rather than decorate it:

  | chip | retires when |
  |---|---|
  | **SWEEP** (#43) | the `op` / `part` addressing rule (`op<<4` plus the part index) is confirmed on a Part other than 1 and the result is written into `CONTEXT.md` |
  | **BRIDGE** (#44) | the capture path is trusted end to end: the scope contract and the harmonics rule are closed and `CAPTURE` fills the figures column on demand |
  | **STARTUP** (#45) | the copies screen lands, where the safety dump's size, time and state are drawn (the reread already has its designed strip) |
  | **AUDIO** (#46) | the check screen lands, where `Line (MODX) · 2 ch · 44 100 · peak · floor` is a designed datum |
  | **PORT** (#47) | the check screen lands **and** no pending measurement needs the polling switch or the note generator |

- **The chips are tabs: one instrument is on screen at a time.** That is what `8g` draws — one chip
  lit, one body under it — and it is what lets the open handle carry a retirement line that is only
  true of one panel. It also keeps retirement a **deletion** rather than a refactor: closing a ticket
  removes one case and one entry, and nothing else moves.
- **Nothing inside the drawer is rendered while it is shut.** Not hidden — absent. A readout nobody
  can see is still work done on every pass, and these are fed at the audio rate. It is also what makes
  "the body regains the height the readouts took" structural rather than a stylesheet promise.
- **The ticket number sits at the type floor (10 px), like the instrument's name, and steps down in
  ink rather than in size.** `8g` sets it a pixel smaller; a number whose whole job is to say which
  ticket to close is read, and §20 rule 17 puts the floor for anything read at 10 px.
- **The SysEx console is the one chip with no ticket**, because it is permanent. That is how you tell
  the one that stays from the five that go.
- **Closed by default**, and nothing inside animates or counts up. Nothing in a drawer competes with
  the signal.
- **Alert behaviour belongs to the console alone.** An unconfirmed write is a consequence and calls for
  attention; a bridge log with 0 drops has nothing to say and stays neutral and quiet. A temporary
  instrument that nags is a temporary instrument nobody closes the ticket on.
- Any future instrument docks into the same handle.

## 17 · The sound changing underneath (round 6)

The starting point is a zero measured twice: **loading another Performance emits not one byte** — no
Program Change, no Bank Select, no SysEx, with both switches `ON`, in raw mode, and with the Part name
verified inside the window. The app has no event. It polls the Part 1 name (`31 00 00`–`13`, 20 ASCII
addresses, ~40 ms) at **1 Hz**, and everything else follows from that.

### 17.1 · The anchor (`6a`) — the Performance name, promoted to data

**It is not new furniture.** The patch name was already in the header; what changed is that it is now
the thing everything else is judged against, at a deliberately low weight: 17 px of primary ink.

**In rest it is the name and nothing else.** A non-debugging user needs the name, and only when it
changes. The poll rate and `31 00 00` are debug provenance and live in the check screen (§13), which
the anchor already opens on touch. **Three states**, and none of them is a dialog:

1. **Rest** — a stable name. It does not compete with the algorithm or the transport.
2. **Just changed** — the new name **with the old one struck through beside it** (so it is clear what
   happened), the 2 200 ms change flash that is already used when the tutor writes, and **everything
   polled put on hold**: algorithm, feedback, chain.
3. **Reread** — the header **does not go back to rest**: it stays at `NOT MEASURED IN THIS SOUND`,
   because polls recover by themselves and captures do not.

### 17.2 · The moment of the change (`6b`) — what dies and what does not

The rule that orders the screen, and it is the design decision of the whole round:

- **The map dies** (polled): the eight operators, the algorithm, the chain. A pending operator **keeps
  its shape and loses its figure** — neutral outline and a dash. Nothing is dimmed with opacity.
- **The capture dies**: it belonged to another sound. And **it does not recover by itself**, because
  nobody can capture again without a note sounding. The figures column shows no zeros: it shows dashes
  and `NOT MEASURED IN THIS SOUND`, with its button.
- **The live view never dies.** It is audio arriving right now. Scope and spectrum stay in phosphor
  with their `STILL TRUE · THIS IS AUDIO` chip. What disappears from the spectrum is **the Bessel
  curve**: there is no I until there is a capture.

Three things that are **not** done: numbers are not silently replaced (a 90 that jumps to 64 without
passing through the dash is indistinguishable from a value the user changed by hand); there is no
"reread" button (the app already knows it has to reread; the count is shown because it costs ~0.9 s,
not because there is a decision); and it does not block, because nothing was in progress.

### 17.3 · Voided, not paused (`6c`)

**Blocking when there is live state, not blocking when there is none** — and blocking means the warning
anchors to the thing that broke and takes away its actions, not that a modal appropriates the screen.

The asymmetry that governs all four exits: **the app can write parameters but cannot load
Performances**, so recovery is never "I will fix it for you".

- **Sweep** — the map is drawn with a **cut vertical** in alert and the label `THE SOUND CHANGED HERE`;
  steps 6–8 are an inert dashed line. **There is no "resume"**: three exits — keep the 5 marked as
  belonging to another sound, start over (~25 s), discard. And Level is already back where it was,
  because the sweep saved a copy before the first step.
- **A/B** — A and B are no longer the same patch with one parameter different, which was the entire
  premise. See §14.
- **Lesson** — the finished steps describe a sound that is not loaded, and the app cannot fix this. So
  it says **exactly what only the user can do**, with the literal path
  (`[PERFORMANCE] → [Category Search] → Init Normal (FM-X)`). As soon as the anchor sees it, the lesson
  continues where it was.
- **Copies** — see §6.

A voided figure **keeps its shape and loses its figure**, marked with a dash. **The dash is the stamp**
— see §20.7.

### 17.4 · Read-only (`6d`) — the console's third failure mode

`30 4B 00` (the Super Knob) can be read, it transmits, and it **will not accept a write**: it was sent
`20` and `60`, and returned `3F` both times, with no error. Over an address like that,
`REPAIR AND VERIFY` is a button promising the impossible, and an app that retries by itself is a loop.

- **Its own state**, in **dashed amber and not in alert**: it is not broken, it just cannot be done —
  the same register as the Freq Mode warning. Said with the honest sentence: *you look, you do not
  touch*.
- **It is reached by experience, not by catalogue**, because the Data List does not mark them and **the
  keyboard cannot be asked**: reserved addresses answer a read exactly like real ones. So the app
  **learns it and writes it down**: `WHAT THE APP HAS LEARNED`, with the address, the sentence, the
  attempts and the date. Two tries and stop.
- **It remembers, and re-probes once per session** — a write and a read-back cost ~4 ms, so there is no
  need to choose between freezing a conclusion and paying for a failure every session. The re-probe is
  silent when it confirms (the app already knew; that is not news). If the address **does** accept, it
  leaves the list and that *is* reported, with a card in `UNCONFIRMED`: the app had learned something
  false and has just corrected itself. An entry that survived a re-probe carries a 9 px
  `RECONFIRMED TODAY` pill — a mark, not a line of prose.
- **The reserved addresses from the paper** (`48 0p 51–55`) are written beside it, marked as what they
  are: a list that comes from the document and not from the instrument.
- **Vocabulary of the observable control**: if the Super Knob appears on screen it is the usual knob
  **with no grip mark**. The arc and the figure stay (the value is true and arrives by itself); what is
  missing is the handle, and its absence **is** the state. Chip: `SENDS · WON'T TAKE`.
- It is **the only thing the MODX notifies**: with `Super Knob CC = off`, 635 SysEx in 25 s. The
  Parameter Change transmitter exists and works — the zero on a Performance change is not a limitation
  of the keyboard, it is a decision by Yamaha. That changes the explanation, not the architecture.

### 17.5 · Confidence grades (`6e`)

One capture per step (~25 s for eight) and **a second pass only over the doubtful ones**. The map is
drawn **complete**: a doubtful point is not a hole, it is a **hollow circle with a dashed halo** in the
same amber as prediction, **and it is on the curve**. When a step comes out doubtful is a calculation
(a partial less than 12 dB above the floor, or less than one step from a zero of the fitted `|Jₙ|`),
not a threshold the user sets. A refined point shows `×3 AVERAGED` **and its spread** (`−43.8 ±0.6`):
without the spread, three averaged captures are exactly as opaque as one.

## 18 · Following (round 7)

**No new screen, deliberately.** Following is behaviour, not surface: it lives in the editor's rail
(`7a`) and in the ALL EIGHT cards (`7b`).

The keyboard **notifies nothing about navigation** (phase 0d, verified raw): changing the focused
operator, the page or the Part emits not one byte. But the watch set already being polled is **40
addresses — five parameters across the eight operators**. If `49 60 1A` moves in one round, the app
does not know you are looking at OP7: it knows you **just touched something on OP7**, which for what
matters is better. Following costs not one extra request.

### 18.1 · The rail that follows you (`7a`)

- **A `FOLLOW ME` switch**, with a drawing of what it does (a key, an arrow and the rail's dot), in
  phosphor because following is reading an incoming signal. At rest it **says nothing else**: no
  counter.
- **Suggestion, not jump.** The rail marks the operator with activity (a beating phosphor ring) and a
  band offers `GO TO OP7` / `STAY HERE`, both 44 px. The reason is not reversibility — the rail already
  gives that — it is that **a gesture cannot be interrupted**: a focus jump halfway through dragging an
  AEG point breaks the curve mid-stroke.
- **The sentence does not promise what cannot be known**: never "you are on OP7", always "you just
  touched something on OP7", with the address and old → new value. **It detects changes, not visits.**
- **Its own writes do not count as yours**: a change coinciding with a pending read-back is not the
  user's — the *pending → reread → confirmed* cycle already tells them apart. When the tutor writes,
  focus **does not move**.
- **One suggestion at a time, the last one**, and it clears itself after 6 s. Five changes across five
  operators are one band and five marks on the rail, not five warnings.

### 18.2 · ALL EIGHT as a mirror (`7b`)

Here following **does not move focus** — all eight are already on screen — so it **leaves a trace**:
each card says what you touched, from what to what and how long ago (`LEVEL 56 → 71 · 0.3 s AGO`), and
in the Level column the old value stays as a **dashed mark**. It is not a history: it is the last
gesture. The others say `NOTHING FROM YOU`, which is information and not a hole.

**Provenance of a change uses the vocabulary that already exists**: phosphor for what comes from
outside (your hands, like every measured signal), cyan for what the app wrote
(`THE TUTOR WROTE THIS · 3 min`). Not one new colour, and it reads without a legend. This is BUILD mode
in its purest form: the user makes the sound by hand and **the app is the mirror**.

### 18.3 · The two rings — and the consequence that gets said

To know where the hands are you have to watch all eight; to keep the open operator current you have to
watch its 43 parameters. Two sets with two cadences, **and they share the channel**: the wide ring
drops to roughly half rate with an operator open. So **opening an operator slows following down**, and
that gets said.

- **Stale is four times the period of its own ring.** The rule is what matters and it is written as a
  rule, not as two numbers, precisely so that a corrected poll rate does not invalidate it.
- The cadence is labelled **once per zone, in its header** (`ALL EIGHT · 10 Hz`), not on every figure.
- **No new badge.** A second stamp on every number would be exactly what was rejected for the tempo.

---

## 19 · Interaction: finger and mouse

**Touch as the base case, mouse as a superset.** One design for both pointers; there is no "touch
mode" and no "desktop mode" to maintain separately. The left hand is on the MODX.

1. **Targets**: minimum `--hit-min` 44 real px for anything actionable; `--hit-touch` 56 px on controls
   used by touch often; minimum separation `--hit-gap` 8 px. On this panel 44 CSS px ≈ 9 mm physical:
   nothing needs inflating.
2. **Nothing depends on `:hover`.** Not for discovery, not to show a value, not to reveal a control.
   The pattern "move over the knob and the number appears" is forbidden: the value is **always visible**
   or appears **on touch**.
3. **The finger covers what it drags.** On knobs, sliders and curve editors the value and the active
   point go **above and to the side** (`--value-offset`), never under the point. The drag point is drawn
   at 22 px (`--grip-handle`) with a 44 px grab zone (`--grip-hit`).
4. **No right-click as the only route** and **no hidden gestures**. If there is a context menu or a
   gesture, it is a shortcut for something that already has a touchable button.
5. **Hover exists, as refinement**: it highlights, previews, or brings forward a breakdown that also
   opens on touch. It is never the only carrier of a value, a control or a state.
6. **Mouse extras, always an additional layer**: wheel for ±1 on a knob, a modifier for ×0.1 fine steps,
   double click to return to the default, keyboard shortcuts for `CAPTURE` and for switching views.
   Removing the mouse removes no function.
7. **No double tap for anything destructive.** Overwriting the user's patch always goes through the
   warning with a snapshot.

## 20 · Rules an implementer must respect

**Vocabulary**

1. Carrier and modulator are told apart **by shape before colour**: `--radius-carrier` (fully curved) vs
   `--radius-modulator` (live corner). Never two nodes with the same radius and different colours.
2. **Level is the length of the luminous fill along the axis its composición declares** — its height
   in the narrow grid, its length in both wide boxes, the stacked node and the batten alike — linear
   0-99, against the shared ceiling datum (§9, ADR-0008 §2.1). The axis is never inferred from the
   box's proportions. The mono figure is confirmation. The fill's scale is the node's **track** —
   its interior less a constant inset at the far end of the carrying axis, `levelTrackInset()` — and
   not the card itself, so that a Level at the top of the range still leaves the ceiling datum
   somewhere to be drawn (§9, #67); and **one Level point is never drawn smaller than 1 px on the
   axis that carries it** (`PIXELS_PER_POINT = 1`, `node-geometry.ts`; ADR-0008 §5). Level 0 is not
   painted grey: dashed outline, no fill, and in the grid the route leaving it dashed too — the wide
   composición is rule 19's.
3. A continuous parameter **has no `input type=number`**. A circular knob (vertical drag), a bipolar
   control with a visible centre (`--track-bipolar`), or a draggable point on the curve. The number is
   shown next to the control, never in its place.
4. **A disabled control is NOT dimmed with container `opacity`.** It is drawn with the same vocabulary
   as everything else inactive — **dashed outline + `--inert`, at full opacity** — and its explanatory
   text stays at `--ink-tertiary` or better. Container opacity multiplies over every descendant and
   takes the prose down with it: an 11 px label at 0.45 drops below 2:1 contrast and stops being
   readable. Inactive has to look inactive **and stay readable**. Fractional opacity is legitimate only
   on **signal strokes** (out-of-focus trajectories in `5b`, ghost curves in `4`), where there is no text
   inside. *(A mode with no code behind it is a different case — it is absent, not disabled. See §3.1.)*
5. **Freq Mode, Spectral Form and Curve are chosen by drawing.** The Freq Mode toggle is the exemplar:
   two drawings, one lit. Spectral Form is seven touchable spectra; Skirt and Resonance modify the
   selected drawing live. No `<select>`, no tooltip as the only label.
6. The two envelopes (PEG `49 op 0C-0F`, AEG `49 op 10-18`) are edited **by dragging points on the
   curve**, with the key-off mark visible. Times appear as labels under the curve. Level Scaling is **a
   curve over the keyboard**, with the Break Point over the key and the keyboard drawn below (its own
   scale, base A-1, not MIDI).

**Honesty of the datum — this is acceptance criteria, not aesthetics**

7. **Every figure carries its provenance, in four words and two shapes.** The four words are four
   different **sources**, and no shape distinguishes a provenance claim:

   | state | word | shape | colour |
   |---|---|---|---|
   | measured | `MEASURED · 65536` | solid outline | phosphor |
   | predicted | `PREDICTED` | **dashed** outline | amber |
   | polled, fresh | `POLLED · 10.4 Hz` (once per zone) | solid outline | cyan |
   | documented | `DOCUMENTED` | solid outline | **neutral — paper has no colour** |
   | polled, stale | `POLLED · 0.40 s` | **broken** outline | cyan, dimmed |
   | void | — (a dash) | kept outline, no fill | neutral |

   **Stale and void have no word**, and that is deliberate: stale is `POLLED` plus age and both halves
   are already drawn, while a dash inside a kept outline already *is* the void stamp. Writing a word
   next to a dash labels a blank and puts uppercase text exactly where the eye is hunting for a number.
   Where void has to be said in words it is said **once per zone**: `NOT MEASURED IN THIS SOUND`.
   **Line styles never mix.**
8. **`LIVE` and `CAPTURE` are two acts with two controls.** The live view beats; the capture is a
   shutter you press that leaves a stamp with its FFT size and its age. A measured number that blinks
   on its own is forbidden.
9. Anything not at a predicted partial is **marked** `NOT A HARMONIC` with its frequency, in a dashed
   alert stroke. Never hidden, never counted as a harmonic.
10. Where prediction does not match measurement, it is **boxed and explained** in one sentence. That is
    the lesson, not an error to cover up.
11. Every write to the keyboard is shown **verified by reading back** (`✓ read back` per parameter). An
    unconfirmed write is painted in alert, not in green. And that verification has a place where it
    **can be seen happening**: the drawer of §16.
12. **No probe leaves the user's patch touched.** If a check needs to dirty a parameter, the order is not
    negotiable: back up → dirty → verify → test → **and restore by whichever route actually works**,
    including (especially) when the test fails. Preaching against silent failure and then committing it
    is worse than not preaching.

**Drawing and performance at DPR 1.5**

13. Signal, diagram, curves and grids: **vector (SVG) or canvas scaled by DPR**. No fixed-size bitmaps;
    at 1.5× they blur.
14. **1 px hairlines are forbidden**: rules at `--rule-min` 2 px, or better, separation by surface colour
    and air (`--rule-by-space`). In SVG, `vector-effect: non-scaling-stroke` so the stroke does not
    fatten when the viewBox stretches.
15. Nothing animated competes with the signal: only the `LIVE` heartbeat (`--dur-heartbeat`) and the
    flash for "the tutor just wrote to your keyboard". State transitions ≤ 180 ms.
16. No UI operation may cost more than `--frame-live` (33 ms). If a panel does not fit the budget, the
    panel is simplified.
17. Type floor `--text-micro` 10 px **for anything a figure is read from**. The grid and axis labels
    may disappear; the figures may not. **Three labels sit at 8 px on purpose** and are the whole list
    of exceptions: the node's role word (`CARR` / `MOD` / `ZERO`), the mode's roadmap line (§3.1) and
    `HUSH`'s own label. None of the three carries a figure — each names a thing that is also drawn —
    which is the test. The token's comment used to call 10 px an absolute floor with nothing below it,
    and that comment was the thing that was wrong: it is corrected in `design-tokens.css` rather than
    the design being bent to match it.

**The drawing's own labels and lines**

18. **A label is never painted over by a node.** It is anchored at its near edge one bulge past the
    box and aligned away from it, never centred over an edge; where a neighbour stands to the right
    in the same row it is lifted into the gap above (`.label` in `operator-diagram.scss`;
    `feedbackArc()` in `wide-layout.ts`). A figure the ring went and read may not be half-covered by
    the drawing it belongs to (#68).
19. **A documented route is always drawn where it can be, and the ink says whether it carries** —
    solid when signal passes, inert dash when not, the vocabulary `FB 0` already uses (#57). A route
    *into* an operator parked at zero is drawn inert onto its stub bar; a route *out of* one is not
    drawn in the wide composición. **Two facts, two predicates** (`sends()`, `deadEnds()`). The
    asymmetry is **geometric**: parking has moved the operator onto its bar, so inbound edges land
    where it lives and outbound edges would run back into the chain it was removed from. The cost is
    stated: an outbound route is a documented route the drawing does not show, acceptable because
    the drawing is of the algorithm as configured (ADR-0008 §2.5). A live modulator into a silent
    destination must never read as less connected than a silent operator (#70).
20. **Every gap a line lives in holds its arrowhead plus a visible segment.** The threshold is
    derived, not chosen: `rowGapFloor() = ARROWHEAD + VISIBLE_SEGMENT / yScale`, evaluated at the
    body's floor, and the depth at which the gap can no longer be floored is where the drawing folds
    (§10). **The visible segment is 6 px, chosen and looked at** — look 4, ADR-0008 §8 — with 0.06
    px of margin at five rows (ADR-0008 §4).

## 21 · What I decided **not** to do

- **No settings sidebar.** Every parameter lives next to the thing it changes — inside the node or on
  its curve. The moment a "properties" column exists, the app is an office app. Applied with full force
  in ALL EIGHT: **no cell holds a bare number**, every value carries its shape.
- **ALL EIGHT is not the operator editor.** Five facts per operator, not 43. When parameter 12 is needed
  the editor opens — having both is what avoids the grid.
- **The Part has no Arpeggio, Motion Seq, Part LFO, Control Assign or Receive SW.** They do not affect
  what is measured; that screen's criterion is "warn", not "expose all 86 offsets".
- **No EQ or insert editor.** They appear as state (flat / Thru) because the only thing that matters
  about them is whether they are in the way.
- **The diff is not a `git diff`.** No columns, no ± per line: groups with a human sentence and drawn
  evidence. Identical parameters are not listed.
- **The warm sub-register never enters a measuring surface.** Serif and cream ink only on what is read
  to understand; every measured figure stays in mono and phosphor, including inside a lesson.
- **No small breakpoint and no embedded layout.** One canvas, 1280×800, scaling upward. Designing for a
  screen we are not going to only flattened decisions.
- **I have not drawn the 88 algorithms.** The diagram is a layout by chain depth that serves any
  topology read from the keyboard; drawing 88 plates is data work.
- **No routing matrix and no algorithm editor.** The algorithm is a number that gets written and the
  engine applies.
- **No light theme.** An audio app with a keyboard in front of it is not looked at in white.
- **No rack skeuomorphism**: no screws, no brushed metal, no leather.
- **No hand-drawn iconography** beyond primitive shapes (circle, diamond, line, arc).
- **No 3D waterfall.** The flat ridgeline teaches more and perspective lies about amplitudes.
- **No tooltips as carriers of information.** With a finger they do not exist.
- **No DX7 corpus and no patch library.** Declared as the last phase.
- **No settings surface for the temporary instruments.** The bench drawer holds them; it is not a
  developer panel and it does not grow options.

---

## 22 · The language move, and what the running build corrected

Two things in this document have no earlier home, because they are not about a screen.

**The product is in English, and it was a naming pass rather than a translation.** The reason was never
internationalisation: after using the running app the owner still could not say what `TEORÍA` meant on
an operator node, and `THEORY` would have been exactly as opaque. So each term was re-derived from the
fact its number represents. The reasoning per term, and the complete rename list that running code
follows, is `GLOSSARY.md`. The four decisions that carry the most weight:

- **`PREDICTED`**, because it is the only candidate that implies the number **can be wrong** — which is
  the entire reason for stamping it.
- **`LIVE` / `CAPTURE`**, a state and an act, so the grammar separates them before the reading does.
- **`HUSH`**, because *panic* named the user's emotion where everything else names what happens.
- **`DOCUMENTED`** as a fourth provenance source: the routes come from Yamaha's table, which is neither
  polled, nor measured, nor arithmetic.

**The running build corrected four of my figures and one count**, because mine came from the phase-0
spikes and the app is measuring its own reality:

| where it appears | spike figure | the running build |
|---|---|---|
| noise floor | −104 dB, relative to the peak | **−58 to −66 dB**, relative to the peak |
| wide ring poll rate | 12.2 Hz | **10.0–10.4 Hz** |
| reread set | 416 addresses | **384** requests |
| bulk dump | 7 669 B | **19 003 B in 123 messages** |
| temporary readout blocks | three | **five** |

The one with a design consequence: round 7's stale thresholds were derived from 12.2 Hz, so at a real
10 Hz the wide ring's threshold is **0.40 s** and the narrow ring's **0.80 s**. **The rule survives
untouched** — four times its own ring period — which is exactly why it was written as a rule and not as
two numbers.

**On the floor: it was never two formulas, it was two signals.** There is one floor computation —
median of all bins, Hann 4096 — and −104 is what it answers on the golden WAVs offline while −58 to
−66 is what it answers on the live USB stream. Both are right for what they were measured on, and the
figures in this table are quoted **relative to the peak**, which is how the spikes reported them.
**The word `FLOOR` on screen means absolute dBFS** (§8.2), so a figure from this table and a figure
from the app cannot be compared until the peak is added back. And the floor is not what decides the
non-harmonic chips: the generator's comb sits *below* the live floor and the chips still fire,
because the partial picker has its own absolute threshold and never consults this number.

**On the reread: 384 is the total, and 383 is the answered count.** The token and the readout are the
number of requests the build issues; exactly one of those addresses answers nothing, which is
documented here rather than hidden in an off-by-one. Anywhere the reread *set* is quoted, it is 384.

**Where the build and the spikes disagree, this document follows the build**, because the build is
measuring the instrument that is actually on the desk. The spike figures are kept in this table rather
than deleted, because they are what the earlier rounds were reasoning from and a reader who finds the
old number somewhere should be able to see that it was superseded and not invented.

**Session 2 applied all of it to `design-tokens.css`**, in both copies of the file and identically:
`--probe-idle` 12 → 10, `--ring-wide-hz` 12.2 → 10, `--stale-wide-s` 0.33 → 0.40, `--stale-narrow-s`
0.66 → 0.80, `--reread-total` 416 → 384, plus the two ceiling-datum tokens the round proposed. **No
value in either file is stale and no marker is left**, so the precedence exception `README.md` carried
for them is gone: the token file and the prose agree. See `CONCERNS.md` §29, resolved.

## 23 · Viewport

**1280 × 800 CSS px at 150 %**, ~1280 × 740 usable. Unchanged, and every screen in this folder is
authored to it — including the algorithm surface of §10, which fits 1280 and takes what the ranuras
leave it (ADR-0007).

The question of moving the target to 125 % (1536 × 960, roughly 40 % more area) is **deferred by the
owner**. Nothing in the current design assumes extra room, so nothing has to be redrawn when that comes
back; the argument and its one cost are on file in `CONCERNS.md` §32.

## 24 · Provenance of the data

`modx.md`, `datalist_fmx_tables.md`, `rm_pantallas_fmx.md` and `fase0c_RESULTS_mapa.md` are the sources
for every value, SysEx address and technical phrase in these mockups. Where a figure from the running
build contradicts them, §22 governs.

Three data errors of mine were found and corrected when the sources arrived, and they are worth keeping
because each one changed a control:

1. **Spectral Skirt is 0-7, not 0-99** (`49 op 0A`). Consequence: Skirt **is not a continuous knob** —
   it is eight positions, drawn as eight skirt widths.
2. **Filter Cutoff is 0-255 in two bytes** (`48 0p 0C`), not hertz, and Resonance is 0-127 (`0F`). The
   readout is the parameter; the curve's axis is still frequency.
3. **The FEG level is bipolar in cents**, ±128 → ±9 600 ¢. Labelled `+52 · +3 931 ¢`, which is what it
   does to the spectrum.

What is **still plausible invention**, and it is the short list:

- The dirty-example values (cutoff 178, res 42, FEG +52, Amp Mod 18, C1–C6, vel 22–115) and the eight
  AEG times. They are **inside the documented ranges**.
- Op5–Op8 of the example patch. Still only Op1 99, Op2 0, Op3 90 ×1.41 and Op4 99 are measured.
- **The content of the nine lessons.** The master doc leaves the course undecided; the titles follow the
  conceptual order of the sources.

One warning from `fase0c` that the design must respect: **the `al` map is only semantically verified on
Op3**; outside it, only `1A`, `06` and `17`. ALL EIGHT treats the eight operators as equals —
structurally they are (43 identical offsets) — but if one operator behaved differently, that screen is
the one that would make it visible first.

The curves are not decorative: the waveform is `sin(2πt + I·sin(2π·2t))` with I = 2.8, the spectrum is
the `|J_n(I)|` amplitudes at `1 ± 1.41n` and `2 ± 7n`, and the waterfall is the frames of an actual
capture with the index decaying.

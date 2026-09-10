# Round 10 — the wide drawing, decided as one thing

A **proposal**, re-based on `52eb91b` ("The fill measures against a track, and the ceiling stops
hiding in the border", #67) and on the canonical handoff. Nothing here is implemented, no ticket is
opened, and the two known defects are folded in as constraints rather than fixed. The drawings are
`Round10-operator-diagram.dc.html` (`10a`–`10f`).

**Language and precedence.** English, and where this document and an older one disagree, this one is
later — except on figures read out of the build, which win over everything.

> **The one fact in this round that needs no appeal to taste:** #67's track costs the fill **a third
> of its range** — 11.6 px of scale at the body's floor — so 99-against-96 collapses to **0.35 px**.
> Two rules, each individually correct, bidding for the same 23.6 px, and the winner starves the loser
> to a third of a pixel. Everything below is the consequence of that.

---

## 0 · The re-base, and what it costs this proposal

The first version of this document was written against the tree at `9be470b0` and against
`modx/design/DESIGN.md` as it stood after round 9. Both moved. **Two of its three opening findings
were artifacts of reading a stale pair, and they are retracted here rather than quietly dropped.**

**Retracted — "#67's geometry is not in the build."** It is. `52eb91b` landed `TRACK_INSET = 8`,
`DAYLIGHT_FLOOR = 6`, `node-geometry.ts`, the verdict note, and the §20.2 refinement that separates
*Level is the height of the fill* from *the fill is the card*. The finding was true of the tree I
read and is not true now. This is a **better** position for the proposal, not a worse one: it is no
longer adding an inset to a build that lacks one, it is **deleting one that exists and was judged on
screen**. That is a heavier thing to propose and §7 carries it accordingly.

**Retracted — "§10's worst case is behind #40."** The canonical §10 was corrected in session 2 with
the histogram's real maxima; the copy I was reading was 181 lines behind, still saying *up to 6 depth
levels with up to 4 parallel branches*, and still carrying a dangling `§16.4` cross-reference to a
section that has been §20 for two rounds.

**And the cause is the defect this issue set is named after, one layer out.** Both bad findings came
from reading the fossil: a claim that was true about the artefact in hand and false about the thing it
was a claim on, **with nothing failing at the moment it stopped being true** — which is exactly
`bottom: 99%`, and exactly the `textContent` assertion that stayed green while the legend clipped. So
deleting the loose copy (§9) is not housekeeping in this diff; **it is the fix for the defect that
produced two of my three opening findings**, and it is the sentence that stops someone re-creating
that copy next month.

**Stands — the ceiling datum has never been one line across the eight.** It is one `.node__datum`
per node at the same *relative* offset, and `operator-diagram.spec.ts` asserts eight of them. In the
3 × 3 grid that puts the mark at three different heights; in the wide drawing, at eight. #67 gave
that mark its daylight and did not change what it is, so §9's sentence — *one shared ceiling datum, a
2 px dashed line drawn across all eight nodes* — still describes an object that has never been on
screen. **This is the finding that opens the ADR**, and it corrects the objection as much as the
prose: *eight edge ticks would not align into a common rule* was never an objection to rotating, it
was an unnamed description of what ships.

### What #67 changed about the case for rotating

The track is the right fix and it **costs the fill a third of its range**, because both rules are now
bidding for the same 23.6 px:

| | pin down (measured) | boot, both ranuras empty | at `BODY_FLOOR` (378) |
|---|---|---|---|
| card, outer | 320 × 34.5 | 302 × 34.5 | 302 × 23.6 |
| track (fill's scale) | 22.5 px | 22.5 px | **11.6 px** |
| datum daylight at ceiling 99 | 6.2 px | 6.2 px | 6.1 px |
| one Level point, vertical | 0.225 px | 0.225 px | **0.116 px** |
| one Level point, horizontal (inset 6) | 3.10 px | 2.92 px | 2.92 px |
| 99 against 96 | 0.68 px | 0.68 px | **0.35 px** |
| 71 against 99 | 6.3 px | 6.3 px | 3.3 px |

Card geometry from `wide-layout.ts` at algorithm 66 — `pitchY 44`, `rowGap 11`, `nodeH 33`,
`nodeW 380`, so the card is 30.84 % × 8.25 % of the 1232 × 400 box — and confirmed against the
hardware shot (card 320 px, row pitch 46, hence canvas 1 034 × 418). Track and daylight from
`node-geometry.ts`: `trackHeight = card − 4 − 8`, `datumDaylight = 8 − (2 − 0.01·T)`.

**The floor column is corrected here too, and by the same kind of error.** I had the floor card at
24.75 px from an estimated 78 px of zone chrome; `node-geometry.ts` states it — `floorCanvasHeight()
= 378 − 12 − 18 − 8 − 54 = **286 px**` — so the card is **23.6 px** (which is the "roughly 24 px" its
own comment quotes), the track 11.6 and one Level point 0.116 (`T/100`, which is how the fill is drawn). Every floor figure below moves with
it, and the conclusion gets slightly worse rather than better. The y-scale at the floor is 0.715, not
the 0.75 I used.

**The resolution figure is the consequence, not the case.** The case is that the vertical direction
is carrying two different quantities: **across** nodes it means depth in the chain, **within** a node
it means Level. Those were never comparable numbers, and every symptom of this week is that overload
surfacing — the datum hiding in the border, the squat batten, the eight coincident strokes the eye
was asked to join into a rule, and now a fix for one of them taking a third of the other's range.
Rotation gives each direction one meaning: **vertical is depth, horizontal is Level.**

---

## 1 · Decision 1 — Level turns onto the axis its composition states

**Decided: in the wide composition Level lies along the axis that composition states — its length,
in both of the wide boxes (§2.4) — and the ceiling datum is a vertical rule. The narrow grid does not
change at all.** Drawn at `10b`, candidate C.

The argument is the one above: one direction, one quantity. The numbers follow from it — 0.35 px per
comparison becomes 8.8 — and so does the datum, which becomes a single object **wherever the cards
share a column**: they are the same width and measure from the same left edge, so the marks line up
into one rule. That is the deep case, and it is the case the datum was always failing hardest in.
Where the wide drawing puts cards side by side in bands it stays what §0.1 says it has always been —
a repeated mark on identical boxes — and the corrected §9 says so in those words rather than
promising a line that only some compositions draw.

**#67's derivation turns with it and its criterion survives.** On the new axis
`I = d + DATUM_STROKE − 0.01·T` gives a trailing inset of **6 px** and daylight of **6.9** — the
judged 6 px met with a *smaller* inset, because the last percent of a 292 px track gives back 2.9 px
instead of 0.13. What retires is the number 8, not the reasoning that produced it.

**Rejected — a tick outside the card** (`10b` B): the ticks still sit 0.35 px apart, because the axis
did not change, and it spends the gutter the routes need. **Rejected — keeping it vertical** (`10b`
A): correct, visible, and unreadable — the fill's scale is 11.6 px at the floor.

**What it costs.** ADR-0007 §3's *the node travels entire* survives: one component, one template,
five facts, one legend, and the legend's datum swatch is a dash with no orientation to contradict.
§20.2 is edited, and #67 has already done the hard half of that edit — it separated the claim (*Level
is the height of the fill*) from the accident (*the fill is the card*). This separates the same claim
from a second accident riding underneath it: *the height*.

**What I cannot settle on paper.** Whether a horizontal bar still reads as loudness. That needs the
rotated node on the hardware beside the grid.

## 2 · Three conditions on the rotation

All three are about not rebuilding the same failure on the new axis. Drawn at `10f`.

**2.1 · One origin, one scale, asserted as geometry.** The rule is only a rule if every batten
measures from the same left edge at the same px per point; one indented or narrowed batten and it is
a coincidence again, silently — exactly as `bottom: 99%` was silently correct. So it is an invariant,
and the assertion is that **the rule's box crosses all eight battens at the same fraction of each**,
never `element-exists`, which is the check that stayed green for the whole life of the old defect.

**2.2 · Px-per-point needs a floor, and that floor is #66.** The batten's width is derived from the
panel, so 2.92 is a number at one composition width. Stating the readable minimum in
**px per Level point** converts #66 from *where does the drawing stop being claimed* into a
computation. **And the floor does not depend on the class at all** — which is one layer above where I
put it.

**The narrowest card the layout can draw is 142 units, at the column cap, in either class.**
`nodeW = min(pitchX − COL_GAP, cap)` with `pitchX = (WIDE_CANVAS_W − 2·MARGIN_X) / columns`, so at
`WIDE_COLUMNS = 8` it is `1200/8 − 8 = 142` — **and neither cap appears in that expression.** At eight
columns `NODE_W_MAX` and `SQUAT_NODE_W_MAX` are both unreachable, so a batten drawn at eight columns
is 142 units wide exactly like a stacked node is. The floor's real inputs are four constants, none of
them a cap and none of them in the table below: **`WIDE_CANVAS_W`, `MARGIN_X`, `COL_GAP` and
`WIDE_COLUMNS`.**

So the test recomputes **142 from those four constants** rather than asserting 990, or a share, or a
class — the same move as calling `wideRowPitch()` instead of copying its answer — so that an edit to
`COL_GAP` or `MARGIN_X` fails loudly instead of silently moving a floor nobody re-earns.

**Two of the four are not exported today, and the diff has to say which way that goes.**
`WIDE_CANVAS_W` and `WIDE_COLUMNS` are exported; `MARGIN_X` and `COL_GAP` are module-private, so "the
test recomputes 142 from four exported constants" is a claim about an interface that does not exist
and a test that cannot be written. **Export the two.** The floor is now a public fact about the
layout, so its inputs are part of the layout's surface. The alternative — the spec re-declaring them
— makes the floor a copy of four numbers, which is `legend.ts`'s original defect in a new place: a
test whose subject is a copy can go green while the screen says something else.

Card = the track px-per-point asks for, plus the inset that follows from it, plus 4 px of border;
canvas = card ÷ share; lane = canvas + 36 px of zone padding (`ZONE_PAD_X` 18); body = lane +
`FIGURES_W` 208 + the filete, plus `RAIL_W` 52 in the rail shape.

**One criterion, not two — and the order matters more than the number.** I had this as a `max()` of
px-per-point against the daylight, with the daylight binding by a pixel. **It cannot bind, because the
inset is derived from it:** `I = ⌈d + DATUM_STROKE − 0.01·T⌉` makes `datumDaylight = I − 2 + 0.01·T ≥
6` hold identically for every `T` — 6.92 on the batten and 6.08 on the stacked node **by construction
rather than by luck** — so quoting the daylight as a second criterion is one criterion wearing two
hats. And the staleness warning I hung on it was backwards: when `DAYLIGHT_FLOOR` moves, the **inset**
moves and the track floor stays exactly where px-per-point put it.

**The other half of the same error: Level divides by 100, not 99.** The fill is
`[style.height.%]="node.fill"` with `fill = level.value ?? 0`, and `datumDaylight` reads
`track * (1 − level / 100)` — the same `0.01·T` the inset formula uses. So one Level point is
`T/100`, and 1 px per point asks for **T ≥ 100** — which is the number I had credited to the
daylight.

Stated in the order that is true: **px-per-point asks for 100 px of track, the inset follows at 7,
and the daylight is then 6 by construction.** The figures are untouched — card **111 px**
(100 + 7 + 4), **lane ≥ 999 px**, **body ≥ 1 263 (rail) / 1 211 (pinned)**, slack **17 / 69** — and
only the derivation was wrong.

The per-class rows below are **illustration, and their shares are cap figures** — 30.84 % needs
`pitchX ≥ 388`, i.e. **3 columns or fewer**, and 15.42 % needs `pitchX ≥ 198`, i.e. **6 or fewer**;
read either as a width and you have made the same mistake this section just corrected:

| box | card share | needs | body it needs (rail / pinned) |
|---|---|---|---|
| wide batten, at the 380 cap (≤ 3 columns) | 30.84 % | lane ≥ 393 px | 657 / 605 |
| wide stacked node, at the 190 cap (≤ 6 columns) | 15.42 % | lane ≥ 756 px | 1 020 / 968 — **not the floor** |
| **either class, at the column cap** — 142 units | **11.53 %** | **lane ≥ 999 px** | **1 263 / 1 211** |

**And that reverses the reassuring note, which is the part that matters.** The rail lane is exactly
`1280 − 52 − 208 − 4 = 1 016`, and the pinned lane is **1 068**, not the 1 070 the ADR and `app.ts`
both quote: `diagramLane()` subtracts `2 · RULE` in every shape, while `.body--wide` halves the filete
(`column-gap: calc(var(--rule-min) / 2)`), so the sheet draws 1 070 and the arithmetic returns 1 068.
That is the same 2 px as the 306-against-320 slip I retracted — not an isolated slip but **the pinned
arm carried with one `RULE` twice** — and it is a disagreement between the model and the sheet inside
the one module whose stated contract is that they mirror each other, so it wants reconciling in the
same commit.

> **Reconciled (#76, landed).** The module went **up to a half**: `bodyGap()` now owns the filete's
> width, keyed to the adjacency — the two gaps abut because the lane between them has closed — and
> `.body`'s `column-gap` is bound from it rather than declared a second time in the sheet. So the
> pinned lane is **1 070 px in the model as well as on screen**, and the figures below read **17 px
> (rail) and 71 px (pinned)**. The finding above stands as written; only its resolution is settled.

Against **999** the slack is therefore **17 px (rail) and 71 px (pinned)**, at the design width, and
`tauri.conf.json` has no `minWidth`. The pinned figure was the one that depended on which way that
2 px was reconciled: 69 was the model's answer and 71 is what is on screen, and it is the on-screen
one that describes what a user has — so 71 is the figure now that the module has been brought up to
the sheet rather than the sheet down to the module. **The binding arm is 17 px either way.** So the
Level axis does not merely bind: **it very nearly fails at the shipped window, and any drag breaks it
immediately.** That is the finding, not the footnote.

So `max()` gets a computed arm that is right: **#66's floor is body ≥ 1 263 px (rail) / 1 211 px
(pinned)**, derived from the four constants above and never from a cap — and the code
says in as many words that `NODE_W_MAX` and `SQUAT_NODE_W_MAX` are ceilings the eight-column case
never reaches, so that nobody re-derives the floor from one of them. The figures term stays the
unmeasured second arm, marked as such.

**The two floors use two different worst cases from the same table, and each has to say which.**
§4.1's row classification uses the **nothing-parked** case, because parking removes operators from the
depth stack and can only move an algorithm to a shallower class. This width floor uses the
**any-parking** case, because `columns = grid.columns + stubColumns`: parking *adds* a column, so an
algorithm three columns wide unparked can be drawn at six with four operators cut. The bound is not
derived, it is **cited**: `WIDE_COLUMNS = 8` is exported and documented in `wide-layout.ts`'s header
as #40's measured worst case, and the arithmetic agrees — `grid.columns ≤ placed` and
`stubColumns = ceil(parked / stubRows)` with `stubRows ≥ 2`, so the total is at most
`placed + ceil((8 − placed)/2) ≤ 8`.

### 2.4 · The third box — named, because it is 64 of the 88

My §6 draft named two boxes, the grid node and the batten, and left the **wide stacked node** in
neither sentence. It is a real third box with its own proportions — `NODE_W_MAX` 190 units against
`nodeH` up to 91.33 — and it is the majority of the table, so §7 cannot retire `WIDE_ROWS` without
saying what carries Level in it.

**And "the box's long axis" cannot be the rule that decides it.** That axis is not a property of the
box: `layout.ts`'s numbers are `viewBox` units stretched with `preserveAspectRatio="none"`, so the
on-screen ratio belongs to the panel. At the pin-down scale the stacked node is about 159 × 95 px —
long axis horizontal, but only 1.7 : 1 where the batten is 8 : 1. A rule phrased as *whichever axis
the box actually has* lets a window resize flip the direction of the measurement with nothing
failing, which is `bottom: 99%`'s shape on the new geometry and would be the fourth instance this
week.

**So the axis is stated per class, and the classes are named:**

| class | when | box, in units | Level |
|---|---|---|---|
| the grid node | narrow composition, always | 118 × 108 | its **height** |
| the wide stacked node | wide, 3 rows or fewer — **64 of the 88** | 142 to 190 wide × up to 91.33 | its **length** |
| the wide batten | wide, 4 rows or deeper — **24 of the 88** | 380 × 66 down to 380 × 33 | its **length** |

The width in that middle row is a range because `NODE_W_MAX` is a cap the layout only sometimes
reaches — see §2.2, where its narrow end is what #66's floor has to be derived from.

The wide composition therefore carries Level horizontally in **both** of its boxes — one axis per
composition, not per box, and never per ratio. The alternative (vertical in the stacked node,
horizontal in the batten) would flip the measurement inside one composition and would make the datum
a common rule for the minority case only, which is the claim §1 rests on.

The stacked node's own arithmetic, since the rotation now reaches it — **and taken at the binding
instance rather than at the cap, which is the error §2.2 just corrected**: at 142 units the card is
about **119 px** outer (113 px in the rail shape), so `I = d + 2 − 0.01·T` gives a **7 px** inset on a
**108 px** track, **1.08 px per Level point** and **6.1 px** of daylight — clearing the criterion by a
tenth of a pixel. At the 190 cap the same box is 159.5 px with a 148.5 px track and 1.5 px per point,
which is the comfortable reading and not the one that exists. **That 1.08 is the number that shows the
floor is genuinely tight**, and it is the box §7's second look has to be taken on: a look at a
190-unit node answers an easier question than the drawing asks, which is the same trap as judging
#67's datum on the grid card.

**2.3 · Parked operators cannot stay at the far end of the Level axis.** §9 and ADR-0007 §4 park a
Level-0 operator *to the right* on a dashed stub. Right is now the loud end of the measurement, so
that puts position in direct contradiction with the drawing's own figure — on the one composition
whose stated principle is that position says it without a caption. **Parking therefore stops being a
horizontal displacement**: the parked operators leave the *stack* rather than the left margin, into a
band above the deepest row — they have no depth in the chain, so they are not in the depth axis at
all — at the shared origin, keeping the dashed stub that ends nowhere and their routes undrawn. What
is retired is the direction of the displacement, not the principle that position says *this one is
not sounding*.

**And that cut is worth naming, because it is the second time it has been the answer.** #67 separated
*Level is the height of the fill* from *the fill is the card*; this separates *parked is off the
branches* from *parked is to the right*. Same move: a claim with an accident riding underneath it,
and the accident is what breaks. Naming the move makes it available the third time.

## 3 · Decision 2 — the card keeps its width; the gap comes out of the height

**Decided.** Drawn at `10c`. After decision 1 the width *is* the measurement: halving it takes the
axis to 1.4 px per point. And the horizontal room buys less than it appears to — algorithm 66 is one
branch, so every route in it is a straight drop, and by construction no line ever crosses between
bands (`wide-layout.ts`, `place()`).

The routes' problem is vertical: `rowGap = min(26, pitchY/4)` leaves 7.9 px at the floor and the
arrowhead is 6.4 of them, so the visible segment is about 1.5 px. The gap gets a floor of its own,
and the card gives back the pixels of a height it is no longer measuring with.

## 4 · Decision 3 — the chain folds its facts, never its positions

**Decided.** Drawn at `10d`. Depth is height, so no row of the chain is removed. The deepest
operators keep their row, their order and their place above what they modulate, and give up the
ratio, the glyph, the Hz and the stamp to one band; identity and Level stay, against the same rule at
full length, so the loudest operator in the patch is still found by eye. A press unfolds the band
into the drawing that ships today.

### 4.1 · The threshold, derived — and it is 5 rows, affecting exactly 2 of the 88

The first version of this document left the threshold open for want of the depth distribution. **That
was wrong: the distribution exists.** `CONCERNS.md` §31 is resolved, the histogram was extracted in
session 2 from the 88 topologies transcribed in `crates/modx-midi/src/algorithms.rs`, and the table's
bounds are asserted — *and asserted to be reached* — by the tests in that file, which is the
instrument the derivation needs.

The criterion is §20's new rule 20: **the gap must hold its arrowhead plus a visible segment.** At
the floor the canvas is **286 px** (`floorCanvasHeight()`), so the y-scale is 0.715 and the 9-unit
arrowhead is 6.44 px; ask for 6 px of visible line and the gap must be ≥ 12.44 px, which is **17.39
units** — not the 17.3 I rounded to before multiplying. `rowGap = min(26, pitchY/4)` reaches that at
`pitchY ≥ 4 × (9 + 6/0.715) = **69.57**`, and `pitchY = 352 / rows`, so **rows ≤ 5**: 70.4 at five
rows clears it, 58.67 at six does not.

**The boundary survives the 300-to-286 correction; its margin mostly does not, and that has to be
recorded rather than noted.** At five rows the gap is 17.6 units — 12.58 px at 286 against 13.20 at
300 — the arrowhead takes 6.44, and what is left of the visible line is **6.15 px against the 6 px
the criterion asks for: a margin of 0.15 px**, where the canvas-300 arithmetic reported 0.45. In
units the margin against `pitchY` is **0.83**, not the 1.2 that quoting 69.2 implied. So by this
round's own standard: **assert the margin, not the classification.** A test that says *five rows do
not fold* passes at 6.001 px and tells nobody anything; the test says *five rows leave at least N px
of visible line*, and 0.15 px is recorded beside it. It is a tighter margin than the 1.33-unit one
§4.1 already calls the next `bottom: 99%` — 1.33 units is 0.95 px at this scale — and it decides
which five algorithms fold.

**And its inputs are worse than that margin's, because one of them is a number §7 says is about to
move.** The threshold now runs through `floorCanvasHeight()`, so it depends on `BODY_FLOOR` and
therefore on `LEGEND_H` — and §7 says `BODY_FLOOR` has to be **re-measured** after the fold, because
#19 measured a pre-fold node losing its figures. **The threshold is derived from a floor the fold
invalidates.** Solved the other way: the criterion needs `8.6 units × scale ≥ 6`, so `scale ≥
0.6977`, `canvas ≥ 279.1`, **`BODY_FLOOR ≥ 371.1`**. It is 378. So a re-measurement that comes back
**7 px lower moves the threshold to rows ≤ 4** and folds five more algorithms — the whole 5-row bin —
with nothing failing. **The re-measurement therefore goes before the threshold in implementation
order, not after it.**

Against the histogram (depth is 0-based, so rows = depth + 1: `1×1, 2×26, 3×37, 4×17, 5×5, 6×1, 8×1`):

- **2 of the 88 fold** — algorithm **37** at 6 rows and algorithm **66** at 8. Both named, neither
  guessed.
- **24 of the 88 are battens already** — 4 rows and deeper — which is the blast radius of decision 1
  and the number that matters more than the fold's two. **Run, not quoted:** parsing `ALGORITHMS` out
  of `crates/modx-midi/src/algorithms.rs` and reproducing `chain_depth()`'s fixpoint over all 88
  gives rows `1×1, 2×26, 3×37, 4×17, 5×5, 6×1, 8×1` — identical to §31's histogram — so 24 battens,
  64 stacked, and the fold firing on exactly `{37, 66}`. The query is
  `*t.chain_depth().iter().max() >= 3` over `ALGORITHMS`, the same `deepest` closure that file's
  bounds tests already use. One caveat that survives the run: rows are `max(depth) + 1` over the
  **placed** operators, so parking can move an algorithm down a class and never up — the counts above
  are the nothing-parked case, which is the right basis for classifying a drawing but is not a count
  of live screens.
- **64 keep the stacked node** at 3 rows or fewer.

One fragility, and it is not a footnote: **3 rows gives `pitchY = 117.33`, `rowGap = min(26, 29.33) =
26` and `nodeH = 91.33` units against `STACK_H = 90`. Thirty-seven algorithms sit 1.33 units from
becoming battens**, and a two-unit change moves the rotation's blast radius from 24 to 61. Five
constants move that boundary — `WIDE_CANVAS_H`, `MARGIN_Y`, `BUS_OFFSET`, `OUT_ROOM` and
`ROW_GAP_MAX` — **none of which is obviously about representation**, and if any of them moves by a
point and a half, a whole class of algorithms silently changes what kind of drawing it is. Nothing
fails. That is the third instance of the same defect this week, so this round guards it:

> **Assert the margin, not the classification.** A test that says *three rows produces a stack*
> passes at 90.01 and tells nobody anything. The test says *three rows clears `STACK_H` by at least
> N units*, so it fails while there is still room to think. **1.33 units is recorded as a measured
> margin beside `STACK_H`, with its five inputs named**, so that the next person to move
> `WIDE_CANVAS_H` can see what they are spending.

### 4.2 · The fold fires on two of 88, so the suite has to force it by number

A branch that fires twice in the whole table will essentially never be exercised in ordinary use, and
a mode nobody sees is a mode nobody notices breaking. So: the probes draw it (`10d`), and **the suite
forces both cases by number — algorithm 37 and algorithm 66 — never through a predicate that could
drift**. A test that asks *the deepest algorithm folds* is a test that stops covering the fold the
day the threshold moves.

### 4.3 · The band may not fold the provenance and keep the value

§20.7 is not negotiable here: a number on screen whose provenance is behind a press is a figure
making a claim it is not currently backing. Three options, and the half-measure is the one that would
look most reasonable in review:

- **Chosen — the band wears one stamp**, and it is the weakest of the operators it holds. That is not
  a new rule: `operator-diagram.ts`'s `weakest()` already gives a node the worst stamp of the figures
  inside it, and the band is the same rule applied one level up. One shape, one line, four values
  behind it.

  **Condition: the rank has to be written down and asserted, or `weakest()` is a comparator whose
  answer nobody can predict** and §20.7's claim ends up depending on an ordering that exists only
  inside a function. The rank is over **freshness of one source**, not across sources: `void (dash)
  < stale < fresh`. It does not need a cross-source order, because the band only ever holds polled
  Levels and identities — `MEASURED`, `PREDICTED` and `DOCUMENTED` cannot appear in it, and saying so
  is part of the rule. Written and tested, the band wearing one stamp is a derivation; unwritten, it
  is a convention.
- **Acceptable — the values fold away too**, and the band shows nothing numeric until pressed.
- **Rejected — value visible, provenance folded.**

## 5 · The two defects, as constraints

**`FB` half-covered by its own node** (drawn at `10e`). Cause: `labelX = max(out.x, back.x) + ear/2` puts the anchor
10 units — 8.4 px — past the card's right edge, `translate(-50%,-50%)` centres it back onto the card,
and in `operator-diagram.html` the nodes render **after** the labels, so the node paints over the
left half. It reads `B 0`. Two rules follow (§20's new 18): the label sits past the arc's bulge and
is aligned away from the node, and no label is ever painted over by a node — which today is a
consequence of template order rather than a decision.

**Routes into a parked operator are dropped, and rule 19 is a claim about the sound** (`10e`, right). It says so in
those words, because that is what makes it testable: a route into a parked operator is not inaudible
because we chose not to draw it, it is inaudible **because what it modulates has no output, and the
drawing is reporting that**. Only the first kind of statement can be wrong, so only the second is
worth asserting.

Two consequences. **The directions are two facts, not one** — *out of* parked says nothing leaves,
*into* parked says the signal arrives and modulates silence — and today a single predicate,
`drawn(from) && drawn(into)`, answers both, so neither is assertable. And this is **the same claim in
a second place**: `FB 0` is already kept dashed and inert on exactly this reasoning (#57), so the
vocabulary is not new and the rule should say it is the same one. What it must not become is a third
unnamed behaviour under prose describing a neighbour.

---

## 6 · Proposed diff to `DESIGN.md`

Written as the handoff would read after the decisions, against the canonical copy (1 104 lines).
**Numbering is preserved:** §20.2 is rewritten in place and the new rules are appended as 18–20,
because `§20.2` and `§20.7` are cross-referenced from `node-geometry.ts`, from the specs and from
`README.md`.

### §9 · The operator node — replace *The ceiling datum* and extend the track paragraph

> **Level's axis is a property of the composition, not of the box.** There are three boxes and each
> one's axis is stated rather than derived:
>
> | class | when | box, in units | Level |
> |---|---|---|---|
> | the grid node | narrow composition, always | 118 × 108 | its **height** |
> | the wide stacked node | wide, 3 rows or fewer — 64 of the 88 | 142 to 190 wide × up to 91.33 | its **length** |
> | the wide batten | wide, 4 rows or deeper — 24 of the 88 | 380 × 66 down to 380 × 33 | its **length** |
>
> The axis is **never** read off the box's proportions. `layout.ts`'s numbers are `viewBox` units
> stretched with `preserveAspectRatio="none"`, so the on-screen ratio belongs to the panel: the
> stacked node is 1.7 : 1 at the pin-down scale and the batten 8 : 1, and a rule phrased as *whichever
> axis the box has* would let a window resize flip the direction of a measurement with nothing
> failing. One composition, one axis.
>
> This is the same separation #67 made, one accident further in: *Level is the height of the fill* was
> a claim with two accidents riding under it, *the fill is the card* and *the height*. The claim is
> unchanged, linear and zero-anchored; what carries it is stated per composition. **One Level point is
> never drawn smaller than 1 px on the axis that carries it** (#66), which on the wide stacked node is
> the binding case and not the batten.
>
> The inset that keeps the datum off the border turns with the axis and keeps its derivation: 6 px on
> the batten's 292 px track leaving 6.9 px of daylight, and 7 px on the wide stacked node — whose
> track is **108 px at the column cap**, leaving **6.1** — the criterion #67 judged, met on both
> boxes, with smaller insets than the vertical axis needed because the last percent of a long track
> gives back whole pixels rather than a tenth of one. The 148.5 px track that `NODE_W_MAX` would allow
> is a **cap** reading and not a width: it needs six columns or fewer, and the eight-column case
> never reaches it.
>
> **The ceiling datum** is the patch's highest Level, drawn in **every** node at the same offset — a
> dashed 2 px mark, per node, never a constant. It is **a repeated mark on identical boxes, and only
> a common rule where the boxes are stacked and share an origin**, which in the wide composition they
> are and in the 3 × 3 grid they are not. Real patches cluster their operators between 71 and 99 —
> the running build's reads `90 · 90 · 71 · 90 · 90 · 85 · 90 · 99`, six of the eight identical to
> the eye — so eight fills with private baselines are eight absolute heights nobody can compare, and
> against the datum the eye reads the **gaps**. **Both ends of that comparison have to be quoted at
> the same size**: the old sentence read *28 % of 108 px, 30 px of daylight*, and the 108 is `NODE_H`
> in `viewBox` units — the grid card renders at 23.79 % of the canvas, which is 68 px at the body's
> floor, 105 px at the shipped window with the strip up, and 142 px with the waterfall in a ranura.
> Nothing draws it at 108. So at the floor, 71 against 99 is **15.7 px on the grid node against 3.3 px
> on the wide batten** — a 4.8× gap, which is the comparison that motivates the axis turning, and it
> survives being stated honestly.
>
> **A parked operator leaves the stack, not the margin.** With Level running along the card in this
> composition, the far end
> of that axis means *loud*, so an operator at zero cannot be parked there. It leaves the depth
> stack — it has no depth in the chain — into a band above the deepest row, at the same origin as
> every other batten, keeping the dashed stub that ends nowhere and its own routes undrawn.

### §10 · Replace the paragraph beginning *The width survives; the height does not*

> **Neither the width nor the height survives at the column cap, and past five rows neither does the
> row.** The width claim this paragraph used to make compared a unit against a pixel: *eight columns
> at 142 units of the 1232 is about 119 px of real panel, which clears the 118 px the node's five
> facts are fitted to*. The 118 is `NODE_W`, in `viewBox` units, and the narrow grid renders it at
> **131 px** — `CANVAS_W = 2·40 + 3·118 + 2·82 = 598` against a 664 px canvas. The labels inside the
> node are HTML at fixed sizes and do not stretch with the box, so **pixels are what the five facts
> are fitted in**, and in pixels the eight-column wide node is **119 px pinned, 113 px in the rail** —
> 12 to 18 px short of the only box those facts have ever been fitted to, and short in the direction
> that hurts, because a shallow node lays them in a **row** and a row needs more width than the stack,
> not less.
>
> So the honest statement is that at eight columns the drawing is already narrower than its own
> reference, at the shipped window, and what the five facts actually need in pixels is #19's owed
> measurement — now with an upper bound (131 px, the grid node as rendered) and a current value
> (119 / 113). Between them and the Level axis's 111 px lies #66's `max()`: **the fitted-width arm
> would ask for a body of ~1 436 px (rail), which the 1 280 design width does not have.** That is the
> second arm arriving as arithmetic instead of as a promise, and it is why this paragraph can no
> longer be carried forward as written.
>
> The height gives as it always did: the row pitch is what the algorithm's depth leaves, and below the
> height five stacked facts need it lays them in a row. Past **five rows** even that fails — not in
> the node but in the gap between them, where a route's arrowhead is 6.4 px at the body's floor and
> the whole gap is 7.9 — so the chain **folds its facts**: the deepest operators keep their row,
> their order and their place above what they modulate, and give up the ratio, the glyph, the Hz and
> the stamp to one band that wears the weakest of their stamps. Identity and Level stay, at full
> length against the same rule. A touch unfolds it.
>
> Five is derived, not chosen: it is where `min(26, pitchY/4)` stops clearing an arrowhead plus a
> visible segment. Against §31's histogram it folds **two of the 88** — algorithm **37** at six rows
> and algorithm **66** at eight — and leaves 24 as unfolded battens and 64 with the stacked node.

### §20 · Rules an implementer must respect

Rule 2, rewritten in place:

> 2. **Level is the length of the luminous fill along the axis its composition states**, linear 0-99,
>    against the shared ceiling datum (§9) — its **height** in the narrow grid, its **length** in
>    both of the wide composition's boxes, the stacked node and the batten alike. The axis is never
>    inferred from the box's proportions, which belong to the panel and not to the drawing. The mono
>    figure is confirmation. The fill's scale is the node's **track**, its interior
>    less a constant inset at the far end of the carrying axis and nowhere else, so that a Level at
>    the top of the range still leaves the datum somewhere to be drawn (§9, #67). **One Level point is
>    never smaller than 1 px on the axis that carries it.** Level 0 is not painted grey: dashed
>    outline, no fill, and the route leaving it dashed too.

Appended:

> **The drawing's own labels and lines**
>
> 18. **A label is never painted over by a node.** `FB n`, `OUT L/R` and anything written beside the
>     drawing sits clear of the boxes and is aligned away from them — past the feedback arc's bulge,
>     not centred over the node's edge. A figure the ring went and read may not be half-covered by
>     the drawing it belongs to.
> 19. **A documented route is always drawn; the ink says whether it carries** — solid when signal
>     passes, inert dash when it does not, which is the vocabulary `FB 0` already uses (#57) and the
>     same claim in a second place. A route **into** an operator parked at zero is drawn inert onto
>     its stub bar, because what it modulates has no output; a route **out of** one is not drawn,
>     because nothing leaves. **These are two facts and need two predicates.** A live modulator into
>     a silent destination must never read as less connected than a silent operator.
> 20. **Every gap a line lives in holds its arrowhead plus a visible segment.** A route drawn as
>     1.5 px of stub under a 6.4 px arrowhead is not a line. Where the row pitch is derived from the
>     algorithm's depth, the gap is floored before the box is, and the depth at which the gap can no
>     longer be floored is where the drawing folds (§10). **The visible segment is 6 px and that
>     figure is chosen, not judged** — see §7.

### 6.1 · Proposed `GLOSSARY.md` entries

Dropped from this document when it was re-based and restored here: `HANDOFF.md` was right to list it.

**Where the diff lands.** `GLOSSARY.md`'s table is under *§3 · Terms that are new in round 8*, so
terms new in round 10 cannot be appended to it: they open **their own parallel section**, the same
move §6 makes with §20's rules 18–20. **The single edit in place is the ceiling datum at
`GLOSSARY.md:134`**, which today reads *one dashed 2 px line drawn across all eight operator nodes* —
§0's opening finding sitting in the vocabulary file. The rewrite closes that finding **where it
originated**, not only in `DESIGN.md`, and that is a better argument for the entry than the round's
own decision is.

**Only one of the six is ever rendered.** §4 of `GLOSSARY.md` already draws that line, so these say
which side they are on: *the ceiling datum* reaches the screen through the legend's fourth entry;
*the track*, *the batten*, *the wide stacked node*, *the fold* and *the lane* are document and code
vocabulary, and no user-visible string says them.

| term | what it means | where |
|---|---|---|
| **the ceiling datum** *(rewritten)* | The patch's highest Level, drawn in **every** node at the same offset as a dashed 2 px mark — a repeated mark on identical boxes, **not one continuous line**. Where the boxes are stacked and share an origin the marks align into a common rule; in the 3 × 3 grid, and wherever the wide drawing puts cards side by side in bands, they read per node, which is what they have always done. Never a constant: a fixed 99 would be a baseline the patch does not have. | operator nodes in both drawings; the legend's fourth entry |
| **the track** *(#67's row, not this round's)* | The card's interior less a constant inset at the far end of the carrying axis — the fill's scale, and what keeps a Level at the top of its range from putting the ceiling datum inside the card's border. **Checked: the word does not appear in `GLOSSARY.md`.** `52eb91b` introduced `.node__track`, `TRACK_INSET`, `trackHeight()` and a rewritten §20.2 built on the word, and shipped no entry in the file that opens by calling itself the authority on the vocabulary — the drift this round is named after, on the commit it re-bases onto. One row, and it belongs to #67. | document and code vocabulary |
| **the batten** | The wide composition's node at four rows or deeper — 302 × 23.6 at the body's floor, far wider than it is tall. Not a different node: the same five facts, folded the other way, with Level along the card and the ceiling standing across it. | the wide drawing, 24 of the 88 |
| **the wide stacked node** | The wide composition's node at three rows or fewer — 142 to 190 units wide, up to 91.33 tall. It carries Level along its length like the batten, because the axis is the composition's and not the box's, and at eight columns it is the box every width floor is earned against. | the wide drawing, 64 of the 88 |
| **the fold** | What the wide drawing does with a chain deeper than five rows: the deepest operators keep their row, their order and their place above what they modulate, and give up the ratio, the glyph, the Hz and the stamp to one band that wears the weakest of their stamps. **Facts fold; positions never do**, because depth is height. A touch unfolds it into the drawing that ships today. | the wide drawing, algorithms 37 and 66 |
| **the lane** | **The diagram's own column of the body** — `diagramLane()`, 1 016 px in the rail shape and 1 070 in the pinned one — the two agreed on the second figure once `bodyGap()` landed (#76). This entry exists to settle a collision rather than to name something new, and the collision is **three senses, not two**: this one in `column-geometry.ts` and `legend.ts`; the **row gap** at `crossY()`'s comment in `layout.ts:219` and at `laneY()` in `wide-layout.ts:287`; and the **gutter** at `laneX()` in `layout.ts:229–234`. `layout.ts` carries two of the three on its own. So: the row gap is **the gap**, which is the word rule 20 already gives it; the vertical run beside a card is **the gutter**, which is what `wide-layout.ts` already calls it (`gutterX()`); and the lane is the column. The code points the same way — *the lane in the gap under a row* is a lane qualified by a gap, not a gap named lane. | document and code vocabulary |

**And two renames, because the collision is in the identifiers too.** `GLOSSARY.md` §6 is
*Renames — the list running code follows*, the same place round 9's applied file renames live, so both
rows belong there — **in a new labelled block of their own.** §6 has three sub-lists today, *Copy
strings*, *File names* and *Token names*, and all three are user-visible or file-level names; there is
no identifier list, so two TypeScript function renames cannot join any of them without changing what
that sub-list is. They open **Identifiers**, the same move the round-10 terms make against
*§3 · Terms that are new in round 8*: one line in the diff, and each sub-list stays one kind of name.

- **`laneY() → gapY()`** (`wide-layout.ts:288`) — the row-gap sense, with `crossY()`'s comment
  (`layout.ts:219`) and both `hopY()`s corrected in the same commit.
- **`laneX() → gutterX()`** (`layout.ts:234`) — and this is the one the comment I quoted actually
  documents. `layout.ts:230` calls it *the vertical lane beside a column* whose safety is that *a
  vertical run in a gutter never crosses a node* (the comment block opens at 229; the sentence is on
  230): both words for one object, in one comment, which is
  the collision at its purest. It is not the row-gap sense at all — it is the **gutter**, and it is
  the same expression `wide-layout.ts` already spells `gutterX()`. So the wide module chose the right
  name and the narrow one still carries the colliding word. **Without this second row, the reader who
  greps `lane` after the rename lands in `laneX()`** — the same failure, one function further down
  the same file.

`diagramLane()` keeps its name: it is the surviving sense.

One question for whoever lands it: **`crossY()` and `laneY()` are one object under two names** across
the two modules, and the rows above rename only the second. If that split is deliberate — the narrow
and wide layouts naming independently — say so where the rename lands; if it is not, then
`crossY() → gapY()` is the same row.

## 7 · What becomes obsolete, and what is retired rather than deleted

**#67's verdict note — retired with its record intact.** This is the one the diff has to say out
loud, because a recorded judgement deleted silently is the same defect as one kept past its geometry.
What it recorded: **`DAYLIGHT_FLOOR = 6` px, judged on screen** in the wide composition with both
ranuras empty and the window dragged down, on a **~31 px card**, against **algorithm 66 at
`99 · 0 · 99 · 99 · 0 · 0 · 99 · 99`** — a ceiling of 99 with a lit carrier at it, which is the case
worth judging because the datum then lies against `--carrier` at full strength. Measured off the PNG
at 1:1 on OP8: 4 device px of border, 13 of clean `--surface-raised`, 4 of datum ≈ 6.5 CSS px.

**The 6 px criterion survives the rotation and is re-used by it** (§1: 6.9 px of daylight on the new
axis). The transfer is legitimate for the note's own reason: daylight runs border-to-datum with both
ends fixed by the inset, explicitly independent of the dimension being measured, which is why it
carried from the 31 px card to the squat one in the first place. Rotation does not touch that.

**But the criterion transfers and the verdict does not.** Six was a judgement about 30 % white
against a specific neighbour — the card's amber border with `--carrier-fill` fading to `.04`
underneath it, which is why it read as a rule and not as a rim on the fill. In the wide composition
the datum is a **vertical** rule and what sits beside it is different ink in a different arrangement.
So **the rotated daylight is derived and has not been looked at, and it is the same kind of number as
`bottom: 99%`.** And there are **two** of them, because the rotation reaches both wide boxes: 6.9 px
on the batten's 292 px track and **6.1 px on the stacked node's 108 px track at eight columns** — the
binding instance, not the 148.5 px the 190 cap would give. The look has to be taken on
**both** — taking it only on the squat batten is the same trap as judging the old datum on the grid
card, and the stacked node is the majority case and the tighter track. Lit carrier at the ceiling,
both boxes, before it ships. That is cheap now: the probes exist, and #72's harness is five minutes
to rebuild. What does not survive is the geometry it was implemented in: `TRACK_INSET = 8` was the
smallest integer clearing 6 px **on the vertical axis of the squat card**, and after the rotation
neither the axis nor that card exists. So the note is not deleted and not kept as a live constant —
it is **retired into the ADR with the value, the card, the patch as Levels, and the sentence that the
geometry it was judged in no longer exists.** `d = 6` must not survive as a bare constant for the
next reader to re-derive a vertical geometry from.

**And a third number wants the same look, which nothing has given it yet.** Rule 20's **visible
segment of 6 px** is chosen — not derived and not judged — and it is the same class as `d` before
somebody dragged a window down. It decides more than it looks: at five rows the visible line is
6.15 px, so the 5-row bin's classification turns on an unjudged constant to within **0.15 px**, and
moving it to 7 folds five more algorithms exactly as a 7 px `BODY_FLOOR` re-measurement would. Same
hardware session as the two daylights, same kind of look.

**Retired by name, in the ADR:** `TRACK_INSET`, `DAYLIGHT_FLOOR`, the #67 verdict note, and #66's
open measurement (which becomes the computed floor of §2.2 plus its one owed arm).

**Constants.** `WIDE_ROWS = 8` goes, replaced by the fold threshold plus the unfolded row count.
`ROW_GAP_MAX` gains a floor and stops being a lone maximum. `STACK_H = 90` is re-earned, and §4.1's
1.33-unit margin is why. `MIN_ROWS = 3` is unaffected. `SQUAT_NODE_W_MAX = 380` survives **by value
and not by reason** — it stops being consolation for lost height and becomes the measurement axis.
`DATUM_STROKE` and `LEVEL_MAX` are untouched. `worstCardHeight()` keeps its shape and changes its
answer, which is what its own comment anticipated: *if #69 lands and the deepest algorithms fold,
this re-derives*.

**Tests.** `node-geometry.spec`'s daylight assertions become assertions about the horizontal axis;
`datumDaylight` keeps its algebra with `T` measured along the other dimension. The datum
test in `operator-diagram.spec.ts` asserts `bottom` across eight nodes and has to be re-earned per
composition. The 108-px-as-a-unit sentence is **not** in that file — the only 108 there is a pitch,
`lowestLivePitch.set(108)` — it is in the prose, at `DESIGN.md:383`, which is the paragraph §6
replaces. It is the clearest single instance of the prose drifting from the drawing, and the fix is
one line of the diff this round already writes rather than a test to re-earn. `wide-layout.spec.ts`'s deep-algorithm case keeps its shape and
loses its premise. The new invariant of §2.1 is a test that does not exist yet in any form.

**`BODY_FLOOR` has to be re-measured, not recomputed.** `NODES_FLOOR` is #19's measured 360 minus the
one-row legend, and #19 measured the **pre-fold, pre-rotation** node losing its figures. The
derivation stays honest; its input stops being current. Somebody drags the window down again with the
folded drawing on screen.

**#69 already exists** as the ticket for folding the deepest algorithms — `node-geometry.ts` names it
— so decision 3 has a home and does not need a new one.

---

## 8 · The ADR — new, and not filed as a refinement

**Proposed: ADR-0008.** It supersedes nothing in ADR-0007: *two drawings that teach different things,
and here is what travels between them* survives intact, including its decision not to redo the narrow
grid. 0008 cites it as the decision it builds on.

But it is **not a refinement either, and should not be dressed as one.** #67's edit to §20.2 was a
refinement — it separated a claim from an accident and deliberately needed no ADR. This changes
**which axis carries Level**, which is a change to the drawing's own vocabulary, and it retires a
judged constant and a documented parking direction. Filing that as a sharpening would leave the next
reader thinking the positional vocabulary was never in doubt on the one axis it now moves.

**Opens with the bidding, not the numbers and not the finding.** #67's track costs the fill a third
of its range — 11.6 px of scale at the floor, 99-against-96 down to 0.35 px — two individually
correct rules bidding for the same 23.6 px, with the winner starving the loser to a third of a pixel.
It is the only statement in the argument that needs no appeal to taste, so it is what the reader
meets first. Then the diagnosis: the vertical direction was carrying **depth** across nodes and
**Level** within them, and every symptom of the week — including #67 itself — is that overload
surfacing. Then the finding that the datum has never been one line across the eight, which is what
makes the rotation a repair rather than a preference. The resolution figures come last, as the
consequence.

**Retires by name:** `TRACK_INSET`, `DAYLIGHT_FLOOR`, the #67 verdict note (with its record carried
into the ADR, §7), #66's open measurement, and — from ADR-0007 §4's fourth item — **the direction of
parking**, the only clause of 0007 this touches, and it touches the direction rather than the
principle.

**Records, rather than retires:** the 1.33-unit margin between three rows and the batten class, with
its five inputs named (§4.1) — that boundary is the next `bottom: 99%`, and the ADR is where somebody
will look for what a two-unit edit to `WIDE_CANVAS_H` would cost.

## 9 · The canonical copy — what I did, why it is still not the resolution, and what you have to do

The repository's `design_handoff/DESIGN.md` is the live one at 1 104 lines; the loose round-9 copy was
923 and still said `§16.4`. **What this round did:** pulled the canonical five into one directory and
stopped shipping anything into the fossil's own path.

**What that is not:** a resolution. The repository tracks its own `design_handoff/` — the same five
files, the same `design/*.dc.html`, the same `screenshots/` — and **that is the path the source
comments cite by §**. So the pair that produced the stale read has been renamed and brought into
agreement rather than removed, which is exactly the state this section argues is worse than
disagreement: two copies that disagree announce themselves (the dangling `§16.4` is how this was
caught), two that agree today are invisible until the next round drifts one of them.

**The resolution, and it is what this delivery now does:** the delivery directory carries **only what
this side produces** — the proposal, the new `Round10-operator-diagram.dc.html`, and the `support.js`
the sheet needs to open. The five handoff files, rounds 3–8, the screenshots and the sources exist
**once**, in the repository, and are read from there rather than copied out. The round-10 index entry
is shipped as a stated one-line addition to the repository's own `Index.dc.html`, not as a forked
copy of it.

**And a zip cannot delete.** `design_handoff_fase1_ui/` is still on the recipient's disk from the
earlier download, and no bundle can remove it — so "is deleted" would be a claim about a state this
delivery cannot produce. **It has to be deleted by hand**, and `HANDOFF.md` says so as the first
thing a reader is asked to do.

## 10 · What this round did not do

No app code, no SCSS, no test changes, no ticket. `#59`, `#60` and `#61` were not read. The three
decisions are not separable: decision 1 needs the width decision 2 keeps, and decision 2 needs the
height decision 3 releases. One question is still open on the owner's ear rather than mine — rule 19,
§5 — and one thing is not decidable on paper at all: whether a horizontal bar reads as loudness.

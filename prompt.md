# Round 10 — implement the rotation. The design round is closed.

The design round ran for eleven passes tonight and is agreed. Its output is now **in the repo**:

- `design_handoff/ROUND10-PROPOSAL.md` — the round. Three decisions, the proposed diffs to
  `DESIGN.md` §9 / §10 / §20, the `GLOSSARY.md` entries, the retirement list and the ADR argument.
- `design_handoff/HANDOFF.md` — the delivery note. Read it first; it is short.
- `design_handoff/design/Round10-operator-diagram.dc.html` — the probes, `10a` → `10f`. Open it in a
  browser, `support.js` is already beside it.
- `design_handoff/design/Index.dc.html` — carries the round-10 card now.

Everything in the proposal is written against `design_handoff/` at **`52eb91b`**, which is HEAD.

**The proposal is a proposal: nothing in it is applied.** `TRACK_INSET = 8` and
`DAYLIGHT_FLOOR = 6` are live in the build today, and this round is what retires them. Your job is
to apply it — with the gates below respected, because two of them are the difference between this
round repairing the defect and re-creating it on a new axis.

## Read in this order

1. `design_handoff/HANDOFF.md`.
2. `design_handoff/GLOSSARY.md`, then `DESIGN.md` §9, §10 and §20 — the vocabulary and the rules as
   they stand today, before your diff.
3. `ROUND10-PROPOSAL.md` §0 (what moved under the round, and two retracted findings), then §1–§5.
4. The sheet, with §1–§4 open beside it.

## The three decisions, in one paragraph

Vertical was carrying two quantities at once — **depth** across nodes and **Level** within them —
and every symptom of this week is that overload surfacing, #67 included. So: **Level turns onto the
axis its composition states** (never the box's, never a ratio the panel owns); **the card keeps its
width and the gap comes out of the height**; and a chain deeper than the threshold **folds its
facts, never its positions**. The three are not separable — decision 1 needs the width decision 2
keeps, and decision 2 needs the height decision 3 releases — so they land together or not at all.

## Order of work, and the first item is a sequencing constraint, not a preference

1. **Re-measure `BODY_FLOOR` first, before anything downstream touches the threshold.** `NODES_FLOOR`
   is #19's measured 360 minus the one-row legend, and #19 measured the **pre-fold, pre-rotation**
   node losing its figures. The derivation stays honest; its input stops being current. This is a
   *measurement* — drag the window down with the folded drawing on screen — not a recompute. It runs
   through everything: the fold threshold needs `BODY_FLOOR ≥ 371.1` to stay at `rows ≤ 5`, and it is
   378 today, so **7 px lower and five more algorithms fold** with nothing failing.
2. The `DESIGN.md` diffs (§9, §10, §20 rules 18–20) and the `GLOSSARY.md` entries — §6 and §6.1 of
   the proposal give them as text. `GLOSSARY.md`'s round-10 terms open **their own section**, not
   appended to *§3 · Terms that are new in round 8*, and the two identifier renames
   (`laneY() → gapY()`, `laneX() → gutterX()`) open an **Identifiers** block under §6, whose three
   existing sub-lists are each one kind of name. The single edit in place is the ceiling datum at
   `GLOSSARY.md:134`.
3. **ADR-0008.** New, superseding nothing in ADR-0007 and not filed as a refinement — it changes
   which axis carries Level. Open it with the bidding (#67's track costing the fill a third of its
   range: 11.6 px of scale at the floor, 99-against-96 down to 0.35 px), then the axis-overload
   diagnosis, then the finding that the datum was never one line across the eight — resolution
   figures last, as the consequence. §8 has the retirement list by name.
4. The layout and component work, with the invariants below asserted.
5. Tests. §7 lists what changes shape and what changes only its answer.

## Non-negotiable invariants — assert these, don't assume them

- **One origin, one scale.** The vertical rule is only a rule if every batten measures from the same
  left edge at the same px-per-point. Test it as **geometry** — the rule's box intersects all eight
  battens at the same fraction of each — not as element-exists. One indented or narrowed batten and
  the rule silently becomes a coincidence, which is `bottom: 99%` again.
- **The width floor is 142 units, computed, not asserted.** `nodeW = min(pitchX − COL_GAP, cap)` with
  `pitchX = (WIDE_CANVAS_W − 2·MARGIN_X) / WIDE_COLUMNS` gives `1200/8 − 8 = 142`, and **neither cap
  is reachable at eight columns** — `NODE_W_MAX` and `SQUAT_NODE_W_MAX` are ceilings, not widths. The
  test recomputes 142 from those four constants, so `MARGIN_X` and `COL_GAP` (module-private at
  `wide-layout.ts:57,60`) get **exported**. Do not assert 990, 999 or a per-class share: those are
  presentations of the same number.
- **Assert margins, not classifications.** Two boundaries in this round are decided by fractions of a
  pixel and neither fails when it moves: the **1.33-unit** margin between three rows and the batten
  class (`pitchY 117.33`, `rowGap 26`, `nodeH 91.33` against `STACK_H = 90`, five inputs at
  `wide-layout.ts:44-64`), and the fold threshold's **0.15 px** of visible line at five rows. A test
  saying *three rows produces a stack* passes at 90.01 and tells nobody anything; a test saying it
  *clears `STACK_H` by at least N* fails while there is still room to think. Record both margins with
  their inputs named.
- **The fold fires on exactly `{37, 66}`** — 2 of 88 — so it will rot. Force both **by number** in the
  suite, never by a predicate that can drift. The histogram is `1×1, 2×26, 3×37, 4×17, 5×5, 6×1, 8×1`,
  reproducible from `chain_depth()` over `ALGORITHMS`, and it gives 24 battens against 64 stacked.
- **Facts fold; positions never do.** The band keeps the row, the order and the above-what-it-modulates
  relation. And it **may not fold the provenance and keep the value** — a number on screen whose
  provenance is behind a press is a figure making a claim it is not currently backing. Either the band
  carries the collapsed provenance in one shape, or the values fold away with it. `weakest()` needs
  the rank `void < stale < fresh` written down and asserted, or it is a comparator nobody can predict.
- **Parked operators come out of the stack, not the margin.** Right is now the far end of the Level
  axis, so parking a Level-0 operator to the right would put the drawing's position in contradiction
  with its measurement. ADR-0007 §4's *direction* of parking retires; the principle does not.

## What you may NOT decide alone — five things are open on the hardware or on the owner

Do not resolve these by picking a plausible value. Land the code with each one named at its site, and
say in the PR which of them the build is currently guessing:

1. **The two rotated daylights** — 6.9 px on the batten's 292 px track, **6.1 px on the wide stacked
   node's 108 px track at eight columns**. Both derived, neither looked at. The stacked node is the
   majority case *and* the tighter track, so a look taken only on the batten is the same trap as
   judging #67's datum on the grid card. Lit carrier at the ceiling, both boxes.
2. **Rule 20's 6 px of visible line** — chosen, not derived and not judged. It decides the 5-row bin
   to within **0.15 px**; move it to 7 and five more algorithms fold.
3. **Whether a horizontal bar reads as loudness at all.** Not decidable on paper.
4. **Rule 19 / §5** — whether a route *into* a parked operator is drawn inert. This is a claim about
   the **sound**, not a drawing convention, and the two directions are two different facts: `from`
   parked says nothing leaves, `into` parked says the signal arrives and modulates silence. Today one
   predicate answers both, so neither is assertable. If the inert dash extends here, say it is the
   same claim as `FB 0` in a second place; if not, say why feedback differs.
5. **#66's second arm** — §19's figures term. The width floor is currently a single-armed `max()`.
   Either compute the figures term now and give `max()` two real arguments, or leave #66 open with
   that term as its stated acceptance criterion and **say in the code that the `max()` is
   single-armed and why**. What it must not be is a `max()` that looks like it has two terms and has
   one — *owed* is not a state the build can be in.

## What retires, and one thing that is retired rather than deleted

By name: `TRACK_INSET`, `DAYLIGHT_FLOOR`, #66's open measurement, `WIDE_ROWS = 8` (replaced by the
threshold plus the unfolded row count), and ADR-0007's parking *direction*. `ROW_GAP_MAX` gains a
floor. `STACK_H = 90` is re-earned. `SQUAT_NODE_W_MAX = 380` survives **by value and not by reason**.
`worstCardHeight()` keeps its shape and changes its answer, as its own comment anticipated.

**#67's verdict note is retired into the ADR, not deleted.** It recorded `DAYLIGHT_FLOOR = 6` px
**judged on screen**: wide composition, both ranuras empty, window dragged down, a ~31 px card,
algorithm 66 at Levels `99 · 0 · 99 · 99 · 0 · 0 · 99 · 99` — ceiling 99 with a **lit carrier** at it —
measured off the PNG at 1:1 on OP8, 4 device px of border, 13 of clean `--surface-raised`, 4 of datum,
≈ 6.5 CSS px. Carry the value, the card, the patch **as Levels**, and the sentence that the geometry it
was judged in no longer exists. A recorded judgement deleted silently is the same defect as one kept
past its geometry — and `d = 6` must not survive as a bare constant for the next reader to re-derive a
vertical geometry from.

## First reply

Don't start writing yet. Come back with the plan and with what you'd push back on — that has been
worth it every round today. Specifically: whether the `BODY_FLOOR` re-measurement can be sequenced the
way step 1 asks inside one commit, what the geometry test for the common rule actually asserts, and
anything in §1–§5 you think is wrong. If a figure in the proposal does not reproduce against the tree,
say so with the line — three of tonight's corrections came from exactly that.

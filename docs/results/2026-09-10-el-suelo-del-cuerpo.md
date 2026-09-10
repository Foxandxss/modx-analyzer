# The body's floor, measured on the drawing it will govern (#81)

`BODY_FLOOR` is the height under which the body stops shrinking and scrolls instead. Round 10 needs
it because the fold threshold is derived from it (#82), and it needed re-taking first because it was
about to govern a drawing — Level along the width, eight rows deep — that nobody had ever measured
it on.

**This is a first measurement and it supersedes nothing.** The number it replaces has no
measurement behind it to supersede: see *The citation* below.

## What was on screen

The harness (#79) at `56cde88` plus this commit, in headless Chrome 152 on the target laptop — 14",
1920 × 1200 physical, 150 % scaling, Windows 11 Pro 26200 — driven at **device scale 1** with the
viewport fixed at **1280 CSS px wide** and the height driven down by the window-metrics override,
which is the drag. The bench strip was hidden for every reading; it is `position: fixed` and takes
no room from the body, but a look taken with a panel over the drawing is a look at the panel.

- **The fold switch off** (`data-folding="off"`), which is what the bench exists for and what makes
  the deepest algorithm drawable at all.
- **The wide composición, both of its shapes**: pinned (`KEEP IT BIG`, a 1 070 px lane) and rail
  (both Ranuras emptied, 1 016 px). The narrow 3 × 3 grid is not in this measurement; round 10 does
  not change it.
- **Algorithm 66** — eight rows, `MAX_DEPTH`, the deepest of the 88 and the anchor #81 asks for —
  with 37 at six rows, 55 at five, 2 at four and 1 at one as the shallower cases.

**The row counts were read off the drawing rather than quoted.** Setting each of the 88 in turn and
counting distinct card rows gives `1×1, 2×26, 3×37, 4×17, 5×5, 6×1, 8×1`, the six-row bin is exactly
`{37}` and the eight-row bin exactly `{66}` — the histogram the round's arithmetic runs on,
reproduced on screen.

### Which patch, as Levels

`90 · 90 · 71 · 90 · 90 · 85 · 90 · 99` — the bench's own patch, `HARNESS_LEVELS`, with **nothing at
zero**. That matters for this measurement and not only for tidiness: a parked operator leaves the
branches, so a patch with a zero in it draws a *shallower* 66 than the one the anchor is about.

### What is a measurement here and what is arithmetic

Every figure below is a rendered box — `getBoundingClientRect`, at device scale 1 — and not a pixel
read off a PNG and not a number this repo's modules computed. Where a module's arithmetic is quoted
it is named as such. The arrowhead is the one exception and it is stated once: the marker is
`markerWidth/markerHeight = 9` in `userSpaceOnUse` units on a `viewBox` the panel stretches, so its
extent along a vertical route is **9 units × the canvas's y-scale**, and that is computed rather than
measured.

## The criterion

Two sentences, recorded here so that the next person recomputes instead of dragging a window:

- **A gap holds its arrowhead plus a visible segment.** The round asks for 6 px of visible line
  (`ROUND10-PROPOSAL.md` §20.20 — chosen, not derived and not judged).
- **A node holds its five facts.** Label and role, Level, ratio, spectral form, Hz: none of them cut
  by the card's edge.

## What came back

### The anchor: algorithm 66, unfolded

| criterion | body row it needs | what the drawing is there |
| --- | --- | --- |
| the five facts, uncut | **561 px** | batten 318.9 × 38.0 (pinned), 302.3 × 38.0 (rail) |
| the five facts, clear of the corner mark's band | 634 px | batten × 44.0 |
| the gap's arrowhead plus 6 px | **≈ 1 300 px** | gap 2 units of visible line at any scale |

The window the app ships gives the body row **534 px**.

**So the anchor as #81 specifies it names no floor the window can keep** — and that is the finding,
not a failure to take the reading. Both criteria fail at the deepest algorithm at every height the
app can be given, and **both are criteria the fold resolves**: the facts fold, and the node gives the
gap the height it stops needing. Clamping the window at 561 — let alone 1 300 — would make the app
scroll at rest on the machine it is designed for, in order to protect a drawing that after #82 is
never drawn.

What the anchor *does* buy is what it was asked to buy, and it is asserted rather than assumed:
`wide-layout.spec.ts` now holds that a card's height is decided by the row count and by nothing else
— not the patch, not the parking, not the node class — and never grows with the row count. The
deepest algorithm is therefore the worst case, folding can only ever buy margin, and the threshold
derived at the floor cannot spiral. `operator-diagram.spec.ts` holds the other half at the seam #82
will use: with the `FOLDING` switch on, no node gets a taller card than with it off, over both wide
classes, forced by algorithm number. Today the two drawings are identical and the assertion passes
trivially; it goes red the day a folded band comes out taller than the card it replaced.

### The five facts, at every depth

Body row needed for the five facts to be uncut, folding off, at the two lanes:

| algorithm | rows | class | pinned | rail |
| --- | --- | --- | --- | --- |
| 1 | 1 | stacked | 438 | 438 |
| 2 | 4 | batten | 416 | 416 |
| 55 | 5 | batten | 388 | 426 |
| 37 | 6 | batten | 446 | 446 |
| 66 | 8 | batten | **561** | **561** |

Two things are worth reading off that table. **Nothing on it is under the floor** — at 382 px the
drawing does not hold its five facts at *any* depth, including the shallowest, which is the class 64
of the 88 are in. And **the facts wrap to two lines in every case**: at 302 px the batten cannot lay
its five facts in one row, so what it needs is two lines' worth of card. That is #66's fitted-width
arm arriving on the height, and it is the width trigger's business (#82), not the floor's.

### The threshold, at the floor

At the floor the canvas is **282 px** and the y-scale 0.705. Measured, per gap, uniform to a
hundredth across each drawing:

| rows | gap | arrowhead (9 units) | visible line | clears 6 px |
| --- | --- | --- | --- | --- |
| 5 (alg 55) | 12.41 px | 6.35 px | **6.06 px** | yes, by **0.06** |
| 6 (alg 37) | 10.34 px | 6.35 px | 4.00 px | no |
| 8 (alg 66) | 7.77 px | 6.35 px | 1.42 px | no |

**The `rows ≤ 5` bin survives, and its margin is 0.06 px rather than the 0.15 the proposal
recorded.** It survives *because* of the legend correction below: at the canvas the screen was
drawing before this commit — 278 px — the same gap leaves **5.98 px**, which is under the criterion,
and the threshold would have been `rows ≤ 4`, folding the whole five-row bin (38, 39, 40, 41, 55)
rather than two algorithms. That is precisely the failure the proposal named in advance: *a
re-measurement that comes back 7 px lower moves the threshold to rows ≤ 4 … with nothing failing.* It
came back 8 px lower, and what moved was not the window.

## What the build and the paper disagreed about, and which way it went

### The legend's band is 62 px, and the model was spending 54

`.legend__swatch` is declared `22 × 14` with a `--rule-min` border and nothing anywhere sets
`box-sizing: border-box` for it, so each of the four rules is drawn **outside** the declared box and
the screen gives the swatch **26 × 18**. A legend row is as tall as its swatch, so a row is 18 and
the band is **62 px** against the 54 `legend.ts` computed. Measured: swatch 26 × 18, row 18, legend
62, at 1280 × 800.

The build won.

That eight pixels is not cosmetic, because `LEGEND_H` is spent twice in the floor chain — once
raising `BODY_FLOOR` and once subtracted back out at `floorCanvasHeight()`:

- The floor is **382 px** and not 378, which is what keeps the relation the floor is written as:
  *whatever the legend takes, the canvas is left with what it was left with when the 360 was taken.*
  It was leaving it four pixels less.
- The canvas at the floor is **282 px**, and `floorCanvasHeight()` said 286. It now says 282 and the
  screen draws 282.
- Every figure derived through that scale was about 1.4 % optimistic. The grid's narrowest card is
  67.1 px and not 68.0; its 99-against-71 gap is 15.4 px and not 15.7. Neither track inset moves —
  both are still 8 px on the grid and 7 px in the wide composición, and both are still earned a pixel
  at a time.
- The legend's own row widths were four pixels per swatch light against #65's clipping check. They
  still fit: row 1 is 462.7 px in the 664 the narrowest lane leaves.

The rest of the zone's chrome was read off the screen in the same pass and **holds**: `padding-top`
12, the head's box 14 with its `--space-1` margin at 4 — the 18 the model assumes, and the one term
`node-geometry.ts` says it cannot compute — and the canvas's margins 4 and 4.

### The citation

`NODES_FLOOR = 360 − legendHeight(1)` cited **#19**. GitHub #19 is *«Text collides at full size»* —
the struck-through name under the `ALG` chip and `TEORÍA` over `SONDEADO` — and its three acceptance
criteria are legibility ones at the design window. **It contains no height measurement.** 360 appears
in no document under `docs/results/`, and nowhere in `design_handoff/` except the round-10 proposal's
own sentence citing that comment. Its only witness was a comment pointing at a ticket that does not
have it.

Corrected at every site that made the claim: `column-geometry.ts` (the constant, and the sentence
naming the floor's criterion), `column-geometry.spec.ts`, `app.ts`'s mirror of the 382, and
`node-geometry.ts`. The 360 is left standing and is now labelled for what it is — an **unwitnessed**
number — rather than carrying a citation that does not hold it up.

## What this measurement does not settle

1. **It is not a judgement.** Nothing here was looked at and called good or bad; every figure is a
   rendered box. Whether 6 px of visible line reads as a line, and whether a folded band reads as
   depth, are looks 4 and 6 on the round's verification list (#88).
2. **The floor is still not the anchor.** The number the window keeps is 382 px, earned from the 360
   and the legend's band; the anchor at 561 is recorded here and is what the fold has to buy back.
   If #82 finds it cannot, the fold's own floor is the thing that fails, and it fails visibly.
3. **The 0.06 px margin at five rows is smaller than anything else in the round**, including the
   1.33-unit stack margin the proposal already calls the next `bottom: 99%`. It is inside the
   rounding of the head band's font metric, which is the one term of `floorCanvasHeight()` that
   cannot be exact. #82 asserts the margin and not the classification, and #84 records it.
4. **The 360 itself is still unwitnessed.** This measurement did not re-take it — it measured the
   drawing at the deepest algorithm, which is a different question — so the vistas' half of the floor
   remains a number with no document behind it. Re-taking it is nobody's ticket yet.
5. **DPR 1, not 1.5.** The app ships at 1280 × 800 CSS on a 150 % display; these readings are at
   device scale 1, so a figure quoted here as 6.06 px is 9.09 device pixels there and rounds
   differently. Nothing in the round's arithmetic is in device pixels, and no claim above depends on
   which side of a device pixel a figure falls.

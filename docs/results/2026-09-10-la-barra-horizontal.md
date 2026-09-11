# Does a horizontal bar read as loudness (#78)

Round 10 turns Level onto the horizontal axis. If a horizontal bar does not read as loudness at all,
the rotation is wrong and none of the round's other numbers matter — so #78 asks the question before
anything is built, on the one surface that can already answer it: `Round10-operator-diagram.dc.html`,
which draws the rotation with the real tokens and needs only a browser.

**What this buys, said first, because it bounds everything below. A design sheet can reject; it
cannot bless.** It is not the app's ink, it is not the app's geometry, and it is not the eight-card
drawing. A no here would have stopped the round and superseded ADR-0008 before it was written. A yes
is a **failure to reject**, and it stays provisional until it is confirmed in the app — look 1 on the
verification list, #88.

The sheet says as much about itself, at §10c: *whether a horizontal bar still reads as loudness …
needs the rotated node on the hardware beside the grid, which is a build and a look, not an argument.
I am not going to guess a number for it.* That sentence is still true. This record does not overturn
it; it records the rejection test the sheet **can** answer, and leaves the blessing where the sheet
put it.

## The answer

**Yes — it did not reject.** A bar running from a shared left origin reads as a magnitude, and at the
worst card it makes the one comparison the drawing exists for legible for the first time. The round
proceeds to Block 1.

## What was on screen

`design_handoff/design/Round10-operator-diagram.dc.html` at `d646903`, opened in headless Chrome
152.0.7977.76 on the target laptop (14", 1920×1200 physical, 150 % scaling, Windows 11 Pro 26200) —
**not** the owner's display and **not** at the app's DPR. Two renders of the same markup: one at
device scale 1, which is the read, and one at device scale 3, which is the measuring. Sections §10b
(*Question 1 — what form the ceiling reference takes*, candidates A, B and C) and §10c's
three-boxes row (*grid node · wide stacked node · wide batten*).

Reproducible without the app:

```sh
chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1120,700 --screenshot=out.png \
  "file:///…/design_handoff/design/Round10-operator-diagram.dc.html#10b"
```

The figures below were then read off `out.png` pixel by pixel, so they are measurements of the
rendered sheet and not a second copy of the sheet's own labels. Where they agree with the labels,
that agreement is a result.

## Which patch, as Levels

§10b draws **three cards, `99 · 96 · 45`**, all at the worst card — `BODY_FLOOR`, a batten 302 × 23.6
px, so a **292 px track**. Candidate A draws them on today's vertical axis with #67's track;
candidate C draws the same three on the horizontal axis with the trailing inset. §10c draws one card
at `96` in each of the three boxes.

Three cards is not eight, and none of them is a lit carrier. That is what the sheet has, and it is
named here rather than glossed: no claim below is about the eight-card drawing.

## What was measured

Off the device-scale-1 render, in image pixels. The batten's track runs `x = 751 … 1043` (292 px) and
the ceiling rule is the 2 px dash at `x = 1040–1041`, which is 99 % of the track.

**Candidate C, the horizontal bar.**

| card | fill ends at | fill length | of a 292 px track | dark between fill and rule |
| --- | --- | --- | --- | --- |
| OP1 · 99 | `x = 1037` | 287 px | 98.3 % | **2 px** |
| OP3 · 96 | `x = 1030` | 280 px | 95.9 % | **9 px** |
| OP4 · 45 | `x = 881` | 131 px | 44.9 % | **158 px** |

**Candidate A, the same three Levels on today's vertical axis, same card.** Reading the first
non-background row inside each card:

| card | fill's top edge, rows below the card's interior top |
| --- | --- |
| OP1 · 99 | 9 |
| OP3 · 96 | **9** |
| OP4 · 45 | 15 |

**That is the finding worth having, and it is a measurement rather than the round's arithmetic.** The
proposal says 99 and 96 differ by 0.68 px of height on this card and 0.35 px at the floor. On the
screen those are not two close rows — they are **the same row**. Sub-pixel figures round to zero when
something actually draws them, and what the reader gets is two cards that are pixel-identical while
their figures differ by three Level points. The same pair on the horizontal axis is a 9 px notch of
dark surface before the ceiling rule, on a card 23.6 px tall.

## How it read

**As loudness, and as a measurement.** The three lengths from one shared left edge read as three
magnitudes on a common scale. `45` unmistakably ends before the middle; `96` reads as *nearly at the
ceiling but not at it*, which is precisely the reading the vertical axis cannot deliver at this card.

**The origin is where the ink is dense, and that is not an accident of this sheet.** The fill's
gradient runs dense at the origin and fades away from it — `.40` down to `.10` along the bar,
matching the vertical fill's `.44` down to `.04` upward. So the convention is unchanged by the
rotation: the dense end is zero in both. The consequence is the same in both too, and it lands on the
new axis: **the edge the ceiling rule measures against is the faintest ink on the card.** On the 45
bar the last lit pixel is `rgb(23,39,47)` against a card surface of `rgb(15,20,23)` — a real step, and
the softest one in the drawing. Recorded, not decided; that is #71's question, and #88's looks 2 and 3
are what decide it, at a mid Level rather than at the ceiling.

> **Erratum, 2026-09-11 (#93).** The comparison in the paragraph above is sheet against sheet, not
> sheet against app: `.44` down to `.04` is this sheet's own vertical panel (line 358), while the
> app's tokens were `.50 → .04` (carrier), `.46 → .05` (modulator), `.42 → .04` (signal). The
> `rgb(23,39,47)` against `rgb(15,20,23)` step remains a valid reading of the sheet at `.10`; it is
> not a reading of the app, whose faint stop is roughly half that. The finding — *the edge the
> ceiling rule measures against is the faintest ink on the card* — survives and is sharpened, since
> it turns out truer of the app than of the sheet it was written about. The build at the time did not
> draw the rotated ramp at all; #93 turns it, keeps the app's stops as provisional, and puts the faint
> stop on the verification list as a comparison looks 2 and 3 carry (ADR-0008 §2.6, §8).
>
> **And the comparison was taken, 2026-09-11 (#88).** The app's faint stop is `.10` since then —
> the same digit as this sheet's, arrived at from the app's own ink and not adopted from here: on
> the 100 px track of the eight-column card the `.04` tip left the 99 / 96 notch invisible and a
> mid-Level bar's end a ten-pixel guess, and `.10` reads on both cards without turning the grid's
> ceiling into a rim. ADR-0008 §8 · 10 is the record.

**Progress or loudness.** §10c names the fear honestly: *a batten filling rightwards may read as
progress or as time.* On a single nearly-full bar in isolation that ambiguity is real. It is not what
the sheet actually shows: three bars of visibly different length, sharing a left edge, against a
common mark near the right, do not read as three progress bars — they read as a comparison, because
progress bars are not drawn stacked and compared. The disambiguating context is the drawing's own,
and the drawing always has it.

**Side by side, §10c.** The grid node's vertical fill at `96` and the wide stacked node's horizontal
bar at `96` make the same claim in the same ink. Neither looked like a different kind of object from
the other. The grid node's datum is a horizontal dash near the top; the stacked node's is a vertical
dash near the right; both read as a reference mark clear of the border rather than as a rim on the
fill.

## What this look does not settle

1. **It is not the app's ink.** Look 1 on the verification list is the confirmation in the app, and it
   is still owed.
2. **The track measured is the batten's 292 px, and that is the easy question.** The binding instance
   is the **wide stacked node at eight columns** — a 119 px card, 108 px of track, 1.08 px per Level
   point — and the sheet does not draw it. §10c's stacked node is at its 190 unit cap, not at the
   column cap. A bar that reads over 292 px says little about one over 108, and 99-against-96 there is
   3.2 px rather than 9. **The app confirmation has to be taken on that box**, or it repeats the trap
   the round already named once: judging the datum on the card where it is easiest.
3. **Three cards, not eight, and no lit carrier.** *One origin, one scale* is the first of the three
   conditions on the rotation and this sheet cannot test it: three cards share a left edge here
   because they were authored at the same `left`, not because a layout put them there.
4. **The far edge is soft**, per the measurement above. Left open for #88's looks 2 and 3, and decided
   in #89.

## What follows

The round proceeds: Blocks 1 through 10 are unblocked by this answer. The confirmation stays on the
verification list as look 1 — *the horizontal bar confirmed in the app's own ink* — and #84 carries
this record's status into ADR-0008 as the ground for the `Accepted` status, together with the note
that a negative confirmation in the app **supersedes** 0008 rather than amending it.

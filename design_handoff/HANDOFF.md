# Round 10 delivery — the operator diagram

**Do this first: delete `design_handoff_fase1_ui/` from wherever the earlier download left it.** A zip
cannot delete, so no bundle can do it for you. It is 181 lines behind the repository, it still carries
a dangling `§16.4`, and reading it is what produced two findings that `ROUND10-PROPOSAL.md` §0
retracts. Nothing in this delivery replaces it, because nothing in this delivery is a copy of it.

## What is in here, and it is only what this side produced

| file | what it is |
|---|---|
| `ROUND10-PROPOSAL.md` | the round: three decisions about the wide drawing, the proposed diff to `DESIGN.md` §9 / §10 / §20, the `GLOSSARY.md` entries, what retires, and the ADR argument |
| `Round10-operator-diagram.dc.html` | the probes, `10a`–`10f`. Open it in a browser; it needs `support.js` beside it and nothing else |
| `support.js` | the runtime the sheet loads. Not a deliverable |

## What is deliberately **not** in here

`DESIGN.md`, `GLOSSARY.md`, `CONCERNS.md`, `README.md`, `design-tokens.css`, rounds 3–8, the
directions, the system sheet, `screenshots/` and `sources/`. **They exist once, in the repository, at
`design_handoff/` — read them there.** That is the path the source comments cite by §, and shipping a
second copy alongside it is what this round spent a section arguing against: two copies that disagree
announce themselves, two that agree today are invisible until the next round drifts one of them.

Everything in the proposal is written against `design_handoff/` at **`52eb91b`** — the commit that
landed #67, the fill's track and the ceiling's daylight.

## One upstream edit this round asks for, as a diff rather than a fork

`design_handoff/design/Index.dc.html` wants a round-10 card at the top of its grid, above the round-8
one. Same markup as its siblings, `#58c8f5` border, linking to `Round10-operator-diagram.dc.html`:

> **ROUND 10 · 10a → 10f** · NEWEST · PROPOSAL
> **The wide drawing, decided as one thing**
> Three questions that compete for the same pixels — the ceiling reference, the card's width, and
> whether eight rows get drawn in full — answered together against algorithm 66. Level turns onto the
> axis its composition states, the ceiling becomes a vertical rule, and the chain folds its facts
> instead of its rows. Every figure read out of the build or measured off the hardware.
> `READ ROUND10-PROPOSAL.md ALONGSIDE IT · THE DIFF IS PROPOSED, NOT APPLIED`

## Read in this order

1. The repository's `design_handoff/GLOSSARY.md`, then `DESIGN.md` §9, §10 and §20 — the vocabulary
   and the rules as they stand today.
2. `ROUND10-PROPOSAL.md` §0, which says what moved under this round and retracts two findings.
3. `Round10-operator-diagram.dc.html`, with §1–§4 of the proposal open beside it.

## What is agreed and what is not

**The repository's handoff is the agreed one. Build against that.** This proposal is not applied
anywhere: `TRACK_INSET` and `DAYLIGHT_FLOOR` are live in the build today, and the proposal is what
would retire them. If you are implementing this week, implement the handoff — the proposal tells you
which parts are about to move and why.

Five things in it are open on the owner or on the hardware rather than on the design: whether a route
into a parked operator is drawn inert (a claim about the sound, §5); whether a horizontal bar reads as
loudness at all — **narrowed on 2026-09-10 (#78)**: the sheet was read as a rejection test and did not
reject, so what is still open is the confirmation in the app's own ink, on the wide stacked node at
the column cap, in `docs/results/2026-09-10-la-barra-horizontal.md`; the two rotated daylight figures (6.9 px on the batten, 6.1 on the wide stacked node
at the column cap), derived and unlooked-at on either box; **rule 20's 6 px of visible line, which is
chosen rather than judged and decides the 5-row bin to within 0.15 px**; and #66's second arm, which
is a measurement nobody has taken.

# CONCERNS.md — where I disagree, and what I still owe you

A living list. Each entry says **what you asked for**, **what I did**, and **what I am arguing with you
about or still owe**. Closed entries stay as a record.

State as of 2026-09-09, after round 9. **Numbers never change** — they are what chat, comments and the
other documents refer to. An entry that has been settled since it was written says so at the top rather
than filing its resolution two hundred lines away.

**Open right now: §17, §23.1, §29 and §31.** Everything else on this page is closed. §32 is deferred by
the owner, which is not the same as open.

---

## CLOSED

### 1–7 · Round 4

Waterfall promoted (`4a`) with `NOT A HARMONIC · 2756 Hz` recovered · the two missing screens delivered
· HUSH with its tension resolved · what it cost to fit accepted · my three data errors corrected · the
Op3 risk reframed · no decision reverted.

### 8–14 · Round 5

**8** A/B is a mode, not a screen — closed in my favour. **9** The chip says the consequence, not the
fault. **10** The badge that jumps from 12 Hz to 2 Hz, for your reason, which was better than mine: it
is the only place where you can see that capturing costs something. **11** The order of the
`Receive Bulk` probe was wrong and you were right; `4e` draws the five steps and restores with a
Parameter Change. **12** The operator editor is `5a`, and it was the big hole, not "a hole without
drama". **13** The sweep is `5b` and the trajectories **are** the Bessel functions. **14** The SysEx
console is `5c`, and as a drawer: you have to see the verification while it happens.

### 15 · How many captures per step — **closed by your decision, and it is better than my question**

I asked you for a number; you gave me a criterion. **One per step, and a second pass only over the
doubtful ones.** Drawn in `6e`, and you are right that it opens a state I had not foreseen: the map is
drawn **complete, with points marked as unreliable**, which puts the sweep into the same provenance
vocabulary as the rest of the app — it is not "measured" versus "not measured", it is *measured with how
much confidence*.

What I added on my own, and it goes with your criterion: **when a step comes out doubtful is a
calculation, not a threshold the user sets** (a partial less than 12 dB above the floor, or less than
one step from a zero of the fitted `|Jₙ|`), and a refined point **shows its spread** (`−43.8 ±0.6`).
Without the spread, three averaged captures are exactly as opaque as one.

### 16 · `YOU ARE PLAYING` — **closed: measured, no longer an inference**

The amber box in `4c` is gone; that chip is now `MEASURED · phase 0e`. I accept your correction to my
earlier §16: **MIDI first, audio as a degraded fallback**. You were right about the argument I was
missing — the note count and the velocity are what make the chip information rather than an indicator
lamp, and audio cannot give that. My sentence survives where it actually helps: if incoming MIDI is
closed, `AUDIO IS COMING IN THAT I DID NOT ASK FOR`.

### 18 · `48 00 52` → `48 00 48` — **closed: explained**

A reserved address, undefined behaviour, took its neighbour down with it at its `1E` default. The `5c`
text is updated. And I agree that **what stays in place is worse**: reserved addresses answer a read as
if they were real (`51→00 · 52→00 · 53→00 00 · 55→00`, only `54` stays silent), so the list **is not
discoverable by asking** and the app carries it internally. It is written in `6d` beside the list that
*is* learned by measuring.

### 19 · The warning blocks, but only what broke — **decided, and here is the defence**

You asked me to decide it. Your instinct ("with live state yes, without live state no") is the right one
and I applied it, with one qualification I think matters: **blocking does not mean modal**.

- **Nothing in progress** (`6b`): there is no warning to attend to. The new name, the reread, and two
  notices that clear themselves. Messing with sounds is exactly what the owner is going to do; if the
  app scolds him every time, it gets in the way of the one thing he was going to do anyway.
- **With live state** (`6c`): the warning anchors **to the voided thing** and takes away its normal
  actions. The rest of the app stays alive. A centred modal would also switch off what **is** still
  true — and one thing never stops being true: the live view, which is audio arriving now.

The underlying reason is the same as the whole app's: **an invalid measurement that looks valid is the
one failure this project cannot afford.** Carrying on quietly would produce a false lesson.

What I do argue with is the word "paused": in `6c` there is no "resume". Resuming a sweep broken by a
sound change would give a Bessel map that looks good and is not.

### 20 · Note counting is by pitch, not by message — and what that costs

Your `Multi` trap is real and I resolve it like this: **the app counts distinct pitches**, not messages.
A key arriving on four channels within 28 ms is **one note**, because the pitch is what sounds and the
channel is transport. Correct in `Single` and in `Multi` without knowing which one you are in.

Two consequences I accept, and one I owe you:

- **The mode is derived, not read**: if the same pitch arrives on more than one channel, the app *knows*
  it is in Multi and can say so. No need to read the setting (and we do not know whether it can be).
- **One legitimate case is lost**: two layered Parts sounding the same key are, to the app, one note. I
  think that is the good trade — this is an FM analysis app, not a polyphony counter.
- **What I owe you**: the raw counts (messages per channel) still exist, but **only in the drawer of
  `5c`**, which is where traffic lives. The header carries the figure you can read at a glance.

### 21 · The read-only list — **closed, and your third option is the right one**

I gave you a pair (remember or forget) and you saw what I had missed: **checking is free**. A write and
a read-back are ~4 ms, so there is no need to choose between freezing a conclusion and paying for a
failure once per session.

Applied in `6d`: **remember, and silently re-probe once per session**, the first time the app is about to
write that address. If it still will not take, **nothing is said** — the app already knew, that is not
news. If it does take, the address **leaves the list** and that *is* reported, with a card in
`UNCONFIRMED`: the app had learned something false and has just corrected itself.

And on your question of whether "reconfirmed" is noise: **it is not, but only as a mark**. It goes as a
9 px pill on the entry (`RECONFIRMED TODAY`), not as a line of prose. The reason is consistent with the
rest of the app: it is the difference between *"I know this from this session"* and *"I am carrying this
from another day"*, which is exactly what separates a fresh poll from a stale one on any other figure.

### 22 · The tempo does not go in the badge — **decided, and I am not asking for a screen**

You asked for a decision, not a screen. Mine: **the poll badge stays as it is** (two stable values) and
the tempo goes **beside the anchor**, in the check screen, as `TEMPO 90 BPM · background 40 msg/s`.

The reason is yours from §10 taken to its conclusion: a number that jumps when the situation changes is
information, but **a badge with three different causes no longer says which one changed**. And the tempo
is not a property of the keyboard or of the moment: it is a **property of the loaded sound**, like the
algorithm or the chain. Its home is where the sound's name lives.

### 24 · Following (round 7) — three decisions, one of which I half-argue with

**Suggestion and not a jump**, even with the rail of the eight one touch away. Your argument for the jump
(the rail brings you back) is true but incomplete: what cannot be interrupted is not the navigation, it
is **the gesture**. If focus jumps while you are dragging a point on OP3's AEG, the drag breaks
mid-curve. A suggestion waits for you to lift your finger; a jump does not. In ALL EIGHT the question
does not arise: all eight are already on screen, so there following **moves nothing** — it leaves a
trace.

**The sentence does not promise what it cannot know.** Never "you are on OP7": always "you just touched
something on OP7", with the address and the old and new value. And one suggestion at a time, the last
one, clearing itself after 6 s. Five changes across five operators are not five bands: they are one band
and five marks on the rail.

**The two rings: it gets said.** And there is a consequence I found more interesting than the stale
question itself: **opening an operator slows following down**, because the two rings share the channel.

So the stale threshold is **four times the period of its own ring**, and the cadence is said **once per
zone in its header**, not on every figure. No new badge: the provenance vocabulary that already exists is
enough, and a second stamp on every number would be exactly what §22 rejected for the tempo.

> **Corrected by the running build (§35.3), and this is why the rule was written as a rule.** The
> thresholds published in round 7 (0.33 s / 0.66 s) were derived from a 12.2 Hz wide ring. The build
> achieves 10.0–10.4 Hz, so they are **0.40 s and 0.80 s**. Nothing was redrawn and no reasoning
> changed — two labels changed. Had round 7 published the numbers instead of the rule, this would have
> been a redesign.

What I did **not** do, and it was the risk: turn this into a mode. There is no "mirror mode". There is a
switch (`FOLLOW ME`), a trace per card, and a reversible suggestion.

### 25 · My reading of where phase 1 stands — **superseded, and the recommendation was taken**

At the end of round 7 I said: the surface is complete, what is missing is implementation, stop polishing
and start building. That was right and it was followed — steps 1–4 are implemented and have been run
against the real MODX8.

What I had not foreseen is that the biggest hole was not a screen but **the vocabulary**: the owner used
the app and still could not say what `TEORÍA` meant on an operator node. That is what rounds 8 and 9
were for. The rest of the reading stands: what remains open is decisions and data risks that get
resolved by implementing or measuring, not by drawing.

### 26 · The naming pass — three calls on the record

The full table is in `GLOSSARY.md`. Three decisions are worth defending here because they are the ones I
would expect pushback on.

**`TEORÍA` → `PREDICTED`, not `CALCULATED` / `COMPUTED` / `DERIVED`.** All four are true and only one is
the point. `CALCULATED` and `COMPUTED` say arithmetic happened, which nobody doubts. `DERIVED` says it
came from other data, which is equally true of a polled value. **`PREDICTED` is the only candidate that
implies the number can be wrong** — and the whole project exists because the MODX's real fundamental does
not land where `note frequency × ratio` says. It also covers the Bessel overlay with the same word, so
the node stamp and the theory line stop needing two vocabularies.

**`MIRAR` / `MEDIR` → `LIVE` / `CAPTURE`.** `WATCH` / `MEASURE` would have shipped the confusion intact:
two verbs from one family, both meaning *look at the sound*. `LIVE` and `CAPTURE` are not the same part
of speech — a state and an act — so **the grammar separates them before the reading does**. And it hands
the app the noun it never had in Spanish: the shutter leaves behind *a capture*, which has a window size,
an age and a note.

One consequence I accepted deliberately: **the act is `CAPTURE` and the provenance stamp is `MEASURED`.**
Two words for what a naive reading calls one thing. It is not sloppiness — the button is something you do
and the stamp is where a number came from, and collapsing them would put the verb back on the figures.

**`CREAR` → `BUILD`, not `CREATE`.** `CREATE` is the vaguest verb in software. You are assembling a sound
out of eight parts with a known topology; `BUILD` says so, and it pairs with `LEARN` as two things a
person does rather than two nouns.

**And two words that were the build's, not mine** (§35): `DOCUMENTED` and `HUSH`. Both times the
implementation was ahead of the design document, and both times for the same reason — **whoever is
holding the real data finds the missing category first.**

### 27 · Do the five stamps need five words — **no. Four words and two shapes.**

Decided, and it is a reduction, not a loss — though the honest count went **up** before it came down. The
running app revealed a source I had missed (`DOCUMENTED`, §35.1), so there were six states rather than
five. `MEASURED`, `PREDICTED`, `POLLED` and `DOCUMENTED` keep their word because they are four different
**sources** and no shape distinguishes a provenance claim. `DOCUMENTED` takes the rule that writes
itself — **paper has no colour**: neutral ink, solid outline, the only neutral-and-solid pair in the
palette.

`CADUCO` loses its word: stale is `POLLED` **plus age**, and the design was already drawing both halves —
the broken outline and the seconds. `POLLED · 0.40 s` in a broken outline says it twice; the word said it
a third time. This is the stamp that appears most (forty addresses, ten times a second), so it is where
the ink actually was.

`INVALIDADO` loses its word too: round 6 already decided that a void figure **keeps its shape and loses
its figure**. A dash inside a kept outline *is* the stamp, and writing `VOID` next to a dash both labels a
blank and puts uppercase text exactly where the eye is hunting for a number. Where it has to be said in
words it is said **once per zone**, in the sentence that already exists: `NOT MEASURED IN THIS SOUND`.

Six states, all still distinguishable in greyscale, two words fewer than they would have cost. Drawn in
`8b`; the table is `DESIGN.md` §20.7.

### 28 · The operator node drops the miniature AEG — **closed, accepted by the owner**

You asked how Level maps to fill height and what the spectral form looks like as a glyph. Answering both
honestly forced a third answer I was not asked for, so I flagged it rather than burying it: **round 3
asked the node to hold six facts in 118×108 and it holds five.** The ellipsised `×0.50 ...` is the symptom
of the overload, not of a text-versus-drawing mistake.

**Accepted.** The alternative on the table was dropping the predicted Hz instead, which I argued against —
that figure is the one that makes the node teach anything, and it is the example the whole naming pass
turned on. The screenshots settled it either way: the ratio row reads `×0.50 ...` in all eight nodes, so
the box was over budget before the AEG was even drawn.

**Level → fill height: linear 0–99, and I will not expand it.** Any non-linear mapping makes the fill
height stop meaning the figure, which is the spreadsheet trap wearing a new costume. The clustering at
71–99 is real but it is not a mapping problem: it is that eight fills each had their own private
baseline. One shared **ceiling datum** turns eight absolute heights into seven readable gaps. Drawn in
`8c`, written up as `DESIGN.md` §9.

### 30 · The algorithm swap is automatic — and here is the risk I am taking

Decided: **automatic on "nothing measured yet", with one pin.** Not a mode (a mode needs a switch, a
switch needs a home, and the whole argument for the trade is that the empty panels should not need
managing) and not a plain toggle (that makes the user do bookkeeping the app can do from state it already
has).

The risk, stated plainly: **the layout moves under the user at the moment they press `CAPTURE`.** I think
that is acceptable and even good — it reads as the consequence of the press, it happens over
`--dur-settle` (420 ms), and it happens on a deliberate act rather than spontaneously. But it is a layout
change nobody asked for, at the moment of highest attention, and if it turns out to be annoying in the
running app the fix is small: make `KEEP IT BIG` default to on after the first capture of a session. I
would rather find that out from use than guess it now.

The second-order effect is the one I would watch: the sound changing underneath voids the capture, so
**the algorithm would grow back on a Performance change**. That is correct behaviour and also a big
movement at a moment already full of movement (the change flash, the reread strip). If those two collide
badly, the algorithm's regrowth should wait for the reread to finish rather than race it.

### 33 · What I could not settle — **all three resolved or moved**

**33.1 · ~~The real screenshots never arrived~~ — closed.** They arrived, every answer was checked
against them, and the results are in §35 and `8h`. The one I most wanted settled was settled: the ratio
row reads `×0.50 ...` in **all eight** nodes, which is overload and not a CSS accident.

**33.2 · ~~The documents are not all in English~~ — closed in round 9.** `DESIGN.md`, `CONCERNS.md`,
`README.md`, `GLOSSARY.md`, the token file's comments and the screen copy are all English, the `design/`
files carry their English names, and the round-8 chapter has been folded into the sections it corrected
so that each rule is stated once. The sequencing was deliberate and it paid: locking the vocabulary first
meant the copy was rewritten once instead of twice.

**33.3 · Moved to §23.1**, where it belongs — it is a data risk, not an unsettled decision.

### 34 · What I did not do, and would push back on being asked to

- **No new screen in rounds 8 or 9.** Round 8 added one piece sheet (`Round8-pieces.dc.html`) and modified
  existing screens; round 9 added nothing at all. Two of round 8's answers were **removals**.
- **No settings surface for the temporary instruments.** The bench drawer holds them; it is not a
  developer panel and it does not grow options.
- **No prose caption anywhere.** `8e` removes the app's only sentence of prose rather than computing a
  new one. If the app is going to describe the shape of a capture, that claim gets stamped `PREDICTED`
  like every other derived claim, and it is a feature rather than caption copy.
- **No rule changed while folding.** Round 9 was editorial. Where folding made me want to change
  something, it is raised in §29 and §36 and the rule is left alone.

### 35 · What the running app taught me

**35.1 · `DOCUMENTED` is a fourth provenance source, and it is the app's word, not mine.** The build
already stamps the diagram `RUTAS · DOCUMENTADO`, and whoever wrote that was right. The topology is not
polled and not measured: the app polls **which** algorithm is loaded and then reads who-feeds-whom out of
Yamaha's FM-X table. That is paper, and paper is a different kind of claim from anything else on screen.
My glossary had four sources where there are five, and §27 is corrected to four words and two shapes. Its
colour rule follows from what it is — **paper has no colour**.

**35.2 · `CALLA` is a better word than `PÁNICO`.** Also the build's, also right. *Panic* names the user's
emotion; every other failure state in this app names what happens. English: **`HUSH`**, imperative, four
letters at 56 px. `SILENCE` is the alternate if `HUSH` reads too soft.

**35.3 · Four figures and one count were the spikes', not the app's.** Noise floor **−66 dB**, not −104.
Wide ring **10.0–10.4 Hz**, not 12.2. Reread set **383 of 384**, not 416. Bulk dump **19 003 B in 123
messages**, not 7 669 B. Temporary readout: **five blocks**, not three. All are propagated through the
round-8 pieces and the documents; the four that still sit in `design-tokens.css` are §29.

The one with a design consequence is folded into §24: the stale thresholds become 0.40 s and 0.80 s, and
**the rule survives untouched**.

**35.4 · One defect was worse than the note described.** The measured column does not merely sit empty:
it repeats a variant of "not in this session" under **four separate cells**, plus a fifth sentence under
the last. So the emptiest region of the screen is also the wordiest, and none of the five says that
`CAPTURE` is what fills it. `8d` replaces all five with one sentence, one shared shutter glyph, and each
cell's own unit.

---

## OPEN

### 17 · What is still not designed — unchanged, and I agree with your ordering

- **Saving to the MODX's memory.** All the work is on the edit buffer, which is what makes none of this
  dangerous. The day it really saves, it will need a screen and a warning.
- **Patch library and DX7 corpus.** Out by your decision, last phase.

### 23 · Data risks that are still live — none blocks, all affect a sentence

Ordered by what it would cost if they come out the other way.

**23.1 · The anchor has a ~1.5 s blind spot per capture — declared, not drawn. Still open, and still the
only real hole.** The name poll at 1 Hz cannot run inside the 65 536-sample window (1.486 s) without
putting traffic into the capture. So if the sound changes exactly there, the app finds out **when the
capture ends**, not during. The design survives it (the capture is marked as belonging to another sound
as soon as the anchor comes back), but it is not drawn on any screen, and a documented hole is a decision
while a hole that only exists in the complaints file is a surprise waiting for phase 1. It is in
`README.md` as a known property of the anchor, alongside its cadence and its cost.

Round 8 gave it one new consequence worth writing down: with `LIVE` and `CAPTURE` named as a state and an
act, **the blind spot is now easy to say** — "the anchor cannot poll inside a capture" is a sentence a
user can understand, where "el sondeo no puede correr dentro de la ventana de FFT" was not.

If you want it drawn rather than declared, the honest place is the `CAPTURE` button itself: for the 1.5 s
the shutter is open, the anchor's dot goes to the void vocabulary (shape kept, figure gone) and comes back
when the window closes. **That is one small piece of drawing and I have not done it, because you have
twice decided this should be declared and not drawn.** Say the word and it is a ten-minute change.

2. ~~If `Bank Select` / `Pgm Change` are receive-only~~ — **closed by the paper, and you corrected me
   well**: the Reference Manual says they govern *both in transmission and reception*, and both were
   `ON`. So the easy explanation for the zero is dead and there is no "remote setting that does transmit
   it": **the anchor poll is not the best source, it is the only one.**
3. **`MIDI I/O Mode = Hybrid` has not been tested.** If it distributes notes differently, my rule from
   §20 (count by pitch) still holds — which is exactly why I chose it.
4. **`Super Knob CC` went back to 95 unverified** (the user returned it, not the measurement). If it
   stayed `off`, the app will see incoming SysEx on `30 4B 00` that it did not ask for. `6d` treats that
   as what it is: legitimate transmission by the keyboard, not a fault.
5. **MODX-2 and MODX-3 deliver not even clock**, so their silence is not interpretable. Nothing drawn
   uses them.
6. **WinMM and 2-byte messages** are still unverified end to end. That is a listener risk, not a design
   risk.

### 29 · Token values: four are stale, one is missing, and this needs your decision

**No token name or value changed in rounds 8 or 9.** The names were already semantic and already English,
so the language pass did not touch running code — only the file's comments, which are now English along
with everything else.

But §35.3 leaves the file carrying four figures the running build has since contradicted. I have **marked
them `STALE` in a comment and changed nothing**, because you said no value changes and because
`design-tokens.css` is the single source of truth — I would rather you change it than find that I did:

```
--probe-idle: 12          the build achieves 10.0–10.4
--ring-wide-hz: 12.2      same
--stale-wide-s: 0.33      derived from 12.2; at a real 10 Hz it is 0.40
--stale-narrow-s: 0.66    same; at a real 10 Hz it is 0.80
--reread-total: 416       the build rereads 383 of 384
```

This is the one place in the handoff where two documents now disagree on purpose: `DESIGN.md` §20.7 says
`POLLED · 0.40 s` and the token file says `0.33`. **The precedence rule in `README.md` resolves it in the
prose's favour**, but an implementer consuming the token file directly would not read the prose, so this
should not be left standing for long.

And one token is genuinely new. I am **proposing rather than adding it**, for the same reason:

```
--datum-ceiling-stroke: 2px;            /* dashed line across the eight nodes at the patch max */
--datum-ceiling-color: oklch(1 0 0 / .3);
```

Everything else in rounds 8 and 9 reuses existing tokens: `--drawer-grab` and `--drawer-lift` for the
bench drawer, `--dur-settle` for the algorithm swap, `--hit-min` for the corner, `--theory` +
`--dash-theory` for the no-lock scope.

### 31 · The worst case across the 88 algorithms is a data task, not a drawing task

I have sized the algorithm surface by **the bound eight operators can produce** — up to 6 depth levels
with up to 4 parallel branches at one level, which at 150 px nodes and 30 px rows is 1232 × 400 with the
bus. That is arithmetic on eight nodes and it is safe: no real algorithm can exceed it.

What I have **not** done is claim which of the 88 is the worst case, because that needs the depth/width
histogram over the FM-X algorithm table, and inventing it would break the round-1 rule. **If somebody
extracts that histogram, the surface can probably be tightened** — if the real maximum is 4 deep and 3
wide, the panel gets ~80 px of height back, which is 80 px the eight AEGs would like. Cheap task, real
payoff, nobody's blocker. It is the owner's side.

---

## DEFERRED

### 32 · Viewport · **deferred by the owner**

Left open at the owner's request, and not revisited in round 9. The target stays **1280 × 800** and every
piece is authored to it, including the algorithm surface, which fits 1280 and takes the full body width
when nothing is measured. **Nothing assumes extra room, so nothing has to be redrawn when this is
decided** — which is why it was safe to leave open rather than settle by default.

The argument, kept on file for when it comes back: every request in round 8 was a request for room, and
125 % (1536 × 960) is 40 % more area, which would retire the whole list at once — the algorithm surface,
the node that had to drop a fact, the eight AEGs already recorded at 700 of 740 usable px, and the Part
that round 3 flagged as tight. The cost, which is the part that needs agreement rather than analysis:
**the composition would have to be authored fluid between 1280 and 1536**, panels taking fractions of the
row and the algorithm taking the slack, with the **type scale fixed** — nothing scaling with the
viewport, because a 10 px floor that becomes 12 px is a different design and a 24 px figure that becomes
20 px is a broken one. "One canvas" would stop meaning "one pixel size" and start meaning "one
composition", and that is a change to a rule the owner wrote.

---

## ROUND 9

### 36 · What folding cost — the four places the owner should check

Round 9 was editorial: fold the round-8 chapter into the sections it corrected, finish the translation,
change no rule. Four things did not reconcile cleanly and are decisions I made rather than rules I
followed.

**36.1 · The spike figures versus the build's figures — I kept both, in one table.** `DESIGN.md` used to
carry `−104 dB`, `416 parameters` and `7 669 B` in several places as measured facts, because they were:
the spikes measured them. The build measures different numbers. Deleting the old ones would have made
three earlier arguments look like inventions, and leaving them scattered would have made the document
lie in five places instead of one. So the running figures are used everywhere the app is described, and
**the superseded ones survive in exactly one place** — the table in `DESIGN.md` §22 — labelled as what
they are. If you would rather they disappear entirely, that is one deletion.

**36.2 · The algorithm surface got its own section rather than being folded into the main screen.** The
brief said it survives as round-8 material because it has no earlier home; the main screen's section was
arguably its home. Folding it there would have meant one section describing two compositions at once,
which is the exact defect round 9 exists to remove. So it is `DESIGN.md` §10, immediately after the main
screen and before the pieces that hang off it. If that reads as a screen rather than a state, move it in.

**36.3 · The token file's comments were translated, which the brief did not ask for.** §2 scoped the
token work to the two misleading comments. But §2 also says every document ends the round in English, and
the token file is the one an implementer keeps open beside the code — 288 lines of Spanish comments in it
would have undone the point of the pass. **No name and no value changed**; comments only. If you want the
Spanish comments back, they are one revert.

**36.4 · The token file now contradicts the prose on four values, and I left it that way.** See §29. It
is the only deliberate disagreement in the handoff, it exists because "no value changes" and "the build's
figures win" cannot both hold, and it is the one item on this page I would fix first.

**36.5 · Two things kept their Spanish names on purpose.** The three archived direction sheets, and
the twenty-two screenshot files. Both are dated artefacts: nothing is built from them, nothing links
to the screenshots by name, and the screen ids inside them are the stable reference. Renaming binaries
buys an implementer nothing. The archived sheets ship in the handoff folder anyway, so the index's
links resolve rather than 404.

**One thing I checked and did not need to change**: no screen id moved. `3a`…`8h` mean exactly what they
meant, in every document and in the pieces, which is what makes it safe to fold prose around them.

# GLOSSARY.md — the vocabulary of the MODX Analyzer

Round 8. **This is a naming pass, not a translation.** For every term the question asked was not
"what is the English word for this" but "what fact does this number represent, and which English
word makes someone who has never read `DESIGN.md` guess right the first time".

Where the honest answer was *fewer words*, the word is gone and a shape carries the distinction.
See **§2 · The stamps become four words and two shapes**.

**This file is the authority on every user-visible string.** Where any other document disagrees with
§6, §6 wins. If a Spanish string is not in §6, it has no approved English form yet — **ask, never
invent**. §4b was the one such row and **it is closed**: there is no open row today.

---

## 1 · The terms

### Provenance — where a figure came from

| current (es) | new (en) | what it means, in plain language | where it appears |
|---|---|---|---|
| `MEDIDO` | **MEASURED** | This figure came out of a capture: a real 65 536-sample window of real audio. It is the only kind of figure that can contradict the theory. | every figure in the measured column; capture badge; A/B (both sides) |
| `TEORÍA` | **PREDICTED** | Nothing measured this. It is arithmetic on values the app polled — `note frequency × ratio` for the operator's Hz, `\|Jₙ(I)\|` for the harmonic amplitudes. It is a **claim about what should be there**, and the point of stamping it is that it can be wrong. | operator node (the small Hz figure at the bottom); the dashed overlay on the harmonics panel and on the sweep trajectories |
| `SONDEADO` | **POLLED** | The app asked the keyboard by SysEx and the keyboard answered. True at the moment it was read; not measured, not derived. | algorithm, feedback, the eight operators' parameters, the chain, the anchor |
| `DOCUMENTADO` | **DOCUMENTED** | Yamaha's tables say so. Not from the keyboard, not from audio, not arithmetic — from paper. The algorithm's routing is the big one: the app polls *which* algorithm is loaded and then reads who-feeds-whom out of the FM-X table. **This is the app's own word, taken from the running build, and it was right.** | the diagram's routes; parameter ranges and defaults; the reserved-address list of `6d` |
| `CADUCO` | *(word dropped — see §2)* | A polled figure older than four times its own ring period — **0.40 s wide ring, 0.80 s narrow**, at the 10 Hz the running app actually achieves. Still a poll, just old. | now drawn as **broken outline + the seconds**, no word |
| `INVALIDADO` | *(word dropped — see §2)* | The sound changed underneath, so this figure belongs to a sound that is no longer loaded. Unlike stale, **it does not recover by itself** — only a new capture brings it back. | now drawn as **the figure replaced by a dash inside its kept outline**, no word |

**Why `PREDICTED` and not `CALCULATED` / `COMPUTED` / `DERIVED`.** All four are true; only one is the
point. `CALCULATED` and `COMPUTED` say arithmetic happened, which nobody doubts. `DERIVED` says it
came from other data, which is also true of a polled value. **`PREDICTED` is the only one that
implies the number can be wrong** — and the entire project exists because the MODX's actual
fundamental does not land where `note frequency × ratio` says it will. It also carries the same
weight over the Bessel overlay, so one word covers the node stamp and the theory line instead of two.

### The anchor — the polled Performance name everything hangs off

| current (es) | new (en) | what it means | where |
|---|---|---|---|
| `ANCLA` | **ANCHOR** | The name of the loaded Performance, polled at 1 Hz. It is the only way the app can tell the sound changed, because loading a Performance emits nothing. "Anchor" survives translation because it says its job: the one fixed thing everything else is judged against. | primary header, left of the algorithm pill |
| `ANCLA · 1 Hz · 31 00 00` | *(removed from the header — see `DESIGN.md` · **The anchor (`6a`) — the Performance name, promoted to data**)* | Poll rate and SysEx address are debug provenance. They keep their home in the check screen, which the anchor already opens on touch. | check screen only |
| `SIN MEDIR EN ESTE SONIDO` | **NOT MEASURED IN THIS SOUND** | The polls recovered by themselves after the sound changed; the capture did not, and cannot until a note is held again. This is the state the header stays in — it does not return to rest. | anchor eyebrow, after a reread |
| the 2 200 ms flash | **the change flash** | The same flash the tutor's writes use. It is not a term the user reads; it is named here so the two uses stay one implementation. | anchor; tutor write notice |

### The transport pair — the two that are constantly confused

| current (es) | new (en) | what it means | where |
|---|---|---|---|
| `MIRAR` | **LIVE** | The audio bridge is delivering frames right now. Continuous, free, always on, and **nothing you can quote**: no partials table, no ratio, no index. | header pill, with the frame rate: `LIVE · 30 fps` |
| `MEDIR` | **CAPTURE** | One 65 536-sample window taken on a held note. It is the **only** thing that produces the partials table, fc, fm, the measured ratio and the fitted index. One press, one artefact, with an age. | header shutter button: `CAPTURE · 65536`, and the sub-line `NEEDS A HELD NOTE` |

**Why this pair stops the confusion.** `WATCH` / `MEASURE` fails exactly the way `MIRAR` / `MEDIR`
failed: two verbs from the same family, both meaning *look at the sound*. `LIVE` and `CAPTURE` are
not the same part of speech — **`LIVE` is a state and `CAPTURE` is an act** — so the grammar does the
separating before the reading does. And it produces the noun the app was missing: the thing the
shutter leaves behind is **a capture**, and a capture has a window size, an age and a note. There was
no Spanish noun for that; `ÚLTIMA MEDIDA` had to borrow the verb.

The act is **CAPTURE**; the provenance stamp on a figure that came out of it is **MEASURED**. Two
different jobs, deliberately two words: the button is a thing you do, the stamp is where a number
came from.

### Everything else

| current (es) | new (en) | what it means | where |
|---|---|---|---|
| `NOTA SOST.` | **NEEDS A HELD NOTE** | The capture window is 1.486 s of continuous audio, so the note has to still be sounding for all of it. Written as the condition, not the noun — it tells you what to do. | under the CAPTURE button; player state 3 |
| `BARRIDO` | **SWEEP** | Write a parameter at N values, capture at each one, and plot each harmonic's amplitude against the parameter. The plot **is** the Bessel functions, measured. | `5b`; the `SWEEP 0→99 IN 8 STEPS` button in A/B |
| `ARTEFACTO` | **NOT A HARMONIC** | A partial that is not at `\|fc ± k·fm\|` — so it is not the FM the app is explaining. It is marked, never hidden, and never counted as a harmonic. The chip is useless without its frequency: the Hz is what tells a generator comb from mains hum from aliasing. | spectrum panel, top right: `NOT A HARMONIC · 2756 Hz` |
| `PÁNICO` | **HUSH** | All Sound Off + All Notes Off + 2 048 explicit Note Offs. Touches no parameter. **Not `PANIC`** — the running build already renamed it `CALLA`, and that was the right instinct: *panic* names the user's emotion, while every other failure in this app names what happens. `HUSH` is imperative, fits 56 px, and says the outcome. (`SILENCE` is the alternate if `HUSH` reads too soft.) | the one octagon, far right of every header |
| `CADENA LIMPIA` | **CLEAN CHAIN** | Filter at Thru, sends at 0, inserts out, EQ flat — so what reaches the analyzer is the FM and nothing else. | header chip; the Part screen |
| `CADENA SUCIA · NO ESTÁS MIDIENDO FM PURO` | **DIRTY CHAIN · THIS IS NOT PURE FM** | Something between the operators and the output is moving amplitudes that Bessel will not explain. Said as the consequence, because the consequence is the actionable part. | Part screen bar; header chip in alert |
| `PEOR PARCIAL` | **WORST PARTIAL** | The partial where prediction and measurement disagree most, with the gap in dB. The single most useful number in the theory panel: it says *where* the model broke, not just how much. | figures column; theory-vs-measurement footer |
| `PORTADORAS · SUENAN` | **CARRIERS · YOU HEAR THESE** | The operators that reach the output bus. Their level is loudness. | the eight, group frame |
| `MODULADORES · COLOREAN` | **MODULATORS · THEY COLOUR IT** | The operators that feed another operator's phase. Their level is brightness, not loudness — which is the single hardest idea in FM and the reason the word is "colour" and not "modulate". | the eight, group frame |
| `A CERO · CORTAN` | **AT ZERO · SILENT** | Level 0. Present in the algorithm, contributing nothing. Drawn, never deleted — an operator that is off is a fact about the patch. | the eight, group frame |
| `CREAR` | **BUILD** | You make the sound; nobody leads. High density, all eight operators at once. `CREATE` was rejected as too vague — you are assembling something out of parts, and `BUILD` says so. | mode label / mode switch |
| `A-B` | **A/B** | Two values of one parameter, both captured, compared side by side. Unchanged. | mode switch |
| `APRENDER` | **LEARN** | The tutor leads, writes to the keyboard, and you listen. Low density, warm sub-register. | mode switch |
| `CORTE 178 · RES 42` | **CUTOFF 178 · RES 42** | The filter's two figures. *Corte* is cutoff. **Both are parameter values, not hertz** — cutoff is 0–255 in two bytes (`48 0p 0C`) and resonance 0–127 (`0F`). The curve's axis is still frequency, because a curve is a response; the readout is the parameter. | the Part screen, under the filter curve |
| `A MANO` | **BY HAND** | A snapshot the user took themselves, as opposed to one the app took before touching the patch. | the copies list |
| `IR A CREAR →` | **GO TO BUILD →** | The visible door between the two modes. | mode bar |
| `IR A APRENDER →` | **GO TO LEARN →** | The same door, other direction. | mode bar |
| `SEGUIR EN EL PASO 3` | **RESUME AT STEP 3** | Re-enter the open lesson where it was left. *Resume*, not *continue* — the lesson is a place you were already standing in. | the tutor index |

---

## 2 · The stamps become four words and two shapes

The question was whether five uppercase tags are worth their ink. **They are not — but the honest
count went up before it came down.** The running app revealed a source I had missed (`DOCUMENTED`,
§3), so there were six states, not five. Four of them need a word and two were already drawn. The
distinction is untouched — this is a change to how much text it costs, not to what it distinguishes.

**Four keep their word: `MEASURED`, `PREDICTED`, `POLLED`, `DOCUMENTED`.** These are four different
*sources*. No shape can tell "a real window of audio" from "arithmetic on a poll" from "the keyboard
answered" from "Yamaha's table says so" — they are claims about provenance, and a claim needs a word.
Three carry colour (phosphor / amber-dashed / cyan); `DOCUMENTED` gets the rule that writes itself —
**paper has no colour**, so neutral ink and a solid outline. Nothing else in the palette is
neutral-and-solid, so it survives greyscale beside the other three.

**`CADUCO` loses its word.** Stale is not a fourth source: it is `POLLED` **plus age**. The design
already draws both halves — the broken outline and the seconds — so the tag reads
`POLLED · 0.40 s` inside a broken outline, and the word `STALE` is a third statement of something
already said twice. This is the stamp that appears most often (forty addresses, ten times a second),
so it is where the saving actually lands.

**`INVALIDADO` loses its word too.** Round 6 already decided that a void figure **keeps its shape and
loses its figure**, marked with a dash. A dash inside a kept outline *is* the stamp. Writing `VOID`
next to a dash is labelling a blank — and worse, it puts uppercase text where a number used to be,
which is the one place the eye is looking for a number. Where it has to be said in words it is said
**once per zone**, in the header, as the sentence that already exists: `NOT MEASURED IN THIS SOUND`.

What that leaves, per figure:

| state | word | shape | colour |
|---|---|---|---|
| measured | `MEASURED · 65536` | solid outline | phosphor |
| predicted | `PREDICTED` | dashed outline | amber |
| polled, fresh | `POLLED · 10.4 Hz` (once per zone) | solid outline | cyan |
| documented | `DOCUMENTED` | solid outline | **neutral — paper has no colour** |
| polled, stale | `POLLED · 0.40 s` | **broken outline** | cyan, dimmed |
| void | — (a dash) | kept outline, no fill | neutral, no fill |

Two words fewer than the six states would have cost, all six still distinguishable in greyscale, and
the two that lost their word are the two that were already unmistakable by shape.

---

## 3 · Terms that are new in round 8

| term | what it means | where |
|---|---|---|
| **the ceiling datum** | One dashed 2 px line drawn across all eight operator nodes at the patch's highest Level. Real patches cluster their operators between 71 and 99, so eight independent fills look identical; against one shared line the eye reads the **gaps**, which is the comparison that matters. The fill stays linear 0–99 — see `DESIGN.md` · **The operator node**. | operator nodes on the main screen; the eight |
| **the corner** | A 44 × 44 open corner mark (two 2 px strokes) at the bottom-right of every operator node. It is the visible path from the node to the operator editor. Not an icon, not a menu, not a chevron: the same mark on all eight, and the words appear **once** in the diagram legend. **The running build draws the corner and holds the legend line back**, because the operator editor does not exist yet and a caption promising a path nobody can walk is a caption lying; the line joins in the same commit as the editor. | operator nodes |
| **the bench drawer** | One bottom drawer holding every temporary instrument (bridge, startup, audio and port readouts #16 / #5, sweep readout #8 — five today, N tomorrow), each as a chip on the 52 px handle **with its ticket number showing**. Closed by default. Same vocabulary as the SysEx console drawer. A temporary instrument that shows its ticket is visibly on its way out. | every screen, bottom edge |
| **the scope contract** | The three things the scope guarantees in writing: which period it locked to, how many cycles it shows, and what it draws when it cannot lock. See `DESIGN.md` · **The scope contract**. | scope panel caption |

---

## 4 · Terms deliberately *not* introduced

- **No word for "the algorithm surface expanded".** It is not a mode and gets no name; it is the
  main screen with nothing measured on it. Naming it would invite a switch.
- **No word for a disabled mode.** An unbuilt mode is absent from the switch, not greyed in it.
- **No "artefact" as user-facing copy.** It stays as the term in these documents; the screen says
  `NOT A HARMONIC` with the frequency.
- **No noun for the live view's output.** `LIVE` produces nothing quotable, and giving it a noun
  would put it back on a footing with `CAPTURE`.

---

## 4b · The one open row — **closed by the running build**

`FE Line` — the small grey readout beside `ALG 37` in the running build's header — **is the feedback
row**. It reads `FB n · OP n`: the Performance's feedback amount and the operator carrying it, both
polled on the wide ring beside the eight operators' parameters. The round-1 rule is satisfied rather
than suspended — the readout has a definition, so it can be named.

**The words do not change.** `Feedback` is Yamaha's own name for the parameter (`48 0p 50`, per Part)
and `OP` is how the instrument numbers its operators, so both fall under §5 and are left exactly as
the hardware spells them. What changed is that the app no longer prints `FE Line`, which was a label
for a fact nobody could state.

**There is no open row left.** Every string the running build renders has either a §6 entry or a form
quoted in the current text of a `DESIGN.md` section.

## 5 · Out of scope — **do not translate these**

**The keyboard's own names.** `LPF24D`, `HPF12`, `BPF12D`, `BEF12`, `LPF18`, `LPF12+HPF12`, `Thru`,
`INIT`, `MODX-1`, `Init Normal (FM-X)`, the menu paths (`[UTILITY]` → `[Settings]` → `[Advanced]`),
the parameter names (`Receive Bulk`, `Super Knob`, `Local Control`, `Freq Mode`, `Spectral Form`,
`Skirt`, `Level Scaling`, `Break Point`, `Coarse`, `Fine`, `Detune`, `Feedback`, `AEG`, `PEG`,
`FEG`) and the mode names (`Single`, `Multi`, `Hybrid`, `Performance`, `Part`). **These are what is
printed on the instrument and in Yamaha's manual.** Translating them would break the one thing the
app's "where to look on the keyboard" panels exist to do: match what the user is staring at. They are
already English on the hardware; leave them exactly as the hardware spells them, capitals included.

**Source-code identifiers and code comments.** The implementer's call, and already English where it
matters.

---

## 6 · Renames — the list running code follows

**One note before the list, because a later pass will otherwise collapse them.** `MEASURED` and
`CAPTURE` are **two words for two different things** and neither is a synonym of the other.
`CAPTURE` is the **act and its noun** — the press, the 65 536-sample window it takes, and the artefact
it leaves behind with a size, an age and a note. `MEASURED` is the **provenance stamp** on a figure
that came out of one. So `MEDIDA` (the readout label, a noun for the thing) becomes `CAPTURE`, while
`RATIO MEDIDO` (a figure and where it came from) becomes `MEASURED RATIO`. Translating them to one
word would take the stamp with it and leave every figure on screen unable to say what kind of claim it
is, which is the distinction §2 exists to keep.

**Copy strings** (user-visible):

```
MEDIDO                                  → MEASURED
TEORÍA                                  → PREDICTED
SONDEADO / SONDEANDO                    → POLLED
CADUCO                                  → (dropped: POLLED · <n> s + broken outline)
INVALIDADO                              → (dropped: dash in kept outline)
MIRAR · 30 fps                          → LIVE · 30 fps
MEDIR · 65536                           → CAPTURE · 65536
NOTA SOST.                              → NEEDS A HELD NOTE
ÚLTIMA MEDIDA                           → LAST CAPTURE
ANCLA                                   → ANCHOR
ANCLA · 1 Hz · 31 00 00                  → (removed from header; lives in the check screen)
SIN MEDIR EN ESTE SONIDO                → NOT MEASURED IN THIS SOUND
BARRIDO / BARRER 0→99 EN 8 PASOS        → SWEEP / SWEEP 0→99 IN 8 STEPS
ARTEFACTO 2756 Hz                       → NOT A HARMONIC · 2756 Hz
ARTEFACTO · NO ARMÓNICO                 → NOT A HARMONIC
PÁNICO / CALLA                          → HUSH
DOCUMENTADO                             → DOCUMENTED
RUTAS · DOCUMENTADO                     → ROUTES · DOCUMENTED
ALGORITMO 06 / ALG 37                   → ALGORITHM 06 / ALG 37
LOS OCHO · 10 Hz                        → ALL EIGHT · 10 Hz
VIVO                                    → LIVE
SUELO                                   → FLOOR   (absolute dBFS, one meaning everywhere)
PARCIALES                               → PARTIALS
los ajustes no entran en esta sesión    → (removed — see DESIGN.md · The measured column
                                           before the first capture)
hay que volver a medir                  → NOT MEASURED IN THIS SOUND
CADENA LIMPIA                           → CLEAN CHAIN
CADENA SUCIA · NO ESTÁS MIDIENDO FM PURO→ DIRTY CHAIN · THIS IS NOT PURE FM
LIMPIAR LA CADENA                       → CLEAN THE CHAIN
PEOR PARCIAL                            → WORST PARTIAL
PORTADORAS · SUENAN                     → CARRIERS · YOU HEAR THESE
MODULADORES · COLOREAN                  → MODULATORS · THEY COLOUR IT
A CERO · CORTAN                         → AT ZERO · SILENT
CREAR                                   → BUILD
APRENDER                                → LEARN
PORT / MOD / INACTIVO  (node role)      → CARR / MOD / ZERO
FE Line                                 → FB n · OP n   (the feedback row; FB and OP are Yamaha's — §4b)
DIAGRAMA DE OPERADORES                  → ALGORITHM
ESPECTRO / ARMÓNICOS / WATERFALL        → SPECTRUM / HARMONICS / WATERFALL
CIFRAS MEDIDAS                          → MEASURED
SIN CONFIRMAR                           → UNCONFIRMED
REPARAR Y VERIFICAR                     → REPAIR AND VERIFY
ESCRITO Y VERIFICADO / ✓ releído        → WRITTEN AND VERIFIED / ✓ read back
EMITE · NO ACEPTA                       → SENDS · WON'T TAKE
LO QUE LA APP HA APRENDIDO              → WHAT THE APP HAS LEARNED
RECONFIRMADA HOY                        → RECONFIRMED TODAY
TOCA LA APP                             → THE APP IS PLAYING
TOCAS TÚ                                → YOU ARE PLAYING
HAY UNA NOTA MÍA VIVA Y NO DEBERÍA      → A NOTE OF MINE IS STILL SOUNDING
TE SIGO                                 → FOLLOW ME
SIN CAMBIOS TUYOS                       → NOTHING FROM YOU
IR AL OP7 / SIGO AQUÍ                   → GO TO OP7 / STAY HERE
LO ESCRIBIÓ EL TUTOR                    → THE TUTOR WROTE THIS
SE PONE UNA VEZ Y SE OLVIDA             → SET ONCE, THEN FORGET
LOS OCHO                                → ALL EIGHT
DÓNDE ESTÁS                             → WHERE YOU ARE
ESTO NO HA MUERTO · ES AUDIO            → STILL TRUE · THIS IS AUDIO
AQUÍ CAMBIÓ EL SONIDO                   → THE SOUND CHANGED HERE
CONGELAR Y GUARDAR                      → FREEZE AND KEEP
CONVERTIR EN LECCIÓN DE 5 PASOS         → TURN INTO A 5-STEP LESSON
ANTES DE QUE LA APP TOCARA NADA         → BEFORE THE APP TOUCHED ANYTHING
GUARDAR Y SEGUIR / NO TOQUES            → SAVE AND CONTINUE / DON'T TOUCH IT
```

**File names** (`design/`) — **applied in round 9**, every cross-reference updated:

```
Pantalla-principal.dc.html    → Main-screen.dc.html
Ronda3-pantallas.dc.html      → Round3-screens.dc.html
Ronda4-piezas.dc.html         → Round4-pieces.dc.html
Ronda5-pantallas.dc.html      → Round5-screens.dc.html
Ronda6-pantallas.dc.html      → Round6-screens.dc.html
Ronda7-piezas.dc.html         → Round7-pieces.dc.html
Sistema-A-componentes.dc.html → System-sheet.dc.html
Indice.dc.html                → Index.dc.html
Round8-pieces.dc.html         → (new in round 8, already English)
Direccion-A-Bancada.dc.html   → (archived — keeps its name, not maintained)
Direccion-B-Nebula.dc.html    → (archived — keeps its name, not maintained)
Direccion-C-Plotter.dc.html   → (archived — keeps its name, not maintained)
```

Screen ids (`4a`, `4b`, `3a`…`7b`, `8a`…`8h`) **do not change**. They are what chat and comments
refer to, and renaming them would break every cross-reference in three documents.

**Token names in `design-tokens.css`: none change.** They are already semantic and already English
(`--signal-primary`, `--carrier`, `--theory`, `--probe-idle`). Two comments inside the file are now
misleading and are the only edits: `--theory` is described as "la teoría" (now: *predicted*), and
`--probe-idle` / `--probe-playing` as "sondeo" (now: *poll rate*). **No value changes, no name
changes, no consumer breaks.**

One token was worth adding rather than renaming, and round 9 listed it in `CONCERNS.md` §29 rather
than applying it unilaterally: `--stale-*` already existed but there was no token for the **ceiling
datum** stroke, because the datum was new in that round. **Session 2 applied it** —
`--datum-ceiling-stroke` and `--datum-ceiling-color` are in both copies of the file, along with the
five values §29 raised. No token name changed, then or since.

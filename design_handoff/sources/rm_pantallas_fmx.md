# MODX Reference Manual — mapa de pantallas FM-X ↔ direcciones SysEx

Fuente: **MODX Reference Manual**, `modx/modx_reference_manual.pdf` (217 pág.). Secciones útiles
extraídas a texto: `modx/rm_fmx_pages145-159.txt` (Normal Part FM-X Edit) y
`modx/rm_utility_pages187-211.txt` (Utility). Las direcciones vienen del Data List
(`modx/datalist_fmx_tables.md`); el emparejamiento pantalla↔dirección es **inferencia por nombre**
salvo donde la fase 0c ya lo midió.

## Rutas de menú — cierra lo que quedaba pendiente de la fase 0b/0c

| ajuste | ruta real en pantalla |
|---|---|
| **Device Number** (1-16, All, **Off**) | `[UTILITY]` → `[Settings]` → `[Advanced]` |
| **Receive Bulk** (Protect / On) | `[UTILITY]` → `[Settings]` → `[Advanced]` |
| **Bulk Interval** (0-900 ms) | `[UTILITY]` → `[Settings]` → `[Advanced]` |
| **MIDI I/O Mode** (Multi / Single) y **MIDI I/O Ch.** | `[UTILITY]` → `[Settings]` → `[Advanced]` |
| **MIDI IN/OUT** (MIDI / USB), **Local Control**, **MIDI Sync**, **Clock Out** | `[UTILITY]` → `[Settings]` → `[MIDI I/O]` |

Tres cosas que importan al proyecto:

- **`Receive Bulk` puede estar en `Protect`** y entonces el teclado **ignora el bulk restore** — el
  mismo modo de fallo silencioso de siempre. Es lo primero que hay que mirar si un `bulk-send` no
  hace nada. En la fase 0c estaba evidentemente en `On`, pero nunca se leyó en pantalla.
- **`Bulk Interval`** solo afecta a la transmisión *del teclado* al responder un Bulk Dump Request.
  No al envío desde el PC — coherente con que 0 ms de pausa funcionara.
- **`MIDI I/O Mode`**: en `Multi` cada Part usa su canal; en `Single` todo va por `MIDI I/O Ch.` y
  **el arpegio no se transmite**. Relevante cuando la app toque notas.
- Nota suelta del manual: el Super Knob, con `Super Knob CC` en `off`, **transmite por SysEx**. Es
  el único caso documentado de emisión SysEx del MODX, y no toca parámetros de FM-X.

## Árbol de edición FM-X

`[PERFORMANCE (HOME)]` → `[EDIT]` → *selección de Part* → …

### Operator [Common] — bloque `48 0p`

| pantalla | parámetros | direcciones |
|---|---|---|
| `[Part Settings]` → `[General]` | Volume, Pan, Random/Alternate/Scaling Pan Depth, Key On Delay | `00`-`05` (Pan y Volume de Part viven en `31 0p 24`/`25`) |
| `[Part Settings]` → **`[Algorithm]`** | **Algorithm** y **Feedback Level** | `4F` y **`50`** |
| `[Pitch/Filter]` → `[Pitch]` | Pitch Velocity Sens, Random Pitch Depth, Key Follow Sens + Center Note | `06`-`09` |
| `[Pitch/Filter]` → `[PEG/Scale]` | PEG de Part: niveles, tiempos, depth, key follow | `3B`-`46` |
| `[Pitch/Filter]` → `[Filter Type]` | **Filter Type** (19 modos, default Thru), Cutoff, Resonance/Width, HPF Cutoff, Distance, Gain, sensibilidades de velocity | `0B`-`16` |
| `[Pitch/Filter]` → `[Filter EG]` | FEG completa: Hold/Attack/Decay1/Decay2/Release **Time** y **Level**, Depth, velocity y key follow | `17`-`2C` |
| `[Pitch/Filter]` → `[Filter Scale]` | Cutoff Key Follow, Break Points 1-4, Offsets 1-4 | `2D`-`3A` |
| `[Routing]` → `[Ins A]` / `[Ins B]` / `[EQ]` / `[Ins Assign]` | inserciones y EQ de Part | EQ en `27`-`2E` del bloque de Part; el resto sin cruzar |
| `[Mod/Control]` → `[2nd LFO]` | Wave, Speed, Phase, Delay, Key On Reset, Pitch/Amp/Filter Mod Depth | `47`-`4E` |
| `[Mod/Control]` → `[Part LFO]` / `[Control Assign]` / `[Receive SW]` | — | sin cruzar |

**El Feedback sí estaba en una pantalla** — en la del Algorithm, dentro de Part Settings, no en las
páginas del operador. Por eso el barrido del operador de la fase 0c no podía encontrarlo.

### Operator *(1-8)* — bloque `49 op`

| pantalla | parámetros | direcciones |
|---|---|---|
| `[Form/Freq]` | Key On Reset, Freq Mode, Coarse, Fine, Detune, Pitch/Key, Pitch/Vel, **Spectral** (Form, Skirt, Resonance) y la **PEG** del operador (Initial/Attack Level, Attack/Decay Time) | `01`-`0F` |
| `[Level]` | **AEG** (Attack/Decay1/Decay2/Release-Hold Level y Attack/Decay1/Decay2/Release/Hold Time), Time/Key, **Level**, Level Scaling (Break Point, Depth Lo/Hi, Curve Lo/Hi), Level/Vel | `10`-`20` |

Todo lo de estas dos pantallas **ya está medido** en la fase 0c salvo `21`-`24` (offsets de 2nd LFO
y sensibilidades de controlador), que el manual confirma que **no se editan desde las páginas del
operador**.

## Notas de contenido útiles para las lecciones

- **Spectral Form**: solo `Sine` carece de armónicos. Con las demás formas, `Skirt` controla cuántos
  armónicos tiene la onda y `Resonance` desplaza la frecuencia central — `Resonance=0` es la
  fundamental, `Resonance=99` es el **armónico 100**. Skirt y Resonance solo están activos con
  `Res 1` / `Res 2`.
- **Freq Mode = Fixed** hace que `Coarse` y `Fine` fijen la frecuencia absoluta en vez del ratio, y
  **habilita** `Pitch/Vel` y `Pitch/Key`. Encaja con lo medido en la fase 0c: cambiar Freq Mode
  movía también el Coarse.
- **Feedback**: realimenta la salida del operador sobre sí mismo, 0-7.

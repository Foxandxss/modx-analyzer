# MODX Data List — tablas SysEx de FM-X (extracción curada)

Fuente: **MODX Data List**, Yamaha, `modx_en_dl_d0.pdf` (223 pág.), sección *MIDI Data Table*,
pág. 186-220. Modelo declarado en la Implementation Chart: **MODX6/7/8, versión 1.0, 18-JUL-2017**.
No es el Montage. PDF guardado en `modx/modx_data_list.pdf`; texto crudo de la sección MIDI en
`modx/datalist_midi_pages186-220.txt` (211 KB).

> **PROCEDENCIA: documentado, no medido.** Todo lo de este fichero sale del PDF. La fase 0c demostró
> que escribir con la longitud equivocada es un no-op silencioso, así que nada de aquí entra en
> `modx-map.json` como verdad sin que el teclado conteste. Donde el papel y la medida coinciden, se
> indica.

## Esquema de direcciones (pág. 191-192)

El PDF trae el **Parameter Base Address** completo, con "Top Address" por bloque:

| bloque | top address | tamaño |
|---|---|---|
| FM PART COMMON | `48 0p 00` | 86 (`56h`) |
| FM PART OPERATOR | `49 op 00` | 47 (`2Fh`) |

`p` = Part 0-F, `o` = Operator 0-7. **Confirma la medida de la fase 0b**: `am = (op<<4)|part`.

## FM PART OPERATOR — `49 op al` (47 offsets documentados)

| `al` | tam | rango hex | parámetro | descripción | default |
|---|---|---|---|---|---|
| `00` | 1 | | *reserved* | | |
| `01` | 1 | 00-01 | Oscillator Key On Reset | Off, On | 01 |
| `02` | 1 | | *reserved* | | |
| `03` | 1 | 00-01 | Oscillator Frequency Mode | Ratio, Fixed | 00 |
| `04` | 1 | 00-1F | Tune Coarse | 0-31 | 01 |
| `05` | 1 | 00-7F | Tune Fine | 0-127 | 00 |
| `06` | 1 | 00-1E | Detune | -15 – 0 – +15 | 0F |
| `07` | 1 | 00-63 | Pitch Key Follow Sens | 0-99 (solo si Freq Mode = Fixed) | 00 |
| `08` | 1 | 00-0E | Pitch Velocity Sens | -7 – 0 – +7 | 07 |
| `09` | 1 | 00-06 | Spectral Form | Sine, All 1, All 2, Odd 1, Odd 2, Res 1, Res 2 | 00 |
| `0A` | 1 | 00-07 | Spectral Skirt | 0-7 | 00 |
| `0B` | 1 | 00-63 | Spectral Resonance | 0-99 | 00 |
| `0C` | 1 | 00-64 | **PEG** Initial Level | -50 – 0 – +50 | 32 |
| `0D` | 1 | 00-64 | **PEG** Attack Level | -50 – 0 – +50 | 32 |
| `0E` | 1 | 00-63 | **PEG** Attack Time | 0-99 | 00 |
| `0F` | 1 | 00-63 | **PEG** Decay Time | 0-99 | 00 |
| `10` | 1 | 00-63 | **AEG** Attack Level | 0-99 | 63 |
| `11` | 1 | 00-63 | **AEG** Decay 1 Level | 0-99 | 63 |
| `12` | 1 | 00-63 | **AEG** Decay 2 Level | 0-99 | 63 |
| `13` | 1 | 00-63 | **AEG** Release (Hold) Level | 0-99 | 00 |
| `14` | 1 | 00-63 | **AEG** Attack Time | 0-99 | 00 |
| `15` | 1 | 00-63 | **AEG** Decay 1 Time | 0-99 | 00 |
| `16` | 1 | 00-63 | **AEG** Decay 2 Time | 0-99 | 00 |
| `17` | 1 | 00-63 | **AEG** Release Time | 0-99 | 28 |
| `18` | 1 | 00-63 | **AEG** Hold Time | 0-99 | 00 |
| `19` | 1 | 00-07 | AEG Time Key Follow Sens | 0-7 | 00 |
| `1A` | 1 | 00-63 | Operator Level | 0-99 | 00 (63 si el operador es el 0) |
| `1B` | 1 | 00-63 | Level Scaling Break Point | **A-1 – C8** | 3C |
| `1C` | 1 | 00-63 | Level Scaling Low Depth | 0-99 | 00 |
| `1D` | 1 | 00-63 | Level Scaling High Depth | 0-99 | 00 |
| `1E` | 1 | 00-03 | Level Scaling Low Curve | -Linear, -Exp, +Exp, +Linear | 00 |
| `1F` | 1 | 00-03 | Level Scaling High Curve | -Linear, -Exp, +Exp, +Linear | 00 |
| `20` | 1 | 00-0E | Level Velocity Sens | -7 – 0 – +7 | 07 |
| `21` | 1 | 00-07 | 2nd LFO Pitch Mod Depth Offset | 0-7 | 03 |
| `22` | 1 | 00-07 | 2nd LFO Amplitude Mod Depth Offset | 0-7 | 03 |
| `23` | 1 | 00-0E | Pitch Controller Sens | -7 – 0 – +7 | 07 |
| `24` | 1 | 00-0E | Level Controller Sens | -7 – 0 – +7 | 07 |
| `25` | 5 | | Controller Set 1-16 Element Switch | bitmap 16 bits (bit0=Box1 … bit15=Box16); bytes 1-2 reserved, 3º `bit1-0 bit15-14`, 4º `bit6-0 bit13-7`, 5º `bit6-0 bit6-0` | 00 00 03 7F 7F |
| `2A` | 5 | | *reserved* | | |

**Resuelve los 12 offsets que la fase 0c dejó sin identificar**: `00`, `02` y `2A` son *reserved*;
`21`-`24` son los offsets de 2nd LFO y las sensibilidades de controlador (no aparecen en la página
del operador); `25` y `2A` son los bloques de 5 bytes del Controller Set. Los offsets `2B`-`2E` que
el spike vio silenciosos están **consumidos por `2A` (5 bytes)**.

### Confirma inferencias de la fase 0c

- **Break Point** = escala que empieza en **A-1**. El spike midió `B 3` → 50 y dedujo A-1 de un solo
  punto. Correcto: A-1 = 0 ⇒ B3 = 50. ✔
- **Curve** = `-Linear, -Exp, +Exp, +Linear` (0-3). El spike midió `+Exp`=2 y `+Lin`=3 e infirió el
  resto. Correcto. ✔
- **Bipolares con centro variable**: Detune centra en `0F` (15), Level/Vel y Pitch/Vel en `07` (7).
  Coincide con lo medido, y explica por qué no es 64. ✔
- **Spectral Form** llega hasta **Res 2 = 6** (el spike había visto Res 1 = 5). ✔

### Corrige etiquetas

Lo que el spike llamó "envolvente de Form/Freq" (`0C`-`0F`) es la **PEG** (pitch EG del operador), y
lo de la página Level (`10`-`18`) es la **AEG**. Mismo sitio, nombres de Yamaha.

## FM PART COMMON — `48 0p al`

Lo relevante, con el hallazgo gordo primero:

| `al` | tam | rango | parámetro | default |
|---|---|---|---|---|
| `4F` | 1 | 00-57 | **Algorithm Number** (1-88) | 00 |
| `50` | 1 | 00-07 | **Feedback Level** (0-7) | 00 |
| `51`-`55` | 1 | | ***reserved*** | |

**Aquí vive el Feedback**: `48 0p 50`, es **por Part, no por operador** — que es exactamente por qué
el descarte de la fase 0c (los ocho operadores tenían los mismos valores) era correcto y aun así no
lo encontró.

Y **explica el efecto colateral `48 00 52` → `48 00 48`**: `52` es una dirección **reservada**.
Escribir en reservadas es comportamiento indefinido, y lo que se llevó por delante fue `48` =
**2nd LFO Speed** (default `1E` = 30, justo el valor que el spike esperaba y no volvía).
⇒ **Regla para el backup: no leer ni escribir offsets reservados.** Con eso, la restauración
parámetro a parámetro probablemente sale 416/416 a la primera, sin depender de la pasada de
reparación (que se mantiene igual, por prudencia).

### El filtro, entero (era lo que faltaba por mapear a mano)

| `al` | tam | parámetro |
|---|---|---|
| `0B` | 1 | Filter Type (19 tipos: LPF24D, LPF24A, LPF18, LPF18s, LPF12+HPF12, LPF6+HPF12, HPF24D, HPF12, BPF12D, BPFw, BPF6, BEF12, BEF6, DualLPF, DualHPF, DualBPF, DualBEF, LPF12+BPF6, **Thru**) — default `15` = Thru |
| `0C` | **2** | Filter Cutoff Frequency (0-255) |
| `0E` | 1 | Filter Cutoff Velocity Sens (-64 – +63, centro 40) |
| `0F` | 1 | Filter Resonance/Width (0-127) |
| `10` | 1 | Filter Resonance Velocity Sens |
| `11` | **2** | HPF Cutoff Frequency |
| `13` | **2** | Distance (solo filtros Dual) |
| `15` | **2** | Filter Gain |
| `17`-`1B` | 1 | FEG Hold / Attack / Decay 1 / Decay 2 / Release **Time** |
| `1C`,`1E`,`20`,`22`,`24` | **2** | FEG Hold / Attack / Decay 1 / Decay 2 / Release **Level** (-128 – +127 = -9600 – +9600 cents) |
| `26`-`2C` | 1 | FEG Depth, sensibilidades de velocity y key follow |
| `2D` | 1 | Filter Cutoff Key Follow Sens (-200% – +200%) |
| `2E`-`31` | 1 | Filter Cutoff Scaling Break Point 1-4 |
| `32`,`34`,`36`,`38` | **2** | Filter Cutoff Scaling Offset 1-4 |
| `3A` | 1 | HPF Cutoff Key Follow Sens |

Otros del bloque: `00`-`02` Random/Alternate/Scaling Pan Depth, `03`-`05` Key On Delay,
`06`-`09` Pitch velocity/random/key-follow, `3B`-`46` PEG de Part, `47`-`4E` **2nd LFO**
(Wave, Speed, Phase, Delay, Key On Reset, y profundidades de Pitch/Amplitude/Filter Mod).

**Para el panel de teoría vs medición**, lo que interesa comprobar antes de creerse un espectro:
`0B` = Thru (`15`) y `0F` resonancia baja.

## Nota de longitudes

El bloque COMMON está lleno de parámetros de **2 bytes** (`0C`, `11`, `13`, `15`, `1C`, `1E`, `20`,
`22`, `24`, `2C`, `32`, `34`, `36`, `38`). Codificación documentada `1st bit6-0 → bit13-7`,
`2nd bit6-0 → bit6-0`, o sea `valor = (b1<<7)|b2` — **coincide con lo medido en la fase 0c** con el
Tempo. El parser de longitud variable no es opcional en este bloque.

# MODX Analyzer — fase 0d: qué notifica el teclado

Fecha: 2026-09-07. Yamaha MODX8, driver Yamaha Steinberg 2.1.9.0, Windows 11 Pro 26200.
Herramienta: `modx-spike-fase0c` (subcomando `listen` añadido en esta sesión).

Todo **medido en la máquina** salvo lo marcado como inferencia o como documentación.
Ajustes del teclado durante toda la sesión, leídos en pantalla y anotados antes de tocar nada:
**`MIDI I/O Mode = Single`**, **`Bank Select = ON`**, **`Pgm Change = ON`** (los tres en
`[UTILITY] → [Settings] → [Advanced]`). Solo se cambió `MIDI I/O Mode` a `Multi` para una prueba
concreta, y se devolvió a `Single`.

## Nota sobre los documentos de partida

De los cuatro que citaba el brief, **ninguno estaba en el repo**. Tres aparecieron en
`Downloads/Telegram Desktop` (`datalist_fmx_tables.md`, `rm_pantallas_fmx.md`, `modx.md`) y el
cuarto (`fase0c_RESULTS_mapa.md`) es `modx-spike-fase0c/RESULTS.md`. Se leyeron los tres antes de
medir nada.

---

## Correcciones a lo publicado

**1. El clock no son ~125 msg/s: son ~40, y dependen del tempo.**
`modx.md` dice «el MODX transmite clock continuamente, ~125 msg/s incluso en silencio». Medido hoy:
**1801 mensajes en 45 s = 40/s**, con el Tempo en 90 BPM. El clock MIDI son 24 pulsos por negra, o
sea `BPM × 24 / 60`: a 90 BPM tocan 36/s, y lo medido son 40 contando también el Active Sensing
(`FE`), que el escucha filtra junto al clock.

Los 125/s de la fase 0c se midieron **con el Tempo a 300**, que lo había puesto yo mismo al probar
la codificación de dos bytes. Era un artefacto de mi propia escritura, no una propiedad del teclado.
La fase 0b, antes de tocar nada, ya daba 43/s (12.965 mensajes en 300 s) — coherente con un tempo
normal. **Regla: el tráfico de fondo escala con el tempo de la Performance.**

**2. `modx.md` conserva la latencia vieja en dos sitios.** Las líneas 320 («el Request, 11 bytes,
16 ms») y 586 («Latencia 16 ms por parámetro») siguen diciendo 16 ms, cuando la propia sección de la
fase 0c del mismo documento ya corrige a **2,0 ms de mediana**. Es residuo de la 0b sin actualizar.

**3. La hipótesis del brief sobre Program Change era falsa.** Escrita antes de medir: «(a), (b) y (c)
no transmiten nada; (d) sí transmite Program Change». Las tres primeras aciertan; **la cuarta no**.
Ver punto 2.

---

## 1. ¿Transmite el MODX las teclas por USB? — SÍ

Ventana de escucha: **60 s**, filtro: se ocultan `F8` (clock) y `FE` (active sensing) pero se
cuentan. **2401 filtrados**, que es la prueba de que el escucha estaba vivo.

```
--- resumen de 60 s ---
clock/sensing filtrados : 2401
mensajes de canal       : 174
mensajes SysEx          : 0
   CC             92
   NoteOff        11
   NoteOn         11
   PitchBend      60
```

| | medido |
|---|---|
| **Notas** | 11 On / 11 Off, **todas en canal 1** (con `MIDI I/O Mode = Single`) |
| **Forma del Note Off** | **siempre `90 nn 00`** (Note On con velocity 0). **Nunca `0x80`**: 11 de 11 |
| **Velocity** | 9 valores distintos entre **32 y 106**. Resolución real, no aplanada |
| **Pitch Bend** | 60 mensajes, **14 bits reales**: 57 valores distintos, de los que **48 no son múltiplos de 128**. Rango completo 0–16383 |
| **Modulación** | **CC 1**, 92 mensajes, rango completo 0–127 |
| **Aftertouch** | **no se puede medir: el MODX8 no tiene aftertouch** (dato del usuario). No es que no lo transmita |

Traza de ejemplo:

```
[ 44438.4 ms] NoteOn ch1 nota71 vel40    90 47 28
[ 44670.0 ms] NoteOff ch1 nota71 (vel0)  90 47 00
[ 44828.4 ms] NoteOn ch1 nota74 vel53    90 4A 35
```

**Para la app**: puede distinguir sin ambigüedad las notas del usuario de las suyas, con velocity y
pitch bend de resolución completa. Dos avisos para el parser: el Note Off llega como Note On con
velocity 0, y el pitch bend hay que leerlo a 14 bits o se pierden dos tercios de los valores.

### El número de mensajes por tecla depende de `MIDI I/O Mode`

Medido de rebote al probar el punto 2 con `Multi` y una Performance de cuatro Parts:

```
[4539.8 ms] NoteOn ch1 nota65 vel51    90 41 33
[4556.7 ms] NoteOn ch2 nota65 vel51    91 41 33
[4566.9 ms] NoteOn ch3 nota65 vel51    92 41 33
[4567.1 ms] NoteOn ch4 nota65 vel51    93 41 33
```

**Una tecla, cuatro Note On** — uno por Part, cada uno en su canal, todos en 28 ms. En `Single` la
misma tecla da **uno**. Si la app cuenta notas sin saber el modo, contará de más.

## 2. ¿Notifica algo de navegación o de selección? — NO, NADA

> ### ⚠ Esto se midió con los interruptores relevantes ENCENDIDOS
>
> En `[UTILITY] → [Settings] → [Advanced]`, **`Bank Select = ON`** y **`Pgm Change = ON`**, leídos en
> pantalla antes de medir y no tocados. **Aun así, cargar una Performance no transmite nada.**
> Se repitió además con `MIDI I/O Mode` en sus dos valores probados, `Single` y `Multi`.
>
> **No es un ajuste apagado.** Si en el futuro se retoma esto, el punto de partida es que la
> explicación fácil ya está descartada por medición, y hay que buscar en otro sitio: si esos dos
> interruptores son de recepción y no de transmisión, si hay un tercer ajuste no localizado, o si
> el MODX sencillamente no emite Program Change al cambiar de Performance desde el panel.

Ventana: **60 s**, **2401** mensajes de clock filtrados. Cuatro acciones con ~8 s de pausa entre
ellas.

```
--- resumen de 60 s ---
clock/sensing filtrados : 2401
mensajes de canal       : 0
mensajes SysEx          : 0
NO llego nada aparte del clock en esos 60 s.
```

| acción | predicción del brief | medido |
|---|---|---|
| a) cambiar el operador en foco, OP3 → OP4 | nada | **nada** ✓ |
| b) cambiar de página, Form/Freq → Level | nada | **nada** ✓ |
| c) cambiar de Part, 1 → 2 | nada | **nada** ✓ |
| d) **cargar otra Performance** | **Program Change** | **nada** ✗ |

**Ni Program Change, ni Bank Select (CC 0 / CC 32), ni SysEx. Cero bytes.**

### Por qué este cero sí es una medición

El caso (d) se verificó por una vía independiente: se leyó el **nombre de la Part** (`31 00 00`-`13`,
20 bytes ASCII) antes y después.

```
antes:  'Init Normal (FM-X)  '
después: 'CFX + FM EP 2       '
```

La Performance cambió de verdad, y aun así no salió un byte. Es el mismo diseño de canario que la
fase 0b usó con el mute.

### Descartado que sea un ajuste apagado

`Bank Select` y `Pgm Change` estaban **los dos en `ON`** (leídos en `[UTILITY] → [Settings] →
[Advanced]`). Se repitió (d) con `MIDI I/O Mode = Multi`, ventana de 30 s, **1095** clock filtrados:

```
mensajes de canal : 8   (los cuatro Note On/Off de la prueba de teclas)
mensajes SysEx    : 0
```

Nombre de la Part: `'CFX + FM EP 2       '` → `'Creation            '`. **Tampoco.** Dos modos de
MIDI I/O, dos verificaciones independientes del cambio, dos ceros. `MIDI I/O Mode` se devolvió a
`Single`.

**Consecuencia de diseño, y es seria:** la app **no puede enterarse de que el patch ha cambiado
debajo**. No hay evento. Tiene que sondear un ancla — el nombre de la Part es barato y suficiente:
20 direcciones, ~40 ms — o poner un botón de "releer". Un sondeo del nombre a 1 Hz cuesta nada y
detecta el cambio de Performance en menos de un segundo.

## 3. ¿Se transmiten las ediciones de panel? — NO (re-verificado, ahora airtight)

La fase 0b ya lo concluyó, pero sin dejar anotada la configuración del menú MIDI con la que se midió.
Repetido con los ajustes documentados arriba.

**Primera pasada** (45 s, 1800 clock filtrados): 0 mensajes. Pero el estado solo demostraba que el
patch estaba editado, **no que los cambios ocurrieran dentro de la ventana**. Insuficiente.

**Segunda pasada, con ancla antes y después** (30 s, **1199** clock filtrados):

| | antes | después |
|---|---|---|
| `48 00 4F` Algorithm | 2 | **3** |
| `49 20 1A` Op3 Level | 52 | **73** |

```
--- resumen de 30 s ---
clock/sensing filtrados : 1199
mensajes de canal       : 0
mensajes SysEx          : 0
NO llego nada aparte del clock en esos 30 s.
```

Los dos parámetros cambiaron **dentro** de la ventana y no salió un solo byte. Confirmado.

## 4. Verificar el mapa fuera del Op3 — 12 de 12

`am = (operador << 4) | part`, base cero ⇒ Op5 = `am 0x40`, Op7 = `am 0x60`.
**Predicciones escritas antes de medir:**

| parámetro | `al` | predicción Op5 | predicción Op7 |
|---|---|---|---|
| Coarse | `04` | `49 40 04` | `49 60 04` |
| Spectral Form | `09` | `49 40 09` | `49 60 09` |
| AEG Attack | `14` | `49 40 14` | `49 60 14` |
| AEG Release | `17` | `49 40 17` | `49 60 17` |
| Level | `1A` | `49 40 1A` | `49 60 1A` |
| Level/Vel | `20` | `49 40 20` | `49 60 20` |

La predicción incluía **que no se moviera ninguna otra dirección**.

### Op5 (`am = 0x40`) — 6/6, 0 colaterales

```
49 40 04 : [01] -> [09]  (1 -> 9)    Coarse = 9
49 40 09 : [00] -> [06]  (0 -> 6)    Spectral Form = Res 2
49 40 14 : [00] -> [21]  (0 -> 33)   AEG Attack = 33
49 40 17 : [28] -> [2C]  (40 -> 44)  AEG Release = 44
49 40 1A : [00] -> [37]  (0 -> 55)   Level = 55
49 40 20 : [07] -> [0C]  (7 -> 12)   Level/Vel = +5
```

### Op7 (`am = 0x60`) — 6/6, 0 colaterales

```
49 60 04 : [01] -> [0C]  (1 -> 12)   Coarse = 12
49 60 09 : [00] -> [02]  (0 -> 2)    Spectral Form = All 2
49 60 14 : [00] -> [42]  (0 -> 66)   AEG Attack = 66
49 60 17 : [28] -> [4D]  (40 -> 77)  AEG Release = 77
49 60 1A : [00] -> [58]  (0 -> 88)   Level = 88
49 60 20 : [07] -> [03]  (7 -> 3)    Level/Vel = -4
```

**Los 12 valores coinciden exactamente con los que el usuario puso en pantalla, y no se movió
ninguna otra dirección en ninguno de los dos bloques.**

Esto cierra la única inferencia grande que quedaba en el mapa. Ya no es «estructura idéntica en los
ocho y semántica confirmada en tres offsets»: es **semántica verificada en seis offsets de dos
operadores nuevos, con la predicción escrita antes de mirar**.

### Tres afirmaciones documentadas que pasan a estar medidas

Elegidas a propósito dentro de esta prueba para no gastar tiempo extra:

| afirmación (Data List) | medido |
|---|---|
| Spectral Form llega a **`Res 2 = 6`** | `49 40 09` = `06` con `Res 2` en pantalla ✔ |
| Spectral Form **`All 2 = 2`** | `49 60 09` = `02` con `All 2` en pantalla ✔ |
| Level/Vel es **bipolar con centro 7** | `+5` → `12` y **`-4` → `3`**. Confirmado **en ambos sentidos**, que hasta ahora solo se había medido hacia arriba ✔ |

## Extra — los dos pendientes grandes de la fase 0c, cerrados

### El Feedback existe y está donde dice el Data List

`48 0p 50`, **por Part, no por operador**. La fase 0c descartó correctamente que fuera por operador
(los 12 offsets sin identificar valían lo mismo en los ocho) pero no pudo encontrarlo porque no está
en las páginas del operador, sino en `[Part Settings] → [Algorithm]`.

```
lectura inicial          48 00 50 = 00
usuario pone Feedback 5  48 00 50 = 05     <- medido
escritura desde el PC    48 00 50 <- 03, relectura 03  OK
```

Leido y escrito, y la escritura confirmada en la pantalla del teclado: tras escribir 03 desde el PC, la pantalla de [Part Settings] -> [Algorithm] mostraba Feedback 3. Ciclo cerrado sobre un parametro que hasta hoy no se sabia ni donde vivia.

### El efecto colateral `48 00 52` → `48 00 48` queda explicado

El Data List dice que `48 0p 48` es **2nd LFO Speed**, default `1E` = 30, y que `51`-`55` son
direcciones **reservadas**. Medido hoy:

```
48 00 48 = [1E] = 30
```

**Es exactamente el valor que no volvía en la restauración de la fase 0c.** Escribir en una dirección
reservada (`52`) es comportamiento indefinido y lo que se llevó por delante fue el 2nd LFO Speed en
su default. La explicación deja de ser papel.

### Y un hallazgo que el Data List no advierte

**Las direcciones reservadas responden como las reales.** Medido en el bloque `48 00`:

```
51 -> [00]      52 -> [00]      53 -> [00 00]  (2 bytes)      54 -> sin respuesta      55 -> [00]
```

Cuatro de las cinco reservadas contestan a un Parameter Request, y una incluso con dos bytes.
**No se puede distinguir una dirección reservada de una real preguntándole al teclado.** Eso hace que
la regla «no leer ni escribir reservadas» **dependa del Data List**: no es descubrible por sonda, que
es justo como la fase 0c se metió en el problema.

## 5. Cadencia real de un conjunto de vigilancia

Conjunto de **40 direcciones**: Coarse (`04`), Fine (`05`), AEG Attack (`14`), AEG Release (`17`) y
Level (`1A`) de los **ocho operadores**. Timeout 100 ms, 50 pasadas completas (2.000 peticiones) en
cada condición. La carga se genera desde el PC y **se cuenta el tráfico recibido**, para que la
medida se autoverifique.

| | silencio | 8 notas por petición |
|---|---|---|
| tráfico ajeno durante la medida | 165 msg | **823 msg** |
| peticiones | 2.000 en **4,09 s** | 2.000 en **20,59 s** |
| **Hz efectivos del conjunto** | **12,22 Hz** | **2,43 Hz** |
| latencia mediana | 2,0 ms | 10,3 ms |
| p90 | 2,5 ms | 15,7 ms |
| p99 | 3,3 ms | 20,4 ms |
| peor caso | 4,5 ms | **24,2 ms** |
| **perdidas** | **0 / 2.000** | **0 / 2.000** |

**Los números de la fase 0c eran correctos**: predijo ~12 Hz y ~2 Hz, y salen 12,22 y 2,43.

Recomendación, sin cambios respecto a la fase 0c: **timeout de 100 ms** (4,1× el peor caso medido),
conjunto de vigilancia de ~40 direcciones, y aceptar que bajo carga de notas densa el refresco cae a
~2,4 Hz. Sigue siendo suficiente para que un diagrama de operadores parezca vivo, y **no se pierde
ni una petición**.

---

## Estado del teclado al terminar

- **No se guardó nada en la memoria del MODX.** Todo el trabajo fue sobre el buffer de edición.
- Copias de seguridad en `safety/`: `02-previo-fase0d.bin` (estado al empezar esta sesión) más las
  dos de la fase 0c.
- `MIDI I/O Mode` devuelto a **`Single`**, su valor original. `Bank Select` y `Pgm Change` no se
  tocaron (estaban en `ON`).
- Notas colgadas: la prueba de carga del punto 5 terminó con `panic` (All Sound Off + All Notes Off
  + 2.048 Note Off explícitos).

## Preguntas que este spike NO contesta

- **Qué hace `MIDI I/O Mode = Hybrid`.** No aparece en el extracto del Reference Manual disponible y
  no se probó.
- **PENDIENTE DE INVESTIGAR — si `Bank Select` y `Pgm Change` del menu Advanced son de recepcion, de transmision o de ambas.**
  Se leyeron en `ON` y se midió que no se transmite nada al cargar una Performance; no se ha
  determinado si esos interruptores gobiernan la transmisión o solo la recepción. Si fueran solo de
  recepción, el cero del punto 2(d) seguiría siendo válido pero por una razón distinta.
- **Si alguna otra acción del panel transmite algo.** Se probaron cuatro. El Reference Manual
  menciona un caso documentado que no se ha medido: el **Super Knob con `Super Knob CC` en `off`
  transmite por SysEx**. Sería la única emisión SysEx conocida del MODX y no toca parámetros FM-X.
- **El resto del bloque `0x48`**: 72 offsets válidos; con esta sesión hay 6 identificados
  (`01`, `02`, `03`, `48`, `4F`, `50`). El Data List trae el bloque entero, pero **documentado, no
  medido**.
- **Si el mapa de `al` vale también para las Parts 2-16.** Todo lo verificado es Part 1. El esquema
  `(op<<4)|part` se comprobó en la fase 0b leyendo `49 21 1A`, pero no se ha barrido otra Part.
- **Cuánto sondeo aguanta de forma sostenida.** Las medidas son ráfagas de 4 a 21 s, no horas.

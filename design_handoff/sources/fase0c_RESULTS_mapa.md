# MODX Analyzer — fase 0c, resultados

Fecha: 2026-09-07. Yamaha MODX8 por USB, Yamaha Steinberg USB Driver 2.1.9.0, Windows 11 Pro 26200.
Binario: Rust 1.98.1 `x86_64-pc-windows-gnu`, `midir` 0.10.4 (WinMM), `serde_json`.

Continuación de la fase 0b. Todo lo de aquí está **medido en la máquina** salvo lo marcado
explícitamente como inferencia. Puerto `MODX-1`, Device Number `all`.

---

## AVISOS — leer antes que nada

**1. La prueba de carga dejó notas colgadas sonando.** Fue un fallo del código de este spike: el
generador de carga enviaba `Note On` de una nota y `Note Off` de otra distinta. El teclado se quedó
sonando solo hasta que se envió un panic. **Corregido**: la herramienta tiene ahora un subcomando
`panic` (All Sound Off + All Notes Off + 2048 Note Off explícitos). Cualquier código futuro que
genere notas debe tener su apagado antes de usarse, no después.

**2. Hubo que desactivar Smart App Control de Windows para terminar la sesión.** A mitad del spike,
SAC empezó a bloquear el binario recién compilado (`An Application Control policy has blocked this
file`); recompilar con hash nuevo no lo resolvió. El usuario lo desactivó para poder continuar.
**Desactivar SAC es de un solo sentido: no se puede volver a activar sin restablecer Windows.**
Conviene decidir en frío si se deja así. Para el proyecto real, firmar el binario evitaría el
problema de raíz.

**3. Escribir con la longitud de dato equivocada es un no-op SILENCIOSO.** Mandar dos bytes a un
parámetro de uno no da error, no cambia nada y el teclado no protesta. Es el peor modo de fallo
posible: **la app debe verificar releyendo, siempre.**

**4. Escribir un parámetro puede modificar otro.** Dos casos medidos:

- escribir `48 00 52` pone `48 00 48` a cero. Una restauración parámetro a parámetro en orden
  numérico pierde ese valor de forma determinista (ver punto 4);
- cambiar `Freq Mode` (`49 xx 03`) a Fixed modifica también el **Coarse** (`49 xx 04`).

No son enumerables a priori. **Por eso la restauración debe ser verificar-y-reparar, no confiar en un
orden.**

**5. En ningún momento se guardó nada en la memoria del MODX.** Todo el trabajo fue sobre el buffer
de edición. Hay copias de seguridad en `safety/` (`00-estado-previo-a-la-sesion.bin` y
`01-base-init-fmx.bin`), restaurables con `bulk-send`.

---

## Corrección a la fase 0b: la latencia real es ~2 ms, no 14-21

La fase 0b reportó 14-21 ms por Parameter Request. Ese número salía del *timestamp* de `midir`,
que cuenta desde que se abre el puerto, así que incluía la apertura. Medido como ida y vuelta real
petición→respuesta, con el puerto ya abierto:

```
49 20 1A  ->  [00]              1.5 ms
48 00 4F  ->  [00]              2.4 ms
49 20 25  ->  [00 00 03 7F 7F]  1.8 ms
```

**Mediana 2.0 ms**. Un orden de magnitud mejor que lo publicado, y cambia el cálculo de si sondear
sale a cuenta. Ver punto 6.

## Corrección a la fase 0b: `49 xx 0E` estaba mal etiquetado

La fase 0b lo registró como "Attack del EG del operador". Es el **Attack de la envolvente de la
página Form/Freq**, no el de la envolvente de amplitud. El operador FM-X tiene **dos** envolventes y
en la fase 0b no se anotó de qué página se editó. El Attack de la envolvente de la página Level
resultó estar en `49 xx 14`. Ambos medidos en esta sesión.

---

## 1. ¿Se puede escribir el Algorithm?

**Sí, y el motor de sonido lo aplica** — no solo se guarda el número.

```
leer     F0 43 30 7F 1C 07 48 00 4F F7   ->  ... 48 00 4F 01 F7   (algoritmo 2)
escribir F0 43 10 7F 1C 07 48 00 4F 05 F7
releer                                    ->  ... 48 00 4F 05 F7   (algoritmo 6)
```

Verificación en el teclado, en tres pasos y con un matiz que importa:

| valor escrito | pantalla | dibujo | ¿suena distinto? |
|---|---|---|---|
| `05` (alg. 6) | 6 | redibujado | **no** |
| `57` (alg. 88) | 88 | redibujado | **no** |
| `56` (alg. 87) | 87 | redibujado | **sí** |

Los dos primeros "no" **no son un fallo**: el patch tenía Op3 modulando a Op4, y tanto el algoritmo
6 como el 88 mantienen esa misma relación por casualidad, así que el sonido no tenía por qué
cambiar. Fue el usuario quien lo señaló. Con el algoritmo 87, donde Op3 y Op4 no están conectados,
Op3 pasó a ser portadora y el sonido cambió. **Eso es lo que cierra la pregunta**: relectura +
pantalla + dibujo demuestran que el parámetro se guarda; solo el cambio audible demuestra que el
motor lo aplica.

### Valores fuera de rango: satura, no rechaza

Partiendo de un `03` conocido (FM-X tiene 88 algoritmos, o sea `00`-`57`):

| escrito | releído | comportamiento |
|---|---|---|
| `58` (=88, primero inválido) | `57` | **satura** al máximo válido |
| `7F` (=127) | `57` | **satura** |
| `00 05` (2 bytes) | `03` | **ignorado en silencio** |
| `01 02` (2 bytes) | `03` | **ignorado en silencio** |

> Primero interpreté mal esto: leí "satura" también en los casos de dos bytes, porque el valor ya
> era `57` de la prueba anterior y "queda en 57" parecía saturación. Repitiendo desde un `03`
> conocido se ve que son cosas distintas. La lección de método: **una prueba de escritura tiene que
> partir de un valor distinto del esperado**, o no distingue "se aplicó" de "no pasó nada".

La saturación también se confirmó en un parámetro de dos bytes: el Tempo (máx. 300) escrito a 301
(`02 2D`) queda en `02 2C`.

## 2. ¿Se puede restaurar un estado completo con un Bulk Dump?

**Sí, con fidelidad perfecta y sin necesidad de pausa entre mensajes.**

Procedimiento y resultado:

1. Volcado de `0E 25 00` → `snapshot_A.bin`, 123 mensajes, 7.669 bytes.
2. Cuatro parámetros cambiados por SysEx y verificados: `49 20 1A`=20, `49 30 1A`=48,
   `49 20 04`=7, `48 00 4F`=42.
3. `snapshot_A.bin` reenviado tal cual salió.
4. Los cuatro parámetros vuelven a `4B`, `63`, `01`, `01` — sus valores originales.
5. Nuevo volcado de `0E 25 00`: **idéntico byte a byte** a `snapshot_A.bin`, 7.669 de 7.669.

**El teclado no acusa recibo**: silencioso, igual que las escrituras.

### Caudal

| pausa entre mensajes | tiempo de envío | resultado |
|---|---|---|
| 50 ms | 6.23 s | idéntico |
| 20 ms | 2.53 s | idéntico |
| 10 ms | 1.30 s | idéntico |
| 5 ms | 0.68 s | idéntico |
| 2 ms | 0.31 s | idéntico |
| **0 ms** | **0.02 s** | **idéntico** |

El caso de 0 ms se verificó aparte y con cuidado, porque 0.02 s para 7,7 KB es sospechoso: se
ensució el estado, **se confirmó por lectura que estaba sucio**, se restauró sin pausa, y se
comprobó tanto la relectura de los parámetros como la identidad byte a byte del volcado. Los 0.02 s
son el tiempo de encolar en el driver, no el de la transferencia por el cable; el teclado
evidentemente amortigua sin perder nada.

**Consecuencia para la arquitectura del modo tutor: un paso de tutorial puede ser un snapshot
binario de 7,7 KB, y restaurarlo es un solo mensaje.**

## 3. ¿Cómo se codifica un valor de dos bytes?

**`valor = (b1 << 7) | b2`. Medido, no inferido**, con un parámetro legible en pantalla.

Se buscó a propósito un parámetro cuyo valor se pudiera leer en el MODX y que superara 127, para
que la comprobación no dependiera de ninguna suposición. El Tempo de la Performance
(`30 40 2C`, rango 5-300) cumple ambas cosas:

| tempo en pantalla | bytes leídos | `(b1<<7)\|b2` |
|---|---|---|
| 90 | `00 5A` | 0·128 + 90 = **90** |
| 200 | `01 48` | 1·128 + 72 = **200** |
| 300 | `02 2C` | 2·128 + 44 = **300** |

Y en escritura: se escribió `00 78` y el tempo pasó a 120; se escribió `02 2C` y **el usuario
confirmó 300 en pantalla**.

La dirección salió del diff de dos volcados de `0E 25 00`, que cambió en exactamente **tres bytes**:
los dos del dato (`00 5A` → `01 48`) y el checksum del mensaje (`40` → `51`). El dato baja 17 en
total y el checksum sube 17, lo que vuelve a confirmar `(0x80 - suma) & 0x7F`.

### El parser

El campo de datos es **todo lo que hay entre el byte `al` y el `F7` final**, sea de la longitud que
sea. Nunca posición fija. Longitudes observadas: 1, 2, 4 y 5 bytes (`49 xx 25` devuelve
`00 00 03 7F 7F`).

Un `al` que no responde se clasifica en dos casos distintos, y el mapa los distingue:

- **consumido** por un parámetro multibyte anterior (el anterior que sí responde tiene un dato que
  llega hasta aquí),
- **vacío** (no hay parámetro).

En el bloque de operador `ah=0x49, am=0x20`, de los 128 `al` posibles responden 43; de los 85
silenciosos, 4 están consumidos por parámetros multibyte y el resto están vacíos.

## 4. ¿Un snapshot parámetro a parámetro restaura el estado idéntico?

**Casi. 415 de 416 a la primera; 416 de 416 con una pasada de reparación.**

Snapshot de 416 direcciones (`ah` 48 y 49, los 8 operadores de la Part 1, `al` 00-7F). El usuario
cambió tres cosas a mano (Op6 Level a 13, Op4 Coarse a 2, Algorithm a 22), se verificó por lectura
que el estado había cambiado, y se restauró reenviando cada par dirección→valor como Parameter
Change.

### La dirección que no vuelve

```
48 00 48 : esperado [1E] (30)   leído [00]
```

Investigado hasta el final:

- **No es de solo lectura**: la escritura directa entra sin problema y satura en `63`.
- **No es pérdida de mensaje**: falla la misma dirección **6 veces de 6**.
- **No es el Algorithm**: escribirlo no toca `48 00 48`. Tampoco escribir un Level.
- **El culpable es `48 00 52`**: escribirlo pone `48 00 48` a cero. Como la restauración va en orden
  numérico, `...48` se escribe antes que `...52` y el segundo se lleva por delante al primero.

Caracterización parcial, y aquí hay que ser honesto: con `48 00 52` en `01`, escribir `00` encima
resetea `48 00 48`; pero en una repetición con otra precondición la restauración completa salió
bien a la primera. **La regla exacta de cuándo se dispara el efecto no quedó determinada.** Lo que
sí está sólido y reproducido es el hecho (6/6 con la precondición `48 00 52 = 00`) y el remedio.

### El remedio: verificar y repasar

La herramienta hace ahora `restore --repair N`: tras restaurar, relee todo, y reescribe solo lo que
no cuadra, repitiendo hasta N veces. **Converge en una sola pasada**, con cualquier caudal:

| pausa entre escrituras | tiempo | pasadas de reparación | fallos finales |
|---|---|---|---|
| 10 ms | 4.38 s | 1 | 0 |
| 5 ms | 2.30 s | 1 | 0 |
| 2 ms | 1.05 s | 1 | 0 |
| 1 ms | 0.62 s | 1 | 0 |
| **0 ms** | **0.03 s** | 1 | 0 |

**No se pierde ninguna escritura ni siquiera sin pausa.** 416 Parameter Changes en 0.03 s.

### ¿Importa el orden?

**Sí, pero no por donde el brief lo sospechaba.** El Algorithm no arrastra a nada: escribirlo no
cambió ningún otro valor. Lo que sí importa es el par `48 00 52` → `48 00 48`. Y como esa clase de
dependencia no se puede enumerar a priori, **la recomendación no es ordenar sino verificar y
reparar**, que cubre cualquier dependencia futura sin conocerla.

### Tiempos reales

| operación | tiempo |
|---|---|
| Leer 416 direcciones conocidas (ocioso) | **~0.9 s** |
| Leer las mismas bajo carga de notas densa | ~5.5 s |
| Escribir 416 direcciones (sin pausa) | **0.03 s** |
| Restaurar + verificar + reparar | ~5 s |
| Volcado bulk completo de `0E 25 00` | ~7,7 KB, unos segundos |
| Reenviar un bulk completo | 0.02 s de encolado |

> Un barrido *a ciegas* de las mismas 2.048 direcciones tarda 100 s, pero eso es todo timeout de las
> 1.632 que no existen. Una app que conoce el mapa no paga eso.

## 5. El mapeador — lo que sobrevive

`modx-spike-fase0c map`, y el mapa persistente `modx-map.json`.

Como el MODX no transmite nada al editar en el panel (medido en la fase 0b), las direcciones no se
pueden descubrir girando knobs. El método es **foto → cambio → foto → diff**:

```
map before --ah R --am R --al R [--state s.json]     toma la foto
map after  --name "<nombre>" [--state s.json] [--map m.json]   rescanea, hace el diff y registra
map watch  --ah R --am R --al R [--map m.json]       bucle interactivo: foto, Enter, diff, pregunta el nombre
map show   [--map m.json]                            vuelca el mapa de forma legible
```

Cada entrada guarda **dirección, nombre, longitud del dato en bytes, valores observados y cómo se
descubrió**. Si el diff da más de una dirección, **las muestra todas y las registra todas con el
nombre marcado como ambiguo — no adivina**. El mapa es JSON legible y editable a mano, se recarga y
se amplía en sesiones sucesivas.

### El mapa levantado en esta sesión

**48 entradas**, partiendo de las 6 que traía la fase 0b. Reparto: **31 del bloque de operador**
(de 43 offsets válidos), 12 del bloque de Part `0x31`, 4 del bloque `0x48` y el Tempo.

### ¿Vale el mapa para los ocho operadores?

Todo se levantó sobre el Op3 de la Part 1 (`am=0x20`), así que había que comprobarlo antes de darlo
por bueno:

- **Estructuralmente, sí**: los ocho operadores tienen **exactamente el mismo conjunto de 43 offsets
  válidos**, con los mismos huecos.
- **Semánticamente, confirmado fuera del Op3** en tres offsets: `1A` (Level) en Op1, Op2, Op4 y Op6,
  y `06` (Detune) y `17` (Release) en Op5. En el Op5 se predijo *antes de mirar* que el cambio caería
  en `49 40 06` y `49 40 17`, y cayó exactamente ahí y en ninguna otra dirección.
- **El resto de offsets no se ha verificado fuera del Op3.** Es inferencia razonable por la identidad
  estructural, pero inferencia.

Bloque de operador FM-X, `ah=0x49`, `am=(operador<<4)|part`:

| `al` | parámetro |
|---|---|
| `01` | **Key On Reset** (ON=1, OFF=0) |
| `03` | **Freq Mode** (Ratio=0, Fixed=1) |
| `04` | Coarse del ratio |
| `05` | Fine del ratio |
| `06` | **Detune** (bipolar, centro 15) |
| `07` | **Pitch/Key** |
| `08` | **Pitch/Vel** (bipolar, centro 7) |
| `09` | Spectral Form (enum base cero: Odd1=3, Odd2=4, **Res1=5**) |
| `0A` | **Spectral Skirt** (aparece con Form = Res) |
| `0B` | **Spectral Resonance** (aparece con Form = Res) |
| `0C` | Form/Freq LEVEL **Initial** (bipolar, centro 50) |
| `0D` | Form/Freq LEVEL **Attack** (bipolar, centro 50) |
| `0E` | Form/Freq TIME **Attack** ← *corrige la etiqueta de la fase 0b* |
| `0F` | Form/Freq TIME **Decay** |
| `10`-`13` | Level LEVEL: **Attack, Decay 1, Decay 2, Rel(Hold)** |
| `14`-`18` | Level TIME: **Attack, Decay 1, Decay 2, Release, Hold** |
| `19` | **Time/Key** |
| `1A` | Level del operador |
| `1B` | **Break Point** (nota, con escala propia — ver más abajo) |
| `1C`-`1F` | **Lvl/Key Lo, Lvl/Key Hi, Curve Lo, Curve Hi** |
| `20` | **Level/Vel** (bipolar, centro 7) |

Bloque de Part `ah=0x31`, `am=part`:

| `al` | parámetro |
|---|---|
| `00`-`13` | nombre de la Part, 20 bytes ASCII |
| `18` | Mute Switch |
| `1C` / `1D` | **Velocity Limit** Lo / Hi |
| `1E` / `1F` | **Note Limit** Lo / Hi (nota MIDI, **C-2 = 0**) |
| `22` / `23` | **Velocity Depth** / **Velocity Offset** |
| `24` / `25` | **Volume** / **Pan** (bipolar, centro 64) |
| `29` / `2A` / `2C` | **RevSend** / **VarSend** / **Dry Level** |

Bloque `ah=0x48`, `am=part` — **y aquí hay una corrección**: no es solo "FM-X de nivel de Part".
Contiene el Algorithm, pero también parámetros generales de la Part:

| `al` | parámetro |
|---|---|
| `01` | **Alternate Pan** (bipolar, centro 64) |
| `02` | **Scaling Pan** (bipolar, centro 64) |
| `03` | **KeyOnDelay Length** |
| `4F` | Algorithm FM-X (base cero) |

Y `30 40 2C` Tempo de la Performance.

### Dos escalas de nota distintas en el mismo instrumento

El Note Limit de la Part usa **numeración MIDI estándar**: `F#-2` = 6 y `D8` = 122, o sea C-2 = 0.
Medido en dos puntos.

El **Break Point del operador no usa esa escala**: `B 3` se guarda como 50, y con C-2 = 0 el B3 sería
71. La diferencia es 21, lo que encajaría con una escala que empieza en A-1. **Es inferencia de un
solo punto**: solo se ha medido un valor de Break Point, y un punto no determina un offset.

**Las dos envolventes del operador quedan completas**, que era la prioridad: la de Form/Freq
(`0C`-`0F`) y la de la página Level, con sus niveles (`10`-`13`) y sus tiempos (`14`-`18`).

### Cómo se asignó cada nombre sin adivinar

Cambiando **varios parámetros a la vez con valores distintos entre sí**, y emparejando cada
dirección con su valor. Con valores distintos la correspondencia es única y no hace falta una ronda
por parámetro. Ejemplo real, la tanda de la envolvente de tiempos:

```
49 20 15 : [00] -> [34] = 52   -> Decay 1 (el usuario puso 52)
49 20 16 : [00] -> [28] = 40   -> Decay 2 (puso 40)
49 20 17 : [28] -> [4F] = 79   -> Release (puso 79)
49 20 18 : [00] -> [2F] = 47   -> Hold    (puso 47)
```

En la última tanda dos parámetros involucraban un "3" y aun así la asignación salió única: lo que
los separó fue el **punto de partida**, porque `Level/Vel` iba de `+0` y estaba guardado como `07`
(bipolar centrado), no como `00`.

### Codificación de valores: tres formas distintas vistas

- **Directa**: Level, Coarse, tiempos de envolvente.
- **Enum base cero en el orden de la pantalla**: Algorithm (pantalla − 1), Spectral Form, Curve.
- **Bipolar con offset**: y **el centro varía por parámetro** — Detune centra en 15, Initial y
  Attack de Form/Freq en 50, Level/Vel en 7. **No asumir 64.**

### Lo que queda sin identificar del bloque de operador

12 offsets: `00, 02, 21, 22, 23, 24, 25, 2A, 2B, 2C, 2D, 2E`. El usuario recorrió todas las páginas
del operador y **no encontró más parámetros que cambiar**, así que no están expuestos en pantalla con
esta configuración.

**Ninguno de los doce varía entre operadores**: los ocho tienen los mismos valores
(`00, 00, 03, 03, 07, 07, 00 00 03 7F 7F, 00, 00, 00, 00, 00`). Por contraste, un offset en uso sí
varía — `1A` (Level) da `00 00 4B 63 00 00 00 00`, que es el patch cargado.

Eso permite un descarte firme: **el Feedback no está entre ellos**. El algoritmo activo da
retroalimentación al Op1 según el dibujo de la pantalla; si el Feedback fuera un parámetro por
operador, el Op1 tendría ahí un valor distinto de los demás. No lo tiene. Tampoco aparece como
opción en ninguna pantalla del operador. **Dónde vive el Feedback, o si existe como parámetro
accesible, queda sin resolver.**

### Una técnica que funcionó mejor de lo esperado: la foto de pantalla

Dos fotos del mismo menú, antes y después, permitieron mapear **ocho parámetros de golpe** sin una
sola ronda de diff: basta leer los valores de la foto y buscarlos en un barrido del bloque. Funciona
cuando los valores son distintivos, y falla cuando dos parámetros comparten valor — pasó con el Pan
(62 aparecía en dos direcciones) y se resolvió **escribiendo** 80 en la candidata y comprobando que
la pantalla mostraba `R16`.

Cuando el valor buscado **no aparece** en el bloque escaneado, no significa que el dato sea falso:
significa que el parámetro vive en otro bloque. Los tres que faltaban (Alternate Pan, Scaling Pan,
KeyOnDelay Length) estaban en `0x48`, y los localizó el diff de dos bulk dumps, que no requiere
acertar el bloque porque la cabecera del mensaje trae la dirección.

## 6. Sondeo bajo carga

Carga generada desde el PC (notas por petición), para que la medida sea reproducible y no dependa de
que alguien toque. **Cada medición cuenta el tráfico de canal que llega**, así que se autoverifica.

| carga | tráfico ajeno | mediana | p90 | p99 | peor caso | perdidas |
|---|---|---|---|---|---|---|
| solo clock | 315 msg | 2.0 ms | 2.8 | 3.3 | 3.5 ms | **0 / 1216** |
| 2 notas/petición | 1362 msg | 9.1 ms | 10.1 | 12.3 | 16.0 ms | **0 / 1216** |
| 8 notas/petición | 1703 msg | 13.2 ms | 16.5 | 18.4 | **22.6 ms** | **0 / 1216** |

Y con timeouts de 50, 100, 200 y 500 ms sobre 6.080 peticiones cada uno: **0 perdidas en las 24.320**.

> **Esa tabla estuvo a punto de ser falsa.** Los dos primeros intentos de medir "bajo carga" se
> etiquetaron como tal sin saber si el usuario había tocado. El contador de tráfico lo desmintió:
> 125 mensajes/segundo, exactamente la tasa del clock a solas. Por eso la carga acabó generándose
> desde el PC y la medición cuenta el tráfico: **una medida de carga que no verifica la carga no
> mide nada.**

### El clock MIDI

El MODX transmite clock continuamente: ~125 mensajes/segundo incluso "en silencio". No se probó a
apagarlo (MIDI Sync / Transport en los ajustes) porque **con él puesto no se pierde ni una petición
ni con carga de notas encima**, así que no hay problema que resolver. Queda como hipótesis sin
comprobar que apagarlo bajaría algo la latencia mediana.

### Recomendación

- **Timeout: 100 ms.** Da 4,4× de margen sobre el peor caso medido (22.6 ms) con carga densa, y en
  27.000 peticiones no se perdió ninguna. 50 ms también funcionó (2,2× de margen); 100 ms cuesta lo
  mismo y aguanta un pico peor.
- **Lectura completa de un patch bajo demanda**, no en bucle: ~0.9 s ocioso, ~5.5 s tocando.
- **Conjunto de vigilancia pequeño para la vista viva**: 40 parámetros a 13 ms de mediana con carga
  son 0.5 s por pasada, o sea **~2 Hz mientras se toca** y ~12 Hz en silencio. Suficiente para que
  un diagrama de operadores parezca vivo sin saturar el puerto.
- **Reintentar no hace falta** por pérdida, pero sí **verificar toda escritura releyendo**, por el
  no-op silencioso del aviso 3.

---

## Preguntas que este spike NO contesta

- **La regla exacta del efecto `48 00 52` → `48 00 48`.** El hecho está reproducido 6/6 y el remedio
  funciona, pero no se determinó qué condición lo dispara. Puede haber más pares así entre los
  parámetros no mapeados.
- **Los otros 12 offsets del bloque de operador.** No están expuestos en pantalla y valen lo mismo en
  los ocho operadores. Probablemente sean defaults de funciones inactivas, pero no está demostrado.
- **El bloque `0x48` casi entero**: 72 offsets válidos, 4 identificados. `48` y `52` se conocen por
  su efecto colateral pero no por su nombre.
- **Dónde está el Feedback.** Descartado que sea un parámetro por operador (ver punto 5). No aparece
  en ninguna pantalla del operador. Sin resolver.
- **Si el mapa de `al` vale para todos los operadores.** Estructura idéntica en los ocho; semántica
  confirmada fuera del Op3 solo en `1A`, `06` y `17`.
- **La escala de nota del Break Point.** Un solo punto medido (`B 3` → 50).
- **Si el resto de valores del enum de Curve** son los que se deducen. Se midieron dos de cuatro
  (`+Exp`=2, `+Lin`=3); `-Lin`=0 se observó como valor de partida y `-Exp`=1 es **inferencia**.
- **Si los `am` de otros operadores y otras Parts se comportan igual.** Todo el mapa se levantó sobre
  el Op3 de la Part 1 (`am=0x20`). La fase 0b verificó el esquema `(op<<4)|part` en cinco
  direcciones distintas, pero el mapa de `al` solo se ha comprobado en un operador.
- **Si apagar el clock MIDI mejora la latencia.** No se probó.
- **Nada sobre guardar en la memoria del MODX.** Deliberado: todo el spike fue sobre el buffer de
  edición.

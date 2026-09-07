# MODX Analyzer — fase 0, resultados del spike

Fecha: 2026-09-06. Yamaha MODX8 por USB, Yamaha Steinberg USB Driver **2.1.9.0** (2025-05-20),
Windows 11 Pro 26200. Binario: Rust 1.98.1 `x86_64-pc-windows-gnu`, `cpal` 0.15.3, `hound` 3.5.1,
`rustfft` 6.4.1. Solo host WASAPI (sin feature `asio`).

---

## 1. ¿Qué dispositivos del MODX ve WASAPI, y con qué nombres?

**Uno solo, de dos canales, llamado `Line (MODX)`.** Los pares asignables no aparecen.

```
hosts compilados en este binario:
  - Wasapi
hosts disponibles en ejecucion:
  - Wasapi

========== HOST Wasapi ==========
default input device: Line (MODX)

--- [0] "Microphone Array (Intel(R) Smart Sound Technology for Digital Microphones)"
    default_input_config: 4 ch, 48000 Hz, F32, buffer Range { min: 0, max: 4294967295 }
    supported:  4 ch |  48000..48000  Hz | I32 | buffer 0..4294967295 frames
    supported:  4 ch |  48000..48000  Hz | F32 | buffer 0..4294967295 frames

--- [1] "Line (MODX)"
    default_input_config: 2 ch, 44100 Hz, F32, buffer Range { min: 0, max: 4294967295 }
    supported:  2 ch |  44100..44100  Hz | U8 | buffer 0..4294967295 frames
    supported:  2 ch |  44100..44100  Hz | I16 | buffer 0..4294967295 frames
    supported:  2 ch |  44100..44100  Hz | I32 | buffer 0..4294967295 frames
    supported:  2 ch |  44100..44100  Hz | F32 | buffer 0..4294967295 frames
```

No es una limitación de `cpal` **ni de WASAPI**. WASAPI hace multicanal sin problema: en esta misma
salida, el array de micrófonos Intel del portátil enumera **4 canales**. Es el driver de Yamaha el
que decide publicar un único par estéreo en su lado WDM — decisión de diseño de Yamaha, no un techo
de Windows. Los pares asignables existen para grabación multipista en un DAW por **ASIO**, que es
el otro camino que el mismo driver ofrece sobre el mismo stream USB.

El endpoint, sencillamente, **no existe** a nivel de sistema. En
`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture` hay exactamente una
entrada MODX, y su `PKEY_AudioEngine_DeviceFormat` es un `WAVEFORMATEXTENSIBLE` con
**2 canales, 44100 Hz, 24 bit, `dwChannelMask` = 0x3 (FL|FR)**, subformato PCM:

```
NAME: Line | DESC: MODX | STATE: 1 | ID: {c34b2c57-de33-48e8-9eb3-da5b80f423a5}
  iface: {1}.USB\VID_0499&PID_172A\5&3B87C881&0&6
```

Los 10 canales de entrada que anuncia el driver no se reparten en varios endpoints WDM: solo se
publica un par estéreo. No hay ningún sitio donde puedan aparecer los canales 3-10.

---

## 2. ¿Se puede abrir USB1&2 y capturar de ahí?

**No. Por WASAPI es inalcanzable.** Y el par estéreo que sí se publica es el **Main L/R**.

Test decisivo: misma Performance, misma nota sostenida, mismo nivel, cambiando únicamente
`Part Output` en el teclado.

| Captura | `Part Output` | RMS | Pico |
|---|---|---|---|
| `wav/routing-main.wav` | `MainL&R` | −28.81 dBFS | −24.74 dBFS |
| `wav/routing-usb12.wav` | `USB1&2` | **−600 dBFS** | **−600 dBFS** |

Con `USB1&2` la captura son ceros digitales exactos en los dos canales — no ruido bajo, cero:

```
===== canal 0 =====
RMS       : 0.000000  (-600.00 dBFS)
pico abs  : 0.000000  (-600.00 dBFS)
canal en silencio absoluto, no hay nada que analizar
```

Descartado también que sea configurable: el panel del driver
(`C:\Program Files (x86)\Yamaha\Yamaha Steinberg USB Driver\ysusb_cp.exe`) solo ofrece **Mode**
(Standard / Stable / Low Latency) y **Buffer Size**. No hay selector de qué par alimenta la salida
WDM. En el registro del driver (`HKLM\SOFTWARE\WOW6432Node\Yamaha\Yamaha Steinberg USB Driver`)
tampoco hay nada de mapeo de canales, solo `Path` y `Version`.

**Consecuencia para el proyecto:** la premisa de partida — medir un par asignable para evitar
Reverb y Variation — no se puede cumplir por WASAPI. Hay dos salidas y la decisión no es de este
spike:

- **Ir a ASIO.** El driver ASIO ya está registrado en esta máquina:
  `HKLM\SOFTWARE\ASIO\Yamaha Steinberg USB ASIO` (y su gemelo en `WOW6432Node`). Haría falta
  compilar `cpal` con la feature `asio`, que exige el **ASIO SDK de Steinberg** descargado aparte
  (no es redistribuible, hay que aceptar su licencia), `LIBCLANG_PATH` y la variable `CPAL_ASIO_DIR`
  apuntando al SDK, porque el binding se genera con `bindgen` en tiempo de compilación. Añade una
  dependencia de build pesada y una licencia que hay que aceptar explícitamente. **No se ha montado
  en este spike, por instrucción expresa.**
- **Quedarse en Main L/R** y garantizar la limpieza por configuración del teclado en vez de por
  enrutado: Reverb Send y Variation Send a 0, inserciones en thru, sin Master Effect. Los cuatro WAV
  de oro se han grabado así y el resultado es excelente (ver punto 3): suelo de ruido a −100/−109 dB
  y armónicos exactamente donde deben estar. Para el objetivo de medir espectros de FM-X, esta vía
  parece suficiente.

---

## 3. ¿El espectro de un FM-X sin efectos sale limpio?

**Sí, y con mucho margen.** Suelo de ruido entre −100 y −109 dB relativo al pico, y las parciales
caen donde predice la teoría de FM. Ventana Hann de 4096 muestras (10.767 Hz/bin), nota C4.

### `wav/fmx-1op-sine.wav` — un operador, ratio 1.0

Senoide pura. Suelo de ruido **−105.4 dB**. El único contenido armónico real es el 3.º a −84 dB
(f/f0 = 3.0007), o sea ~0.006 % de distorsión.

```
RMS       : 0.036286  (-28.81 dBFS)
pico abs  : 0.057954  (-24.74 dBFS)
suelo ruido (mediana de bins): -105.4 dB rel. al pico
  #   freq (Hz)     dB rel pico    f/f0
   1     261.938         0.00     1.0000
   2   14043.141       -71.86    53.6124
   3   13519.246       -72.13    51.6124
   ...
  12     785.990       -84.30     3.0007   <- 3.er armonico
```

### `wav/fmx-ratio2-modlow.wav` — ratio 2:1, modulador `Level ≈ 40`

Con portadora a ratio 1 y modulador a ratio 2, las bandas laterales caen en `fc ± k·fm` =
`f0·(1 ± 2k)`, y las de frecuencia negativa se pliegan sobre las positivas: **solo armónicos
impares**. Es exactamente lo que sale.

```
RMS       : 0.115186  (-18.77 dBFS)
pico abs  : 0.163645  (-15.72 dBFS)
suelo ruido (mediana de bins): -100.4 dB rel. al pico
  #   freq (Hz)     dB rel pico    f/f0
   1     261.934         0.00     1.0000
   2     785.235       -30.16     2.9978
   3    1308.722       -67.21     4.9964
   ...
  11    1831.885       -82.31     6.9937
```

Armónicos 1, 3, 5, 7. Ni rastro del 2.º, 4.º ni 6.º, como debe ser.

### `wav/fmx-ratio2-modhigh.wav` — mismo ratio, modulador `Level ≈ 90`

Mismo esqueleto impar, pero el índice alto empuja la energía hacia arriba: **el pico más alto ya no
es la fundamental sino el 9.º armónico**. Comportamiento de Bessel de manual.

```
RMS       : 0.113705  (-18.88 dBFS)
pico abs  : 0.167564  (-15.52 dBFS)
suelo ruido (mediana de bins): -89.1 dB rel. al pico
  #   freq (Hz)     dB rel pico    f/f0(pico)   armonico
   1    2355.724         0.00     1.0000        9
   2     261.934        -2.50     0.1112        1
   3    1308.722        -4.58     0.5555        5
   4     785.234        -5.32     0.3333        3
   5    3402.973       -10.73     1.4446       13
   6    2879.487       -13.84     1.2223       11
   7    1832.483       -24.53     0.7779        7
   8    3926.273       -25.03     1.6667       15
   9    4450.143       -28.09     1.8891       17
  10    4973.424       -43.57     2.1112       19
  11    5496.898       -50.37     2.3334       21
```

Armónicos impares del 1 al 21 sin un solo par. El par bajo/alto funciona como vector de prueba:
misma estructura de frecuencias, reparto de amplitudes radicalmente distinto.

### `wav/fmx-ratio1414.wav` — ratio no entero, modulador `Level ≈ 90`

Aquí las parciales dejan de ser múltiplos enteros de f0, que es justo el motivo de tener este
vector. Todas las líneas encajan en `|fc ± k·fm|` con `fc = 261.763` y `fm = 369.175`:

| medido (Hz) | predicho | k | signo |
|---|---|---|---|
| 107.404 | 107.412 | 1 | plegada |
| 630.930 | 630.938 | 1 | + |
| 845.761 | 845.762 | 3 | plegada |
| 1214.944 | 1214.937 | 4 | plegada |
| 1369.287 | 1369.288 | 3 | + |
| 1584.127 | 1584.112 | 5 | plegada |
| 1738.470 | 1738.463 | 4 | + |
| 1953.287 | 1953.287 | 6 | plegada |
| 2107.653 | 2107.638 | 5 | + |
| 2322.483 | 2322.462 | 7 | plegada |
| 2476.813 | 2476.813 | 6 | + |

Las once líneas dan `fm = 369.175 ± 0.005 Hz`. **Ratio medido = 369.175 / 261.763 = 1.4103.**

En el teclado estaba puesto `Coarse 1` / `Fine 41`, y la pantalla mostraba **1.41**, que es lo que
predice la fórmula de FM-X `coarse × (1 + fine/100)`. La diferencia entre el 1.41 mostrado y el
1.4103 medido son **0.4 cents**: redondeo interno del generador, no un desajuste. Lo relevante para
el proyecto es que **el valor de pantalla y el que genera el oscilador no son idénticos**, así que
un ratio leído del display no sirve como verdad de referencia con precisión de cents — hay que
medirlo.

---

## 4. Sample rate real, sample format y tamaño de buffer

| | |
|---|---|
| Sample rate nominal | 44100 Hz (único soportado, `44100..44100`) |
| Sample rate medido (5 s) | 44103.02 Hz — desviación +0.0068 % |
| **Sample rate medido (30 s)** | **44100.62 Hz — desviación +0.0014 %** |
| Sample format entregado | **F32** (`default_input_config`) |
| Buffer real por callback | **441 frames, constante** — min 441 / max 441 en 2996 callbacks |
| Periodo del callback | 441 / 44100 = **exactamente 10.000 ms** |
| Errores de stream | 0 |

```
--- resultado ---   (captura de 30 s)
callbacks               : 2996
frames escritos         : 1321236  (29.9600 s a 44100 Hz nominales)
frames en el wav        : 1321236
buffer real / callback  : min 441 / max 441 frames
sample rate medido      : 44100.62 Hz  (sobre 1320795 frames en 29.9496 s de reloj)
errores de stream       : 0
fallos de escritura wav : 0
```

**El sample rate real coincide con el nominal**; la desviación residual es del reloj de pared del PC
usado para medir, no del stream (baja de +0.0068 % a +0.0014 % al pasar de 5 s a 30 s, que es lo que
se espera si el error está en la medición y no en el dispositivo).

Observaciones para el diseño de la captura real:

- **El buffer no varía nunca.** 441 frames en los 2996 callbacks de la prueba de 30 s. No hace falta
  un ring buffer de tamaño variable; el productor es perfectamente regular a 100 Hz.
- **Cero underruns** en 30 s escribiendo WAV *dentro del callback de audio*, que es lo peor que se
  puede hacer. Con un ring buffer de verdad el margen es amplísimo.
- **F32 aunque el endpoint sea 24 bit.** El formato nativo del dispositivo es PCM 24 bit empaquetado
  (`nBlockAlign` 6), pero WASAPI en modo compartido —el único que soporta `cpal`— entrega float32 ya
  convertido por el motor de audio de Windows. Es una conversión sin pérdida de un entero de 24 bit,
  así que no compromete la medida, pero conviene saber que **no se está leyendo el bitstream original**.
  Llegar al 24 bit crudo exigiría modo exclusivo (fuera de `cpal`) o ASIO.
- **44100 Hz es el único rate.** No hay 48 kHz ni 96 kHz por esta vía. Nyquist en 22050 Hz.

### Precisión del estimador de frecuencia (no estaba en las preguntas, pero fija el diseño)

Con ventana de 4096 la interpolación parabólica log sobre Hann tiene un **sesgo sistemático en los
bins bajos**. La fundamental converge al alargar la ventana mientras los armónicos ya son correctos
desde el principio:

| ventana | f0 leída directamente | 3.er armónico / 3 |
|---|---|---|
| 4096 | 261.934 Hz | 261.745 Hz |
| 16384 | 261.805 Hz | 261.749 Hz |
| 65536 | **261.763 Hz** | **261.763 Hz** |

Error de la lectura directa a 4096: **+0.17 Hz = 1.13 cents** para una fundamental de 262 Hz (bin
24.3). Dos conclusiones utilizables:

1. **Estimar f0 dividiendo un armónico alto es ~10× más preciso** que leer el bin de la fundamental.
2. Si el proyecto necesita precisión de cents, 4096 muestras no bastan para fundamentales graves.

### Espurios del oscilador FM-X

En los cuatro WAV aparecen picos que **no son armónicos**, en `k·(44100/16) ± f0`, a **−72 dB**:

```
2756.15   11024.85   13781.2   16537.6   19293   Hz   (cada uno con bandas laterales a ±f0)
```

`44100 / 16 = 2756.25` exacto, así que están ligados al reloj de muestreo, no a la nota. Son del
generador FM-X del MODX, no de la cadena de captura. A −72 dB no estorban para detectar
fundamentales y armónicos, pero un detector de picos ingenuo los va a encontrar: en
`fmx-1op-sine.wav` son **los picos 2.º y 3.º más altos de todo el espectro**, muy por encima del
3.er armónico real. Conviene tenerlos identificados para no confundirlos con contenido musical.

---

## Lo que sobrevive al spike

### WAV (`wav/`)

| Fichero | Contenido | f0 | Nivel |
|---|---|---|---|
| `fmx-1op-sine.wav` | 1 operador, ratio 1.0. Senoide pura | 261.763 Hz (C4) | −24.74 dBFS pico |
| `fmx-ratio2-modlow.wav` | 2 ops, ratio 2:1, modulador `Level ≈ 40` | 261.763 Hz | −15.72 dBFS pico |
| `fmx-ratio2-modhigh.wav` | 2 ops, ratio 2:1, modulador `Level ≈ 90` | 261.763 Hz | −15.52 dBFS pico |
| `fmx-ratio1414.wav` | 2 ops, `Coarse 1`/`Fine 41` → pantalla 1.41, ratio medido **1.4103**, modulador `Level ≈ 90` | 261.763 Hz | −15.37 dBFS pico |
| `routing-main.wav` | Evidencia del test de enrutado (`MainL&R`). Igual que `fmx-1op-sine` | 261.763 Hz | −24.74 dBFS pico |
| `routing-usb12.wav` | Evidencia del test de enrutado (`USB1&2`). Silencio digital | — | −600 dBFS |

Todos: 44100 Hz, 2 canales, float32, ~5 s, capturados por `MainL&R` con sends a 0. Los dos canales
son idénticos muestra a muestra (fuente mono centrada), así que para análisis basta el canal 0.

Nota de afinación: `fc = 261.763 Hz` frente a los 261.626 Hz de C4 a A=440 son **+0.91 cents**. Sin
importancia para el espectro, pero si el proyecto compara contra frecuencias teóricas hay que
calibrarlo o medirlo, no asumirlo.

### Números que fijan el diseño de la captura real

- Un solo dispositivo, `Line (MODX)`, **2 canales**, WASAPI compartido.
- **44100 Hz fijo**, F32, **441 frames por callback constantes** (10.000 ms), 0 errores en 30 s.
- Nivel de trabajo real: **−15 a −25 dBFS de pico**. Hay ~15 dB de margen sin riesgo de clip.
- Suelo de ruido del sistema completo: **−100 a −109 dB** relativo al pico con ventana de 4096.
- Sesgo del estimador de f0 a 4096 muestras: **+1.13 cents** en bins bajos.
- Espurios del FM-X en `k·(Fs/16) ± f0` a **−72 dB**.
- El ratio que muestra la pantalla del MODX y el que genera el oscilador difieren en **0.4 cents**
  (1.41 mostrado, 1.4103 medido). El display no es verdad de referencia con precisión de cents.

---

## Preguntas que este spike NO contesta

- Si por ASIO se pueden abrir los pares asignables y con qué latencia y tamaño de buffer. No se ha
  probado, por instrucción expresa. Lo que haría falta está escrito en el punto 2. Nótese que lo
  demostrado aquí es que **no hay endpoint WDM** para esos canales; que los datos sigan viajando por
  el cable USB es inferencia a partir de los 10 in que anuncia el driver y del ASIO registrado, no
  una medición. Se confirma en un minuto abriendo cualquier host ASIO y mirando la lista de entradas.
- Cuánto ensucia realmente el camino Main L/R cuando la Part sí alimenta Reverb y Variation. Todas
  las capturas se hicieron con los sends a 0, así que no hay medida del caso sucio — que era la
  motivación original de querer el par asignable.
- Si esos 0.4 cents entre display y oscilador son constantes, proporcionales al ratio, o varían con
  la nota. Se ha medido **un** ratio a **una** nota; no hay base para extrapolar la regla.
- Comportamiento con varias notas simultáneas, con capturas largas (> 30 s) o con el equipo bajo
  carga. Todo lo medido es nota única, 5-30 s, máquina ociosa.

# MODX Analyzer — master doc

Proyecto nuevo, arrancado 2026-09-06. Herramienta para **aprender FM-X** mirando en vivo lo que
sale del Yamaha MODX8: waveform, espectro, armónicos, waterfall, y — la parte que le da sentido —
**teoría contra medición**.

~~Dual por diseño, pero la fase 1 es solo Windows. La Waveshare ESP32-S3 Touch LCD 7B (1024×600)
es un objetivo declarado.~~ **Cancelado 2026-09-07 por Jesús: el ESP32/Waveshare se descarta.**
El proyecto ha derivado de "osciloscopio junto al teclado" a **tutor de FM-X que lee y escribe el
MODX**, y eso ya no tiene sentido en un microcontrolador. Objetivo único: **app de escritorio con
Tauri**, sobre su portátil Windows, que es **táctil** — el táctil pasa a ser modo de interacción
de primera clase, no un extra.

## Estado

- **Fase 0 — spike de captura. HECHA (2026-09-06).** Resultados completos en `fase0_RESULTS.md`.
  Veredicto: **la captura no es un riesgo**. La ruta nativa funciona sin sobresaltos; lo que sí
  se cae es la premisa de enrutado (ver más abajo).
- **Fase 0b — spike de SysEx. HECHA (2026-09-06).** Resultados en `fase0b_RESULTS_sysex.md`.
  Veredicto: **escenario 2 — el MODX no transmite al editar, pero responde a Parameter Request y
  acepta escrituras sobre parámetros de operador FM-X.** El diagrama de operadores se puede leer
  del teclado, y además la app puede **conducir** el teclado. Detalle abajo.
- **Fase 0c — escritura, restauración y mapa. HECHA (2026-09-07).** Resultados en
  `fase0c_RESULTS_mapa.md`. Veredicto: **el ciclo completo está cerrado.** Se puede escribir el
  Algorithm (y el motor lo aplica), se puede **reenviar un Bulk Dump** con fidelidad byte a byte, y
  un snapshot parámetro a parámetro restaura 416/416 con una pasada de reparación. Mapa levantado a
  **48 entradas** con herramienta persistente (`modx-map.json`). Ya no queda ninguna incógnita
  bloqueante en el proyecto.
- **Fase 0d — qué notifica el teclado. HECHA (2026-09-07).** Resultados en
  `fase0d_RESULTS_notificaciones.md`. Veredicto: **el teclado transmite notas y controladores, y
  nada más.** Notas SÍ (canal 1, velocity y pitch bend de resolución completa). Navegación de panel,
  cambio de Part y **cambio de Performance: cero bytes**, con `Bank Select` y `Pgm Change` en `ON`.
  Mapa verificado 12/12 fuera del Op3. Feedback (`48 0p 50`) leído y escrito. El colateral
  `48 00 52` → `48 00 48` explicado: era escribir en una dirección reservada.
- **Fase 0e — falsar el cero del cambio de Performance. HECHA (2026-09-07).** Resultados en
  `fase0e_RESULTS_falsacion.md`. Veredicto: **el cero de la 0d se confirma** en modo crudo y con
  ancla autoverificada. Hallazgo lateral que resultó ser lo grande: **el emisor de Parameter Change
  del MODX existe y funciona** — el Super Knob con `Super Knob CC = off` emite 635 SysEx en 25 s en
  `30 4B 00`, que además es la **primera dirección de solo lectura** encontrada en el proyecto.
- Fase 1 — analizador de audio en Angular. Desbloqueada, sin empezar.
- Fase 2 — MIDI. Fase 3 — SysEx (ya no es incógnita, es trabajo). ~~Fase 4 — port ESP32.~~
  **Cancelada.** La última fase pasa a ser el catálogo DX7 (ver sección propia).

## Hardware y cadena de señal

- **MODX8** conectado por USB al portátil (Windows).
- Con el **Yamaha Steinberg USB Driver** el MODX es una interfaz de **10 in / 4 out** más dos
  puertos MIDI. Sin él es class-compliant (es lo que usa iOS), pero en Windows el camino soportado
  es el driver.
- El driver expone **ASIO + WDM**. Chrome habla **WASAPI (WDM)**, nunca ASIO. Ahí está el riesgo.
- Los 10 canales no son decorativos: son Main L&R más cuatro pares asignables (USB1&2 … USB7&8).
  En el teclado el enrutado existe y funciona: `Part Output = USB1&2` en Edit → Common → Part
  Settings → General saca la Part del grupo estéreo principal, y al hacerlo **deja de alimentar
  los envíos de Reverb y Variation** (los insert effects de la Part sí siguen, se apagan a mano).
  Atajo: Quick Setup #3 "Audio REC on DAW".
- **PERO ese par no existe en Windows fuera de ASIO.** Medido en fase 0: el driver Yamaha publica
  **un único endpoint WDM**, `Line (MODX)`, **2 canales**, que es el **Main L/R**. Con
  `Part Output = USB1&2` la captura WASAPI son **ceros digitales exactos**. No es límite de `cpal`
  ni de WASAPI (el array de micros del portátil enumera 4 canales por la misma vía): es que
  Yamaha decide publicar solo un par estéreo en WDM y reserva los 10 canales para ASIO. Verificado
  también en el registro (`PKEY_AudioEngine_DeviceFormat` = 2 ch / 44100 / 24 bit / mask 0x3) y en
  el panel del driver, que no tiene selector de canales.
- **Señal de medida definitiva: Main L/R con disciplina de init**, no enrutado. Reverb Send y
  Variation Send a 0, inserts en thru, sin Master Effect, Master EQ plano. Medido así, el suelo de
  ruido queda en **−100/−109 dB** relativo al pico y los armónicos caen donde predice la teoría:
  suficiente de sobra. La limpieza se garantiza por configuración, no por ruta.
- Lo que se pierde con esto: analizar **varias Parts a la vez** por canales separados. No hace
  falta en ninguna fase prevista (todo es una Part, una nota), así que ASIO queda como mejora
  opcional y no como deuda.

## Riesgos reales, por orden

1. ~~**Que Chrome no dé la señal limpia.**~~ **Muerto.** Doblemente: se descartó el navegador
   como ruta de captura (Tauri + `cpal`), y la fase 0 demostró que WASAPI compartido entrega el
   stream tal cual, sin AGC, sin remuestreo, con suelo de ruido a −105 dB. **La captura ha dejado
   de ser el riesgo del proyecto.** Nota para el futuro: si algún día se captura con
   `getUserMedia` dentro del WebView2, vuelven el AGC y el remuestreo tal cual — el riesgo no
   desapareció, se esquivó.
2. **Puerto MIDI en exclusiva.** En Windows un puerto MIDI abierto por otra app (DAW, MODX
   Connect) no lo abre Chrome. Es una nota de operación, no un problema de diseño.
3. ~~**SysEx del MODX.**~~ **Muerto (fase 0b).** El teclado contesta a Parameter Request a la
   primera, con Device Number `all`, sin tocar nada en el MODX, y acepta escrituras con efecto
   visible en pantalla sobre tres parámetros de operador distintos. Lo único que **no** hace es
   transmitir al editar en el panel — eso no es un riesgo, es una restricción de diseño conocida
   (hay que sondear). Ver "Fase 3".

## Stack — decidido 2026-09-06: Tauri, no navegador

Jesús descarta el navegador de entrada; no necesita que esto viva en una pestaña. Correcto, pero
con un matiz que hay que tener claro: **ni Electron ni Tauri "se saltan el navegador"**. El
renderer de Electron es Chromium y el webview de Tauri en Windows es WebView2, que también es
Chromium. Si dentro de cualquiera de los dos capturas con `getUserMedia`, tienes exactamente el
mismo AGC y el mismo remuestreo. Lo que dan es **la opción de una ruta de captura nativa**, no la
desaparición del problema.

**Elegido: Tauri v2, captura en Rust con `cpal`, MIDI más adelante con `midir`.** Frontend Angular
igual que en cualquier otra opción, con `ng serve` y hot reload durante el desarrollo.

El motivo no es el binario ni la moda: es la calidad de la dependencia de audio. En Rust, `cpal`
y `midir` son las librerías de referencia, mantenidas y con ejemplos que funcionan. El
equivalente en Node es PortAudio vía `naudiodon`/`naudiodon2`, que es node-gyp, compilación
nativa y recompilación cada vez que sube la ABI de Electron. Ese es el tipo de dependencia que se
come una tarde y luego se rompe sola.

**El Rust está acotado y no crece.** Abre el dispositivo, ring buffer, y manda bloques de f32 al
frontend por un channel de Tauri. Un fichero, del orden de cien líneas, copiadas en buena parte
de los ejemplos de `cpal`, que no se vuelven a tocar.

**El DSP se queda en TypeScript**, y es deliberado. Estéreo a 44,1 kHz son ~350 KB/s por el IPC,
que no es nada. Poner la FFT en Rust ahorraría ancho de banda que sobra y metería la parte
divertida e instructiva del proyecto en un lenguaje que Jesús no conoce. La FFT, los picos, los
armónicos y Bessel se quedan donde están el aprendizaje y el gusto por hacerlo. Además así el
plan de vectores de oro sigue en pie tal cual.

## Fase 0 — HECHA. Lo que dejó

Spike en Rust puro de consola (`cpal` 0.15.3 + `hound` + `rustfft`, solo host WASAPI), tirado
después. Informe íntegro en `fase0_RESULTS.md`. Lo que sobrevive:

**Constantes de la captura (medidas, no supuestas):**

| | |
|---|---|
| Dispositivo | `Line (MODX)`, único, **2 canales** = Main L/R |
| Sample rate | **44100 Hz fijo** (único soportado). Nyquist 22050 |
| Formato entregado | **F32** (el endpoint es PCM 24 bit; WASAPI compartido convierte sin pérdida) |
| Buffer por callback | **441 frames, invariable** — 2996/2996 callbacks en 30 s |
| Periodo | exactamente **10,000 ms** → productor regular a 100 Hz |
| Errores / underruns | **0** en 30 s escribiendo WAV *dentro* del callback |
| Nivel de trabajo | **−15 a −25 dBFS** de pico. ~15 dB de margen |
| Suelo de ruido | **−100 a −109 dB** rel. al pico (ventana 4096) |

Consecuencia: el ring buffer es trivial (tamaño fijo, cadencia fija) y no hace falta modo
exclusivo ni ASIO para nada de la fase 1.

**Vectores de oro grabados** (`wav/`, todos 44100/2ch/f32, ~5 s, Main L/R con sends a 0, C4):
`fmx-1op-sine`, `fmx-ratio2-modlow` (mod ≈ 40), `fmx-ratio2-modhigh` (mod ≈ 90),
`fmx-ratio1414` (Coarse 1 / Fine 41), más `routing-main` / `routing-usb12` como evidencia del
test de enrutado. **Los dos canales son idénticos muestra a muestra** (fuente mono centrada): para
análisis basta el canal 0, y eso es la mitad de trabajo.

**La física salió como debía**, que es lo que valida el concepto entero del proyecto:

- 1 operador ratio 1 → senoide con 3.er armónico a −84 dB (0,006 % THD).
- Ratio 2:1 → **solo armónicos impares** (las bandas de frecuencia negativa se pliegan). Ni rastro
  del 2.º, 4.º ni 6.º.
- Mismo ratio con el modulador alto → mismo esqueleto impar, pero **el pico más alto ya no es la
  fundamental sino el 9.º armónico**. Bessel de manual, visible sin haber escrito una línea de
  interfaz. Ese par bajo/alto es *el* vector de prueba: misma estructura de frecuencias, reparto
  de amplitudes radicalmente distinto.
- Ratio no entero → las 11 parciales encajan en `|fc ± k·fm|` con **fm = 369,175 ± 0,005 Hz**.

## Tres trampas medidas — spec obligatoria para el detector de picos

Las tres salieron de la fase 0 sin que nadie las buscara. Ignorar cualquiera de ellas da una
herramienta que miente con cara de acertar.

1. **El comb del generador FM-X.** Hay picos que **no son armónicos** en `k·(44100/16) ± f0`, o sea
   múltiplos de **2756,25 Hz**, a **−72 dB**. Están ligados al reloj de muestreo, no a la nota, así
   que huelen a artefacto de la tasa de control interna del tone generator del MODX (no de la
   cadena de captura). El problema no es el nivel: es que en `fmx-1op-sine` son **el 2.º y el 3.er
   pico más altos de todo el espectro**, muy por encima del 3.er armónico real. Un detector
   ingenuo de "top N picos" falla el primer día. → **Lista de exclusión fija en el detector**, y
   marcarlos en pantalla como artefacto en vez de esconderlos.
   *Test barato pendiente:* cambiar de nota. Si el comb se queda quieto y solo se mueven sus
   bandas laterales, queda confirmado que es tasa de control y no otra cosa.
2. **Sesgo del estimador de f0 a 4096.** La interpolación parabólica sobre Hann tiene sesgo
   sistemático en bins bajos: **+0,17 Hz = 1,13 cents** para f0 = 262 Hz (bin 24,3). Converge al
   alargar la ventana (261,934 → 261,805 → 261,763 con 4096 / 16384 / 65536). Los armónicos altos
   ya son correctos desde 4096. → Dos consecuencias: **estimar f0 dividiendo un armónico alto es
   ~10× más preciso** que leer el bin de la fundamental, y **hay que partir el DSP en dos**
   (abajo).
3. **La pantalla del MODX no es verdad de referencia.** Con Coarse 1 / Fine 41 el display dice
   `1.41` y el oscilador genera **1,4103** — **0,4 cents** de diferencia, redondeo interno. Y la
   afinación absoluta tampoco cuadra: `fc = 261,763` frente a los 261,626 Hz de C4 a A=440 son
   **+0,91 cents**. → Para el panel "teoría vs medición", los ratios se **miden**, no se leen.
   Nota útil: cualquier error de reloj o de master tune **se cancela en los ratios** (son
   adimensionales) pero **no en los Hz absolutos**. O sea que las afirmaciones sobre ratios y
   posiciones relativas de parciales son robustas; las de pitch absoluto necesitan calibración.
   *Sin resolver:* si esos +0,91 cents son Master Tune del teclado, detune del operador en el init
   o deriva de reloj. Mirar Utility → Settings → Sound antes de calibrar nada.

## Fase 1 — el analizador (Angular dentro de Tauri)

La app que valida la idea: *¿mirar esto mientras toco los ratios me hace entender FM?*

**FFT propia desde el principio.** Con captura nativa las muestras llegan por IPC, no por un grafo
de Web Audio, así que `AnalyserNode` deja de estar en la ecuación — y mejor, porque nunca sirvió
para medir: no controlas la ventana, aplica suavizado y devuelve dB ya cocinados. Ventana Hann,
solape, y todo lo cuantitativo calculado por nosotros. Si el hilo principal se queda corto, la
FFT se va a un Web Worker, no a Rust.

**Números que fijan el diseño.** A 44,1 kHz con FFT de 4096, cada bin son ~10,8 Hz y la ventana
son ~93 ms. Eso basta para ver, pero no para distinguir un ratio 1,41 de un 1,414. La solución no
es una FFT gigante: es **interpolación parabólica sobre los tres bins del pico** en escala log,
que convierte bins de 10,8 Hz en estimaciones por debajo del hercio y cuesta cuatro líneas.
15-30 espectros por segundo sobran para que se vea fluido.

**Dos DSP, no uno — decidido tras la fase 0.** El sesgo de 1,13 cents a 4096 no se arregla con
interpolación mejor, se arregla con ventana más larga, y una ventana larga no puede alimentar una
vista a 30 fps. Así que se separan dos caminos sobre el mismo ring buffer:

- **Vista viva** — 4096 con solape, 30 fps. Scope, spectrum y waterfall. Precisión de píxel, no
  de cents. Es lo que se mira mientras se gira un knob.
- **Medida** — 16384 o 65536 sobre nota sostenida, disparada a mano (y en fase 2 automáticamente,
  porque la app tocará la nota ella misma y una captura larga sale gratis). Es la que produce
  números publicables: ratio medido, tabla de parciales, comparación con Bessel.

Que la medida sea un acto explícito y no un número que parpadea también es honesto de cara al
usuario: separa "estoy mirando" de "estoy midiendo".

**El scope tiene que quedarse quieto o no vale nada.** Trigger por cruce por cero ascendente,
alineado al periodo de la nota. Cuando llegue el MIDI (fase 2) el periodo lo sabemos exacto y el
trigger deja de adivinar.

Vistas: Scope, Spectrum, Harmonics, Waterfall. El waterfall es el que enseña los envelopes del
modulador — el ataque brillante que se apaga — y es probablemente la vista que más enseña.

## Qué sabe cada fuente — y por tanto qué se puede pintar y cuándo

Confusión que hay que tener resuelta antes de diseñar la pantalla: **el MIDI de notas no sabe
nada de FM**. Note-on te da tecla y velocity, punto. Las tres fuentes son:

| Quiero pintar | Audio (fase 1) | MIDI notas (fase 2) | SysEx (fase 3) |
|---|---|---|---|
| Waveform, espectro, waterfall | sí | — | — |
| Posición exacta de las parciales | sí | — | — |
| **Ratio fm/fc** | **sí, inferido** | — | sí, leído |
| Índice de modulación | sí, inferido vía Bessel | — | sí (level) |
| Nota y velocity | estimable | sí, exacto | — |
| **Diagrama del algoritmo, qué OP modula a cuál** | **no** | no | sí |
| Envelopes, feedback, niveles por operador | parcial (waterfall los ve) | — | sí |

**La inferencia por audio ya está demostrada en fase 0**, no es una promesa: del WAV de ratio no
entero se recuperó `fm = 369,175 ± 0,005 Hz` y `fc = 261,763` a partir del espaciado de las once
bandas laterales, o sea **ratio medido 1,4103** sin preguntarle nada al teclado. Y el ratio 2:1
deja una firma inconfundible (solo armónicos impares, por plegado de las frecuencias negativas).

Límite honesto de la inferencia: **funciona con dos operadores, se rompe con ocho**. Con un
algoritmo complejo hay muchas combinaciones que producen espectros parecidos y el problema deja de
tener solución única. Eso no es un fallo del proyecto — es exactamente por lo que las lecciones
empiezan en un operador y suben de uno en uno.

~~**Atajo que desbloquea "teoría vs medición" sin SysEx:** un formulario donde Jesús teclea lo que
ha puesto en el MODX.~~ **Ya no hace falta (fase 0b).** El teclado contesta, así que la columna
SysEx de la tabla está disponible desde que se escriba el lector — y el lector es media tarde de
trabajo conocido, no una incógnita. El formulario manual queda como fallback de emergencia, no
como plan.

Y hay algo mejor que leer, que el spike demostró y que reordena las fases: **la app puede
escribir**. Una lección no tiene por qué decirle a Jesús "pon el Op3 a ratio 2 y nivel 40" y
esperar a que lo haga bien; puede montarlo ella en el teclado, sonar al tocar (Local Control sigue
en on) y saber exactamente qué hay puesto sin releerlo. Eso convierte el "curso de 7 lecciones" de
lista de instrucciones en algo que se ejecuta solo.

## Fase 2 — MIDI, y el giro que lo hace útil

MIDI no es solo "saber qué tecla ha pulsado". Lo que cambia el proyecto es **que la app toque
ella**: manda note-on, sostiene, mide, suelta. Con eso los experimentos son repetibles y se puede
barrer un parámetro y grabar el resultado de cada paso.

Ejemplo del experimento que justifica el proyecto entero: subir el nivel del modulador de 0 a 99
en pasos, capturar el espectro en cada paso, y pintar el resultado como un mapa. Eso es el índice
de modulación dibujado, y es lo que en los libros son las **funciones de Bessel** — la amplitud
del armónico n-ésimo es `J_n(I)`. El panel "teoría" no es prosa: es una curva calculable que se
superpone a la medida. Ahí es donde la herramienta deja de ser un osciloscopio bonito.

## Fase 3 — SysEx. Validada en fase 0b

Informe completo en `fase0b_RESULTS_sysex.md`. Resumen de lo que quedó **medido**:

- **Puerto: `MODX-1`**, para mandar y para recibir. En 345 s de escucha, `MODX-2` y `MODX-3` no
  recibieron un solo byte. No se ha investigado para qué sirven.
- **Device Number = `all`** (determinado por experimento, no leído en pantalla): responde a
  cualquier `n`. **Pero contesta siempre con `1n = 10`** — el parser no debe casar la `n` de la
  respuesta con la que envió. Si otro usuario lo fija a un número, el barrido de los 16 `n` sigue
  siendo la forma de encontrarlo.
- ~~**Latencia de Parameter Request: 14-21 ms**~~ → **CORREGIDO en fase 0c: mediana 2,0 ms.** El
  número de la 0b salía del timestamp de `midir`, que cuenta desde que se abre el puerto e incluía
  la apertura. Ida y vuelta real con el puerto abierto: 1,5-2,4 ms. Un orden de magnitud mejor, y
  cambia el cálculo de si sondear sale a cuenta.
- **Las escrituras no producen eco.** El teclado aplica y calla → no hay riesgo de bucle si la app
  escribe y escucha a la vez.
- **Ciclo cerrado confirmado** sobre tres parámetros de operador (Level, Attack, Spectral Form):
  escribir desde el PC, leer de vuelta, y verlo cambiar en la pantalla del MODX. Esto es lo que
  permite que la app **monte el patch de la lección** en vez de pedirle a Jesús que lo teclee.
- **Local Control = on**, así que el teclado sigue sonando solo mientras la app le escribe
  parámetros: el usuario toca y oye sin que la app reenvíe las notas. Es justo lo que se quiere.

### No hay vista viva — hay que sondear

**El MODX no transmite Parameter Change al editar en el panel.** Es un "no" medido, no un "no
llegó nada": se muteó la Part 1 desde el panel con los tres puertos escuchando, salieron **0
mensajes SysEx**, y la lectura posterior de `31 00 18` demostró que el cambio sí había ocurrido.
Sesión previa de 300 s, mismo resultado. Los ajustes de MIDI del teclado estaban correctos.

Consecuencias de diseño:

- El diagrama de operadores es una vista **sondeada**, no reactiva. Releer al cargar Performance,
  bajo demanda, y con un poll de cadencia a decidir.
- **El sondeo compite con las notas, pero mucho menos de lo que parecía.** Cuantificado en fase 0c
  con carga generada desde el PC (y verificando el tráfico recibido, porque una medida de carga que
  no comprueba la carga no mide nada):

  | carga | mediana | p99 | peor caso | perdidas |
  |---|---|---|---|---|
  | solo clock | 2,0 ms | 3,3 | 3,5 ms | 0 / 1216 |
  | 2 notas/petición | 9,1 ms | 12,3 | 16,0 ms | 0 / 1216 |
  | 8 notas/petición | 13,2 ms | 18,4 | **22,6 ms** | 0 / 1216 |

  **Cero peticiones perdidas en 27.000**, con timeouts de 50 a 500 ms. Los huecos falsos de la 0b
  eran el timeout de 50 ms rozando el peor caso, no pérdida real.
  → **Timeout recomendado: 100 ms** (4,4× de margen). Lectura completa de patch: ~0,9 s ocioso,
  ~5,5 s tocando. Un set de vigilancia de 40 parámetros da **~2 Hz tocando y ~12 Hz en silencio**,
  suficiente para que el diagrama parezca vivo.
- El MODX **transmite clock continuamente**, ~~~125 msg/s~~ → **CORREGIDO en fase 0d: ~40 msg/s a
  90 BPM**, contando Active Sensing. El clock son 24 pulsos por negra, o sea `BPM × 24 / 60`: **el
  tráfico de fondo escala con el tempo de la Performance**. Los 125/s de la 0c se midieron con el
  Tempo a 300, que lo había puesto el propio spike al probar la codificación de dos bytes — era un
  artefacto de su propia escritura. No se probó a apagarlo porque con él puesto no se pierde nada.
- Como la app puede **escribir**, hay un atajo elegante: si la app monta el patch, ya sabe lo que
  hay puesto y no necesita releerlo. El sondeo solo hace falta cuando el usuario toca el teclado.

### Qué notifica el teclado — CERRADO en fase 0d (2026-09-07)

Detalle en `fase0d_RESULTS_notificaciones.md`. La regla es limpia: **el MODX transmite lo que tocas,
no lo que editas ni lo que seleccionas.** Única excepción, medida en fase 0e: el **Super Knob**
(ver más abajo).

**Transmite (medido en ventana de 60 s con clock filtrado y contado):**

- **Notas**, canal 1 con `MIDI I/O Mode = Single`. Dos trampas para el parser: el **Note Off llega
  como Note On con velocity 0** (`90 nn 00`, 11 de 11, nunca `0x80`), y el **pitch bend es de 14
  bits reales** — leerlo a 7 y se pierden dos tercios de los valores.
- **Modulación en CC 1**, rango completo. Velocity con resolución real.
- El **número de Note On por tecla depende de `MIDI I/O Mode`**: en `Single` uno, en `Multi` uno por
  Part (una tecla dio cuatro, en canales 1-4, en 28 ms). Si la app cuenta notas sin saber el modo,
  cuenta de más.
- El MODX8 **no tiene aftertouch**, así que ese caso no es medible.

**No transmite nada (cero bytes, verificado con ancla de lectura antes/después):**

- Cambiar el operador en foco, cambiar de página, cambiar de Part.
- **Cargar otra Performance.** Y no es un ajuste apagado: `Bank Select` y `Pgm Change` estaban en
  `ON` en `[UTILITY] → [Settings] → [Advanced]`, y se repitió con `MIDI I/O Mode` en `Single` y en
  `Multi`. El canario fue el nombre de la Part (`31 00 00`-`13`): cambió de `Init Normal (FM-X)` a
  `CFX + FM EP 2` sin que saliera un byte.
  **Cerrado por documentación (2026-09-07):** el Reference Manual dice de los dos interruptores
  «enables or disables … messages, **both in transmission and reception**», así que gobiernan
  también la transmisión y la hipótesis de «son solo de recepción» queda descartada. El cero es
  real, no un ajuste apagado.
  **Falsado en fase 0e (2026-09-07): el cero se CONFIRMA.** Repetido en modo crudo (`listen --raw`,
  todo byte que no sea `F8`/`FE` impreso en hex, sin clasificar) y con el ancla verificada **dentro**
  de la ventana por la propia herramienta. Dos tandas, Performance de fábrica y de usuario: **ni una
  línea de log**, con 2.016 y 2.014 mensajes de clock filtrados como prueba de vida. La grieta del
  parser (`0xC0` descartado en silencio) queda descartada: en modo crudo no hay clasificación que
  pueda fallar, y la inyección sintética imprime `C0`, `B0` y `D0` correctamente.
- Ediciones de panel, re-verificado con configuración de menú documentada y con ancla dentro de la
  ventana (Algorithm 2→3 y Op3 Level 52→73, 0 mensajes en 30 s).

**Consecuencia de diseño:** la app **no puede enterarse de que el patch ha cambiado debajo**. No hay
evento. El ancla barata es el **nombre de la Part**: 20 direcciones, ~40 ms, sondeado a 1 Hz detecta
un cambio de Performance en menos de un segundo. Alternativa o complemento: botón de "releer".

**Cadencia confirmada.** Conjunto de 40 direcciones (5 parámetros × 8 operadores), timeout 100 ms,
2.000 peticiones por condición: **12,22 Hz en silencio** (mediana 2,0 ms) y **2,43 Hz con 8 notas
por petición** (mediana 10,3 ms, peor caso 24,2 ms). **0 perdidas de 4.000.** La predicción de la
fase 0c (~12 y ~2 Hz) era correcta.

**Direcciones reservadas: no son descubribles por sonda.** En el bloque `48 00`, cuatro de las cinco
reservadas (`51`-`55`) **responden a un Parameter Request** como si fueran reales, y `53` devuelve
dos bytes. O sea que la regla "no leer ni escribir reservadas" **depende del Data List** — es
exactamente así como la fase 0c se metió en el problema de `48 00 52`.

### El emisor de Parameter Change existe — fase 0e (2026-09-07)

Detalle en `fase0e_RESULTS_falsacion.md`. **El MODX sí sabe emitir Parameter Change, y lo hace bien:
solo lo hace para un control.** Con `Super Knob CC = off`, mover el Super Knob emite **635 SysEx en
25 s**, todos Parameter Change (`F0 43 10 7F 1C 07 30 4B 00 vv F7`) con los 128 valores. Con
`Super Knob CC = 95` (el default) emite en cambio **473 CC 95** y cero SysEx.

Reinterpreta los ceros de las fases 0b/0d/0e: **no son incapacidad de firmware, son decisión de
diseño de Yamaha**. Para la arquitectura no cambia nada — sigue habiendo que sondear — pero cierra
la duda de si el emisor existía siquiera.

**`30 4B 00` es de SOLO LECTURA.** Primera dirección así de todo el proyecto: se lee (`3F`, coincide
con la posición del knob), emite, y **no acepta escritura** (escrito `20` y `60`, relectura `3F` en
ambos casos). ⇒ la regla «toda escritura se verifica releyendo» no es solo por el no-op silencioso
de longitud: **hay direcciones que nunca aceptarán la escritura**, y el Data List no las marca.

**Puertos `MODX-2` y `MODX-3`: resultado ambiguo, no cero.** Abren sin error pero **no entregan ni
clock** (0 en 30 s) mientras `MODX-1` da ~50 msg/s en el mismo momento. Su silencio no es
interpretable: no se puede distinguir «no tienen nada que decir» de «no están entregando nada». No
se ha encontrado forma de hacerlos hablar.

### El método de descubrimiento (lo más valioso que dejó el spike)

Como el teclado no transmite, girar knobs y mirar bytes **no sirve**. Lo que funciona: fotografiar
el espacio de direcciones con Parameter Requests, cambiar un parámetro en el panel, volver a
fotografiar, y comparar. ~10 s por iteración. Con eso el resto del mapa se levanta solo.

Plan B para leer de golpe: **Bulk Dump**. `F0 43 20 7F 1C 07 ah am al F7`. El buffer de edición
vivo es **`0E 25 00`** (7.669 bytes), y el diff es limpio — dos volcados sin tocar nada son
idénticos byte a byte, sin contadores ni timestamps, así que cualquier diferencia *es* el
parámetro. Checksum Yamaha estándar `(0x80 - suma) & 0x7F`, confirmado. Para leer un puñado de
parámetros gana el Request (11 bytes, **2,0 ms** — el 16 ms era el artefacto de medida de la 0b);
para reconstruir una Performance entera, el bulk.

### Trampa del parser: `dd` es de longitud variable

Algunas direcciones devuelven **dos bytes de dato**, y `49 xx 25` devuelve **cinco**. Cuando un
parámetro ocupa varios bytes, el `al` siguiente no responde: está consumido. Durante el spike un
comparador que asumía un byte por dirección produjo **20 falsos positivos** en el diff del
algoritmo. **El parser del proyecto tiene que tratar `dd` como longitud variable desde el primer
día**, no como un byte.

**Codificación multibyte, medida en fase 0c: `valor = (b1 << 7) | b2`.** Verificada contra un
parámetro legible en pantalla y mayor de 127 — el Tempo de la Performance (`30 40 2C`, rango 5-300):
90 → `00 5A`, 200 → `01 48`, 300 → `02 2C`. Y en escritura, `02 2C` puso 300 en la pantalla.
Longitudes observadas: 1, 2, 4 y 5 bytes. Regla del parser: **el dato es todo lo que hay entre `al`
y el `F7` final**, nunca posición fija. Un `al` que calla es "consumido" por el multibyte anterior o
"vacío", y el mapa distingue los dos casos.

**Trampa del lado de escritura (fase 0c, la peor de todas): escribir con la longitud equivocada es
un no-op SILENCIOSO.** Mandar dos bytes a un parámetro de uno no da error, no cambia nada y el
teclado no protesta. Corolario duro: **toda escritura se verifica releyendo.** Y los valores fuera
de rango **saturan** en vez de rechazarse (algoritmo `58` → queda en `57`).

Segunda trampa, del barrido: **`am` significa cosas distintas en cada bloque** (Part en `0x31` y
`0x48`, `(operador<<4)|part` en `0x49`, algo sin identificar en `0x30`). El barrido inicial probó
solo `am = 00` y dio por muertos bloques que no lo estaban — incluido el de operadores FM-X, que
casi hace concluir en falso que no eran alcanzables. **Barrer `am` entera antes de declarar nada
vacío.**

## La puerta al ESP32 — CANCELADA 2026-09-07

Jesús cierra la vía: la app ya no es lo que quería inicialmente (un osciloscopio junto al teclado),
es un tutor que conduce el MODX por SysEx, y eso no cabe ni tiene sentido en el S3. **No hay port,
no hay segundo target, no hay 1024×600.** Solo Tauri en el portátil.

Lo que se salva de esta sección, porque vale por sí mismo y no por el port: **el DSP puro y aislado**
(funciones sin Angular ni DOM: entran `Float32Array`, salen números), **los vectores de oro** de la
fase 0 como tests de regresión del análisis, y **los parámetros de FFT congelados y escritos**. Eso
seguía siendo buena ingeniería antes de existir el ESP32 y lo sigue siendo ahora.

Texto original, conservado por historia:

### (histórico) Un contrato, no código

No se comparte código. TypeScript en el navegador y C++/LVGL/ESP-DSP en el S3 no se parecen, y
forzar la abstracción hoy empeora la fase 1 sin ahorrar nada mañana.

Lo que sí se hace ahora, y cuesta casi nada:

- **DSP puro y aislado.** El análisis vive en funciones sin Angular, sin DOM y sin Web Audio
  dentro: entran `Float32Array` y parámetros, salen números. Angular solo las llama.
- **Vectores de oro. Ya grabados en fase 0** (los cuatro WAV de arriba, con su espectro y sus
  picos medidos en `fase0_RESULTS.md`). Falta guardar junto a ellos la salida de la versión TS
  cuando exista. Esos ficheros son **la especificación ejecutable del port**: el día que exista el
  C++, pasa o no pasa. Pendiente por añadir a la colección: una nota **con envelope de modulador**
  (todo lo de fase 0 es estado estacionario), que es justo lo que el waterfall tiene que enseñar.
- **Parámetros congelados y escritos**: tamaño de FFT, ventana, solape, criterio de pico,
  interpolación. Un port que use otra ventana no es el mismo instrumento.

La 7B es 1024×600, la misma anchura horizontal que la 5B — el ancho es lo que importa en un
osciloscopio, y la elección de 7B es por distancia de lectura al lado del teclado, no por
resolución. Cuando llegue, el reto no es la GUI: es **USB Audio Host en el S3**, que es lo más
incierto de todo el proyecto. Plan B conocido: audio analógico por ADC I2S desde las salidas L/R.

## Decisiones tomadas

- ~~**Windows primero, ESP32 después.**~~ **2026-09-07: solo Windows/Tauri. ESP32 cancelado.**
- **El portátil es táctil, y la app se diseña para dedo además de ratón.** Consecuencias de diseño:
  objetivos de toque grandes (mandos y puntos de envolvente arrastrables con el dedo, no de 8 px),
  nada que dependa de hover para descubrirse ni para leerse un valor, gestos de arrastre en los
  editores de curva, y cero menús contextuales de clic derecho como única vía.
- **Angular/TypeScript**, porque es su terreno y la pregunta que hay que contestar no es técnica.
- ~~**Audio primero, MIDI después, SysEx al final.**~~ **Corregido 2026-09-06:** SysEx se adelanta
  a un spike propio (fase 0b, `prompt.md`) **antes** de la fase 1. Motivo: es la única parte del
  proyecto cuyo resultado cambia el diseño de la pantalla principal, y es lo más incierto. Si el
  MODX transmite Parameter Change al editar, el diagrama de operadores es una vista viva; si solo
  responde a Request, es sondeo; si no hace ninguna, es un formulario que rellena el usuario. No
  tiene sentido diseñar esa pantalla sin saber cuál de las tres. El spike es de una sentada y no
  depende de nada de la fase 1. **Resuelto: escenario 2 (sondeo), con escritura de propina.**

### Formato SysEx del MODX — VERIFICADO contra el teclado (fase 0b)

```
PARAMETER CHANGE    F0 43 1n 7F 1C 07 ah am al dd F7     (escribir)
PARAMETER REQUEST   F0 43 3n 7F 1C 07 ah am al F7        (leer)
BULK DUMP REQUEST   F0 43 2n 7F 1C 07 ah am al F7        (volcar)
```

**Model ID `07` = MODX**; el Montage usa `02`, así que los ejemplos que circulan por internet
suelen venir con el byte equivocado y el teclado simplemente calla. Formato y esquema de
direcciones confirmados además contra una fuente independiente (hilo de yamahasynth.com), cuyas
dos direcciones documentadas se releyeron correctamente en el teclado.

En el bloque FM-X de operador, **`am = (operador << 4) | part`**, ambos base cero: Op3 de la Part 1
es `am = 0x20`, Op3 de la Part 2 es `am = 0x21`. En los bloques `0x31` y `0x48`, `am` = índice de
Part a secas.

Como FM-X tiene 88 algoritmos fijos, **el número de algoritmo *es* la topología**: al cambiarlo no
se movió ninguna otra dirección. No hay matriz de rutado que leer.

### El mapa — 48 entradas (fase 0c). Fuente de verdad: `modx-map.json`

Levantado con la herramienta `map` (foto → cambio → foto → diff), que persiste dirección, nombre,
longitud, valores observados y cómo se descubrió, y **marca como ambiguo en vez de adivinar** cuando
el diff da más de una dirección. El mapa es JSON editable a mano y se amplía en sesiones sucesivas.

**Bloque de operador `ah=0x49`, `am=(op<<4)|part` — 31 de 43 offsets válidos:**

| `al` | parámetro |
|---|---|
| `01` | Key On Reset |
| `03` | Freq Mode (Ratio=0, Fixed=1) — **cambiarlo a Fixed modifica también el Coarse** |
| `04` / `05` | Coarse / Fine del ratio |
| `06` | Detune (bipolar, **centro 15**) |
| `07` / `08` | Pitch/Key / Pitch/Vel (bipolar, centro 7) |
| `09` | Spectral Form (enum base cero: Odd1=3, Odd2=4, Res1=5) |
| `0A` / `0B` | Spectral Skirt / Resonance (aparecen con Form = Res) |
| `0C` / `0D` | Form/Freq LEVEL Initial / Attack (bipolar, **centro 50**) |
| `0E` / `0F` | Form/Freq TIME Attack / Decay |
| `10`-`13` | Level LEVEL: Attack, Decay 1, Decay 2, Rel(Hold) |
| `14`-`18` | Level TIME: Attack, Decay 1, Decay 2, Release, Hold |
| `19` | Time/Key |
| `1A` | **Level del operador** |
| `1B` | Break Point (escala propia, ver abajo) |
| `1C`-`1F` | Lvl/Key Lo, Lvl/Key Hi, Curve Lo, Curve Hi |
| `20` | Level/Vel (bipolar, centro 7) |

**Corrección de la fase 0b: `49 xx 0E` NO es el Attack del EG de amplitud**, es el Attack de la
envolvente de la página Form/Freq. El operador FM-X tiene **dos** envolventes; el Attack de la de
Level está en `49 xx 14`.

**Bloque de Part `ah=0x31`, `am=part`:** `00`-`13` nombre (20 bytes ASCII), `18` Mute, `1C`/`1D`
Velocity Limit Lo/Hi, `1E`/`1F` Note Limit Lo/Hi (**MIDI estándar, C-2 = 0**), `22`/`23` Velocity
Depth/Offset, `24`/`25` Volume/Pan, `29`/`2A`/`2C` RevSend/VarSend/Dry Level.

**Bloque `ah=0x48`, `am=part`** — corrección: no es solo "FM-X de Part", tiene parámetros generales.
`01` Alternate Pan, `02` Scaling Pan, `03` KeyOnDelay Length, **`4F` Algorithm FM-X** (base cero).
De 72 offsets válidos hay 4 identificados. Y `30 40 2C` = Tempo de la Performance.

**Tres codificaciones distintas, y esto es spec para la UI:** directa (Level, Coarse, tiempos), enum
base cero en el orden de la pantalla (Algorithm = pantalla − 1, Spectral Form, Curve), y **bipolar
con offset cuyo centro varía por parámetro** — Detune centra en 15, Form/Freq Initial y Attack en
50, Level/Vel en 7. **No asumir 64.**

**Dos escalas de nota en el mismo instrumento:** Note Limit de Part usa MIDI estándar (C-2 = 0,
medido en dos puntos); el Break Point del operador **no** (`B 3` → 50, que con C-2=0 sería 71). El
offset de 21 encajaría con una escala que empieza en A-1 — **CONFIRMADO por el Data List**
(`Level Scaling Break Point: A-1 – C8`), ver más abajo.

**¿Vale el mapa para los ocho operadores?** Estructuralmente sí: los ocho tienen exactamente los
mismos 43 offsets válidos con los mismos huecos. Semánticamente solo está confirmado fuera del Op3
en `1A`, `06` y `17` — el resto es inferencia razonable, no medición.

**El Feedback no está en el bloque de operador.** Descarte firme: los 12 offsets sin identificar
valen lo mismo en los ocho operadores, y el algoritmo activo da feedback al Op1 — si fuera un
parámetro por operador, el Op1 tendría ahí un valor distinto. Tampoco aparece en ninguna pantalla
del operador. **RESUELTO por el Data List: `48 0p 50` = Feedback Level (0-7), por Part.**

### El Data List cierra el mapa — 2026-09-07

`modx/modx_data_list.pdf` (223 pág.) **sí trae las tablas de Parameter Change completas**, pág.
186-220. Extracción curada en **`modx/datalist_fmx_tables.md`**; texto crudo de toda la sección MIDI
en `modx/datalist_midi_pages186-220.txt`. Es el PDF del MODX6/7/8 (Implementation Chart v1.0,
18-JUL-2017), no del Montage.

Lo que resuelve, sin tocar el teclado:

- **Feedback**: `48 0p 50`, por Part, no por operador. **MEDIDO en fase 0d**: leído (usuario pone 5
  → `05`), escrito desde el PC (`03` → la pantalla muestra Feedback 3). Ciclo cerrado.
- **Los 12 offsets sin identificar del operador**: `00`, `02`, `2A` son *reserved*; `21`/`22` son
  offsets de 2nd LFO Pitch/Amp Mod Depth; `23`/`24` sensibilidades de controlador; `2B`-`2E` están
  **consumidos por `2A`**, que ocupa 5 bytes.
- **El efecto colateral `48 00 52` → `48 00 48`**: `52` es una dirección **reservada** (`51`-`55` lo
  son), y `48` es **2nd LFO Speed**, default `1E` = 30 — justo el valor que no volvía. Escribir en
  reservadas es comportamiento indefinido. ⇒ **el backup no debe leer ni escribir offsets
  reservados**; la pasada de verificar-y-reparar se mantiene igual, por prudencia.
- **Confirma inferencias**: Break Point base A-1, enum de Curve (`-Lin, -Exp, +Exp, +Lin`), centros
  bipolares (Detune 15, Vel 7), codificación `(b1<<7)|b2`.
- **Corrige etiquetas**: `0C`-`0F` es la **PEG** del operador, `10`-`18` la **AEG**. `09` Spectral
  Form llega a **Res 2 = 6**.
- **El bloque de filtro entero** vive en `48 0p`: Filter Type (`0B`, 19 tipos, default Thru), Cutoff
  (`0C`, 2 bytes), Resonance (`0F`), FEG completa, key follow y scaling. **Ya no hay que mapearlo a
  mano** — solo verificar.

**Procedencia**: todo esto es *documentado*, no medido. Entra en `modx-map.json` marcado como tal y
no se da por bueno hasta que el teclado conteste — la fase 0c demostró que escribir con la longitud
equivocada es un no-op silencioso.

### El Reference Manual — pantallas y rutas de menú (2026-09-07)

`modx/modx_reference_manual.pdf` (217 pág.). Mapa pantalla↔dirección en
**`modx/rm_pantallas_fmx.md`**; texto crudo en `modx/rm_fmx_pages145-159.txt` (FM-X Edit) y
`modx/rm_utility_pages187-211.txt` (Utility).

**Rutas de menú — cierra el último pendiente de las fases 0b y 0c:**

- `Device Number`, `Receive Bulk`, `Bulk Interval`, `MIDI I/O Mode`/`Ch.` → `[UTILITY]` →
  `[Settings]` → `[Advanced]`.
- `MIDI IN/OUT`, `Local Control`, `MIDI Sync`, `Clock Out` → `[UTILITY]` → `[Settings]` →
  `[MIDI I/O]`.

**`Receive Bulk` puede estar en `Protect`**, y entonces el teclado ignora el bulk restore en
silencio. Es lo primero que hay que mirar si un `bulk-send` no hace nada, y va como precondición
verificada del modo tutor. `Bulk Interval` solo afecta a la transmisión *del teclado*, no al envío
desde el PC — por eso 0 ms de pausa funcionaba.

**Y no se puede leer ni escribir por SysEx.** El bloque SYSTEM (`00 00 al`) del Data List tiene
`09` Local Control, `18` MIDI IN/OUT, `1F` Bulk Interval, `30` MIDI I/O Mode, `31` MIDI I/O Channel,
`3B` Sustain Pedal Select (el que ya midió la fase 0b) — pero **ni `Receive Bulk` ni
`Device Number`**. Los dos ajustes que controlan si el teclado te hace caso son justo los dos que
Yamaha deja fuera del alcance remoto. ⇒ **el modo tutor no puede consultarlo: tiene que detectarlo
por sonda.** Escribir un parámetro conocido, mandar el snapshot, releer; si no vuelve, el bulk se
está ignorando. Cuesta ~50 ms y sirve de health check al arrancar. Los Parameter Change **no** están
gatilleados por `Receive Bulk`, así que si las escrituras sueltas funcionan y el bulk no, el
culpable está aislado.

**El bulk es más fino que los 7,7 KB.** La tabla BULK CONTROL documenta `0E`=Bulk Header /
`0F`=Bulk Footer, y dentro: `25 00` Performance Edit Buffer (el que se usó), pero también
**`52 nn` = Performance Edit Buffer Part `nn`** y **`53 00` = Common**. O sea que se puede volcar y
restaurar **una sola Part** en vez de la Performance entera — interesante para pasos de tutorial que
solo tocan la Part 1. Sin medir.

**El Feedback sí estaba en una pantalla**: `[EDIT]` → Part → Operator `[Common]` →
`[Part Settings]` → `[Algorithm]`, junto al Algorithm. El barrido de la fase 0c miraba las páginas
del operador, y por eso no podía verlo.

**Árbol de edición FM-X** (para la UI y para las lecciones): Operator `[Common]` tiene General,
Algorithm, Pitch, PEG/Scale, **Filter Type / Filter EG / Filter Scale**, Routing (Ins A/B, EQ),
Arpeggio, Motion Seq, Part LFO, **2nd LFO**, Control Assign, Receive SW. Cada operador tiene solo
dos páginas, `[Form/Freq]` y `[Level]`, que son exactamente `49 op 01`-`0F` y `10`-`20` — o sea que
**lo que se edita a mano en el operador ya está mapeado y medido al 100 %**.

### El Synthesizer Parameter Manual — textos del tutor (2026-09-07)

`modx/modx_synth_parameter_manual.pdf` (90 pág., no específico del MODX). Curado en
**`modx/spm_conceptos_fmx.md`**. No trae direcciones ni menús; trae **definiciones**, que es lo que
el modo tutor necesita para explicar en vez de solo señalar.

Lo más aprovechable es la **analogía que usa el propio Yamaha**: el nivel del modulador hace de
frecuencia de corte y su envolvente de envolvente de filtro, mientras que la portadora pone el tono
y el volumen. Es el puente entre lo que Jesús ya entiende (sustractiva) y FM, y encaja con el A/B
medido en fase 0 (modulador a 20 vs 90 → el pico más alto pasa de la fundamental al 9.º armónico).

Y las siete definiciones de **Spectral Form** (`Sine` sin armónicos; `All`/`Odd`/`Res` con rango
ancho o estrecho) son **afirmaciones comprobables en el analizador** — material de lección y batería
de tests a la vez, mismo patrón que Bessel.

Contenido aprovechable para las lecciones: `Skirt` controla cuántos armónicos tiene la forma
espectral y `Resonance` desplaza la frecuencia central (0 = fundamental, 99 = **armónico 100**),
ambos activos solo con `Res 1`/`Res 2`; `Freq Mode = Fixed` hace que Coarse/Fine fijen frecuencia
absoluta y habilita `Pitch/Vel` y `Pitch/Key` — lo que explica el efecto colateral medido de Freq
Mode sobre el Coarse.
- **Init FM-X sin FX para aprender.** Analizar un preset de 8 operadores con reverb y motion
  sequencing no enseña nada: ves el resultado de todo a la vez.

## Modo tutor — lo que la escritura SysEx desbloquea (planteado 2026-09-06 por Jesús)

### Alcance del tutor en fase 1 — DECIDIDO por Jesús 2026-09-07

**Fase 1 sólo cubre Performances de UNA Part FM-X.** Multi-parte queda para una fase posterior, y no
es una limitación técnica sino una decisión de alcance: el esquema de direcciones `am = (op<<4)|part`
está documentado y se leyó una vez de la Part 2 en la fase 0b, pero **sólo la Part 1 está verificada**
(fase 0d, 12/12 en Op5 y Op7, todo sobre Part 1).

**Partes AWM2:** no se reconstruyen paso a paso — son muestras, no operadores. La dirección acordada
es **dejarlas como están y enfocarse sólo en lo FM**. Vía prometedora y no medida: el Data List
documenta direcciones de Bulk **por Part** (`52 nn`) además del Performance entero (`25 00`), así que
una parte AWM2 se podría restaurar byte a byte desde el snapshot mientras la Part FM-X se lleva a init
y se reconstruye. **Documentado, no medido** — comprobarlo es una sesión corta con el teclado.

El objetivo original era *ver* FM. Con escritura confirmada, aparece un objetivo mayor: la app
**conduce** el teclado, y por tanto puede enseñar por pasos.

Forma: "sonido de flauta FM en 5 pasos". Cada paso es un conjunto de parámetros. El usuario lo hace
a mano en el teclado y la app le dice si va bien (lee y compara); si se atasca, la app **escribe el
estado del paso** y él sigue desde ahí. Volver al paso 2 es restaurar un estado conocido.

Lo que está medido y sostiene esto:
- Lectura de operador (`Level`, `Coarse`, `Fine`, `Attack`, `Spectral Form`) y de Part (`Algorithm`).
- Escritura con efecto en pantalla sobre tres parámetros de operador distintos.
- `Local Control` en `on`: el teclado suena solo mientras la app le escribe. El usuario toca y oye.
- Latencia **2,0 ms** por parámetro (medida de la 0b corregida en la 0c) → reconstruir decenas de
  parámetros son centésimas de segundo.

### Las dos incógnitas de arquitectura — CERRADAS en fase 0c, las dos en verde

**1. El Bulk Dump se puede escribir de vuelta, con fidelidad perfecta.** Volcado de `0E 25 00` (123
mensajes, 7.669 bytes) → ensuciar 4 parámetros → reenviar el snapshot tal cual salió → los 4 vuelven
a su valor y el volcado nuevo es **idéntico byte a byte, 7.669 de 7.669**. Y sin necesidad de pausa
entre mensajes: **0 ms de pausa, 0,02 s de envío, resultado idéntico** (esos 0,02 s son el encolado
en el driver; el teclado amortigua sin perder nada). El teclado no acusa recibo, igual que las
escrituras.
→ **Un paso de tutorial puede ser un snapshot binario de 7,7 KB, y restaurarlo es un solo mensaje.**

**2. El Algorithm se puede escribir y el motor lo aplica.** Y aquí el método importa: escribir `05`
(alg. 6) y `57` (alg. 88) redibujó la pantalla pero no cambió el sonido, porque el patch tenía Op3
modulando a Op4 y ambos algoritmos mantienen esa relación. Fue Jesús quien lo señaló. Con el
algoritmo 87, donde Op3 y Op4 no están conectados, Op3 pasó a portadora y el sonido cambió. **La
relectura y la pantalla demuestran que el parámetro se guarda; solo el cambio audible demuestra que
el motor lo aplica.**

### Snapshot parámetro a parámetro — también funciona, y es el que sirve para generar el guion

416 direcciones (`ah` 48 y 49, los 8 operadores de la Part 1): **415/416 a la primera, 416/416 con
una pasada de reparación**, en 0,03 s sin pausa. Ninguna escritura se pierde.

**Pero escribir un parámetro puede modificar otro**, y eso es lo que rompe la restauración ingenua:
escribir `48 00 52` pone `48 00 48` a cero, y como el orden numérico escribe `...48` antes que
`...52`, el segundo se lleva por delante al primero de forma determinista (6/6). Segundo caso: poner
`Freq Mode` en Fixed modifica el Coarse. **Esa clase de dependencia no es enumerable a priori, así
que la restauración no se ordena: se verifica y se repara.** `restore --repair` converge en una sola
pasada con cualquier caudal. El Algorithm, por cierto, **no** arrastra a nada — la sospecha del
brief era falsa.

Contra lo que yo dije el 2026-09-07, el orden sí importa, pero no por el algoritmo.

### Tiempos reales (fase 0c)

| operación | tiempo |
|---|---|
| Leer 416 direcciones conocidas (ocioso) | ~0,9 s |
| Las mismas bajo carga densa de notas | ~5,5 s |
| Escribir 416 direcciones sin pausa | **0,03 s** |
| Restaurar + verificar + reparar | ~5 s |
| Reenviar un bulk completo | 0,02 s de encolado |

Un barrido *a ciegas* de 2.048 direcciones tarda 100 s, pero es todo timeout de las 1.632 que no
existen: una app que conoce el mapa no paga eso.

Riesgo a diseñar desde el principio: escribir pisa el buffer de edición del usuario. Antes de
montar cualquier patch, snapshot de `0E 25 00` y ofrecer volver. **Con el bulk write confirmado,
esa red de seguridad es exacta y no depende de conocer ninguna dirección.**

**Y una lección de seguridad que se paga en carne: la prueba de carga dejó notas colgadas sonando**,
porque el generador mandaba Note On de una nota y Note Off de otra. Todo código que genere notas
lleva su apagado escrito **antes** de usarse, no después. La herramienta ya tiene subcomando
`panic` (All Sound Off + All Notes Off + 2048 Note Off explícitos).

Límite honesto: el SysEx llega hasta donde llegan los parámetros. Guardar la Performance, cambiar
de modo o navegar la UI del teclado no son parámetros y no se conducen desde aquí.

## Sin decidir

- ~~Si `USB1&2` es alcanzable por WASAPI~~ → **cerrado en fase 0: no lo es.** Main L/R con
  disciplina de init es la señal de trabajo; ASIO queda como mejora opcional y ya sabemos lo que
  costaría (SDK de Steinberg descargado aparte, licencia que hay que aceptar, `LIBCLANG_PATH` +
  `CPAL_ASIO_DIR`, binding por `bindgen` en tiempo de compilación). No se paga hasta que haga falta.
- De dónde salen los **+0,91 cents** de afinación absoluta (master tune / detune / reloj).
- ~~**Cadencia del sondeo SysEx**~~ → **cerrado en fase 0c:** timeout 100 ms, 0 perdidas en 27.000
  peticiones, ~2 Hz tocando y ~12 Hz en silencio para un set de 40 parámetros.
- ~~**Si el Algorithm se puede escribir**~~ → **cerrado en fase 0c: sí, y el motor lo aplica.**
- ~~La **ruta de menú real** de los ajustes de MIDI del teclado~~ → **cerrado (Reference Manual +
  fase 0d): Device Number / Receive Bulk / Bulk Interval / MIDI I/O Mode / Bank Select / Pgm Change
  en `[UTILITY] → [Settings] → [Advanced]`; Local Control, MIDI IN/OUT y Sync en `[MIDI I/O]`.**
  Estado actual anotado: `MIDI I/O Mode = Single`, `Bank Select = ON`, `Pgm Change = ON`.
- ~~**La regla exacta de `48 00 52` → `48 00 48`**~~ → **cerrado en fase 0d: no era una dependencia
  entre parámetros, era escribir en una dirección reservada** (`51`-`55` lo son) y llevarse por
  delante el 2nd LFO Speed (`48 0p 48`, default `1E` = 30, el valor que no volvía). Regla: **no
  tocar reservadas** — y ojo, no son descubribles por sonda, cuatro de las cinco contestan.
- ~~**Dónde vive el Feedback**~~ → **cerrado: `48 0p 50`, por Part.** Leído, escrito, y confirmado en
  la pantalla del teclado (`[Part Settings] → [Algorithm]`).
- ~~**Si el mapa de `al` vale para los ocho operadores**~~ → **cerrado en fase 0d: 12/12 sin
  colaterales** en Op5 (`am 0x40`) y Op7 (`am 0x60`), con la dirección predicha antes de mirar.
- **Los 12 offsets sin identificar del bloque de operador** (`00, 02, 21-25, 2A-2E`, explicados por
  el Data List pero no medidos) y **el bloque `0x48` casi entero** (72 válidos, 6 identificados).
- **Escala de nota del Break Point** (un solo punto medido) y el resto del enum de Curve.
- ~~**Si `Bank Select` y `Pgm Change` del menú Advanced son de recepción o de transmisión**~~ →
  **cerrado por documentación 2026-09-07**: el Reference Manual dice «both in transmission and
  reception». Gobiernan las dos.
- **Falsar el cero del cambio de Performance con bytes crudos.** El escucha de la fase 0d clasifica
  mensajes y nunca decodificó un `0xC0`. Repetir (d) con volcado hexadecimal sin clasificar y
  escuchando también `MODX-2`/`MODX-3`.
- **Si el mapa vale para las Parts 2-16.** Todo lo verificado es Part 1.
- **Cuánto sondeo aguanta de forma sostenida.** Las medidas son ráfagas de 4 a 21 s, no horas.
- **Smart App Control de Windows quedó desactivado** para poder terminar el spike, y es de un solo
  sentido: no se puede reactivar sin restablecer Windows. Decisión en frío pendiente; para el
  proyecto real, firmar el binario evita el problema de raíz.
- **Nada sobre guardar en la memoria del MODX.** Deliberado: todo el trabajo ha sido sobre el buffer
  de edición, y hay copias en `safety/`.
- Si el comb de 2756,25 Hz es realmente tasa de control del MODX — se confirma cambiando de nota.
- Si el modo "lecciones" (el curso guiado de 7 pasos) es producto o es solo una lista de
  experimentos en un README. Se decide después de la fase 1, cuando se sepa si mirar esto enseña.

## Corpus DX7 como fuente de verdad para el generador (idea de Jesús, 2026-09-07)

**Yamaha ya hizo el mapeador.** El *FM Converter* (`shop.usa.yamaha.com/en/fmconverter`, gratuito,
oficial) convierte SysEx de **DX7, DX7II, TX802 y TX216/816** a librería de Montage/MODX (`.X7L`).
Existe además la *Complete DX7 Collection* de Easy Sounds (comercial, licenciada por Yamaha Music
Europe) y una librería gratuita de 128 Performances "DX7" en la Montage Expanded Library. Las voces
se convierten **sin editar** — sin efectos ni Motion Control — o sea que son FM pura.

⇒ **No hay que escribir un conversor. Hay que explotar el suyo como generador de pares.**

El formato de voz del DX7 está documentado hasta el último bit (155 bytes, 6 operadores,
32 algoritmos). Si se convierte un `.syx` conocido, se carga en el MODX y se lee de vuelta con
nuestra herramienta SysEx, sale un **par (parámetros DX7 ↔ parámetros FM-X) medido**. Con unos
cuantos pares se obtiene, sin inferir nada:

- la **tabla de equivalencia de algoritmos** 32 → 88,
- la curva de conversión de **Output Level** y de los **rates/levels de EG**,
- cómo se traduce el **key scaling** y el **feedback**.

Y lo que de verdad importa para el generador de sonidos: **miles de patches DX7 públicos con
nombre** (`E.PIANO 1`, `TUB BELLS`, `BRASS 1`) pasan a ser un **corpus etiquetado**. El "prior" del
LLM deja de ser memoria y pasa a ser estadística sobre datos reales: qué ratios, qué índices y qué
envolventes comparten de verdad las campanas frente a los pianos eléctricos.

**Límites, para no venderlo de más:**

- El DX7 tiene **6 operadores y solo ondas seno**. El corpus convertido no dice nada de los otros
  2 operadores ni de los **Spectral Forms**, que son la extensión del MODX. Útil como orden
  pedagógico: primero FM clásica, después lo que el MODX añade.
- Solo cubre los algoritmos alcanzables desde el DX7, no los 88.
- **Cargar una librería escribe en la memoria del MODX**, y hasta ahora todo el trabajo ha sido
  sobre el buffer de edición. El MODX admite 8 librerías de usuario. Requiere decisión explícita y
  copia de seguridad previa.
- El formato `.X7L` no está documentado. La vía buena es cargar en el teclado y leer por SysEx, que
  ya sabemos que funciona.

### Catálogo horneado: la app no sabe qué es un DX7 (Jesús, 2026-09-07)

Decisión de arquitectura: **la conversión es offline y de una sola vez; la app solo consume patches
FM-X**. No hay código DX7 en tiempo de ejecución, ni parseo de `.syx`, ni tablas de conversión
cargadas: la app tiene una colección de patches nativos (pares dirección→valor, o un bloque bulk por
patch) y un nombre por cada uno.

Pipeline, todo fuera del producto:

1. **Parsear `.syx` nosotros.** Trivial y sin incógnitas: banco de 32 voces = 4096 bytes empaquetados
   (cabecera `F0 43 0n 09 20 00`), voz suelta = 155 bytes sin empaquetar. Formato público y estable.
2. **Levantar la tabla de conversión midiendo** (sección anterior): un banco conocido pasa por el FM
   Converter, se carga en el MODX, se lee de vuelta por SysEx, se compara contra los 155 bytes
   originales. Eso da algoritmos 32→88, curva de Output Level, rates/levels de EG, key scaling,
   feedback. **Es el único paso que necesita el teclado y el único que toca la memoria del MODX.**
3. **Hornear.** Aplicar la tabla a la biblioteca entera y escupir los patches en el formato de la app.
4. La app carga uno, lo escribe al buffer de edición, y ya. Tirar el paso 1-3 no la rompe.

Ventajas de hacerlo así en vez de convertir al vuelo:

- El bootstrap con librería en memoria del MODX ocurre **una vez**; después se borra la librería y no
  se vuelve a tocar nada permanente.
- Los errores de conversión se ven y se corrigen en el horneado, no en producción.
- Se puede **mejorar sobre Yamaha** donde su conversión sea perezosa (p. ej. usar los operadores 7-8
  o los Spectral Forms), porque el conversor es nuestro.
- Regresión objetiva: comparar nuestro horneado contra el patch leído del teclado tras pasar por el
  FM Converter. Diferencia byte a byte = test automático, sin oídos.

Reglas de higiene al escribir un patch convertido (si no, "cargué algo y suena raro"):

- **Poner a cero los operadores 7 y 8** explícitamente — el DX7 tiene 6 y el buffer trae restos.
- Neutralizar la parte no-FM de la Part: filtro en `Thru`, RevSend/VarSend a 0, inserts fuera.
- Spectral Form = `Sine` en los 6 operadores; el DX7 no tiene otra cosa.

Aviso honesto: FM-X **no es un emulador de DX7**. La fidelidad techo es la de la propia conversión de
Yamaha, no la del hardware original. "Suena como" ≈ , no ≡.

#### Cómo levantar la tabla: voces sonda, no patches famosos (2026-09-07)

El par (`.syx` conocido ↔ lectura SysEx del MODX) es el método, pero **elegir ROM1A y compararla es
la forma cara de hacerlo**: en un patch real todos los parámetros están en valores arbitrarios a la
vez y la correspondencia es ambigua — el mismo problema del mapeo de la fase 0c, resuelto allí
poniendo valores distintos entre sí a propósito.

Mejor: **fabricar voces sonda**. Escribimos los 155 bytes nosotros, así que se pueden construir
bancos de 32 voces diseñados para despejar una incógnita cada uno:

- **Banco de algoritmos**: 32 voces idénticas salvo el byte de algoritmo, 0..31. Una carga y una
  lectura → la tabla 32→88 entera, y de paso a qué operadores FM-X mapean los OP1-6 del DX7.
- **Banco de Output Level**: una voz por valor (0, 5, 10 … 99) en un solo operador → la curva de
  conversión punto a punto, que en el DX7 no es lineal.
- **Bancos de EG, key scaling y feedback**: igual, barriendo un solo campo.

Cuatro o cinco cargas de librería y la tabla queda medida entera. Los patches famosos entran
**después**, y para otra cosa: validar el conversor propio (horneamos `TUB BELLS` y comparamos contra
la lectura del teclado) y servir de corpus etiquetado para el generador.

Nota operativa: cada carga escribe en memoria del MODX. Usar **un solo slot de librería**, hacer
copia previa, y borrarlo al terminar.

## Dirección visual — NO es una app de oficina (decisión de Jesús, 2026-09-07)

Prioridad declarada: **el diseño es lo 100% importante**; el corpus DX7 baja a última fase.

La app es de audio y tiene que parecerlo: oscura, con color, con curvas, con cosas que se encienden.
Nada de formularios, tablas y campos alineados — ese es el registro de Pinche y aquí está prohibido.
Ejemplo dado por Jesús: un ON/OFF no es un checkbox, es **un dibujo que se enciende y se apaga**.

Ventaja de partida: esta app **ya tiene héroes visuales naturales** y no hay que inventarse adornos.

- El **diagrama de operadores** (algoritmo + Level/ratio por operador) es la pantalla principal, no un
  panel lateral. Los 88 algoritmos son topologías dibujables.
- El **espectro en vivo** y el panel teoría-vs-medición son de por sí gráficos.
- Los parámetros que más se tocan son continuos (ratios, niveles, envolventes) → **mandos y curvas
  editables**, no `input type=number`.
- Las **envolventes** (PEG y AEG, ya mapeadas enteras) se editan arrastrando puntos sobre la curva.

Consecuencia de orden de trabajo: **la dirección visual se decide antes de escribir la fase 1**, con
mockups estáticos que mirar, no descubriéndola mientras se programa.

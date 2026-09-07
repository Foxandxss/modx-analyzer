# MODX Analyzer — fase 1: implementación (primera sesión)

Eres quien implementa. El diseño está cerrado y las mediciones contra el teclado están hechas: esta
sesión no discute qué construir, construye. Lo que sí quiero es que **discutas si algo de lo que digo
aquí es incorrecto o hay una vía mejor** — este documento lo escribió alguien que no ha compilado
todavía nada de esto.

## Qué es la app

Herramienta de escritorio para **aprender síntesis FM-X** con un Yamaha MODX8 delante. Lee el
teclado por SysEx y lo dibuja, captura su salida de audio y la analiza, escribe parámetros de vuelta,
y convierte la diferencia entre dos estados en una lección paso a paso. Corre en el portátil del
dueño: **Windows 11, panel 14" 1920×1200 con escalado al 150 %, táctil**. Viewport real
**1280×800 CSS**, `devicePixelRatio` **1.5**.

Dos modos de primera clase: **crear** (él hace el sonido, la app le sigue y le enseña qué está
pasando) y **aprender** (el tutor lleva de la mano). Ninguno es un accesorio del otro.

## Qué hay en esta carpeta

```
prompt.md              este documento
design_handoff/        el paquete de diseño, entregado y cerrado tras 7 rondas
  CONCERNS.md          léelo PRIMERO: lo abierto, lo que falta, los riesgos de dato
  DESIGN.md            la dirección elegida, las reglas, la procedencia de cada dato
  design-tokens.css    fuente de verdad de valores — se consume tal cual
  README.md            todas las pantallas descritas, y el orden de implementación
  design/*.dc.html     los prototipos. Ábrelos, no te fíes de las capturas
  screenshots/         referencia visual, NO especificación
  sources/             las ocho fuentes de datos, sin modificar
```

Orden de lectura: `CONCERNS.md` → `DESIGN.md` → `design-tokens.css` → los HTML abiertos al lado del
código. **`design/support.js` es el runtime de los prototipos: NO se porta.**

En `sources/` está todo lo medido: `modx.md` (documento maestro), `fase0_RESULTS.md` (audio),
`fase0c_RESULTS_mapa.md` (el mapa SysEx), `fase0d` y `fase0e` (qué notifica el teclado y qué no),
más las tablas oficiales de Yamaha. **Cuando el papel y la medida discrepen, manda la medida.**

## Punto de partida: NO empieces de cero

En la máquina Windows existe ya el proyecto Rust **`modx-spike-fase0c`**, con `midir` 0.10.4 sobre
WinMM, y contiene funcionando y verificado contra el teclado real:

- Parameter Request y Parameter Change, con latencia mediana medida de 2,0 ms
- volcado y restauración de bulk (`0E 25 00`, 7 669 bytes en 123 mensajes)
- snapshot de las 416 direcciones de la Part 1 con pasada de verificar-y-reparar
- `panic` (All Sound Off + All Notes Off + 2 048 Note Off explícitos)
- `listen`, con modo crudo hexadecimal y verificación por ancla
- `safety/01-base-init-fmx.bin`, el init de FM-X que devuelve el teclado a cero
- el mapa persistente `modx-map.json`

Y existe el spike de audio de la fase 0, con `cpal` 0.15.3 + `rustfft` 6.4.1 y sus cuatro WAV de oro.

**Primer paso: pide la ruta de los dos y léelos.** Ese código es el núcleo de la app, no un
prototipo a tirar. Absorbe lo que valga en un crate propio y deja el spike intacto como referencia.
Reescribir el MIDI desde cero es tirar tres sesiones de medición.

## Stack y reparto — esto no es negociable, y el motivo importa

- **Tauri + Angular.** El dueño es arquitecto Angular; el webview en Windows es WebView2 (Chromium),
  así que SVG, canvas y CSS modernos van tal cual.
- **MIDI vive en Rust.** Nada de Web MIDI: en WebView2 no es terreno fiable y ya hay `midir`
  funcionando y medido.
- **El audio y la FFT viven en Rust.** Captura por WASAPI con `cpal`, análisis en Rust, y el front
  recibe **tramas ya calculadas**. Capturar audio desde el webview mete latencia y permisos, y hacer
  la FFT en JavaScript se cae en cuanto se pinte el waterfall.
- **El front sólo dibuja.** Presupuesto declarado por el diseño: **33 ms por trama**. El puente
  Rust→front no puede mandar arrays grandes serializados a JSON en cada trama; usa un canal de
  eventos con carga binaria o buffers tipados, y decide tú el mecanismo concreto — pero mídelo y
  documenta lo que elijas.
- **Señal en canvas escalado por DPR; diagrama y envolventes en SVG.** El SVG está bien para cuatro
  nodos y fatal para catorce tramas redibujadas 30 veces por segundo. Y con `devicePixelRatio` 1.5,
  cero bitmaps de tamaño fijo y cero filetes de 1 px.
- **El DSP, en funciones puras** sin Angular ni DOM, en su propio módulo y con sus tests. Los
  parámetros de FFT se congelan por escrito (ventana Hann, tamaño, solape) y no se tocan sin anotar
  por qué.

## Reglas duras del MIDI — cada una viene de una medición y cuesta una tarde aprenderla sola

1. **Toda escritura se verifica releyendo.** Escribir con la longitud equivocada no da error, no
   cambia nada y no protesta: es un no-op silencioso. Releer cuesta 2 ms.
2. **Sólo buffer de edición.** La app **nunca** guarda en la memoria del MODX. Es lo que hace que
   todo esto sea seguro: al apagar no queda rastro.
3. **Volcado de seguridad antes de tocar nada**, y botón de devolverlo siempre alcanzable.
4. **Hay direcciones de sólo lectura** (medida: `30 4B 00`, el Super Knob — se lee, emite, y no
   acepta escritura sin dar error) y **direcciones reservadas que contestan a una lectura como si
   fueran reales**. O sea que la app **no puede descubrirlas preguntando**: la lista sale del Data
   List y va dentro del código. Un reintento automático sobre una de ellas es un bucle infinito.
5. **El teclado no notifica casi nada.** No transmite ediciones de panel, ni navegación, ni el cambio
   de Performance — cero bytes, medido en crudo y falsado. La única emisión SysEx del MODX es el
   Super Knob con `Super Knob CC = off`. Por tanto **todo estado se obtiene sondeando**.
6. **El ancla.** Como cargar otra Performance no emite nada, la app se quedaría mintiendo
   indefinidamente. Se sondea el nombre de la Part 1 (`31 00 00`–`13`, 20 bytes ASCII) a 1 Hz, y
   cuando cambia, todo lo derivado del patch anterior queda **invalidado, no pausado** (ver `6b`,
   `6c`).
7. **Cadencia medida**: conjunto de 40 direcciones → **12,2 Hz en silencio, 2,4 Hz con notas
   sonando**. Latencia mediana 2,0 ms / 10,3 ms; peor caso 24,2 ms; **0 pérdidas en 4 000
   peticiones**. Timeout recomendado **100 ms**. Snapshot completo de 416 direcciones: ~0,9 s en
   silencio, ~5,5 s tocando.
8. **Dos anillos de sondeo**, y comparten canal: los ocho operadores en 5 parámetros para saber dónde
   tiene las manos, y las 43 del operador abierto. Abrir un operador baja el anillo de los ocho de
   12,2 a 6,1 Hz. El sello de `CADUCO` lleva un umbral por anillo (4× su propio periodo).
9. **Trampas del parser de entrada**: el Note Off llega como **Note On con velocity 0** (11 de 11,
   nunca `0x80`); el pitch bend es de **14 bits reales**; y con `MIDI I/O Mode = Multi` **una tecla
   genera un Note On por Part** (medido: 4 notas en 28 ms). Contar notas sin saber el modo cuenta de
   más.
10. **El tráfico de fondo escala con el tempo** de la Performance: ~40 msg/s de clock a 90 BPM. No es
    una constante del teclado.
11. **El pánico atraviesa la app**: visible en la cabecera de todas las pantallas y funcional con la
    app en estado de error. Su peor caso es silencio, así que no lleva confirmación.
12. **La app no puede cargar Performances ni navegar los menús del teclado.** Sí puede escribir un
    init completo en el buffer. Cuando algo sólo lo puede hacer el humano, la app **dice la ruta
    literal del menú**; no finge que lo arregla.

## Audio — lo medido, y los vectores de oro

Dispositivo: **`Line (MODX)`**, 2 canales, **44 100 Hz** fijos, F32, host **WASAPI** compartido.
Buffer **441 frames constantes** en 2 996 callbacks → periodo de exactamente 10,000 ms. Sample rate
medido 44 100,62 Hz sobre 30 s. Sólo se publica el par **Main L/R**; los pares asignables por USB son
inalcanzables por WASAPI (silencio absoluto, −600 dBFS), así que la limpieza de la señal se consigue
**neutralizando la cadena en el teclado** (Reverb y Variation Send a 0, inserciones en thru, sin
Master Effect), que es lo que hace el chip de `CADENA LIMPIA` de la pantalla `4e`.

Nivel de trabajo: pico entre **−15 y −25 dBFS**. Suelo de ruido **−100 a −109 dB** relativo al pico.
Artefacto conocido del propio montaje: comb a **2 756,25 Hz** — se marca, no se esconde, y con su
frecuencia visible.

**Los cuatro WAV de la fase 0 son los tests de regresión del DSP** y valen sin teclado conectado:

| vector | qué debe salir |
|---|---|
| `fmx-1op-sine.wav` | senoide pura; suelo −105,4 dB; único armónico real el 3.º a −84 dB |
| `fmx-ratio2-modlow.wav` | **sólo armónicos impares** 1, 3, 5, 7; ni rastro de los pares |
| `fmx-ratio2-modhigh.wav` | mismo esqueleto impar hasta el 21; **el pico es el 9.º armónico**, no la fundamental |
| `fmx-ratio1414.wav` | 11 parciales que encajan en `\|fc ± k·fm\|` con fc = 261,763 y fm = 369,175 ±0,005 → **ratio 1,4103** |

Ventana Hann de 4 096 (10,767 Hz/bin) para el análisis en vivo. El de medida seria usa ventana larga
(65 536), y ojo: **mientras corre, el ancla tiene un punto ciego de ~1,5 s** (`CONCERNS.md` §23).

Detalle que es material didáctico y no una errata: el teclado mostraba `1.41` y el oscilador genera
`1.4103` — **0,4 cents**. El valor del display no es verdad de referencia con precisión de cents.

## Alcance de ESTA sesión: los pasos 1 a 4 del README, y sólo esos

1. **El armazón de `4a`** con su cabecera, incluido el **pánico**.
2. **El nodo de operador** y el diagrama sondeado — el componente que más se reutiliza.
3. **Las vistas de señal** y el sello de procedencia de cada cifra (medido / teoría / sondeado /
   caduco). Mirar y medir son dos controles distintos, y **está prohibido que una cifra de medida
   parpadee sola**.
4. **El ancla** (`6a`) y la relectura de `6b`. Va temprano y antes del reproductor a propósito:
   **todo lo que se dibuje después tiene que saber morir**. Si el estado de «muerto» no existe desde
   el principio, se cuela luego en cada panel como un parche.

Hecho = la app arranca en el portátil, se conecta al MODX, dibuja el patch cargado y su espectro en
vivo, sobrevive a que le cambien la Performance por debajo, y el pánico calla el teclado desde
cualquier pantalla.

**No hagas los pasos 5 a 10** (reproductor, chequeo, editor de operador, barrido, consola SysEx,
invalidaciones, seguimiento). Están diseñados y llegan después.

## Lo que NO se hace, para que no vuelva por inercia

- No se guarda nada en la memoria del MODX. No hay multi-Part: **fase 1 es una sola Part FM-X**.
  Nada de DX7 ni biblioteca de patches: última fase.
- No hay panel lateral de ajustes, ni columna de propiedades, ni tabla de 8×43 celdas. En cuanto
  aparezca una, la app es una app de oficina y el diseño ha fallado.
- No hay tema claro, ni tooltips como portadores de información (con dedo no existen), ni nada que
  dependa de `:hover` para descubrirse o para mostrar un valor. Táctil es la base y el ratón un
  superconjunto: **un solo diseño**, no dos modos.
- No hay breakpoint pequeño: un solo lienzo de 1280×800 escalando hacia arriba.
- No se inventa ningún valor de parámetro, rango ni dirección. Sale de las fuentes o se mide.

## Método

Lo que ha hecho que este proyecto funcione es no inferir. Si algo no está medido, se marca como
documentado y no como medido, y se dice en voz alta. Deja un `RESULTS.md` con lo que hayas verificado
contra el teclado real, con sus números, y con las preguntas que no hayas podido contestar.

Y hay una comprobación barata que conviene hacer pronto porque puede mover código: **el mapa está
verificado sólo en la Part 1**. El esquema `am = (op<<4)|part` está documentado y se leyó una vez de
la Part 2, pero nadie lo ha barrido. Aunque fase 1 sea de una Part, saber si el esquema aguanta
cambia cómo se escribe el direccionamiento.

Si algo de este documento te parece equivocado, dilo antes de implementarlo.

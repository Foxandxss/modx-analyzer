# Handoff: MODX Analyzer — fase 1 UI

## Overview

Interfaz de una herramienta de escritorio (**Tauri + Angular, Windows**) para **aprender síntesis
FM-X** mirando en vivo lo que sale de un Yamaha MODX8: forma de onda, espectro, armónicos,
waterfall, diagrama de operadores leído del teclado por SysEx, y un panel que superpone teoría
(funciones de Bessel) sobre la medición.

El usuario es un pianista que no sabe FM. La app enseña. Todo lo que se pinta corresponde a datos
que los spikes de fase 0 ya demostraron que la app puede obtener.

**Restricción dura del dueño del proyecto:** es una app de audio, no una app de oficina. Nada de
rejillas de formulario, `input type=number` como control principal, tablas de ajustes, checkboxes o
selects nativos, cards blancas con sombra. Obligatorio: superficie oscura, color con intención,
geometría con curvas, y estados que se comunican por **luz y forma** antes que por texto. Un ON/OFF
no es un checkbox: es un dibujo que se enciende y se apaga.

La dirección visual está **decidida: A · Bancada**. Este paquete contiene la **pantalla principal**,
su hoja de sistema, **las cinco pantallas de la ronda 3** (los ocho operadores, la Part, copias y su
resta, el índice del tutor), **las tres piezas de la ronda 4** (el reproductor, el pánico y el
chequeo de arranque) **las tres de la ronda 5** (el editor de operador, el barrido y la consola
SysEx) y **las cinco de la ronda 6** (el ancla, el momento del cambio de Performance, lo que queda
invalidado, el estado de sólo lectura y los grados de confianza), más el **modo A/B**, los tokens, las reglas de implementación, las seis fuentes de datos y
**`CONCERNS.md`** con lo que sigue en discusión.

**Empieza por `CONCERNS.md`.** Es corto y dice qué no está cerrado, qué falta por diseñar y qué
riesgo de datos hay. Ahorra suposiciones.

### Estado del paquete — 2026-09-07, tras la ronda 7

Todo lo que hay en `design/`, `design-tokens.css`, `DESIGN.md` y `CONCERNS.md` es idéntico a la
carpeta de trabajo: el paquete no va por detrás. **Diecinueve puntos cerrados, cuatro abiertos**, y de
los cuatro **ninguno bloquea la implementación**. Y una lectura que va con nombre y apellidos en
`CONCERNS.md` §25: **la superficie de la fase 1 está completa; lo que falta es implementar.**

| abierto | qué falta | a quién le toca |
|---|---|---|
| §17 · sin diseñar | guardar en la memoria del MODX (hoy todo es buffer de edición) y la biblioteca de patches / corpus DX7. **No son huecos: son alcance**, fuera por decisión del dueño | fase posterior |
| §19 · el aviso bloqueante | **decidido y defendido**: bloquea sólo lo que se rompió, y bloquear no es un modal. Regla general de la app | lectura |
| §23 · riesgos de datos | cinco, ninguno bloquea. El primero es el único hueco real y está declarado abajo: **el ancla tiene un punto ciego de ~1,5 s** mientras corre la FFT de 65 536 | fase 1 / próxima sesión |
| §24 · el seguimiento | **decidido**: sugerencia y no salto, la frase que no promete visitas, y los dos anillos con un umbral de `CADUCO` cada uno. Queda por si quieres discutir la marca `RECONFIRMADA` de §21 | lectura |

Cerrado en la ronda 6: **cuántas medidas por paso** (§15), **`TOCAS TÚ` ya no es inferencia** (§16,
medido) y **`48 00 52` → `48 00 48` explicado** (§18, dirección reservada). Cerrado en la ronda 7:
**la lista de sólo lectura** (§21 — recordar **y reprobar en silencio una vez por sesión**, porque
comprobarlo son 4 ms) y **el cero del cambio de Performance por papel** (§23.2 — el Reference Manual
dice que `Bank Select` y `Pgm Change` gobiernan *both in transmission and reception*, y estaban los
dos en `ON`: **el sondeo del ancla no es la mejor fuente, es la única**).

### La app tiene dos modos de primera clase

- **Aprender** — el tutor lleva paso a paso y escribe él en el teclado. Densidad baja, y un
  **sub-registro cálido** (serifa + tinta crema) en todo lo que se lee para *entender*. No es un
  segundo tema: las cifras medidas siguen en mono y fósforo también ahí.
- **Crear** — nadie lleva de la mano. Densidad alta, todo el FM a la vez, y la vista de **los ocho
  operadores** como superficie principal. Es el modo que se va a usar más horas.

Y un tercero que es un **modo de la principal**, no una pantalla: **A/B**, para comparar dos valores
del mismo parámetro. Se entra y se sale por un conmutador visible en la barra
(`CREAR · A/B · APRENDER`), no por un selector escondido.

Dos piezas atraviesan **todas** las pantallas y hay que implementarlas una sola vez:

- **El pánico** — el único octógono de la app, 56 px, en el extremo derecho de toda cabecera, sin
  confirmación. Ver `4d` y `CONCERNS.md` §3.
- **El reproductor** — con el que la app toca el teclado ella misma (note-on → sostener → medir →
  note-off). Siete estados. Ver `4c`.

## About the Design Files

Los ficheros de `design/` son **referencias de diseño escritas en HTML** — prototipos que muestran el
aspecto y el comportamiento previstos, **no código de producción para copiar**. Son estáticos: no hay
lógica de audio, ni MIDI, ni estado real.

La tarea es **recrear estos diseños en el entorno del proyecto** (Angular sobre Tauri, con sus
patrones y librerías establecidos). Si el proyecto aún no tiene UI montada, monta la de fase 1 en
Angular siguiendo `design-tokens.css` como fuente de verdad de valores.

Nota técnica sobre el formato: los ficheros son HTML normales (abren con doble clic) pero se
escribieron en un runtime de prototipado que carga `design/support.js`. **No portes ese runtime.**
Lo que se lee de ellos es la maquetación, los valores y la jerarquía visual — el markup interno no
es un objetivo de fidelidad.

## Fidelity

**Alta fidelidad (hifi).** Colores, tipografía, espaciado, radios, trazos e intensidades son
definitivos y están en `design-tokens.css` con nombres semánticos. Recrea la UI con precisión usando
los tokens, no los literales que veas en el HTML.

Dos cosas son de **datos reales, no decorativas**, y deben calcularse en la app en vez de copiarse:

- La forma de onda es `sin(2πt + I·sin(2π·2t))` con I = 2.8.
- El espectro son las amplitudes `|J_n(I)|` en `|fc ± k·fm|` (parciales en `1 ± 1.41n` y `2 ± 7n`).
- El waterfall son 14 tramas con el índice decayendo `I(t) = 2.9·e^(−2t)` — el ataque brillante
  apagándose.

Los valores de ejemplo que aparecen en pantalla vienen de los spikes y sirven como caso de prueba:
algoritmo 6, feedback 3 en Op5; Op1 portadora 99 ×1.00 Sine, Op2 a 0, Op3 modulador 90 ×1.41 Odd 1,
Op4 portadora 99 ×2.00, Op5 modulador 72 ×2.00 Res 1, Op6 modulador 64 ×7.00, Op7 a 0, Op8
portadora 55 ×0.50 All 1. fc = 261.763 Hz, fm = 369.175 Hz, ratio medido 1.4103 (la pantalla del
teclado dice 1.41, Δ 0.4 ¢), I = 2.81, 11 parciales, suelo −104 dB, pico −18 dBFS, y un comb de
2756.25 Hz que **se marca como artefacto** en vez de esconderse.

## Target canvas

- **1280 × 800 CSS px**, ~**1280 × 740 útiles** a pantalla completa descontando el marco de la
  ventana Tauri. Portátil de 14", panel 1920×1200 con escalado de Windows al 150 %.
- Ese presupuesto de 740 px **está apurado en dos pantallas** (los ocho operadores y la Part). Ver
  `CONCERNS.md` §4 antes de añadir nada a ellas.
- **`devicePixelRatio` = 1.5.** Consecuencia dura: señal, diagrama, curvas y rejillas **vectoriales
  (SVG) o canvas escalado por DPR**; cero bitmaps de tamaño fijo. Y **nada de filetes de 1 px** —
  a 1.5× se ven sucios: separadores a 2 px (`--rule-min`) o separación por color de superficie y
  aire.
- **Pantalla táctil, y también ratón.** Ver "Interactions".
- El objetivo Waveshare ESP32-S3 / 1024×600 **está cancelado**: no hay breakpoint pequeño. Escalar
  hacia arriba en un monitor externo (>1600 CSS px) es caso de escape, no de diseño.

## Screens / Views

### 1. Pantalla principal — "el instrumento"

Fichero: `design/Pantalla-principal.dc.html`, sección `4a`.

> **Nota de versión.** Esta descripción se escribió para la primera principal, hoy archivada. La
> pantalla vigente es `4a`: **mismo vocabulario y mismos componentes**, con tres diferencias de
> composición que se detallan en la sección 10 más abajo — diagrama de **700 px** con nodos de
> 118×108, **armónicos como panel permanente** con Bessel superpuesto, y **waterfall compartido** con
> el scope en 156 px. Y en la cabecera, dos cosas nuevas: el **pánico** y el conmutador
> `CREAR · A/B · APRENDER`. Todo lo que sigue sobre nodos, rutas, transporte y marcado de artefactos
> vale tal cual.

**Purpose.** Es la pantalla que se mira mientras se toca. Tres zonas conviviendo sin que ninguna sea
un panel lateral arrinconado.

**Layout.** Columna vertical de 1280×800:

- **Barra superior**, 58 px de alto, `padding: 0 16px`, `border-bottom: 2px solid rgba(255,255,255,.09)`,
  fondo `linear-gradient(#0b0f11,#080b0d)`, `display:flex; align-items:center; gap:18px`.
  De izquierda a derecha: punto de conexión (9 px, `--signal-primary`, glow 10 px) + línea mono
  `MODX-1 · 44 100 Hz · MAIN L/R`; separador vertical 1×30; nombre del patch (`FM 2OP CHAIN`, 17 px);
  pastilla de algoritmo (`ALGORITMO 06`, borde `rgba(243,177,63,.4)`, radio 999, cifra 15 px en
  `--carrier`); `FB 3 · OP5` en mono 11 px; espaciador flexible; **transporte** (ver abajo).
- **Franja de aviso** (condicional, `flex: 0 0 auto`): 10 px 22 px, fondo `rgba(255,122,92,.1)`,
  borde inferior `1px solid rgba(255,122,92,.35)`, cuadrado de 20 px con borde `--alert` + glow, y
  texto mono 12 px. Aparece en los estados no felices.
- **Cuerpo**, `flex:1`, `display:grid; grid-template-columns: 556px 1fr 214px; gap:2px`, fondo del
  gap `rgba(255,255,255,.07)` (así el "filete" es un hueco de 2 px, no un borde de 1 px):
  - **Columna 1 — diagrama de operadores** (el héroe). `padding: 12px 16px 0`.
    Cabecera: `DIAGRAMA DE OPERADORES` (12 px, tracking .22em, `--ink-secondary`) y a la derecha
    `SONDEADO · SysEx 49 op 1A · 12 Hz` en mono 10 px `--ink-inert`.
    Lienzo de nodos: 3 columnas × 3 filas sobre un SVG de rutas de 552×452, escalado a 0.935.
    Nodos en `left: 50/220/390 px`, `top: 20/148/278 px`, tamaño **100×92**.
    Pie de leyenda: tres muestras (portadora / modulador / level 0) y "toca un operador para
    editarlo", separadas con `border-top: 2px solid rgba(255,255,255,.08)`.
  - **Columna 2 — vistas de señal**: dos paneles iguales apilados (`flex:1` cada uno,
    `padding: 12px 14px`), separados por `border-bottom: 2px solid rgba(255,255,255,.09)`.
    Arriba **SCOPE** (`TRIGGER ↑0 · 2 CICLOS · 261.763 Hz`), abajo **ESPECTRO**
    (`LOG 1×–32× · SUELO −104 dB`). Marco de vista: `border: 1px solid rgba(255,255,255,.07)`,
    `border-radius: 14px`, fondo `linear-gradient(#0a0f10,#070a0b)`.
  - **Columna 3 — cifras medidas**: `padding: 12px 13px`, `gap: 10px`. Arriba el panel **ARMÓNICOS**
    (16 barras de 7 px de ancho, eje `n1 n4 n8 n12 n16`); debajo una pila de celdas separadas por
    huecos de 1 px sobre `rgba(255,255,255,.05)`: `RATIO MEDIDO` (29 px, `--signal-primary`,
    subtítulo `pantalla 1.41 · Δ 0.4 ¢`), `fc / fm`, `ÍNDICE I (Bessel)` (20 px, `--carrier`), y
    `ÚLTIMA MEDIDA` (`65536 · hace 14 s`, `C4 sostenida · pico −18 dBFS`).
- **Waterfall**, `flex: 0 0 194px`, `border-top: 2px solid rgba(255,255,255,.09)`,
  `padding: 10px 18px 12px`. Cabecera: `WATERFALL` + "el ataque brillante apagándose · 14 tramas ·
  0 → 460 ms", y a la derecha `TIEMPO ↓ · FRECUENCIA →`. Marco `border-radius: 16px`.
  14 ridgelines en un SVG `viewBox="0 0 400 210"` con `preserveAspectRatio="none"`, cada traza en
  `translate(0, 26 + r*13) scale(1,1.55)`, color de `#eafff4` (nueva) a `#1e7351` (vieja), grosor
  1.4 → 1 px con `vector-effect: non-scaling-stroke`. Etiquetas `ATAQUE`, `460 ms`, `32×`.

**Componentes clave de esta pantalla.**

- **Nodo de operador** — 100×92 (que además es su objetivo de toque).
  - *Portadora*: `border: 2px solid var(--carrier)`, `border-radius: 26px` (curva total),
    fondo `#0d1214`, glow `0 0 30px -8px rgba(243,177,63,.7)` + `inset 0 0 0 1px rgba(243,177,63,.16)`.
  - *Modulador*: `border: 1.5px solid var(--modulator)`, `border-radius: 5px` (esquina viva),
    fondo `#0a1013`, glow `0 0 26px -7px rgba(88,200,245,.75)`.
  - *Level 0*: `border: 1.5px dashed var(--inert)`, sin relleno, fondo `#070a0b`, cifras a `#3f4d4a`.
  - *Relleno de nivel*: capa absoluta anclada abajo, `height: Level%`,
    `background: linear-gradient(to top, <rol> .46–.50, <rol> .04)`. **El Level ES la altura del
    relleno**; la cifra sólo confirma.
  - Contenido: etiqueta `OP1` (mono 11 px) + rol (`PORT` / `MOD` / `INACTIVO`, 8 px, tracking .14em)
    arriba; abajo cifra de Level (mono 25 px) y `×1.00 · Sine` (mono 10 px).
- **Rutas del diagrama** — SVG. Modulación activa: `--modulator`, 2–2.6 px, con marcador de flecha.
  Ruta desde un operador a 0: `--inert`, 1.5 px, `stroke-dasharray: 4 5`. Bus de salida:
  `--signal-primary`, 2 px, hacia `OUT L/R`. Feedback: arco con etiqueta `FB 3`.
- **Transporte — "mirar" y "medir" son dos actos distintos, y eso tiene que verse.**
  - *Mirar*: pastilla `padding: 12px 16px`, `border: 1px solid rgba(125,240,176,.28)`, fondo
    `rgba(125,240,176,.06)`, punto de 7 px con `animation: livePulse 1.4s ease-in-out infinite`
    (opacidad .35 → 1), texto `MIRAR · 30 fps`.
  - *Medir*: botón `padding: 13px 22px 13px 16px`, `border: 1.5px solid var(--carrier)`,
    `border-radius: 999px 8px 8px 999px`, fondo `linear-gradient(180deg, rgba(243,177,63,.22),
    rgba(243,177,63,.06))`, sombra `0 0 28px -8px rgba(243,177,63,.7)`; dentro, un "obturador"
    (círculo de 26 px, borde 2 px, `radial-gradient(circle, #f3b13f 34%, transparent 36%)`),
    el rótulo `MEDIR` (mono 14 px, tracking .2em, `#ffd08a`) y a la derecha, tras un filete
    vertical, `65536 / NOTA SOST.` en mono 9 px.
- **Marcado de artefactos** — las parciales no armónicas se pintan en `--alert` con
  `stroke-dasharray: 3 3` y llevan un chip `ARTEFACTO 2756 Hz` (borde `rgba(255,122,92,.4)`, fondo
  `rgba(255,122,92,.1)`) en la esquina superior derecha del panel. **No se ocultan y no se cuentan
  como armónicos.** La etiqueta `9.º ARMÓNICO · PICO` va en la esquina izquierda para no chocar.
  Y **ningún badge de artefacto sin su frecuencia**: el Hz es lo que distingue el comb del generador
  de un armónico de red o de aliasing, así que un aviso sin número no se puede accionar.

### 2. Direcciones B · Nébula y C · Plotter — ARCHIVADAS

No van en el paquete y no hay que implementarlas. La dirección elegida es **A · Bancada**; los cuatro
motivos están en `DESIGN.md`. Lo único que sobrevive de C es su **registro cálido** (serifa Georgia,
tinta crema, acento vermellón), que es ahora el sub-registro de las pantallas de lección dentro de A
— ver los tokens `--font-lesson` y `--lesson-*`, y la pantalla `3d`.


### 3. Hoja de sistema (dirección A)

Fichero: `design/Sistema-A-componentes.dc.html` — página larga, se baja con scroll. Ancho 1280.

Contiene, en este orden: portada con los tres chips de contexto (lienzo, DPR, táctil); paleta y
tipografía; **operador en cuatro estados** (portadora activa / modulador activo / level 0 /
seleccionado en foco, este último con borde `--signal-primary` y glow 40 px); **controles**
(mando continuo, bipolar, toggle-dibujo de Freq Mode, selector de Spectral Form); **editor de
operador** (AEG, PEG y Level Scaling); **teoría contra medición**; **badges de estado**; el estado
"el tutor acaba de tocar tu teclado"; **modo tutor** completo; **los cuatro estados no felices**; y
la sección **interacción dedo y ratón**.

Detalles de los controles (todos con su nota de dedo/ratón en la propia hoja):

- **Mando continuo** — SVG de 160×160. Pista `rgba(255,255,255,.08)` de 10 px, arco de valor en el
  color del rol con `stroke-dasharray` y `stroke-linecap: round`, tapa interior r=44 a `#0d1416`,
  marca de índice de 3 px rotada según el valor, y **el valor siempre visible en el centro**
  (mono 27 px) con la etiqueta debajo (10 px). Agarre de arrastre 160 px (`--grip-knob`).
- **Control bipolar (Detune, centro 15)** — pista de 58 px de alto (`--track-bipolar`),
  `border-radius: 12px`, fondo `#0a1013`. Línea de centro `rgba(255,255,255,.28)` de 1 px, barra de
  desviación desde el centro con gradiente en el color del rol, marca de posición de 3 px con glow,
  extremos `−15` / `+15` en mono 9 px y el valor (`+7`, 20 px) centrado arriba.
  **El centro se ve, no se recuerda.**
- **Toggle-dibujo de Freq Mode (el ON/OFF ejemplar)** — dos tarjetas de ~150×112 lado a lado.
  Encendida: `border: 2px solid var(--carrier)`, fondo `linear-gradient(180deg, rgba(243,177,63,.16),
  rgba(243,177,63,.03))`, sombra `0 0 30px -10px`, y **el dibujo de lo que Coarse y Fine van a
  significar**: seis parciales armónicas bajo una envolvente discontinua rotulada `× fundamental`.
  Apagada (`FIXED`): `border: 1.5px solid #2b3436`, fondo `#080c0d`, una sola parcial gris y
  `Hz absolutos`. Cambiar a Fixed **también mueve el Coarse** → hay que avisar al conmutar.
- **Selector de Spectral Form** — siete casillas de ~52×72 con `gap: 7px`; cada una es el **espectro
  resultante** dibujado en un SVG de 44×34 (Sine, All 1, All 2, Odd 1, Odd 2, Res 1, Res 2) con el
  nombre debajo en mono 9 px (nunca en un tooltip). Seleccionada: `border: 2px solid var(--modulator)`,
  fondo con gradiente del rol, sombra `0 0 26px -8px`. Skirt y Resonance **modifican el dibujo
  seleccionado en vivo** (Skirt ensancha la falda, Resonance mueve el pico: 0 = fundamental,
  99 = armónico 100); sólo Res 1/Res 2 los habilitan.
- **Editor de envolventes** — paneles de `border-radius: 16px`, fondo `#0a0f10`, con la dirección
  SysEx en la cabecera (AEG `49 op 10-18`, PEG `49 op 0C-0F`).
  *AEG*: polilínea `--signal-primary` de 2.4 px con relleno `rgba(125,240,176,.08)`, puntos
  arrastrables de r=11 (`fill: #06080a; stroke: 2.4px`), halo de agarre `r=22` discontinuo en el
  punto activo, marca de **key off** vertical en `rgba(243,177,63,.5)` discontinua, niveles
  rotulados junto al punto (99 / 72 / 58) y tiempos como etiquetas debajo
  (`ATK 18 · DEC1 42 · DEC2 55 · REL 30 · HOLD 0`) — **no como campos**.
  *PEG*: igual pero en `--modulator`, con la línea de **centro 50** discontinua a media altura y el
  valor bipolar rotulado (`+34`).
- **Level Scaling** — **es una curva sobre el teclado y se dibuja como tal**: dos tramos de curva en
  `--carrier` (2.2 px) que se juntan en el **Break Point**, marcado con una vertical
  `--signal-primary` discontinua y la etiqueta `BREAK B3`; las curvas rotuladas con su tipo y valor
  (`−Exp · 32`, `+Lin · 48`); y **un teclado dibujado debajo** (rectángulo de 14 px con las teclas
  negras a `#1b2426`), extremos `A-1` y `C8`. Escala propia base A-1, no MIDI.
- **Teoría contra medición** — la razón de existir del proyecto. Barras de medición
  (`--signal-primary`, 7 px, opacidad .85) y **encima** la curva teórica `|J_n(I)|` como polilínea
  `--carrier` de 2 px con `stroke-dasharray: 5 4` y un círculo hueco por punto. La leyenda distingue
  las dos con muestra de línea (`TEORÍA` discontinua con círculo / `MEDIDO 65536` continua gruesa).
  **Donde no cuadra se encierra y se explica**: rectángulo `--alert` de 1.4 px alrededor de n=2, una
  línea guía, y dos frases: "n=2 · medido 10 dB por debajo" / "falta el filtro de la Part en el
  modelo". Pie con `ERROR MEDIO 1.8 dB`, `PEOR PARCIAL n=2 · 10 dB`, `I AJUSTADO 2.81`.
- **Badges de procedencia** — píldoras de `padding: 6px 13px`, mono 10 px, tracking .12em:
  `MIRANDO · 30 fps` (fósforo, con punto que late), `MIDIENDO · 65536` (ámbar),
  `SONDEANDO · 12 Hz` y `ESCRITO Y VERIFICADO` (cian), `ARTEFACTO · NO ARMÓNICO` (alerta, cuadrado),
  `DATO CADUCO · 4 s` (contorno discontinuo), `TEORÍA · CALCULADO`, `MEDIDO · 11 PARCIALES`.
  Cada cifra en pantalla lleva el suyo: **medido, calculado, sondeado o caduco**.

### 4. Modo tutor

En la hoja de sistema. Panel de `border-radius: 20px` en tres columnas
(`grid-template-columns: 250px 1fr 330px`):

- **Pasos**: lista de 5 con círculo de 26 px — hechos (`✓`, borde `rgba(125,240,176,.5)`), actual
  (círculo relleno `--signal-primary` con número en `#06110a`, fila con fondo `rgba(125,240,176,.09)`
  y borde), pendientes (borde `dashed --inert`). Debajo, **← VOLVER AL PASO 2**: volver es restaurar
  un estado conocido, **sin castigo**.
- **Paso actual**: título 26 px, explicación 15 px / 1.65 con la fórmula `|fc ± k·fm|` en mono, y dos
  botones — `PONLO TÚ, YO ESCUCHO` (cian, encendido) y `LO HAGO YO A MANO` (neutro). Pie
  comparativo: `OBJETIVO 1.41` (ámbar) vs `TU TECLADO AHORA 1.4103 medido` (fósforo) + badge
  `COINCIDE`.
- **Dónde mirar en el MODX**: la app **no puede navegar los menús del teclado**, así que muestra la
  ruta como escalera indentada en mono 13 px (`[EDIT] → Part 1 → Operator 3 → [Form/Freq]`, el
  último tramo en fósforo) y espera. Debajo, la precondición verificada al arrancar:
  `Receive Bulk` no está en Protect.
- **Estado "el tutor acaba de tocar tu teclado"** (columna de badges): tarjeta con
  `border: 1.5px solid rgba(88,200,245,.55)` y `animation: writeFlash 2.2s ease-in-out infinite`
  (la sombra late entre `0 0 0 1px rgba(88,200,245,.5), 0 0 30px -8px …4` y
  `0 0 0 1px …9, 0 0 46px -6px …8`). Lista los tres parámetros escritos con `✓ releído` en fósforo
  por línea, y ofrece "volver a lo mío". Es información que el usuario tiene que **percibir aunque
  esté mirando otra cosa**.

### 5. Estados que no son felices

Cuatro tarjetas de `border-radius: 18px`, borde 1.5 px del color de su severidad, fondo
`linear-gradient(180deg, <color> .09, <color> .02)`, `padding: 20px`, cada una con un dibujo SVG de
formas primitivas arriba (nunca un icono inventado), título 18 px, explicación 13 px / 1.55, una
línea de diagnóstico en mono 11 px y su acción.

1. **Teclado no conectado / desconectado a mitad** (`--alert`). El puerto `MODX-1` no está o lo tiene
   otra app en exclusiva. El audio sigue entrando: se puede mirar, no leer el patch. →
   `DIAGRAMA CONGELADO · ÚLTIMO SONDEO 4 s`, botón `REINTENTAR`.
2. **Sin audio entrando** (`--carrier`). **No es silencio: son ceros digitales exactos**, así que no
   hay cable ni ruta. Casi siempre `Part Output = USB1&2`, que no existe fuera de ASIO. →
   `SILENCIO REAL ≠ CABLE MAL PUESTO`, botón `VER LA DISCIPLINA DE INIT`.
3. **La escritura no se aplicó** (`--alert`). El MODX **falla en silencio**: escribir con la longitud
   equivocada no da error y no cambia nada. Toda escritura se verifica releyendo; aquí 1 de 3 no
   volvió. → `49 20 09 · SIN CONFIRMAR`, botón `REPARAR Y VERIFICAR`.
4. **Voy a pisar tu patch** (`--modulator`). El paso escribe 11 parámetros en el buffer de edición
   que el usuario tiene a medias; antes se guarda un volcado de `0E 25 00` (7 669 bytes,
   restauración byte a byte). → dos botones: `GUARDAR Y SEGUIR` / `NO TOQUES`.

### 6. Los ocho operadores — la coreografía del patch (`3a`)

Fichero: `design/Ronda3-pantallas.dc.html`, sección con id `3a`. **La superficie principal del modo
crear.**

**Purpose.** Un operador tiene 43 parámetros; la principal muestra tres y el editor completo muestra
uno. Esta pantalla muestra **cinco hechos de los ocho a la vez**, y sobre todo la **comparación**:
quién ataca antes, quién decae rápido, quién está más alto.

**Layout.** Barra de 58 px con un conmutador segmentado (AEG · NIVEL / PEG · FORM/FREQ / ESPECTRO POR
OP); debajo, panel de curvas (`flex: 1`, ~330 px) y una fila de grupos de `flex: 0 0 296px`.

- **Ocho AEG sobre un mismo par de ejes.** SVG `viewBox="0 0 1240 340"`, `preserveAspectRatio="none"`,
  eje X = 0→2 000 ms, key-off vertical discontinua en ámbar a 1 400 ms. El operador en foco a
  `--curve-focus-stroke` (3.4 px) con glow y **puntos arrastrables de `--grip-curve`** con halo
  discontinuo de `--grip-halo`; los otros siete a `--curve-ghost-stroke` (1.4 px) y
  `--curve-ghost-alpha` (.5), **en el color de su rol**. Los operadores a 0 son una línea
  `--inert` discontinua sobre el cero: presentes, no borrados.
- **El nombre va escrito sobre la curva, en su meseta** (`OP1 99`, `OP4 99`, `OP8 55`…), en el color
  del rol. Sin leyenda que casar y sin tooltip — con dedo no existe el "por encima".
- **Agrupados por el papel que da el algoritmo**, no por número: `PORTADORAS · SUENAN` (marco ámbar),
  `MODULADORES · COLOREAN` (marco cian), `A CERO · CORTAN` (marco discontinuo), cada grupo con su
  cuenta.
- **Tarjeta de operador** de `--op-strip-w` (128 px): etiqueta + rol, ratio en mono 20 px, una
  **columna de Level luminosa y arrastrable** de `--op-level-col-w` (30 px, altura del relleno =
  Level, con marca de 2 px y glow en el valor), la cifra de Level en 26 px, la **forma espectral
  dibujada** en un SVG de 76×34, y su nombre. Radio según rol: `--radius-carrier` 22 px vs
  `--radius-modulator` 5 px.

**La trampa a esquivar era la hoja de cálculo**, y se esquiva así: **ninguna celda con número
suelto**. Todo valor viene con su forma — altura de columna, posición en una curva, o dibujo del
espectro. Si al implementarlo aparece una rejilla de celdas, está mal hecho.

**Editable desde aquí**: arrastrar la columna de Level lo cambia; tocar la tarjeta lleva el foco a su
curva. El resto de los 43 vive en el editor del operador — esta pantalla **no es su sustituto**.

### 7. La Part — lo que hay entre el FM y tus oídos (`3b`)

Sección con id `3b`. **Su función principal es avisar, no mezclar.**

El proyecto se sostiene en comparar el espectro medido contra Bessel. Un filtro con resonancia mueve
las amplitudes sin que nadie lo pida, y entonces la teoría no cuadra y no sabes si el análisis está
mal. Esta pantalla lo dice con luz y forma.

- **La cadena como cinta horizontal** (`flex: 0 0 118px`): OPERADORES FM-X → FILTRO → INSERT A/B → EQ
  → SENDS → MAIN L/R, con flechas entre etapas. Una etapa **transparente se dibuja recta** (una línea
  horizontal) con contorno `--inert` discontinuo y la palabra `TRANSPARENTE`; una que **interviene se
  dibuja con su forma** (la curva del filtro en miniatura) en `--chain-dirty` con glow y la palabra
  `INTERVIENE`. La forma dice el estado antes que el color.
- **Sello de cadena en la barra**: `CADENA LIMPIA` (filtro en Thru, sends a 0, inserts fuera, EQ
  plano) o `CADENA SUCIA · NO ESTÁS MIDIENDO FM PURO` en `--alert` con glow, y al lado un botón
  `LIMPIAR LA CADENA`. **El sello viaja a la principal como chip pequeño** (ver `3e`) y **el panel de
  teoría contra medición lo lee**: con la cadena sucia el error medio es 1.8 dB y se atribuye al
  filtro; limpia, la misma medida da 0.4 dB.
- **El filtro se edita dibujando su respuesta.** SVG de 620×210 con la curva de `LPF12+HPF12`, el
  **corte y la resonancia como puntos arrastrables** de `--grip-curve` con halo, y la **línea de Thru
  como referencia plana discontinua en fósforo** ("plano = Thru = FM puro"). Los tipos son **chips
  dibujados** de `--hit-chip` (36 px), no un desplegable de 19. Direcciones y ruta en la cabecera:
  `48 00 0B / 0C(2) / 0F` · `[Pitch/Filter] → [Filter Type]`.
- **Ojo con las unidades**: el Cutoff es **0-255 en dos bytes**, no hercios, y la Resonance es 0-127.
  El eje de la curva sí es frecuencia (es una respuesta), pero **la cifra del control es el
  parámetro**: `CORTE 178 · RES 42 / 127`.
- **FEG** (`48 00 17–2C`): envolvente con puntos arrastrables y key-off. Su nivel es **bipolar en
  cents, ±9 600** — se rotula `+52 · +3 931 ¢`, que es lo que de verdad le hace al espectro. Con la
  FEG activa el espectro cambia con el tiempo por razones que no son FM: el waterfall lo verá y
  Bessel no lo explicará.
- **2.º LFO** (`48 00 47–4E`): onda dibujada, y `AMP MOD 18` marcado en alerta porque hace respirar
  la amplitud — una medida sobre nota sostenida sale distinta según cuándo dispares.
- **Límites de nota y velocidad** (`31 00 1C–1F`): la nota **sobre un teclado dibujado** con el rango
  activo iluminado y sus dos marcas en fósforo; la velocidad como **cuña** con sus dos límites
  discontinuos. No cuatro campos numéricos.

**No están** Arpeggio, Motion Seq, Part LFO, Control Assign ni Receive SW: no afectan a lo que se
mide. EQ e inserts aparecen **solo como estado**, porque lo único que importa de ellos es si están en
medio o no.

### 8. Copias y la resta entre dos (`3c`)

Sección con id `3c`. Los snapshots que el aviso de "voy a pisar tu patch" promete, con su sitio.
**La resta entre dos es la pantalla más valiosa del proyecto**, y está diseñada como lo que es: el
guion de una lección.

**Layout.** Grid `392px 1fr` con gap de 2 px sobre `rgba(255,255,255,.07)`.

- **Columna izquierda, la lista.** Cada snapshot lleva **procedencia** (`ANTES DE QUE LA APP TOCARA
  NADA`, `INIT`, `PASO n · LECCIÓN m`, `A MANO`), antigüedad, y **su forma**: bulk de 7 669 B o 416
  parámetros — porque no restauran igual. Los dos elegidos para la resta se marcan `A · ORIGEN` en
  ámbar y `B · DESTINO` en cian, con borde 2 px y glow.
- **Restaurar es un toque, sin diálogo**: es un solo mensaje y 20 ms. Pero **un toque, no dos**, y lo
  que estabas usando se guarda antes — nada destructivo pasa por un doble toque.
- **Columna derecha, la resta.** Cabecera `Init FM-X → La campana que me gusta` y "14 parámetros
  cambian, agrupados en cinco cosas que entender". Cada grupo es una tarjeta con **número de paso**
  (círculo de 34 px), **frase en lenguaje humano** ("OP3 · el modulador que da la campana") y
  **evidencia dibujada**: barras de delta con el valor antiguo en `--ink-inert` y el nuevo en
  `--signal-primary`, la **envolvente antes y después superpuestas** (la vieja discontinua en gris,
  la nueva en fósforo con glow), y el espectro de la forma nueva.
- **Los 402 parámetros idénticos no se listan** — solo lo que cambia es información. Y el grupo que
  **no es FM** (el filtro que se coló, el Amp Mod) se marca en `--alert` discontinuo con un botón
  `EXCLUIR DE LA LECCIÓN`: es ruido de la sesión, no parte del sonido.
- Botón `CONVERTIR EN LECCIÓN DE 5 PASOS` en la cabecera: cierra el círculo. Los pasos se reordenan
  arrastrando.

**No es un `git diff`**: ni columnas, ni ± por línea, ni monoespaciado por defecto en la prosa.

### 9. El índice del tutor (`3d`)

Sección con id `3d`. El nivel que faltaba encima de los pasos: "paso 3 de 5 de la lección 2 de 9".

- **Nueve lecciones como un camino con espina dorsal**, no una rejilla de tarjetas: una columna de
  círculos de 34 px unidos por una línea vertical de 2 px que va de fósforo (hecho) a
  `rgba(255,255,255,.09)` (pendiente).
- **La lección en curso está abierta** (`flex: 1`) con sus **cinco pasos visibles** como tarjetas, el
  actual relleno en fósforo, y dos botones: `SEGUIR EN EL PASO 3` y `← VOLVER AL PASO 2`. Volver es
  restaurar un estado conocido, **sin castigo**. Las demás lecciones van cerradas con su cuenta
  (`0 / 4`).
- **Barra de progreso de nueve segmentos** en la cabecera, con el actual a medio llenar.
- **Aquí vive el sub-registro cálido**: títulos y prosa en `--font-lesson` (Georgia) sobre
  `--lesson-surface`, con `--lesson-ink` / `--lesson-ink-dim` y `--lesson-accent`. **Pero las cifras
  medidas siguen en mono y fósforo** (`TU TECLADO 1.4103` frente a `OBJETIVO 1.41` en vermellón, con
  badge `COINCIDE`). Serifa para lo que se lee, mono para lo que se mide — también dentro de una
  lección.
- La columna derecha explica **de dónde salen las lecciones que aún no están escritas**: de restar dos
  copias, con enlace a `3c`. Y repite la precondición verificada al arrancar: `Receive Bulk` no está
  en Protect (`[UTILITY]` → `[Settings]` → `[Advanced]`).

### 10. La principal rebalanceada (`3e`) — DECIDIDA: es la que se implementa

Sección con id `3e`. Era una alternativa a la primera principal; **ganó y se promovió a `4a`**
(`design/Pantalla-principal.dc.html`). Se documenta aquí porque explica los tres cambios de
composición; **lo que se implementa es `4a`**, no la principal archivada.

El waterfall baja de **194 px siempre** a **156 px compartidos** con el scope en un panel con
pestañas de `--hit-tab` (44 px). Con lo que se libera:

- El **diagrama pasa de 556 a 700 px**. Nodos de `--op-node-w` × `--op-node-h` (118×108, y 116 de
  alto para los que llevan ratio medido), que ya admiten **la forma espectral dibujada y el Hz real**
  de cada operador (261.763 / 523.526 / 130.881 Hz), no solo el ratio nominal.
- Los **armónicos dejan de ser una miniatura** y pasan a panel permanente, con la **curva de Bessel
  superpuesta** encima de las barras medidas y su leyenda de línea (MEDIDO grueso continuo / TEORÍA
  fino discontinuo).
- Aparece el **chip `CADENA LIMPIA`** en la barra, alimentado por `3b`, y una celda `PEOR PARCIAL` en
  la columna de cifras.

**Criterio de la pestaña**: el waterfall es el **por defecto en cuanto hay una nota sonando**; el
scope se pide. Cerrado (`CONCERNS.md` §1–7).

### 11. El reproductor (`4c`) — pieza transversal

Fichero: `design/Ronda4-piezas.dc.html`, sección `4c`. **Implementar una sola vez**: lo usan el A/B,
el chequeo de audio y cualquier barrido de parámetro.

Lo que hace: **note-on → sostener → medir → note-off**. No reproduce un archivo: **ejecuta un gesto
sobre un instrumento físico que está sonando en la habitación**.

**Siete estados**, dibujados en fila con sus transiciones (`flex: 0 0 316px`, tarjetas de `flex:1` con
flecha de 30 px entre ellas):

| estado | forma | qué es verdad |
|---|---|---|
| 1 · reposo | triángulo hueco en `--inert` | nadie toca; el teclado es del dueño |
| 2 · armado | triángulo `--carrier` con glow | parámetro escrito **y verificado releyendo**; aún no suena |
| 3 · sosteniendo | pausa en `--modulator`, la tarjeta **late** (`holdGlow` 1.6 s) | hay una nota viva puesta por la app |
| 4 · midiendo | obturador `--carrier` relleno | FFT 65536 sobre la nota sostenida |
| 5 · soltando | curva de release con marca de key-off | note-off enviado, **la cola de la AEG sigue sonando** (~460 ms) |
| 6 · en bucle | flecha circular `--modulator` | vuelve al 2 con el otro valor; `--play-hold` / `--play-gap` |
| 7 · fallido | **octógono** `--alert` | la escritura no volvió al releer. **Se suelta la nota primero, se avisa después** |

El estado 5 existe por una razón de diseño, no de ingeniería: **el waterfall está viendo esa cola**,
así que soltar no es lo mismo que estar en reposo.

**Qué se va a tocar, sin formulario**: la nota se elige **tocando un teclado dibujado** (340×52, la
tecla activa iluminada en `--modulator` con sus dos marcas) y la velocidad **arrastrando una cuña**
(1→127, marca de 2.6 px y el valor en una pastilla encima, nunca debajo del dedo). Referencia de los
spikes: C4 sostenida, velocidad 100.

**Quién está tocando** — la parte no obvia. `Local Control` sigue en `on`: el teclado suena por su
cuenta mientras la app le escribe, y el dueño puede estar tocando a la vez. Tres estados con color
propio:

- `TOCA LA APP · C4` en `--who-app` (cian) — y este chip **vive en la cabecera**, no aquí.
- `TOCAS TÚ · 3 NOTAS` en `--who-hands` (fósforo, como toda señal que entra).
- **`HAY UNA NOTA MÍA VIVA Y NO DEBERÍA`** en `--alert` con contorno discontinuo — el único estado
  que **enciende el pánico por su cuenta**.

**Mirar ≠ medir sigue vigente**: el reproductor alimenta las dos, pero mientras sostiene la vista
viva corre a 30 fps y la medida es el obturador del paso 4, deliberado y con su sello.

**Y el coste que se muestra en vez de disimularse**: leer las 416 direcciones son **0,9 s en
silencio y 5,5 s con notas** (medido, fase 0c). Así que el badge del diagrama **baja de
`--probe-idle` (12 Hz) a `--probe-playing` (2 Hz)** mientras el reproductor sostiene, y se dice.
Nada de animación que finja fluidez.

### 12. El pánico (`4d`) — pieza transversal

Sección `4d`. **No es un control del reproductor**: es el botón de cuando todo lo demás ha fallado.
Las notas colgadas de la fase 0c no las dejó nadie tocando — las dejó un bug del código que las
generaba, así que un botón que dependiera del reproductor habría estado tan roto como él.

**Especificación que no se negocia:**

- `--hit-panic` (56×56) en **el extremo derecho de la cabecera de TODAS las pantallas**, incluidas
  las que no tocan notas.
- `--shape-panic` — un octógono por `clip-path`. Es la **única forma octogonal de la app**; todo lo
  demás es píldora, círculo o rectángulo. La forma lo identifica sin leer.
- **Aislamiento en vez de confirmación**: filete de 2 px + `--gap-isolate` (16 px, el doble del
  `--hit-gap` normal) a su izquierda, nada accionable dentro de esa franja, y es el último elemento
  antes del borde de la ventana.
- **Tres estados**: hueco sobre `--panic-idle-bg` en reposo; **relleno con glow** sobre
  `--panic-live-bg` cuando hay una nota viva; y `HECHO` en `--signal-primary` durante
  `--panic-ack` (1.5 s) tras pulsarlo.
- **Sin confirmación.** Un «¿seguro?» convierte una emergencia en dos pasos.
- **Actúa al levantar el dedo dentro** (`pointerup` dentro del objetivo). Si se toca sin querer y se
  arrastra fuera antes de soltar, no pasa nada. Única concesión, y no cuesta tiempo: el gesto natural
  es tocar y levantar.
- **Qué hace**: `All Sound Off` + `All Notes Off` + 2 048 `Note Off` explícitos (medido, fase 0c). Y
  **ni un parámetro**: no pierde el patch, no cancela una medida guardada, no cierra el puerto, no
  cambia de modo.
- **Qué dice después**: «Silenciadas 3 notas · tu patch está intacto». Sin nada que deshacer, y el
  aviso **se va solo** — no pide un segundo toque para cerrarse.
- **Sobrevive al estado de error**: la cabecera es lo último que se sustituye, y las cuatro tarjetas
  de estado no felices se dibujan **debajo** de ella, nunca encima. Si el teclado se desconecta, el
  botón sigue ahí y sigue mandando los mensajes por si el puerto vuelve.

### 13. Conexión y chequeo de arranque (`4e`) — dos caras

Sección `4e`. Es el sitio al que lleva el `REINTENTAR` del estado «teclado no conectado».

**Cara 1 — la secuencia.** Corre al arrancar y cuando algo se rompe. Grid `1fr 452px`. Seis
comprobaciones **ordenadas de más grave a menos**; las que pasan se colapsan a una línea de ~62 px
con su cifra medida, y **la que falla se queda al final y grande** (`flex: 1`), con la ruta de menú
completa dentro:

| prueba | dato real en pantalla |
|---|---|
| Puerto MIDI | `MODX-1` abierto · Device Number `all` |
| Responde y acepta escrituras | mediana **2.0 ms** · peor caso 22.6 · timeout 100 |
| Fiabilidad del sondeo | **0 perdidas de 24 320** |
| Entra audio de verdad | `Line (MODX)` 2 ch · 44 100 · pico −18 dBFS · suelo −104 |
| Cadena limpia | 4 de 4 · `48 00 0B = 15` (Thru) |
| `Receive Bulk` | **falla** — sondeado, porque no se puede leer por SysEx |

La tarjeta del fallo lleva la ruta literal en mono sobre fondo cálido:
`[UTILITY]` → `[Settings]` → `[Advanced]` → `Receive Bulk` = `On`. Y el razonamiento diagnóstico,
porque es lo que evita buscar a ciegas: **las escrituras de parámetro no pasan por Receive Bulk**, así
que «escribir funciona y restaurar no» aísla al culpable sin ambigüedad.

**Cara 2 — el reposo.** Es **un chip en la cabecera**, el que ya existía (`CADENA LIMPIA`), y tocarlo
abre esta pantalla. **No hay panel de estado permanente**: seis luces verdes ocupando sitio no
informan de nada. Cuando algo falla, el chip **dice la consecuencia y no el fallo** —
`NO PUEDO DEVOLVERTE TU PATCH`, no `Receive Bulk en Protect`.

**Orden de gravedad, que es criterio de diseño y no adorno:**

- **Sin puerto MIDI** — la app no hace nada. La única que bloquea.
- **Sin audio** — funciona a medias: el diagrama sirve, las cuatro vistas de señal no.
- **`Receive Bulk` en Protect** — funciona todo **menos devolverte tu patch**, que es justo lo que la
  app prometió antes de tocarlo. **El peor**, porque no se nota hasta que quieres volver atrás.
- **Cadena sucia** — no es un fallo, es un aviso: no estás midiendo FM puro.

**Ningún fallo dice «error».** Todos dicen qué hacer, y los que se arreglan en el teclado traen la
ruta de menú entera. La cabecera tampoco dice «5 de 6 correcto»: un contador es un dato, una
consecuencia es información.

**Lo que se elige aquí**: puerto MIDI y dispositivo de audio, como **chips de 44 px**, no
desplegables — son dos o tres opciones, no una lista.

### 14. El modo A/B (`4b`)

Fichero: `design/Pantalla-principal.dc.html`, sección `4b`. **Es un modo de la principal, no una
pantalla aparte** — la decisión y su defensa están en `CONCERNS.md` §8 (cerrado).

Reutiliza el armazón de `4a` y cambia sólo tres cosas: los paneles de señal pasan a comparación, la
columna de cifras pasa a deltas, y la franja inferior aloja el reproductor en bucle + los dos
waterfalls.

- **Selector del parámetro** (`flex: 0 0 auto`, marco `--signal-primary`): el nombre del parámetro,
  y una **pista con los dos extremos arrastrables** — A a la izquierda con su valor apagado, B a la
  derecha luminoso, y la banda entre ambos rellena. Su dirección SysEx al lado (`49 20 1A`). Más un
  botón `BARRER 0→99 en 8 pasos` para el caso de más de dos valores.
- **Espectro A sobre B, superpuestos**: A en barras de 7 px `--ab-a-ink` al `--ab-a-alpha`; B en
  barras de 3 px `--ab-b-ink` con glow. **Mismas frecuencias, reparto de amplitudes radicalmente
  distinto** — que es literalmente lo que midió la fase 0.
- **Armónicos A contra B**: pares de barras de `--ab-bar-w` por armónico (A hueca y apagada, B sólida
  y luminosa) **y las dos curvas teóricas**, `|J_n(0.62)|` y `|J_n(2.81)|`, ambas discontinuas en
  `--theory` — la de B más marcada. El discontinuo **sigue siendo de la teoría**; A y B se distinguen
  por relleno, no por color.
- **La diferencia se rotula, no se deduce**: pastillas «la fundamental PIERDE 14 dB» y «el 9.º GANA
  31 dB» ancladas a los picos implicados.
- **La columna dice lo que NO cambia** — fc 261.763, fm 369.175, ratio 1.4103, C4 vel 100, idénticos
  en A y B — porque eso es lo que hace válida la comparación. Y los deltas: I de 0.62 a 2.81, pico de
  «fundamental» a «9.º armónico», parciales de 3 a 11.
- **Las dos son medidas**, cada una con su badge `65536` y su antigüedad. Nunca una medida contra una
  estimación.
- `CONGELAR Y GUARDAR · como paso de lección`: un A/B bueno **es** un paso de lección.
- **Franja inferior**: el reproductor en bucle (`A · 20` apagado / `B · 90 · SOSTENIENDO` encendido,
  vuelta 7, sostén 1.4 s, pausa 0.4 s) y los **dos waterfalls enfrentados** — el de A casi plano, el
  de B con el ataque brillante. Ahí se ve la lección sin leer una cifra.

### 15. El editor de operador (`5a`)

Fichero: `design/Ronda5-pantallas.dc.html`, sección `5a`. Se abre al tocar un operador desde `3a` o
desde el diagrama de `4a`. **Es la pantalla donde se vive en modo crear.**

**Layout.** Cabecera 58 px · cuerpo `grid-template-columns: 296px 1fr 316px` · franja inferior de
`--editor-once-h` (172 px).

- **Cabecera**: `← LOS OCHO`, el nombre (`OP3`) con su chip de rol, y el **rail de los ocho
  operadores** — ocho objetivos de `--op-rail-hit` (32 px) con la forma de su rol (píldora =
  portadora, esquina viva = modulador, discontinuo = a cero) y el actual encendido. Luego MIRAR,
  MEDIR y el pánico.
- **Columna 1 — el contexto y el Level.** Arriba `DÓNDE ESTÁS`: un mini-diagrama de 186 px con
  **sólo tu rama** (OP5 → OP3 → OP1) y las flechas del algoritmo real; a los lados, en 9 px,
  `te modula OP5` / `modulas a OP1`, y abajo `y OP1 sale`. Debajo, el **mando de Level** de
  `--knob-level` (190 px) con la cifra en 40 px **en el centro** y el arco en el color del rol.
- **Columna 2 — las dos envolventes a lo ancho.** AEG arriba (`flex: 1.15`, marco `--modulator`,
  rótulo «en un modulador, esto *es* la envolvente del timbre») y PEG debajo (`flex: 1`, neutra,
  bipolar con su línea de centro 50). Puntos de `--grip-curve` con halo, key-off en `--carrier`
  discontinuo, tiempos como etiquetas bajo la curva.
- **Columna 3 — forma y frecuencia.** Los siete **Spectral Form dibujados** en `grid` de 4 columnas
  (más una celda que dice «se elige el dibujo»); el **Skirt como ocho anchos de falda**
  (`--skirt-steps`), **apagado al 45 % porque la forma es Odd 1** — presente, no ausente; y el
  bloque de **Freq Mode** con sus dos dibujos, Coarse/Fine y el ratio medido.
- **Franja inferior — `SE PONE UNA VEZ Y SE OLVIDA`**, con el rótulo diciéndolo: **Level Scaling
  sobre un teclado dibujado** (break point arrastrable, curvas rotuladas), el **bipolar de Detune**
  con su centro visible, y cuatro chips para Time/Key, Lvl/Vel, Pitch/Vel y Key On Reset.

**Las cuatro reglas que esta pantalla tiene que respetar:**

1. **Jerarquía en la composición, no en pestañas.** Lo diario se lleva el 78 % del alto; lo de una
   vez vive abajo, pequeño **y tocable**. Nada escondido.
2. **El dedo tapa lo que arrastra.** El valor del punto activo va en una pastilla **arriba y al
   lado** (`ATK · nivel 99 · tiempo 18`), nunca bajo el punto; el del mando, en su centro.
3. **El contexto no se pierde**: tu rama siempre visible + el rail de los ocho.
4. **Cero formulario.** No hay ni una lista de `etiqueta: campo` en toda la pantalla. Si aparece,
   está mal hecho.

**El aviso de Freq Mode** es didáctico, no de error: con Fixed, Coarse y Fine **no cambian de valor,
cambian de significado** — de múltiplo a hercios — y el teclado además **moverá el Coarse**. Medido
en la fase 0c. Recuadro discontinuo en `--carrier`, no en `--alert`.

### 16. El barrido (`5b`)

Sección `5b`. Es el resultado del `BARRER 0→99 en 8 pasos` de `4b`.

- **El eje es la trayectoria por armónico**, no el espectro por paso: ocho polilíneas (n0…n7) sobre
  `viewBox="0 0 900 340"`, x = Level 0→99 (los ocho pasos), y = amplitud con **el cero a media
  altura** para que las curvas puedan cruzarlo. n0 en blanco y `--traj-stroke`; el resto en la escala
  de fósforo, adelgazando.
- **La teoría va superpuesta sobre la misma curva**, en `--theory` con `--dash-theory`, una por
  armónico. Porque esas trayectorias **son** las funciones de Bessel: no se comparan dos gráficos,
  se compara una línea con otra encima.
- **El momento que enseña**: hacia Level 77 la traza de n0 **cruza el cero** — primer cero de J₀ en
  `--bessel-zero` (I ≈ 2.405). Se encierra en `--alert` y se explica en una frase: *no es un fallo de
  medida, es la lección*.
- **Una línea vertical arrastrable** (en `--carrier`) marca el paso mostrado y **saca su espectro** al
  panel derecho, con su `|J_n|` encima. Del mapa se baja al detalle sólo cuando hace falta.
- **El estado «corriendo»** ocupa una franja de 64 px: ocho tarjetas, las hechas en fósforo, **la que
  corre ensanchada (`flex: 1.6`) y latiendo** (`stepGlow`) con su barra de progreso interna, y al
  lado las subfases con sus tiempos reales (escribir ✓ · verificar ✓ · sostener 1.4 s · medir 1.5 s ·
  soltar 0.46 s · pausa 0.4 s). La cabecera dice `PASO 6 DE 8 · MIDIENDO` y `QUEDAN ~8 s`.
- **Si se cancela a mitad**: los pasos medidos **se quedan** y el mapa se dibuja con ellos marcado
  como incompleto, se puede reanudar desde el siguiente, **y el Level vuelve a donde estaba** — el
  barrido guarda copia antes del primer paso.
- **Duración**: `--sweep-step-s` (~3,1 s) × `--sweep-steps` ≈ **25 s** con una medida por paso. Ver
  `CONCERNS.md` §15: si se promedian varias medidas cerca de los ceros sube a minutos, y el diseño
  del progreso aguanta las dos escalas sin cambiar.

### 17. La consola SysEx (`5c`) — un cajón

Sección `5c`. **Cajón, no pantalla**: se abre desde un chip de la cabecera y se despliega sobre la
franja inferior **sin sustituir la pantalla de detrás** — hay que ver la verificación mientras pasa,
porque si no, no se ve la causa (el mando que acabas de girar).

- **Asa de `--drawer-grab` (52 px)**, sombra `--drawer-lift` hacia arriba y borde superior en
  `--signal-primary` al 28 %.
- **Por defecto no es un log.** Abre en la pestaña `SIN CONFIRMAR · 2`: una tarjeta por escritura no
  confirmada, con **la frase humana** («OP3 · Level = 90 no volvió al releer»), **los bytes que se
  mandaron**, **lo que devolvió el teclado** y su botón `REPARAR Y VERIFICAR` de 44 px. El caso del
  no-op por longitud equivocada tiene su propia tarjeta («el parámetro es de 1 byte, no de 2»).
- **`TODO EL TRÁFICO · 1 216`** es la segunda pestaña. Nunca lo primero.
- **Tres cifras estables**: mediana 2.0 ms, p99 3.3 ms, perdidas 0. **Ni contadores vivos, ni
  gráficas de latencia, ni volcado corriendo solo** — nada que se mueva compitiendo con la señal.
- **Anota cada reparación con quién pisó a quién**: «48 00 48 · 2.º LFO Speed · 00 → 1E — lo había
  puesto a cero escribir 48 00 52». Es el par de `CONCERNS.md` §18 hecho visible, y el sitio donde
  aparecerían los que falten.
- **El chip de la cabecera sólo llama cuando hay algo**: `SysEx` neutro si no hay nada pendiente,
  `SysEx · 2 SIN CONFIRMAR` en `--alert` con borde de 2 px si sí.
- **La propina didáctica**: los once bytes **en cajas etiquetadas** de `--byte-box` — `F0` inicio ·
  `43` Yamaha · `10` escribir · `7F` a todos · `1C 07` MODX · `49` operador · `20` op3·part1 · `1A`
  Level · `5A` = 90 · `F7` fin — con el byte del valor destacado en fósforo, justo al lado de
  «OP3 · Level = 90». Es la única lección de la app que enseña **cómo habla** con el teclado.
- **Lo que NO es**: el sitio de `Receive Bulk`. Eso es un fallo con consecuencia y vive en `4e`.
  Aquí sólo lo que se repara de un toque.

### 18. La ronda 6 — el patch cambia debajo

Fichero: `design/Ronda6-pantallas.dc.html`. Cinco piezas, y **es el trabajo grande de la ronda**.

El punto de partida es un cero medido dos veces (fase 0d y 0e): **cargar otra Performance no emite un
solo byte** — ni Program Change, ni Bank Select, ni SysEx, con `Bank Select` y `Pgm Change` en `ON`,
en modo crudo, y con el nombre de la Part verificado antes y después de la ventana. Así que la app
**no tiene ningún evento** que le avise de que le han cambiado el sonido debajo, y sondea el nombre de
la Part 1 (`31 00 00`–`13`, 20 direcciones ASCII, ~40 ms) a **1 Hz** como ancla.

**`6a` · El ancla.** El nombre de la Performance **no es mobiliario nuevo**: ya estaba en la cabecera y
ahora lleva su procedencia (`ANCLA · 1 Hz · 31 00 00`), con peso bajo a propósito — 17 px de tinta y el
sello en 8 px. Tres estados: reposo; **acaba de cambiar** (nombre nuevo con el viejo tachado al lado,
el destello de 2 200 ms que ya usa la escritura del tutor, y todo lo sondeado puesto a raya); y
**releído**, que **no vuelve al reposo** — se queda pidiendo `SIN MEDIR EN ESTE SONIDO`. Tocar el ancla
abre el chequeo, donde vive lo que es propiedad del sonido cargado: `TEMPO 90 BPM · fondo 40 msg/s`.

**Propiedades conocidas del ancla**, las tres juntas para que no haya sorpresas en fase 1: cuesta
**~40 ms cada segundo** (20 direcciones ASCII a 1 Hz); detecta el cambio **en menos de un segundo**; y
tiene **un punto ciego de ~1,5 s por medida** — el sondeo del nombre **no puede correr dentro de la
ventana de FFT de 65 536** (1,486 s) sin meter tráfico en la medida, así que si el sonido cambia justo
ahí, la app se enterará **al acabar la medida**, no durante. El diseño lo aguanta sin pantalla extra:
en cuanto el ancla vuelve, la medida queda marcada como de otro sonido, que es el comportamiento
correcto. Es el único hueco real de la ronda 6 y está aquí a propósito — un hueco documentado es una
decisión.

**`6b` · El momento del cambio.** La regla que ordena la pantalla: **muere el mapa** (sondeado) y
**muere la medida** (era de otro sonido), pero **la vista viva no muere nunca**, porque es audio que
entra ahora mismo — scope y espectro siguen en fósforo con su chip `ESTO NO HA MUERTO · ES AUDIO`; lo
que desaparece del espectro es la curva de Bessel, porque no hay I hasta que haya medida. Un valor
muerto **conserva su forma y pierde su cifra** (contorno neutro y una raya): nada se apaga con
opacidad. Franja de relectura con la cuenta real (`118 DE 416`, ~0,9 s en silencio, ~5,5 s sonando) y
el corte dibujado en el waterfall. **Sin nada en curso no bloquea nada**, no hay botón de «releer», y
los números no se sustituyen sin pasar por la raya.

**`6c` · El caso feo.** Cuatro cosas quedan **invalidadas, no pausadas**, y la asimetría manda en las
cuatro salidas: **la app puede escribir parámetros pero no cargar Performances**. Barrido: vertical de
corte, **no hay «reanudar»**, tres salidas. A/B: la premisa se rompió, y repetir A cuesta ~3 s, así que
no se ofrece descartar primero. Lección: la app dice **la ruta literal de lo que sólo él puede hacer**.
Copias: los snapshots llevan procedencia de Performance y el botón **no se desactiva** — cambia de
texto y dice qué pisaría. Bloquea **sólo lo que se rompió**, anclado a esa cosa, nunca un modal.

**`6d` · Sólo lectura.** Tercer modo de fallo de la consola `5c`. `30 4B 00` (Super Knob) se lee,
emite y no acepta escritura, así que `REPARAR Y VERIFICAR` **no aparece**: reintentar no funcionaría
nunca. Estado propio en **ámbar discontinuo, no en alerta** (no está roto, es que no se puede), y
**la app lo aprende**, porque al teclado no se le puede preguntar: las reservadas contestan a una
lectura igual que las reales. Dos intentos y para, nunca un tercero automático. Al lado, la lista de
reservadas del papel (`48 0p 51–55`). Y el vocabulario del control observable: **mando sin marca de
agarre**, chip `EMITE · NO ACEPTA`.

**`6e` · Grados de confianza.** Una medida por paso (~25 s) y segunda pasada **sólo sobre los dudosos**.
El mapa se dibuja completo con los puntos dudosos como **círculo hueco con halo** en el ámbar de la
teoría, y el punto afinado muestra `×3 PROMEDIADAS` **con su dispersión** (`−43.8 ±0.6`).

### 19. La ronda 7 — el seguimiento: la app sabe dónde tienes las manos

Fichero: `design/Ronda7-piezas.dc.html`. **Dos piezas de comportamiento, sin pantalla nueva.**

El teclado **no notifica nada de navegación** (fase 0d, punto 2, en crudo): cambiar de operador en
foco, de página o de Part no emite un byte. Pero el conjunto de vigilancia que la app ya sondea son
**40 direcciones — cinco parámetros por los ocho operadores** a 12,2 Hz. Si en una ronda se mueve
`49 60 1A`, la app no sabe que estás mirando el OP7: sabe que **acabas de tocar algo del OP7**. El
seguimiento **no cuesta ni una petición más**.

**`7a` · El rail que te sigue.** Conmutador `TE SIGO` con el dibujo de lo que hace (una tecla, una
flecha, el punto del rail), en fósforo porque seguir es leer señal que entra; en reposo no dice nada
más. El operador con actividad se marca en el rail con un anillo que late, y una banda ofrece
`IR AL OP7` / `SIGO AQUÍ` (44 px los dos). **Sugerencia y no salto**, y el motivo no es la
reversibilidad —el rail ya la da— sino que **el gesto no se puede interrumpir**: un salto de foco a
mitad de un arrastre de la AEG rompe la curva a medias. Tres reglas escritas en la propia pieza:
**sólo detecta cambios, no visitas** (así que la frase nunca dice «estás en», dice «acabas de tocar
algo de»); **lo suyo no lo cuenta como tuyo** (un cambio que coincide con una escritura propia
pendiente de releer no es del usuario, y cuando el tutor escribe el foco **no se mueve**); y **una
sugerencia por vez, la última**, que se va sola a los 6 s.

**`7b` · Los ocho como espejo.** En `3a` el seguimiento no mueve nada —los ocho ya están en
pantalla— así que **deja rastro**: cada tarjeta dice qué tocaste, de qué a qué y hace cuánto
(`LEVEL 56 → 71 · HACE 0.3 s`), y en la columna de Level el valor viejo queda como **marca
discontinua**. No es un historial: es el último gesto; las demás dicen `SIN CAMBIOS TUYOS`. La
procedencia usa el vocabulario que ya existe — **fósforo lo que entra de fuera** (tus manos, como toda
señal medida), **cian lo que escribió la app**. Es el modo crear en su forma más pura: el usuario hace
el sonido a mano y la app es el espejo.

**Los dos anillos, y la consecuencia que se dice.** Para saber dónde están las manos hay que vigilar
los ocho; para que el operador abierto esté al día, sus 43 parámetros. Dos conjuntos, dos cadencias, y
**comparten canal**: los 12,2 Hz del anillo ancho bajan a ~6 Hz con un operador abierto, así que
**abrir un operador ralentiza el seguimiento**. Por tanto `CADUCO` es **cuatro veces el periodo de su
propio anillo** (0,33 s el ancho, 0,66 s el estrecho), la cadencia se rotula **una vez por zona en su
cabecera**, y **no hay badge nuevo** — un segundo sello por cifra es lo que ya se rechazó para el
tempo.

## Interactions & Behavior

**Táctil como base, ratón como superconjunto.** Un solo diseño para los dos punteros; **no** hay
"modo táctil" y "modo escritorio" que mantener por separado. La mano izquierda está en el MODX.

- **Objetivos de toque**: mínimo **44 px** (`--hit-min`) para cualquier cosa accionable; **56 px**
  (`--hit-touch`) en los controles que se usan tocando a menudo; separación mínima **8 px**
  (`--hit-gap`). Los operadores del diagrama son objetivos de 100×92. En este panel (14" @ 150 %)
  44 px CSS ≈ 9 mm físicos: **no hay que inflar nada**.
- **Nada depende de `:hover`** — ni para descubrirse, ni para mostrar un valor, ni para revelar un
  control. El patrón habitual de app de audio ("paso por encima del mando y sale el número") está
  **prohibido**: el valor está **siempre visible** o aparece **al tocar**.
- **El dedo tapa lo que arrastra.** En mandos, sliders y editores de curva, el valor y el punto
  activo van **arriba y al lado** (`--value-offset: -34px`), nunca bajo el punto. El punto de
  arrastre se dibuja a 22 px (`--grip-handle`) con zona de agarre de 44 (`--grip-hit`).
- **Sin clic derecho como vía única** y **sin gestos ocultos**. Si hay menú contextual o gesto, es
  atajo de algo que ya tiene su botón tocable.
- **Sin doble toque para nada destructivo.** Pisar el patch pasa siempre por el aviso con snapshot.
- **El hover existe, como refinamiento**: resalta, previsualiza o adelanta un desglose que **también**
  se abre al tocar (`--hover-lift`). Nunca es portador único de un valor, un control o un estado.
- **Extras de ratón, siempre capa adicional**: rueda ±1 en un mando, modificador (Alt) para paso
  fino ×0.1, doble clic para volver al default, atajos de teclado para MEDIR y para cambiar de
  vista. **Quitar el ratón no quita ninguna función.**

**Gestos por control**

| control | dedo | ratón añade |
|---|---|---|
| mando continuo | arrastre vertical, agarre 160 px | rueda ±1, Alt ×0.1, doble clic = default |
| bipolar | tocar salta a ese valor, arrastrar afina | rueda ±1, doble clic vuelve a 15 |
| punto de envolvente | arrastre, valor arriba del punto | arrastre con modificador para precisión |
| Spectral Form | tocar la casilla | hover previsualiza el espectro |
| operador | tocar para editar | hover resalta su rama de rutas |
| MEDIR | tocar | atajo de teclado |

**Animación.** Nada animado compite con la señal — aquí lo que se mueve de verdad es la señal.
Sólo existen: el latido de "mirando" (`--dur-heartbeat` 1400 ms) y el destello del aviso de
escritura del tutor (2200 ms). Transiciones de estado ≤ 180 ms (`--dur-state`) con
`--ease-instrument`; llegada de una medida nueva 420 ms (`--dur-settle`).
**Prohibido** un número de medida que parpadee solo.

**Presupuesto de frame.** Ninguna operación de UI puede costar más de **33 ms**
(`--frame-live`, 30 fps). Si un panel no cabe en el presupuesto, se simplifica el panel.

## State Management

Los prototipos son estáticos, pero la dirección A declara los estados que la implementación necesita
(en el prototipo son props del componente raíz):

- `estado: 'vivo' | 'sin-audio' | 'desconectado' | 'patch-sucio'` — controla la franja de aviso
  superior y qué tarjeta de estado no feliz aplica.
- `marcarArtefactos: boolean` — pinta o no las parciales no armónicas en `--alert`.

Lo que la app real tendrá que sostener, por zonas:

- **Patch sondeado** (SysEx, 12 Hz): algoritmo, feedback, y por operador — rol (portadora/modulador,
  derivado de la topología), Level 0-99, Coarse, Fine, Detune, Freq Mode, Spectral Form, Skirt,
  Resonance, AEG, PEG, Level Scaling. Con **marca de tiempo por lectura**: pasados unos segundos el
  dato pasa a `CADUCO` y se pinta como tal.
- **Vista viva** (30 fps): buffer de forma de onda, FFT 4096, cola de 14 tramas para el waterfall.
- **Medida** (disparo explícito): FFT 65536 sobre nota sostenida → parciales, fc, fm, ratio medido,
  índice I ajustado, lista de artefactos, antigüedad de la medida.
- **Teoría**: `|J_n(I)|` calculado, error medio y peor parcial contra la medida.
- **Tutor**: paso actual, pasos completados, snapshot del patch previo (`0E 25 00`, 7 669 bytes),
  y cola de escrituras con su verificación por relectura.
- **Escritura**: toda escritura al teclado es *pendiente → releída → confirmada | fallida*. Una
  escritura sin confirmación **se pinta en alerta, no en verde**.

## Design Tokens

Fuente de verdad: **`design-tokens.css`** (nombres semánticos, no literales). Resumen:

**Superficies** — `--surface-base #06080a`, `--surface-panel #0a0f10`, `--surface-raised #0f1417`,
`--surface-sunken`. Separadores: `--rule-min: 2px`, `--rule-color: oklch(1 0 0 / .09)`,
`--rule-color-strong: … / .16`; alternativa preferida `--rule-by-space`.

**Tinta** — `--ink-primary #d6e2dd`, `--ink-secondary #8fa39d`, `--ink-tertiary #6f817c`,
`--ink-inert #5d6d69`.

**Roles FM** (los tres acentos comparten croma y claridad, sólo cambia el tono) —
`--signal-primary oklch(.87 .155 155)` ≈ `#7df0b0` (audio medido, fósforo);
`--carrier oklch(.80 .150 75)` ≈ `#f3b13f` (portadora: suena);
`--modulator oklch(.79 .140 235)` ≈ `#58c8f5` (modulador: colorea);
`--inert #3d4a48` (Level 0); `--alert oklch(.72 .160 35)` ≈ `#ff7a5c`;
`--theory: var(--carrier)`. Más los gradientes de relleno de nivel
`--carrier-fill` / `--modulator-fill` / `--signal-fill`.

**Tipografía** — `--font-ui: 'Helvetica Neue', Helvetica, Arial, sans-serif`;
`--font-num: ui-monospace, 'Cascadia Mono', Consolas, monospace` para **toda cifra medida**
(tabular). Escala: display 44 / title 26 / section 20 / body 15 / label 12 / **micro 10 (piso
absoluto)**; readout-xl 30, readout 22, node 25. Tracking: label .14em, eyebrow .24em; leading .55.

**Espaciado** — base 4: 4 / 8 / 12 / 16 / 20 / 26 / 34 / 44.

**Toque** — `--hit-min 44px`, `--hit-touch 56px`, `--hit-gap 8px`, `--grip-handle 22px`,
`--grip-hit 44px`, `--grip-knob 160px`, `--track-bipolar 58px`, `--value-offset -34px`.

**Radios (con significado)** — `--radius-carrier 26px` (curva total = portadora) y
`--radius-modulator 5px` (esquina viva = modulador) son **semánticos, no decorativos**; además
`--radius-panel 16px`, `--radius-view 14px`, `--radius-pill 999px`.

**Elevación: luz, no sombra negra** — `--glow-carrier`, `--glow-modulator`, `--glow-signal`,
`--glow-alert`, `--glow-trace` (filter para trazas), `--inset-panel`, `--hover-lift`.

**Trazos de señal** — `--stroke-trace 2px`, `--stroke-partial 3px`, `--stroke-ridge 1.2px`,
`--stroke-theory 2px`; `--dash-theory: 5 4` (**la teoría SIEMPRE discontinua**),
`--dash-inactive: 4 5` (ruta con Level 0). En SVG, `vector-effect: non-scaling-stroke` para que la
traza no engorde al estirar el viewBox.

**Movimiento** — `--ease-instrument cubic-bezier(.2,.8,.2,1)`,
`--ease-mechanical cubic-bezier(.4,0,.2,1)`; `--dur-instant 90ms`, `--dur-state 180ms`,
`--dur-settle 420ms`, `--dur-heartbeat 1400ms`, `--frame-live 33.3ms`.

**Diagrama** — `--op-node-w 118px`, `--op-node-h 108px` (`--op-node-h-tall 116px` para los nodos con
ratio medido), `--op-col-gap 82px`, `--op-row-gap 28px`, `--op-bus-offset 30px`.

**El pánico** — `--hit-panic 56px`, `--gap-isolate 16px`, `--shape-panic` (el único octógono),
`--panic-idle-bg` / `--panic-live-bg`, `--panic-ack 1500ms`.

**El reproductor** — `--play-hold 1400ms`, `--play-gap 400ms`, `--probe-idle 12` / `--probe-playing 2`
(Hz de sondeo en silencio y sosteniendo), `--who-app` (cian: toca la app) / `--who-hands` (fósforo:
tocas tú).

**Comparación A/B** — `--ab-a-ink` + `--ab-a-alpha` (hueca y apagada), `--ab-b-ink` (sólida y
luminosa), `--ab-bar-w 13px`. **A y B se distinguen por relleno, no por color**: el discontinuo
sigue reservado a la teoría.

**Los ocho / comparación** — `--op-strip-w 128px`, `--op-level-col-w 30px`,
`--curve-focus-stroke 3.4px`, `--curve-ghost-stroke 1.4px`, `--curve-ghost-alpha .5`.

**Registro de lección** — `--font-lesson` (Georgia), `--lesson-surface`, `--lesson-ink`,
`--lesson-ink-dim`, `--lesson-accent`. **Nunca en una cifra medida.**

## Assets

**Ninguno.** No hay imágenes, ni iconos de librería, ni fuentes que descargar:

- Tipografía **del sistema** (Helvetica Neue / Helvetica / Arial, Georgia en la dirección C, y la
  mono del sistema). Sin webfonts, sin CDN.
- Toda la gráfica es **SVG inline de formas primitivas** (círculo, rectángulo, línea, arco,
  polilínea) o CSS (gradientes, `repeating-linear-gradient` para la trama de C). Sin iconografía
  dibujada a mano más allá de eso.
- Sin emoji.

Donde en el futuro haga falta una imagen de verdad, va un hueco marcado — no un icono inventado.

## Files

En `design/`:

| fichero | qué es |
|---|---|
| `Indice.dc.html` | índice con enlaces a todas las pantallas — **empieza aquí** |
| `Pantalla-principal.dc.html` | **la pantalla principal** (`4a`) y **el modo A/B** (`4b`) |
| `Ronda4-piezas.dc.html` | `4c` el reproductor y sus siete estados · `4d` el pánico · `4e` conexión y chequeo de arranque |
| `Ronda7-piezas.dc.html` | **ronda 7** — `7a` el rail que te sigue · `7b` los ocho como espejo. Dos piezas de comportamiento, sin pantalla nueva |
| `Ronda6-pantallas.dc.html` | **ronda 6** — `6a` el ancla en la cabecera · `6b` el momento del cambio de Performance · `6c` las cuatro cosas invalidadas · `6d` sólo lectura · `6e` grados de confianza |
| `Ronda5-pantallas.dc.html` | `5a` el editor de operador a pantalla completa · `5b` el resultado del barrido · `5c` la consola SysEx |
| `Ronda3-pantallas.dc.html` | **cinco pantallas** en un lienzo paneable: `3a` los ocho operadores · `3b` la Part · `3c` copias y su resta · `3d` índice del tutor · `3e` la principal rebalanceada, que es la que se promovió a `4a` |
| `Sistema-A-componentes.dc.html` | hoja de sistema: componentes, editor de operador, teoría vs medición, tutor, estados no felices, interacción dedo/ratón |
| `support.js` | runtime del prototipo — **no portar** |

**Archivadas y fuera del paquete**: las direcciones B · Nébula y C · Plotter, y también la primera
pantalla principal (`Direccion-A-Bancada.dc.html`), sustituida por `4a`. De C sobrevive su
**registro cálido** como sub-registro de las pantallas de lección (tokens `--font-lesson` y
`--lesson-*`).

En `screenshots/` (capturas de referencia, por si no quieres abrir los HTML):

| fichero | qué es |
|---|---|
| `4a-principal.png` | **la pantalla principal**, 2× |
| `4b-modo-ab.png` | el modo A/B, 2× |
| `4c-reproductor.png` | los siete estados del reproductor, 2× |
| `4d-panico.png` | anatomía del pánico, 2× |
| `4e-arranque.png` | conexión y chequeo, 2× |
| `5a-editor-operador.png` | el editor de operador, 2× |
| `5b-barrido.png` | el barrido y las trayectorias de Bessel, 2× |
| `5c-consola-sysex.png` | la consola SysEx, 2× |
| `6a-ancla.png` | los tres estados del ancla en la cabecera, 2× |
| `6b-cambio.png` | el momento del cambio de Performance, 2× |
| `6c-invalidado.png` | las cuatro cosas que quedan invalidadas, 2× |
| `6d-solo-lectura.png` | el tercer modo de fallo de la consola, 2× |
| `6e-confianza.png` | grados de confianza en el barrido, 2× |
| `7a-rail-que-te-sigue.png` | el rail con seguimiento y la banda de sugerencia, 2× |
| `7b-espejo.png` | los ocho con rastro de tus manos y los dos anillos, 2× |
| `R3a-los-ocho.png` | los ocho operadores comparados, 2× |
| `R3b-la-part.png` | la cadena que ensucia la medida, 2× |
| `R3c-copias-y-resta.png` | snapshots y el diff como guion de lección, 2× |
| `R3d-indice-tutor.png` | las nueve lecciones, 2× |
| `R3e-principal-rebalanceada.png` | la alternativa a la principal, 2× |
| `Sistema-A-componentes.png` | hoja de sistema completa, página larga a 1× |

Las capturas son **referencia visual, no la especificación**: los valores exactos están en
`design-tokens.css` y en este README. Para inspeccionar medidas, abre los HTML.

En `sources/` van las fuentes de datos, sin modificar: `modx.md` (documento maestro, **actualizado en la ronda 6**: cabecera, clock, latencias y secciones nuevas),
`datalist_fmx_tables.md` (tablas oficiales de Yamaha: offsets, rangos, enums y defaults),
`rm_pantallas_fmx.md` (qué pantalla del MODX corresponde a cada dirección),
`fase0c_RESULTS_mapa.md` (SysEx medido contra el teclado real), `fase0_RESULTS.md` (el spike de
audio: dispositivo, formato, niveles de trabajo, suelo de ruido y el origen del artefacto de
2756 Hz) y `spm_conceptos_fmx.md` (definiciones de Yamaha: la analogía del filtro y las siete formas
espectrales). Y las dos de la ronda 6: `fase0d_RESULTS_notificaciones.md` (qué notifica el teclado y
qué no — las teclas sí, la navegación no, el cambio de Performance **no**; la verificación del mapa
fuera del Op3, 12 de 12; el Feedback en `48 0p 50`; y la cadencia real del conjunto de vigilancia) y
`fase0e_RESULTS_falsacion.md` (la falsación de ese cero en modo crudo, la primera dirección de sólo
lectura, y el descubrimiento de que el emisor de Parameter Change del MODX existe y funciona pero
Yamaha sólo lo cableó al Super Knob). **Cuando el papel y la medida discrepen, manda la medida.**

Con las tres correcciones de dato ya aplicadas (Skirt 0-7, Cutoff 0-255 en dos bytes, FEG bipolar en
cents) **no queda ningún valor marcado como provisional en las pantallas**: lo que sigue sin cerrar
es de decisión o de hardware, no de fuente.

Dos cosas de `spm_conceptos_fmx.md` que son material de diseño y no de ingeniería:

- **La analogía del filtro**: el nivel del modulador hace de frecuencia de corte y su envolvente de
  envolvente de filtro. Es el guion literal del A/B canónico de `4b` y la razón de que la lección 2
  sea esa y no otra. Está citada en `3d`.
- **Las siete formas espectrales están definidas de forma comprobable** (Sine sin armónicos, All/Odd
  anchos o estrechos, Res con pico desplazado). Cada definición es una afirmación que el analizador
  puede verificar, así que **el panel de teoría contra medición vale tal cual para el Spectral
  Form**, no sólo para Bessel.

No va `fase0b_RESULTS_sysex.md`: está superado por la 0c y contiene una latencia de 14-21 ms que
resultó ser artefacto de medición (son 2 ms). Lo que sobrevive de él ya está en `modx.md`.

En la raíz del paquete:

| fichero | qué es |
|---|---|
| `CONCERNS.md` | **léelo primero.** Lo que no está cerrado, lo que falta por diseñar, y el riesgo de datos |
| `design-tokens.css` | **fuente de verdad** de valores; la fase 1 lo consume tal cual |
| `DESIGN.md` | la dirección elegida y por qué, las reglas a respetar, la procedencia de cada dato, y lo que se decidió **no** hacer |
| `README.md` | este documento |

Orden de lectura para quien implemente: `CONCERNS.md` (5 min, evita suposiciones) → `DESIGN.md`
(el "por qué" y los límites) → `design-tokens.css` → la hoja de sistema abierta al lado del código.

**Empezar a implementar por aquí**, en este orden, porque cada paso desbloquea al siguiente:

1. **El armazón de `4a`** con su cabecera — incluido el **pánico**, que atraviesa todo lo demás.
2. **El nodo de operador** y el diagrama sondeado: es el componente que más se reutiliza (`4a`, `3a`,
   `3c`).
3. **Las vistas de señal** y el sello de procedencia de cada cifra.
4. **El ancla** (`6a`) y la relectura de `6b`. Va aquí, temprano y antes del reproductor, porque es
   **barata** (una dirección, 1 Hz) y porque **todo lo que se dibuje después tiene que saber morir**:
   si el estado de «muerto» no existe desde el principio, se cuela en cada panel como un parche.
5. **El reproductor** (`4c`), que desbloquea el A/B y el chequeo de audio.
6. **El chequeo** (`4e`) y el chip de cadena, que es lo que hace creíble el panel de teoría.
7. **El editor de operador** (`5a`), que es donde se vive en modo crear y reutiliza todos los
   controles de la hoja de sistema.
8. **El barrido** (`5b`) con sus **grados de confianza** (`6e`) y la **consola SysEx** (`5c`) con sus
   **tres** modos de fallo (`6d`), que son las dos que dependen de que todo lo anterior funcione.
9. **Lo que queda invalidado** (`6c`), que sólo se puede hacer cuando existen las cosas que se
   invalidan: barrido, A/B, lección y copias.
10. **El seguimiento** (`7a`, `7b`), al final y no por poco importante: **no necesita ni una petición
    nueva**, así que se puede añadir cuando el sondeo y el ciclo de escritura ya funcionen. Antes de
    eso no habría con qué distinguir un cambio tuyo de uno propio.

## Qué se decidió NO hacer

Resumido de `DESIGN.md`, para que no se reintroduzca por inercia:

- **No hay panel lateral de ajustes.** Todo parámetro vive junto a la cosa que cambia — dentro del
  nodo o sobre su curva. En cuanto exista una columna de "propiedades", la app es una app de oficina.
- **No hay breakpoint pequeño** ni layout empotrado: un solo lienzo, 1280×800, y escalado hacia
  arriba.
- **No están dibujados los 88 algoritmos.** El diagrama es un layout por profundidad de cadena que
  sirve para cualquier topología leída del teclado; dibujar 88 láminas es trabajo de datos.
- **Ni matriz de rutado ni editor de algoritmo**: el algoritmo es un número que se escribe.
- **No hay tema claro.** Una app de audio con un teclado delante no se mira en blanco.
- **Nada de skeuomorfismo de rack**: sin tornillos, sin metal cepillado, sin cuero.
- **Sin waterfall en 3D**: el ridgeline plano enseña más y la perspectiva miente sobre las
  amplitudes.
- **Sin tooltips como portadores de información** — con dedo no existen.
- **Sin corpus DX7 ni biblioteca de patches**: última fase.

## Nota de procedencia

Las ocho fuentes van en `sources/`. Con ellas, **casi nada de lo que se pinta es invención** —
pero conviene saber qué es qué:

- **Medido contra el teclado** (`fase0c_RESULTS_mapa.md`, y el maestro): ratio 1.4103 frente a 1.41
  en la pantalla del MODX, fc 261.763 / fm 369.175 ±0.005, 11 parciales, I = 2.81, el comb de
  2756.25 Hz como artefacto, el bulk `0E 25 00` de 7 669 B en 123 mensajes, los 416 parámetros del
  snapshot con su pasada de reparación, `48 00 4F` para el algoritmo, latencia mediana de 2.0 ms y
  timeout recomendado de 100 ms.
- **Documentado, no medido** (`datalist_fmx_tables.md`, `rm_pantallas_fmx.md`): los 47 offsets del
  operador con rango y default, los 86 del bloque de Part, los 19 tipos de filtro, la FEG entera, el
  2.º LFO, el feedback en `48 0p 50`, y las rutas de menú. **Escribir con la longitud equivocada es
  un no-op silencioso**, así que nada de aquí se da por bueno hasta que el teclado conteste.
- **Invención verosímil, dentro de rangos documentados**: los valores del ejemplo sucio de la
  pantalla de la Part, los tiempos de las ocho AEG, los operadores Op5–Op8 del patch de ejemplo, y
  los títulos de las nueve lecciones. Listado completo en `DESIGN.md`, sección "Procedencia de los
  datos".
- **Medido en la ronda 6** (`fase0d`, `fase0e`): el cero del cambio de Performance (dos veces, en
  crudo, con ancla dentro de la ventana), que **el MODX sí transmite las teclas por USB** (11 On /
  11 Off en canal 1, velocity de 32 a 106, pitch bend de 14 bits reales, CC 1 completo), que una tecla
  en `MIDI I/O = Multi` **da un Note On por Part** (cuatro en 28 ms), el sondeo efectivo de 12,22 Hz y
  2,43 Hz con **0 perdidas de 4 000**, el tráfico de fondo de 40 msg/s a 90 BPM (**escala con el
  tempo**), la semántica del mapa verificada en Op5 y Op7 (12 de 12, con la predicción escrita antes de
  mirar), el Feedback en `48 0p 50` **por Part**, que las direcciones reservadas **contestan a una
  lectura**, y que `30 4B 00` es de **sólo lectura**.

  Con esto **se cae la única inferencia grande que quedaba**: `TOCAS TÚ · 3 NOTAS` ya no está apoyado en
  una suposición, y su recuadro ámbar de `4c` pasa a `MEDIDO · fase 0e`. La propuesta de derivarlo del
  audio se conserva **como respaldo degradado** (`ENTRA AUDIO QUE NO HE PEDIDO`) para cuando el MIDI de
  entrada esté cerrado, no como fuente: el MIDI da la cuenta de notas y la velocity, que es lo que hace
  del chip información en vez de un piloto.

Tres correcciones de dato que las fuentes destaparon y que ya están aplicadas: **Spectral Skirt es
0-7** (no 0-99, y eso cambia el control: ocho posiciones, no un mando continuo), **el Cutoff del
filtro es 0-255 en dos bytes** (no hercios) y **el nivel de la FEG es bipolar en cents, ±9 600**.
Detalle en `CONCERNS.md` §1–7.

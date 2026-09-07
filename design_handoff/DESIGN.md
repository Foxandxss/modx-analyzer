# MODX Analyzer — dirección visual (fase 1 UI)

Entregable de diseño. Nada de esto toca código de la app.

**Lienzo de referencia: 1280 × 800 CSS px** (portátil 14", panel 1920×1200 con escalado de Windows
al 150 %), **~1280 × 740 útiles** a pantalla completa descontando el marco de la ventana.
`devicePixelRatio = 1.5`. **Pantalla táctil**, y también ratón.
El objetivo Waveshare ESP32-S3 está cancelado: no hay breakpoint de 1024×600 en ninguna parte.

## Qué hay aquí

| fichero | qué es |
|---|---|
| `Pantalla-principal.dc.html` | **la pantalla principal** (`4a`, promovida desde 3e) y **el modo A/B** (`4b`) |
| `Ronda4-piezas.dc.html` | **ronda 4** — `4c` el reproductor y sus siete estados · `4d` el pánico · `4e` conexión y chequeo |
| `Ronda7-piezas.dc.html` | **ronda 7** — `7a` el rail que te sigue · `7b` los ocho como espejo |
| `Ronda6-pantallas.dc.html` | **ronda 6** — `6a` el ancla en la cabecera · `6b` el momento del cambio de Performance · `6c` lo que queda invalidado · `6d` sólo lectura · `6e` grados de confianza en el barrido |
| `Ronda5-pantallas.dc.html` | **ronda 5** — `5a` el editor de operador · `5b` el barrido · `5c` la consola SysEx |
| `Ronda3-pantallas.dc.html` | **ronda 3** — los ocho operadores, la Part, copias y su resta, el índice del tutor, y la principal rebalanceada (que es ahora `4a`) |
| `Direccion-A-Bancada.dc.html` | la principal anterior — **archivada**, no se mantiene |
| `Direccion-B-Nebula.dc.html` | dirección B — **archivada**, no se mantiene |
| `Direccion-C-Plotter.dc.html` | dirección C — **archivada**; su registro cálido sobrevive en las pantallas de lección |
| `Sistema-A-componentes.dc.html` | hoja de componentes de la dirección recomendada + editor de operador + teoría/medición + modo tutor + los cuatro estados no felices + **interacción dedo y ratón** |
| `design-tokens.css` | tokens semánticos (color, tipo, espaciado, radios, elevación, curvas, objetivos de toque) |

Todos abren con doble clic, sin build ni CDN, con tipografía del sistema (Helvetica/Georgia + mono).

Datos de ejemplo: los medidos en los spikes. Algoritmo 6, feedback 3 en Op5. Op1 portadora 99 ×1.00,
Op2 a 0, Op3 modulador 90 ×1.41 Odd 1, Op4 portadora 99 ×2.00, Op5 modulador 72 ×2.00 Res 1,
Op6 modulador 64 ×7.00, Op7 a 0, Op8 portadora 55 ×0.50. Espectro con las once parciales de
`|fc ± k·fm|`, fc = 261.763 Hz, fm = 369.175 Hz, ratio medido 1.4103 (pantalla 1.41, Δ 0.4 ¢),
I = 2.81, suelo −104 dB, y el comb de 2756.25 Hz marcado como artefacto en vez de escondido.

---

## Las tres direcciones

**A · Bancada** — *bancada de laboratorio: grafito, fósforo y ámbar; el número acompaña, no manda.*
Tres bandas: diagrama de operadores a la izquierda como héroe, scope y espectro apilados al centro,
waterfall a lo ancho abajo, columna de cifras medidas a la derecha. Transporte partido en dos actos
distintos: la pastilla verde «MIRAR · 30 fps» que late, y el obturador ámbar «MEDIR · 65536» sobre
nota sostenida.

**B · Nébula** — *el algoritmo como floración: la profundidad en la cadena es distancia al centro.*
El patch se lee en anillos concéntricos alrededor de un núcleo de salida; el Level es un arco
alrededor de cada operador y las rutas son cables curvos. Las cuatro vistas de señal son paneles de
cristal a la derecha. Es la que mejor cuenta la topología de un golpe (se ve quién está lejos de la
salida) y la más memorable.

**C · Plotter** — *registrador de gráficos: tinta cálida sobre papel oscuro, sin un solo glow.*
La que se aleja de lo obvio: nada de neón. Grafito cálido, un solo acento vermellón, trazo de
plumilla, trama de rayas en vez de relleno luminoso para el Level, serif para lo que explica y mono
para lo que se mide. El waterfall es un rollo continuo que ocupa media pantalla, como una tira de
registrador.

### Cómo aguantan las tres a 1280×800

Las tres se han rehecho y mirado a esa medida. El lienzo es **apaisado y corto de alto**, así que el
problema no es el ancho: es el alto.

- **A** aguanta con holgura y sin perder ninguna vista: el waterfall sigue a lo ancho, las cuatro
  vistas conviven, y la columna de cifras se estrecha sin bajar el cuerpo de los números.
- **B** aguanta **recompuesta**, no encogida: la floración pasó de tres anillos radiales a tres ramas
  con separación angular (el nodo profundo se aparta 26° de su rama en vez de alinearse), el núcleo
  bajó a r=66 y el rail de señal a 560 px. Encogerla al 86 % habría dejado las etiquetas por debajo
  de 10 px; recomponerla no cuesta nada y mantiene la idea. Sigue siendo la que menos aire deja.
- **C** aguanta y es la que menos ha sufrido, porque su lámina de operadores ya estaba en
  porcentajes: reflowa sola. Lo que se acorta es el rollo del waterfall, que pierde algo de su
  gracia de «tira larga» — es el precio del lienzo corto.

Ninguna necesita 1440. Que escale hacia arriba en un monitor externo es bienvenido y está previsto
en los tokens, pero **el caso de diseño es 1280×800**.

---

## Recomendación: **A · Bancada** — aceptada (ronda 3)

B y C quedan **archivadas**: no se mantienen ni se actualizan. De C sobrevive una cosa, por
invitación expresa: su **registro cálido** (serifa + tinta crema + acento vermeñón) es ahora el
sub-registro de las pantallas de lección dentro de A. Ver `--font-lesson` y los tokens `--lesson-*`.

Los cuatro motivos, para el registro:

1. **Es la única que sostiene las cuatro vistas de señal y el diagrama a la vez, con holgura, en
   1280×800.** El proyecto entero se justifica en mirar el waterfall mientras se gira un knob y ver
   el diagrama que corresponde. B lo consigue apretando; C dedica media pantalla al rollo y comprime
   el espectro.
2. **La jerarquía es la del oficio.** Instrumento de medida: fondo neutro, señal luminosa, retícula
   discreta, cifras monoespaciadas. El ojo va a la señal porque es lo único que brilla — que es
   exactamente el criterio del brief («aquí lo que se mueve de verdad es la señal»).
3. **El significado no depende del color.** Portadora = curva total; modulador = esquina viva;
   Level 0 = contorno discontinuo. Funciona en gris y con daltonismo.
4. **Es la que mejor se toca.** El diagrama en rejilla da objetivos rectangulares de 100×92 con
   separación regular; la floración de B tiene nodos redondos a distancias desiguales y con
   etiquetas alrededor, que es más fácil de errar con el dedo.

Qué se pierde al elegir A: el golpe visual de B (la floración es más memorable que tres bandas) y la
personalidad de C (A se parece más a otros analizadores; es el precio de parecer un instrumento).

**C merece una segunda mirada** para el modo tutor y para material impreso: la tinta cálida y el
serif explican mejor que el fósforo. No está descartada como sub-registro de las pantallas de
lección.

---

## Dos modos de primera clase

**Aprender** — el tutor lleva paso a paso, escribe en el teclado, el usuario escucha. Densidad baja,
mucho acompañamiento, y un **sub-registro cálido** (serifa + tinta crema, heredado de la dirección C)
en todo lo que se lee para *entender*. No es una segunda app: es el mismo sistema con otro papel y
otra voz. Las cifras medidas siguen en mono y en fósforo, también ahí.

**Crear** — nadie lleva de la mano. Densidad alta, todo el FM a la vez, y la vista de
**los ocho operadores** como superficie principal. Es el modo que se va a usar más horas.

No son dos temas ni dos navegaciones paralelas: son dos densidades de acompañamiento, y se entra y
se sale por un botón visible en la barra (`IR A CREAR →` / `IR A APRENDER →`).

---

## Las pantallas de la ronda 3

### Los ocho — la coreografía del patch

La más importante. Un operador FM-X tiene 43 parámetros y la principal enseña tres; el editor
completo enseña uno. Esta pantalla enseña **cinco hechos de los ocho a la vez** y, sobre todo, la
**comparación**.

- **Las ocho AEG sobre un mismo par de ejes.** El operador en foco a `--curve-focus-stroke` con sus
  puntos arrastrables; los otros siete a `--curve-ghost-stroke` y `--curve-ghost-alpha`, en el color
  de su rol. Los que están a 0 son una línea discontinua sobre el cero — presentes, no borrados. De
  un vistazo se ve quién ataca antes y quién muere primero, que es lo que hace que suene a campana.
- **El nombre va escrito sobre la curva**, en su meseta. No hay leyenda que casar ni tooltip: con
  dedo no existe el «por encima».
- **Agrupados por el papel que da el algoritmo**, no por número: PORTADORAS · SUENAN /
  MODULADORES · COLOREAN / A CERO · CORTAN, cada grupo con su marco y su cuenta.
- **Cinco hechos por operador**, en una tarjeta de `--op-strip-w`: ratio, Level (columna luminosa
  arrastrable de `--op-level-col-w`), Freq Mode, la forma espectral **dibujada**, y su propia AEG en
  miniatura. El resto de los 43 vive en el editor del operador — esta pantalla no es su sustituto.
- **Conmutador de eje de comparación**: AEG · NIVEL / PEG · FORM/FREQ / ESPECTRO POR OP. La misma
  superficie sirve para las tres comparaciones que importan.

La trampa de la hoja de cálculo se esquiva así: **ninguna celda con número suelto**. Todo valor
viene con su forma — altura de columna, posición en una curva, o dibujo del espectro.

### La Part — lo que hay entre el FM y tus oídos

Su función principal **es avisar**, no mezclar.

- **La cadena como cinta horizontal**: OPERADORES → FILTRO → INSERT A/B → EQ → SENDS → MAIN L/R.
  Una etapa transparente se **dibuja recta** y con contorno discontinuo; una que interviene se dibuja
  **con su forma** y en `--chain-dirty`. La forma dice el estado antes que el color.
- **Sello de cadena**: `CADENA LIMPIA` (filtro en Thru, sends a 0, inserts fuera, EQ plano) o
  `CADENA SUCIA · NO ESTÁS MIDIENDO FM PURO` en la barra, con un botón `LIMPIAR LA CADENA` al lado.
  El sello viaja a la pantalla principal como chip pequeño, y **el panel de teoría contra medición
  lo lee**: con la cadena sucia, el error de n=2 se atribuye al filtro y no al análisis (1.8 dB
  sucio vs 0.4 dB limpio, en la misma medida).
- **El filtro se edita dibujando su respuesta**: curva de 620×210 con el corte y la resonancia como
  puntos arrastrables de `--grip-curve`, la línea de Thru como referencia plana discontinua en
  fósforo («plano = FM puro»), y los tipos como **chips dibujados** de `--hit-chip`, no un
  desplegable de 19.
- **FEG, 2.º LFO, nota y velocidad** completan lo que puede ensuciar una medida: la FEG mueve el
  corte en el tiempo, el Amp Mod hace respirar la amplitud (una medida sale distinta según cuándo
  dispares), y los límites de nota y velocidad se dibujan **sobre un teclado y una cuña**, no como
  cuatro campos.

### Copias — y la resta entre dos

Los snapshots que el aviso de «voy a pisar tu patch» promete, con su sitio.

- **Lista con procedencia y antigiüedad**: `ANTES DE QUE LA APP TOCARA NADA`, `INIT`,
  `PASO n · LECCIÓN m`, `A MANO`. Cada uno dice su forma (bulk de 7 669 B, o 416 parámetros) porque
  no restauran igual.
- **Restaurar es un toque**, sin diálogo: es un solo mensaje y 20 ms. Pero **un toque, no dos**, y lo
  que estabas usando se guarda antes — nada destructivo pasa por un doble toque.
- **La resta entre dos es la pantalla más valiosa del proyecto**, y está diseñada como lo que es: el
  **guion de una lección**. 14 parámetros cambiados se agrupan en **cinco cosas que entender**, cada
  una con su número de paso, su frase en lenguaje humano («OP3 · el modulador que da la campana») y
  su evidencia dibujada — barras de delta, la envolvente antes y después superpuestas, el espectro
  de la forma nueva. Un botón `CONVERTIR EN LECCIÓN DE 5 PASOS` cierra el círculo.
- Los 402 parámetros idénticos **no se listan**. Y el grupo que no es FM (el filtro que se coló, el
  Amp Mod) se marca en alerta y se puede **excluir de la lección**: es ruido de la sesión.

### El índice del tutor

El nivel que faltaba encima de los pasos. Nueve lecciones como un **camino con espina dorsal**, no
una rejilla de tarjetas: hechas con marca, la actual abierta con sus cinco pasos visibles y su
botón `SEGUIR EN EL PASO 3`, las siguientes cerradas con su cuenta. Aquí vive el sub-registro
cálido, y la columna derecha explica de dónde salen las lecciones que aún no están escritas: de
restar dos copias.

---

## El rebalance de la principal — hecho, con una matización

Tienes razón en el diagnóstico y he dibujado la alternativa. El waterfall baja de **194 px siempre**
a **156 px compartidos** con el scope en un panel con pestañas de `--hit-tab`. Con lo que se libera:

- El **diagrama pasa de 556 a 700 px**. Nodos de `--op-node-w` × `--op-node-h` (118×108), que ya
  admiten **la forma espectral dibujada y el Hz real** de cada operador, no sólo el ratio nominal.
- Los **armónicos dejan de ser una miniatura** y pasan a panel permanente, con la curva de Bessel
  superpuesta encima de las barras medidas. Es la vista que de verdad enseña qué está pasando, y
  ahora está al lado del espectro, que es su contexto.

**Dónde te matizo**: era la vista menos accionable, no la menos valiosa — es la única que ve el
tiempo. Así que comparte espacio pero **es la pestaña por defecto en cuanto hay una nota sonando**:
el scope se pide, el waterfall aparece. Lo que se pierde es la comparación scope↔waterfall
simultánea, y no la echo de menos: son la misma señal en dos dominios, no dos cosas que cruzar.

---

## Lo que me ha costado encajar

Lo pediste explícitamente, así que aquí va sin adornos.

1. **Los ocho operadores es la que va justa.** Ocho AEG legibles necesitan ~400 px de alto, y ocho
  tarjetas con cinco hechos necesitan ~300. Suma 700 de los 740 útiles. Entra con dignidad, pero
  **no cabe una novena cosa** en esa pantalla: si más adelante quieres el espectro por operador ahí
  mismo, tiene que ser el conmutador de eje, no un panel nuevo.
2. **La Part es la que más he tenido que priorizar.** El bloque de Part tiene 86 offsets; en pantalla
  hay filtro, FEG, 2.º LFO, EQ, sends, inserts y límites. Han entrado como **dibujo** los que pueden
  ensuciar una medida, y como **estado en la cinta** los que sólo hay que saber si están o no.
  Arpeggio, Motion Seq, Part LFO, Control Assign y Receive SW **no están**: no afectan a lo que se
  mide y meterlos convierte la pantalla en un panel de administración.
3. **El diff cabe con cinco grupos, no con quince.** Una resta init→sonido real puede tener 60
  parámetros. El diseño agrupa por concepto y **se dobla en scroll a partir de cinco grupos**; no
  hay versión de esto que quepa entera en una pantalla, y he preferido que los cinco primeros se
  lean con gusto a que quepan todos apretados.

---

## Lo que dejo para la ronda 4, y por qué

Dos de las seis pantallas que pedías **no están**, a propósito, y no por falta de tiempo:

- **La demostración A/B de un parámetro** (§2.4)
- **Conexión, ajustes y el chequeo de arranque** (§2.6)

Las dos son **secuencias en el tiempo**, no composiciones: un A/B es «esto, luego esto, en bucle, y
mira la diferencia», y un chequeo es «cuatro pruebas que se ven pasar y una que falla diciendo qué
hacer». Dibujar un fotograma de cada una es fácil y es exactamente lo que las haría malas: lo que
hay que diseñar es **qué estados tienen y cómo se pasa de uno a otro**, y eso merece una ronda con
sus fotogramas puestos en fila. Las otras cuatro de esta ronda son pantallas estáticas y por eso
salen bien de una vez.

Además comparten una pieza que aún no existe en el sistema: **el reproductor de la app tocando** (la
app manda note-on, sostiene, mide, suelta). Ese control aparece en el A/B, en el chequeo de audio y
en cualquier barrido de parámetro; conviene diseñarlo una vez y bien, no tres veces de refilón.

---

## Datos provisionales — marcados, no colados

> **Superado.** Esta sección se escribió cuando sólo estaba `modx.md`. Las tres fuentes ya llegaron:
> ver **«Procedencia de los datos»** más abajo, que la sustituye. Se conserva como registro de qué
> se inventó y por qué.

En este proyecto de diseño **sólo está `modx.md`**. `datalist_fmx_tables.md`,
`rm_pantallas_fmx.md` y `fase0c_RESULTS_mapa.md` no llegaron, así que todo sale del maestro (que los
resume con cifras). Lo que he tenido que inventar, y que hay que verificar antes de implementar:

- **Los nombres de los 19 tipos de filtro.** En pantalla hay siete (`LPF12+HPF12`, `LPF24D`, `LPF18`,
  `HPF12`, `BPF12D`, `BEF12`, `Thru`) y un chip que dice `+12 más · nombres provisionales`. Del
  maestro sólo consta que son **19 y que el default es Thru**.
- **Los offsets del EQ de 3 bandas y de los inserts.** El maestro dice que el bloque de filtro vive
  en `48 0p` y que Routing (Ins A/B, EQ) existe como página, pero no da direcciones. En pantalla
  aparecen como **estado** (plano / Thru), sin dirección escrita.
- **Los valores concretos del ejemplo sucio**: corte 8 400 Hz, resonancia 42, FEG +52,
  2.º LFO Amp Mod 18, límites C1–C6 y velocidad 22–115. Son **plausibles, no medidos**. Sí está
medido lo que los rodea: 2.º LFO Speed default 30 (`48 00 48`), y que los sends viven en
  `31 00 29/2A/2C`.
- **Los tiempos de las ocho AEG** de la vista de comparación, y el reparto de operadores del patch
  de ejemplo más allá de los cuatro medidos (Op1 99, Op2 0, Op3 90 ×1.41, Op4 99). Op5–Op8 son
  **invención verosímil** para que haya algo que comparar.
- **El contenido de las nueve lecciones.** Los títulos y su orden salen de los conceptos del maestro
  (un operador → dos → ratios enteros → no enteros → envolvente del modulador → Spectral Form →
  Bessel → Level Scaling → ocho), pero **el curso no está escrito**: el maestro lo deja sin decidir.

Lo que **sí** es medido y he respetado al pie de la letra: ratio 1.4103 contra 1.41 en pantalla,
fc 261.763 / fm 369.175 ±0.005, 11 parciales, I = 2.81, el comb de 2756.25 Hz como artefacto,
el bulk `0E 25 00` de 7 669 B, los 416 parámetros del snapshot, `48 00 4F` para el algoritmo,
`48 0p 50` para el feedback, y la trampa de `Receive Bulk` en Protect.

---

## Procedencia de los datos — tras recibir las tres fuentes

Ya están en el proyecto `modx.md`, `datalist_fmx_tables.md`, `rm_pantallas_fmx.md` y
`fase0c_RESULTS_mapa.md`. Con ellos **casi todo lo que estaba marcado como provisional queda
resuelto**, y aparecieron **tres errores de dato míos** que ya están corregidos en los mockups:

1. **Spectral Skirt es 0-7, no 0-99** (`49 op 0A`). Los mockups decían `sk 38`, imposible. Ahora
   `sk 5`. Consecuencia de diseño: el control de Skirt **no es un mando continuo** — son ocho
   posiciones, y se dibuja como ocho anchos de falda, no como un arco de 0 a 99.
2. **El Cutoff del filtro es 0-255 en dos bytes** (`48 0p 0C`), no hercios. Y la Resonance es 0-127
   (`0F`). Los mockups decían `8 400 Hz`; ahora `CORTE 178 · RES 42 / 127`. El eje de la curva sigue
   siendo frecuencia — es una respuesta — pero **la cifra del control es el parámetro, no el Hz**.
3. **El nivel de la FEG es bipolar en cents**, ±128 → ±9 600 ¢ (`1C`,`1E`,`20`,`22`,`24`, dos bytes).
   Ahora se rotula `+52 · +3 931 ¢`, que es lo que de verdad le hace al espectro.

Lo que **ya no es provisional** y está escrito en pantalla:

- **Los 19 tipos de filtro tienen nombre oficial** y default `15` = Thru. En pantalla hay nueve
  reales y un chip honesto con los diez que faltan.
- **El EQ de Part vive en `31 0p 27`-`2E`** y los sends en `29`/`2A`/`2C`. Escrito en la cinta.
- **El 2.º LFO es `48 0p 47`-`4E`** (Wave, Speed, Phase, Delay, Key On Reset, y profundidades de
  Pitch/Amp/Filter Mod). Antes puse sólo `48`, que es el Speed.
- **La FEG entera es `48 0p 17`-`2C`**, y el filtro `0B`-`16`.
- **Las rutas de menú reales**: `[Pitch/Filter]` → `[Filter Type]` / `[Filter EG]` para el filtro,
  `[Part Settings]` → `[Algorithm]` para el algoritmo **y el feedback**, y
  `[UTILITY]` → `[Settings]` → `[Advanced]` para `Receive Bulk`. Van en los paneles de «dónde mirar
  en el teclado», que ahora no adivinan.

Lo que **sigue siendo invención verosímil**, y ahora es la lista corta:

- Los valores del ejemplo sucio (corte 178, res 42, FEG +52, Amp Mod 18, C1–C6, vel 22–115) y los
  tiempos de las ocho AEG. Están **dentro de los rangos documentados**, que antes no podía
  garantizar.
- Op5–Op8 del patch de ejemplo. Medidos siguen siendo sólo Op1 99, Op2 0, Op3 90 ×1.41, Op4 99.
- **El contenido de las nueve lecciones.** El maestro deja el curso sin decidir; los títulos siguen
  el orden conceptual de las fuentes.

Una advertencia que sale de `fase0c` y que el diseño debe respetar: **el mapa de `al` sólo está
verificado semánticamente en el Op3**; fuera de él sólo `1A`, `06` y `17`. La vista de los ocho
trata a los ocho operadores como iguales — estructuralmente lo son (43 offsets idénticos), pero si
algún operador se comportara distinto, es esa pantalla la que lo haría visible primero.

Y una pieza de interfaz que las fuentes revelan que falta: **el botón de pánico**. La prueba de
carga de la fase 0c dejó notas colgadas sonando, y la herramienta tiene ya un subcomando `panic`
(All Sound Off + All Notes Off + 2048 Note Off). En cuanto la app toque notas, eso es un control
visible y permanente, no un menú. Va con el reproductor, en la ronda 4.

---

## Las piezas de la ronda 4

### El reproductor — no toca un archivo, toca un instrumento que está en la habitación

`4c`. La pieza que el A/B, el chequeo de audio y cualquier barrido comparten. **Siete estados en
fila**, porque es una secuencia y no un fotograma:

1. **Reposo** — nadie toca, el teclado es del dueño. Triángulo hueco en `--inert`.
2. **Armado** — el parámetro está escrito **y verificado releyendo**. Aún no suena.
3. **Sosteniendo** — hay una nota viva puesta por la app. Es el estado que late.
4. **Midiendo** — el obturador, sobre la nota sostenida. FFT 65536.
5. **Soltando** — note-off enviado, pero **la cola de la AEG sigue sonando** (~460 ms). Estado
   propio porque el waterfall lo está viendo.
6. **En bucle** — vuelve al 2 con el otro valor. `--play-hold` de sostén, `--play-gap` de pausa.
7. **Fallido** — la escritura no volvió al releer. **Se suelta la nota primero y se avisa después.**

**Qué se va a tocar, sin formulario**: la nota se toca en un **teclado dibujado** y la velocidad se
arrastra en una **cuña**. Ni un campo numérico. La referencia de los spikes es C4 sostenida.

**Quién está tocando** — esto es la parte que no es obvia. `Local Control` sigue en on, así que el
teclado suena por su cuenta mientras la app le escribe, y el dueño puede estar tocando a la vez.
Tres estados con color propio: `TOCA LA APP` en `--who-app` (cian, y el chip vive en la cabecera),
`TOCAS TÚ` en `--who-hands` (fósforo, como toda señal que entra), y **«hay una nota mía viva y no
debería»** en alerta — el único estado que enciende el pánico por su cuenta.

**Mirar ≠ medir sigue vigente**: el reproductor alimenta las dos, pero mientras sostiene la vista
viva corre a 30 fps y la medida es el obturador del paso 4, deliberado y con su sello.

### El pánico

`4d`. Detalle completo en `CONCERNS.md` §3. Para el implementador, lo que no se negocia:
`--hit-panic` (56 px) en **el extremo derecho de toda cabecera**, `--shape-panic` (el único octógono
de la app), `--gap-isolate` (16 px) de aire y un filete de 2 px a su izquierda, tres estados (hueco
/ relleno con glow cuando hay nota viva / verde 1,5 s tras pulsarlo), **sin confirmación**, actúa al
levantar el dedo dentro, y **no toca ni un parámetro**.

### Conexión y chequeo — dos caras

`4e`. **La secuencia** corre al arrancar y cuando algo se rompe: seis comprobaciones **ordenadas de
más grave a menos**, las que pasan colapsadas a una línea con su cifra medida, y la que falla al
final, grande, con la **ruta de menú entera dentro** (`[UTILITY]` → `[Settings]` → `[Advanced]` →
`Receive Bulk` = `On`).

Cada comprobación lleva su dato real: puerto `MODX-1`; latencia mediana **2,0 ms** (peor caso 22,6,
timeout 100); **0 perdidas de 24 320**; audio `Line (MODX)` 2 ch / 44 100 con pico −18 dBFS y suelo
−104; y cadena limpia 4 de 4.

**El reposo** es un **chip en la cabecera** — el que ya existía. Sin panel de estado permanente:
seis luces verdes ocupando sitio no informan de nada. Cuando algo falla, el chip **dice la
consecuencia y no el fallo**, y tocarlo abre la pantalla.

**Orden de gravedad, que es criterio de diseño**: sin puerto MIDI la app no hace nada (la única que
bloquea); sin audio funciona a medias (el diagrama sirve, las vistas de señal no); con `Receive
Bulk` en Protect funciona todo **menos devolverte tu patch** — el peor, porque no se nota hasta que
quieres volver atrás; y cadena sucia no es un fallo, es un aviso.

**Ningún fallo dice «error».** Todos dicen qué hacer.

### El A/B — es un modo, no una pantalla

`4b`. La decisión y su defensa están en `CONCERNS.md` §8. Reglas de lectura para implementarlo:

- **A y B por relleno, no por color** (`--ab-a-ink` hueco y apagado, `--ab-b-ink` sólido y
  luminoso). El discontinuo sigue siendo de la teoría, y aquí hay **dos** teorías, una por índice.
- **La diferencia se rotula**, no se deduce: «la fundamental pierde 14 dB», «el 9.º gana 31 dB».
- **La columna dice lo que NO cambia** — fc, fm, ratio, nota y velocidad idénticos — porque eso es
  lo que hace válida la comparación.
- **Las dos son medidas**, con su badge de 65536 y su antigüedad. Nunca una medida contra una
  estimación.
- `CONGELAR Y GUARDAR` como paso de lección: un A/B bueno **es** un paso de lección.

---

## Las pantallas de la ronda 5

### El editor de operador (`5a`) — donde se vive en modo crear

Se abre al tocar un operador desde `3a` o desde el diagrama. Cuatro decisiones, en orden de
dificultad:

**1. El contexto, que era la decisión interesante.** Descarté el diagrama de ocho nodos (no cabe
junto a dos envolventes) y la miga de pan (`Part 1 › OP3` pierde la topología, que es justo lo que
importa). Lo que hay es **tu rama y sólo tu rama**: quién te modula, tú, y a quién modulas, con las
flechas del algoritmo real y el resto reducido a una nota. Más el **rail de los ocho** en la
cabecera —ocho objetivos de 32 px con su forma de rol (píldora = portadora, esquina viva =
modulador, discontinuo = a cero)— que es **contexto y navegación a la vez**.

**2. Jerarquía en la composición, no en pestañas.** Lo que se toca cada minuto se lleva el 78 % del
alto: Level como mando de 190 px con el valor en el centro, las **dos envolventes a lo ancho** con
puntos de `--grip-curve`, y la forma espectral como siete dibujos. Lo que se pone una vez vive en
una **franja inferior de 172 px con su rótulo diciéndolo** (`SE PONE UNA VEZ Y SE OLVIDA`): Level
Scaling sobre el teclado, el bipolar de Detune, y cuatro chips para Time/Key, Lvl/Vel, Pitch/Vel y
Key On Reset. **Presentes y tocables, pequeños porque lo son** — cero pestañas.

**3. El dedo tapa lo que arrastra.** El valor del punto activo sale en una pastilla **arriba y al
lado**, nunca bajo el punto; el del mando vive en su centro. Escrito en la propia pantalla para que
no se pierda al implementar.

**4. Skirt aparece apagado, no ausente**, porque la forma es Odd 1 y sólo Res 1/Res 2 lo habilitan.
Y son **ocho barras de anchura creciente**, no un mando: el rango es 0-7.

> **Regla que esto obliga a escribir, y que vale para toda la app: un control deshabilitado NO se
> apaga con `opacity` de contenedor.** Se dibuja con el mismo vocabulario que el resto de lo
> inactivo — **contorno discontinuo + `--inert`, a opacidad plena** — y su texto explicativo se queda
> en `--ink-tertiary` o mejor. La opacidad de contenedor multiplica a todos los descendientes y se
> lleva por delante la prosa, que es documentación y no estado: un rótulo de 11 px a 0.45 baja de
> 2:1 de contraste y deja de leerse. Lo inactivo tiene que verse inactivo **y seguir leyéndose**.
> La opacidad fraccionaria sólo es legítima en **trazos de señal** (las trayectorias fuera de foco
> de `5b`, las curvas fantasma de `3a`), donde no hay texto dentro.

**El aviso de Freq Mode** es didáctico y no de error: con Fixed, Coarse y Fine **no cambian de valor,
cambian de significado** — de múltiplo a hercios — y el teclado además **moverá el Coarse**. Medido
en la fase 0c.

**La trampa esquivada**: en `3a` era la hoja de cálculo; aquí es la columna de propiedades. No hay
ni una lista de `etiqueta: campo` en toda la pantalla.

### El barrido (`5b`) — las funciones de Bessel, medidas

El resultado del `BARRER 0→99 en 8 pasos` de `4b`.

- **El eje es la trayectoria por armónico**, no el espectro por paso: ocho curvas (n0…n7) con
  x = Level 0→99 e y = amplitud, cruzando el cero. Y la consecuencia que lo hace redondo: esas
  trayectorias **son** las funciones de Bessel, así que `|J_n(I)|` va **superpuesta sobre la misma
  curva** en `--theory` discontinuo, no al lado.
- **Ocho espectros no se leen a la vez, y no se intenta**: hay una **línea vertical arrastrable** que
  saca el espectro de un paso al panel derecho. Del mapa se baja al detalle cuando hace falta.
- **El momento que enseña**: en Level ≈ 77 la fundamental **se anula** (primer cero de J₀ en
  I ≈ 2.405). Se encierra en `--alert` y se explica, igual que en el panel de armónicos: *no es un
  fallo de medida, es la lección*.
- **El estado «corriendo» es parte del atractivo**: ocho tarjetas, las hechas en fósforo, la que corre
  **ensanchada y latiendo** con su subfase dentro (escribir ✓ / verificar ✓ / sostener / medir /
  soltar / pausa), y el tiempo restante.
- **Si se cancela a mitad**: los pasos medidos **se quedan** y el mapa se dibuja con ellos marcado
  como incompleto, se puede reanudar, y **el Level vuelve a donde estaba** — el barrido guarda copia
  antes del primer paso.

### La consola SysEx (`5c`) — un cajón, no una pantalla

Se abre desde un chip en la cabecera y **se despliega sobre la franja inferior sin sustituir la
pantalla de detrás**: hay que ver la verificación mientras pasa, porque si no, no se ve la causa.

- **Por defecto no es un log**: abre con las **escrituras sin confirmar**, cada una con la frase
  humana, los bytes que se mandaron, lo que devolvió el teclado y su `REPARAR Y VERIFICAR`.
- **El tráfico completo es la segunda pestaña**, nunca lo primero.
- **Tres cifras estables** y nada más: mediana, p99, perdidas. Sin contadores vivos ni gráficas.
- **Anota cada reparación con quién pisó a quién** (`48 00 52` → `48 00 48`), que es donde
  aparecerían los pares que falten.
- **El chip de la cabecera sólo llama cuando hay algo**: neutro si no hay nada pendiente, en alerta
  con la cuenta si sí.
- **La propina didáctica**: los once bytes **descompuestos y etiquetados** (`F0` inicio · `43`
  Yamaha · `10` escribir · `7F` a todos · `1C 07` MODX · `49` operador · `20` op3·part1 · `1A`
  Level · `5A` = 90 · `F7` fin) al lado de «OP3 · Level = 90». Es la única lección de la app que
  enseña **cómo habla** con el teclado.
- **Lo que NO es**: el sitio de `Receive Bulk`. Eso es un fallo con consecuencia y vive en `4e`.
  Aquí sólo lo que se repara de un toque.

---

## Las pantallas de la ronda 6

El punto de partida es un cero medido dos veces: **cargar otra Performance no emite un solo byte** —
ni Program Change, ni Bank Select, ni SysEx, con los dos interruptores en `ON`, en modo crudo y con el
nombre de la Part verificado dentro de la ventana. La app no tiene evento. Sondea el nombre de la
Part 1 (`31 00 00`–`13`, 20 direcciones ASCII, ~40 ms) a **1 Hz** y de ahí sale todo lo demás.

### El ancla (`6a`) — el nombre de la Performance, ascendido a dato

**No es mobiliario nuevo.** El nombre del patch ya estaba en la cabecera; lo que cambia es que ahora
lleva su procedencia (`ANCLA · 1 Hz · 31 00 00`) y peso deliberadamente bajo: 17 px de tinta primaria
y el sello en 8 px. Si el ancla no estuviera visible en reposo, el aviso del cambio llegaría sin nada
a lo que agarrarse.

**Tres estados**, y ninguno es un diálogo:

1. **Reposo** — nombre estable, sello discreto. No compite con el algoritmo ni con el transporte.
2. **Acaba de cambiar** — nombre nuevo **con el viejo tachado al lado** (para que se entienda qué
   pasó), el destello de 2 200 ms que ya se usa cuando el tutor escribe, y **todo lo sondeado puesto a
   raya**: algoritmo, feedback, cadena.
3. **Releído** — la cabecera **no vuelve al reposo**: se queda con `SIN MEDIR EN ESTE SONIDO`, porque
   el sondeo se recupera solo y la medida no.

Tocar el ancla abre el chequeo (`4e`), y ahí es donde viven las cifras que son **propiedad del sonido
cargado**: `TEMPO 90 BPM · fondo 40 msg/s` y el sondeo efectivo de 12,22 Hz. El tempo va aquí y no en
el badge — ver `CONCERNS.md` §22.

### El momento del cambio (`6b`) — qué muere y qué no

La regla que ordena la pantalla, y es la decisión de diseño de toda la ronda:

- **Muere el mapa** (sondeado): los ocho operadores, el algoritmo, la cadena. Un operador pendiente
  **conserva su forma y pierde su cifra** — contorno neutro y una raya. Nada se apaga con opacidad.
- **Muere la medida**: era de otro sonido. Y **no se recupera sola**, porque nadie puede volver a
  medir sin que suene una nota. La columna de cifras no muestra ceros: muestra rayas y
  `hay que volver a medir`, con su botón.
- **La vista viva no muere nunca.** Es audio que entra ahora mismo. Scope y espectro siguen en fósforo
  con su chip `ESTO NO HA MUERTO · ES AUDIO`. Lo que desaparece del espectro es **la curva de Bessel**:
  no hay I hasta que haya medida.

Tres cosas que **no** se hacen: los números no se sustituyen sin más (un 90 que salta a 64 sin pasar
por la raya es indistinguible de un valor que el usuario cambió a mano); no hay botón de «releer» (la
app ya sabe que tiene que releer; la cuenta se muestra porque cuesta ~0,9 s, no porque haya que
decidir); y no bloquea, porque no había nada en curso.

El waterfall **se queda con el corte dibujado** en cian discontinuo: arriba, otro sonido.

### El caso feo (`6c`) — invalidado, no pausado

**Bloqueante con estado vivo, no bloqueante sin él** — y bloqueante significa que el aviso se ancla a
la cosa que se rompió y le quita sus acciones, no que un modal se apropie de la pantalla. Defensa
completa en `CONCERNS.md` §19.

La asimetría que manda en las cuatro salidas: **la app puede escribir parámetros pero no puede cargar
Performances**, así que la recuperación nunca es «lo arreglo yo».

- **Barrido** — el mapa se dibuja con una **vertical de corte** en alerta y la etiqueta
  `AQUÍ CAMBIÓ EL SONIDO`; los pasos 6–8 son una línea inerte discontinua. **No hay «reanudar»**: tres
  salidas — quedarme con los 5 marcados de otro sonido, empezar de cero (~25 s), descartar. Y el Level
  ya volvió a donde estaba, porque el barrido guardó copia antes del primer paso.
- **A/B** — A y B ya no son el mismo patch con un parámetro distinto, que era la premisa entera. La
  primera acción **no es descartar**: repetir A cuesta una escritura y una vuelta del reproductor,
  ~3 s.
- **Lección** — los pasos hechos describen un sonido que no está cargado, y esto la app no lo puede
  arreglar. Así que dice **exactamente lo que sólo él puede hacer**, con la ruta literal
  (`[PERFORMANCE] → [Category Search] → Init Normal (FM-X)`), igual que todos los arreglos que viven en
  el teclado. Y en cuanto el ancla lo vea, la lección sigue donde estaba.
- **Copias** — los snapshots llevan ahora **procedencia de Performance**. Los de otro sonido no se
  desactivan: **su botón cambia de texto** — `RESTAURAR AQUÍ · PISARÍA CFX + FM EP 2`. Desactivarlo
  sería esconder la única salida que hay si de verdad quieres ese patch de vuelta.

### Sólo lectura (`6d`) — el tercer modo de fallo de la consola

`30 4B 00` (el Super Knob) se lee, emite y **no acepta escritura**: se le escribió `20` y `60`, y
volvió `3F` las dos veces, sin error. Sobre una dirección así, `REPARAR Y VERIFICAR` es un botón que
promete algo imposible y una app que reintente sola es un bucle.

- **Estado propio**, en **ámbar discontinuo y no en alerta**: no está roto, es que no se puede — el
  mismo registro que el aviso de Freq Mode. Y se dice con la frase honesta: *se mira, no se toca*.
- **Se alcanza por experiencia, no por catálogo**, porque el Data List no las marca y **al teclado no
  se le puede preguntar**: las reservadas contestan a una lectura igual que las reales. Así que la app
  **lo aprende y lo escribe**: `LO QUE LA APP HA APRENDIDO`, con la dirección, la frase, los intentos y
  el día. Dos intentos y para. La arista de conservar esa lista entre sesiones está en
  `CONCERNS.md` §21.
- **Y las reservadas del papel** (`48 0p 51–55`) van escritas al lado, marcadas como lo que son: una
  lista que viene del documento y no del instrumento.
- **Vocabulario del control observable**: si el Super Knob aparece en pantalla es el mando de siempre
  **sin marca de agarre**. El arco y la cifra siguen (el valor es verdad y llega solo); lo que falta es
  la manija, y su ausencia **es** el estado. Chip `EMITE · NO ACEPTA`.
- Y es **la única cosa que el MODX notifica**: con `Super Knob CC = off`, 635 SysEx en 25 s. El emisor
  de Parameter Change existe y funciona — el cero del cambio de Performance no es una limitación del
  teclado, es una decisión de Yamaha. Cambia la explicación, no la arquitectura.

### Grados de confianza (`6e`) — una medida por paso

Una medida por paso (~25 s los ocho) y **una segunda pasada sólo sobre los dudosos**. El mapa se dibuja
**completo**: un punto dudoso no es un hueco, es un **círculo hueco con halo discontinuo** en el mismo
ámbar de la teoría, **y está en la curva**. Cuándo sale dudoso es un cálculo (parcial a menos de 12 dB
del suelo, o a menos de un paso de un cero de la `|Jₙ|` ajustada), no un umbral que el usuario ponga.
El punto afinado muestra `×3 PROMEDIADAS` **y su dispersión** (`−43.8 ±0.6`): sin la dispersión, tres
medidas promediadas son igual de opacas que una.

---

## Las piezas de la ronda 7

**Sin pantalla nueva, a propósito.** El seguimiento es comportamiento, no superficie: vive en el rail
del editor (`7a`) y en las tarjetas de los ocho (`7b`).

### El hecho, y por qué sale gratis

El teclado **no notifica nada de navegación** (fase 0d, punto 2, verificado en crudo): cambiar de
operador en foco, de página o de Part no emite un byte. Pero el conjunto de vigilancia que ya se
sondea son **40 direcciones — cinco parámetros por los ocho operadores** a 12,2 Hz. Si en una ronda se
mueve `49 60 1A`, la app no sabe que estás mirando el OP7: sabe que **acabas de tocar algo del OP7**,
que para lo que importa es mejor. El seguimiento no cuesta ni una petición más.

### El rail que te sigue (`7a`)

- **Conmutador `TE SIGO`**, con el dibujo de lo que hace (una tecla, una flecha y el punto del rail),
  en fósforo porque seguir es leer señal que entra. En reposo **no dice nada más**: sin contador.
- **Sugerencia, no salto.** El rail marca el operador con actividad (anillo de fósforo que late) y una
  banda ofrece `IR AL OP7` / `SIGO AQUÍ`, ambos de 44 px. El motivo no es la reversibilidad —el rail ya
  la da— es que **el gesto no se puede interrumpir**: un salto de foco a mitad de un arrastre de la AEG
  rompe la curva a medias.
- **La frase no promete lo que no se puede saber**: nunca «estás en el OP7», siempre «acabas de tocar
  algo del OP7», con la dirección y el valor viejo → nuevo. **Sólo detecta cambios, no visitas.**
- **Lo suyo no lo cuenta como tuyo**: un cambio que coincide con una escritura propia pendiente de
  releer no es del usuario — el ciclo *pendiente → releída → confirmada* ya lo distingue. Cuando el
  tutor escribe, el foco **no se mueve**.
- **Una sugerencia por vez, la última**, y se va sola a los 6 s. Cinco cambios en cinco operadores son
  una banda y cinco marcas en el rail, no cinco avisos.

### Los ocho como espejo (`7b`)

Aquí el seguimiento **no mueve el foco** —los ocho ya están en pantalla— así que **deja rastro**: cada
tarjeta dice qué tocaste, de qué a qué y hace cuánto (`LEVEL 56 → 71 · HACE 0.3 s`), y en la columna de
Level el valor viejo queda como **marca discontinua**. No es un historial: es el último gesto. Las
demás dicen `SIN CAMBIOS TUYOS`, que es información y no hueco.

**La procedencia del cambio usa el vocabulario que ya existe**: fósforo lo que entra de fuera (tus
manos, como toda señal medida), cian lo que escribió la app (`LO ESCRIBIÓ EL TUTOR · 3 min`). Ni un
color nuevo, y se lee sin leyenda. Este es el modo crear en su forma más pura: el usuario hace el
sonido a mano y **la app es el espejo**.

### Los dos anillos — y la consecuencia que se dice

Para saber dónde están las manos hay que vigilar los ocho; para que el operador abierto esté al día hay
que vigilar sus 43 parámetros. Son dos conjuntos con dos cadencias, **y comparten canal**: los 12,2 Hz
del anillo ancho bajan a ~6 Hz con un operador abierto. Así que **abrir un operador ralentiza el
seguimiento**, y eso se dice.

- `CADUCO` es **cuatro veces el periodo de su propio anillo**: 0,33 s el ancho, 0,66 s el estrecho.
- La cadencia se rotula **una vez por zona, en su cabecera** (`LOS OCHO · 12.2 Hz`), no en cada cifra.
- **Sin badge nuevo.** Meterle un segundo sello a cada número sería lo que ya se rechazó para el tempo.

---

## Interacción: dedo y ratón

**Táctil como base, ratón como superconjunto.** Un solo diseño para los dos punteros; no hay «modo
táctil» ni «modo escritorio» que mantener por separado. La mano izquierda está en el MODX.

1. **Objetivos**: mínimo `--hit-min` 44 px reales para cualquier cosa accionable; `--hit-touch`
   56 px en los controles que se usan tocando a menudo; separación mínima `--hit-gap` 8 px. Los
   operadores del diagrama son objetivos de 100×92. En este panel, 44 px CSS ≈ 9 mm físicos: no hay
   que inflar nada.
2. **Nada depende de `:hover`.** Ni para descubrirse, ni para mostrar un valor, ni para revelar un
   control. El patrón «paso por encima del mando y sale el número» está prohibido: el valor está
   **siempre visible** o aparece **al tocar**.
3. **El dedo tapa lo que arrastra.** En mandos, sliders y editores de curva, el valor y el punto
   activo van **arriba y al lado** (`--value-offset`), nunca bajo el punto. El punto de arrastre se
   dibuja a 22 px (`--grip-handle`) con zona de agarre de 44 (`--grip-hit`).
4. **Sin clic derecho como vía única** y **sin gestos ocultos**. Si hay menú contextual o gesto, es
   atajo de algo que ya tiene su botón tocable.
5. **El hover existe, como refinamiento**: resalta, previsualiza o adelanta un desglose que también
   se abre al tocar. Nunca es el portador único de un valor, un control o un estado.
6. **Extras de ratón, siempre capa adicional**: rueda para ±1 en un mando, modificador para paso
   fino ×0.1, doble clic para volver al default, atajos de teclado para MEDIR y para cambiar de
   vista. Quitar el ratón no quita ninguna función.
7. **Sin doble toque para nada destructivo.** Pisar el patch del usuario siempre pasa por el aviso
   con snapshot.

---

## Reglas que un implementador debe respetar

**Vocabulario**
1. Portadora y modulador se distinguen **por forma antes que por color**: `--radius-carrier`
   (curva total) vs `--radius-modulator` (esquina viva). Nunca dos nodos con el mismo radio y
   distinto color.
2. **El Level es la altura del relleno luminoso** dentro del nodo, 0-99 lineal. La cifra en mono es
   confirmación. Level 0 no se pinta gris: contorno discontinuo, sin relleno, y la ruta que sale de
   él también discontinua.
3. Un parámetro continuo **no tiene `input type=number`**. Mando circular (arrastre vertical),
   control bipolar con centro visible (`--track-bipolar`), o punto arrastrable sobre la curva. El
   número se muestra junto al control, nunca en su lugar.
4. **Freq Mode, Spectral Form y Curve se eligen dibujados.** El toggle de Freq Mode es el ejemplar:
   dos dibujos, uno encendido. Spectral Form son siete espectros tocables; Skirt y Resonance
   modifican el dibujo seleccionado en vivo. Ningún `<select>`, ningún tooltip como única etiqueta.
5. Las dos envolventes (PEG `49 op 0C-0F`, AEG `49 op 10-18`) se editan **arrastrando puntos sobre
   la curva**, con la marca de key-off visible. Los tiempos aparecen como etiquetas bajo la curva.
6. Level Scaling es **una curva sobre el teclado**, con el Break Point sobre la tecla y el teclado
   dibujado debajo (escala propia base A-1, no MIDI).

**Honestidad del dato — esto es criterio de aceptación, no estética**
7. Cada cifra lleva su procedencia: `MEDIDO` (fósforo), `TEORÍA` (ámbar y discontinuo),
   `SONDEADO` (cian) o `CADUCO` (contorno roto + segundos). Nunca se mezclan estilos de línea.
8. **Mirar y medir son dos actos con dos controles distintos.** La vista viva late; la medida es un
   obturador que se pulsa y deja un sello con tamaño de FFT y antigüedad. Prohibido un número de
   medida que parpadee solo.
9. Los artefactos (comb de 2756.25 Hz) se **marcan** en el espectro con trazo discontinuo de alerta
   y su badge. No se ocultan y no se cuentan como armónicos.
10. Donde la teoría no cuadra con la medida, se **encierra y se explica** en una frase. Es la
    lección, no un error que tapar.
11. Toda escritura al teclado se muestra **verificada releyendo** (`✓ releído` por parámetro). Una
    escritura sin confirmación se pinta en alerta, no en verde. Y esa verificación tiene un sitio
    donde **se ve ocurrir**: el cajón de `5c`.
12. **Ninguna sonda deja el patch del usuario tocado.** Si una comprobación necesita ensuciar un
    parámetro, el orden no se negocia: copia de seguridad → ensuciar → verificar → probar → **y
    reponer por el camino que sí funcione**, incluso (sobre todo) cuando la prueba falla. Predicar
    contra el fallo silencioso y cometerlo es peor que no predicar.

**Dibujo y rendimiento a DPR 1.5**
12. Señal, diagrama, curvas y rejillas: **vectorial (SVG) o canvas escalado por DPR**. Cero bitmaps
    de tamaño fijo; a 1.5× se emborronan.
13. **Filetes de 1 px prohibidos**: separadores a `--rule-min` 2 px, o mejor separación por color de
    superficie y aire (`--rule-by-space`). En SVG, `vector-effect: non-scaling-stroke` para que la
    traza no engorde al estirar el viewBox.
14. Nada animado compite con la señal: sólo el latido de «mirando» (`--dur-heartbeat`) y el destello
    del aviso «el tutor acaba de escribir en tu teclado». Transiciones de estado ≤ 180 ms.
15. Ninguna operación de UI puede costar más de `--frame-live` (33 ms). Si un panel no cabe en el
    presupuesto, se simplifica el panel.
16. Piso tipográfico `--text-micro` 10 px. La retícula y las etiquetas de eje pueden desaparecer;
    las cifras no.

---

## Lo que decidí **no** hacer

- **No hay panel lateral de ajustes.** Todo parámetro vive junto a la cosa que cambia — dentro del
  nodo o sobre su curva. En cuanto exista una columna de «propiedades», la app es una app de
  oficina. Se aplicó con toda su fuerza en la vista de los ocho: **ninguna celda con número suelto**,
  todo valor con su forma.
- **La vista de los ocho no es el editor del operador.** Cinco hechos por operador, no 43. Cuando
  hace falta el parámetro 12 se abre el editor — tener las dos cosas es lo que evita la rejilla.
- **La Part no tiene Arpeggio, Motion Seq, Part LFO, Control Assign ni Receive SW.** No afectan a lo
  que se mide; el criterio de esa pantalla es «avisar», no «exponer los 86 offsets».
- **No hay editor de EQ ni de inserts.** Aparecen como estado (plano / Thru) porque lo único que
  importa de ellos es si están en medio o no.
- **El diff no es un `git diff`.** Ni columnas, ni ± por línea: grupos con frase humana y evidencia
  dibujada. Los parámetros idénticos no se listan.
- **El sub-registro cálido no entra en superficies de medida.** Serifa y tinta crema sólo en lo que
  se lee para entender; toda cifra medida sigue en mono y fósforo, también dentro de una lección.
- **No hay breakpoint pequeño ni layout empotrado.** Un solo lienzo, 1280×800, y escalado hacia
  arriba. Diseñar para una pantalla a la que no vamos sólo aplanaba decisiones.
- **No he dibujado los 88 algoritmos.** El diagrama es un layout por profundidad de cadena que
  sirve para cualquier topología leída del teclado; dibujar 88 láminas es trabajo de datos.
- **Ni matriz de rutado ni editor de algoritmo.** El algoritmo es un número que se escribe y el
  motor aplica.
- **No hay tema claro.** Una app de audio con un teclado delante no se mira en blanco.
- **Nada de skeuomorfismo de rack**: sin tornillos, sin metal cepillado, sin cuero.
- **Sin iconografía dibujada a mano** más allá de formas primitivas (círculo, rombo, línea, arco).
- **Sin waterfall en 3D.** El ridgeline plano enseña más y la perspectiva miente sobre las
  amplitudes.
- **Sin tooltips como portadores de información.** Con dedo no existen.
- **No he diseñado el corpus DX7 ni la biblioteca de patches.** Está declarado como última fase.

---

## Nota de procedencia

`modx.md` es la fuente de todos los valores, direcciones SysEx y frases técnicas que aparecen en los
mockups. Los tres informes de spike (`fase0_RESULTS.md`, `fase0b_RESULTS_sysex.md`,
`fase0c_RESULTS_mapa.md`) **no están en el proyecto**: todo lo pintado aquí sale del master doc, que
los resume con cifras. Si algún dato de los informes contradice lo que hay en pantalla, manda el
informe.

Las curvas no son decorativas: la forma de onda es `sin(2πt + I·sin(2π·2t))` con I = 2.8, el
espectro son las amplitudes `|J_n(I)|` en `1 ± 1.41n` y `2 ± 7n`, y el waterfall son catorce tramas
con el índice decayendo `I(t) = 2.9·e^(−2t)` — el ataque brillante apagándose.

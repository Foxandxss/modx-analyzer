# ADR-0008: El Level corre por el eje que declara su composición

Fecha: 2026-09-11 · Estado: aceptada · Contexto: #73 (la especificación de la ronda 10), #78, #80,
#81, #82, #83 · Se apoya en ADR-0007 y no la sustituye: de ella retira **una dirección** (§4, el
aparcado a la derecha) y ningún principio · No es un refinamiento: cambia qué eje lleva el Level, y
eso es vocabulario del dibujo, no un ajuste de una cifra

Esta ADR es la **dueña de la lista de verificación** de la ronda (§8). `design_handoff/HANDOFF.md`
y la hoja de sondas `Round10-operator-diagram.dc.html` apuntan aquí y no la repiten; #88 toma las
miradas de aquí y escribe los veredictos aquí.

## 1 · El problema: dos reglas pujando por los mismos píxeles

**La puja, que es el único argumento de esta ADR que no apela al gusto.** En la composición ancha,
en el suelo del cuerpo y en el algoritmo más hondo de los 88, la tarjeta de un operador medía
**23,6 px** de alto. #67 le dio al relleno una pista —el interior de la tarjeta menos un hueco fijo
arriba, para que el techo del patch no cayera dentro del propio borde— y esa pista era **11,6 px**.
Un punto de Level era 0,116 px, y dos operadores a 99 y a 96 se dibujaban a **0,35 px** uno del
otro. Dos reglas cada una correcta por su cuenta —*el techo tiene que verse fuera del borde* y *el
Level es la altura del relleno*— pujando por los mismos 23,6 px, y la que gana deja a la otra con
un tercio de un píxel.

> Geometría de esa cifra, porque toda cifra de esta ADR lleva la suya: `BODY_FLOOR = 378`, lienzo de
> 286 px en el suelo, algoritmo 66 sin nada a cero, la tarjeta a 33 de las 400 unidades de la caja,
> `TRACK_INSET = 8`. Es la geometría en la que se **encontró** el problema; después de #81 el lienzo
> en el suelo es de 282 px y las tres cifras son un poco peores (23,3 · 11,3 · 0,34), no mejores.

**Y en pantalla no era «poco»: era nada.** La hoja de la ronda dibujó las mismas dos tarjetas en el
eje vertical de hoy —99 y 96, misma tarjeta de 302 × 23,6, la de `BODY_FLOOR`— y, leída píxel a
píxel a escala de dispositivo 1, **el relleno de las dos empieza en la misma fila de píxeles**
(`docs/results/2026-09-10-la-barra-horizontal.md`). Un sub-píxel redondea a cero cuando algo lo
dibuja de verdad: el pianista veía dos tarjetas idénticas con dos cifras que difieren en tres
puntos.

**El diagnóstico.** La dirección vertical llevaba dos magnitudes a la vez. **Entre** nodos significa
profundidad en la cadena —una fila es una profundidad, todas las flechas bajan—; **dentro** de un
nodo significaba Level. Nunca fueron números comparables, y todos los síntomas de esa semana son esa
sobrecarga saliendo a la superficie: el techo escondido en el borde de la tarjeta, el listón
achatado, ocho trazos coincidentes que el ojo tenía que unir en una regla, y por fin #67 —un arreglo
correcto de uno de ellos que se lleva un tercio del rango del otro—.

**El hallazgo que convierte esto en reparación y no en preferencia.** El techo del patch **nunca ha
sido una línea a través de los ocho nodos**, en ninguno de los dos dibujos. Es una marca por nodo
(`.node__datum`) al mismo desplazamiento relativo: en la rejilla 3 × 3 eso son tres alturas
distintas, en el dibujo ancho eran ocho. `DESIGN.md` §9 prometía *una línea de 2 px a través de los
ocho*, `GLOSSARY.md` lo repetía, y `CONTEXT.md` lo repite hoy («una línea a la misma altura en los
ocho nodos»). El test que lo cubría era `element-exists`: ocho marcas en el DOM, verdes durante toda
la vida del defecto. *Ocho marcas en el canto no se alinearían en una regla* no era una objeción a
girar el eje; era una descripción, sin nombre, de lo que ya se enviaba.

## 2 · La decisión

**Una dirección, una magnitud: la vertical es profundidad y la horizontal es Level.** En la
composición ancha el Level corre a lo largo del nodo —en sus dos cajas— y el techo del patch es una
regla **vertical**. La rejilla estrecha no cambia nada.

### 1 · El eje es de la composición y se declara; nunca se lee de la caja

Tres cajas, y a cada una se le **dice** su eje:

| caja | cuándo | el Level corre por |
| --- | --- | --- |
| el nodo de la rejilla | composición estrecha, siempre | su **alto** |
| el nodo apilado ancho (*wide stacked node*) | ancha, tres filas o menos — 64 de los 88 | su **largo** |
| el listón (*batten*) | ancha, cuatro filas o más — 24 de los 88 | su **largo** |

`DiagramLayout.levelAxis` lo lleva como literal en cada módulo de disposición (`layout.ts` dice
`'height'`, `wide-layout.ts` dice `'width'`). La tentación que el tipo existe para rechazar es
*el eje que la caja tenga de hecho*: los números de los dos módulos son unidades de `viewBox` que el
panel estira con `preserveAspectRatio="none"`, así que la proporción en pantalla es del panel y no
del dibujo —en el mismo instante el nodo apilado está a 1,7 : 1 y el listón a 8 : 1, y los dos
llevan el Level igual—. Una regla leída de la proporción dejaría que un cambio de tamaño de la
ventana girase la dirección de una medida sin que nada fallara. Una composición, un eje, y en las
dos cajas: la alternativa —vertical en el apilado, horizontal en el listón— giraría la medida
*dentro de un mismo dibujo* en una frontera (`STACK_H`) que el pianista no tiene por qué conocer.

### 2 · La tarjeta conserva su ancho; el hueco entre filas sale del alto

Tras la decisión 1 el ancho **es** la medida, así que no se paga con él nada: partir la tarjeta
llevaría el eje a 1,4 px por punto. El problema de las rutas era vertical —`rowGap = min(26,
pitchY/4)` deja 7,8 px en el suelo a ocho filas y la punta de flecha son 6,3— y ahí es donde se
paga: el hueco entre filas gana un **suelo** propio y la tarjeta devuelve los píxeles de un alto con
el que ya no mide nada. `ROW_GAP_MAX` deja de ser un máximo solo y tiene un suelo (§4).

### 3 · Un dibujo que no cabe pliega sus hechos y nunca sus posiciones

Es la sección §4 entera, porque es un mecanismo con dos disparadores y no un caso.

### 4 · El aparcado sale de la pila, no del margen

ADR-0007 §4 aparca al operador a Level 0 *a la derecha*, sobre un cabo punteado. La derecha es ahora
el extremo **alto** de la medida, así que aparcar ahí pondría la posición del operador en
contradicción directa con su propia cifra, en la única composición cuyo principio declarado es que
la posición lo dice sin rótulo. El operador sale de la **pila de profundidad** —no tiene
profundidad en la cadena, así que no está en ese eje— a una banda por encima de la fila más honda,
en el extremo del origen del eje del Level, y conserva el cabo punteado que no llega a ninguna parte
(#83). Lo que se retira es la **dirección** del desplazamiento; el principio de 0007 —*el aparcado
se dibuja y no se borra, y la posición dice «esto no suena»*— queda entero.

Lo que cuesta es una **fila** y no una columna, y la moneda es el argumento: desde la rotación una
columna es la escala del Level, así que el aparcado se pagaba con la lectura de los siete que no
habían cruzado el cero. La pila se cierra detrás del que se va —`place()` dispone las profundidades
*ocupadas*— y la banda toma la fila que él dejó, una para cualquier número de aparcados. Así **ocho
filas siguen siendo el dibujo más hondo que existe**, que es lo que el suelo del cuerpo tiene por
ancla (§5). Cifras, en unidades de la caja: el **1** con un operador a cero dibuja una tarjeta de
163,4 unidades donde dibujaba 142; el 2 con una portadora a cero cambia 232 → 292 de ancho por 66 →
52,8 de alto. Ancho por alto, que es medida por posición.

### 5 · Una ruta hacia un aparcado se dibuja; una ruta desde él, no. Dos hechos, dos predicados

`drawn(from) && drawn(into)` contestaba a las dos direcciones con un predicado, y por eso en el 66
con OP2, OP4, OP5 y OP6 a cero **OP1 —un modulador a 99 con destino documentado— no dibujaba nada**
mientras los callados que alimentaba tenían su caída punteada a una barra (#70). `sends()` y
`deadEnds()` son ahora una regla cada uno, en el sitio que dibuja.

La razón de la asimetría es **geométrica, no de audibilidad**: las dos direcciones acaban en ningún
audio, así que la audibilidad no puede decidir cuál lleva tinta. El aparcado ya ha desplazado al
operador a la barra de su cabo, de modo que sus aristas **entrantes** aterrizan donde ahora vive; las
**salientes** tendrían que volver a la cadena de la que se le sacó. La asimetría es consecuencia de
una decisión ya tomada. Y el coste se dice: una ruta saliente es una ruta documentada que el dibujo
no enseña; lo que lo hace aceptable es que el dibujo es del algoritmo **tal como está configurado**
y no del algoritmo en abstracto, decisión que ya estaba tomada y esta regla hereda. La tinta de la
entrante es la que `FB 0` usa desde #57 —inerte, `--inert` sobre `--dash-inactive`—: *esto está en
el algoritmo y no lleva nada*, la misma frase en un segundo sitio. Es también **la única línea del
dibujo que sube**, y ese es el precio de que la banda esté encima de la fila más honda: dibujada
hacia abajo habría aparcado al operador de vuelta en el eje del que se le sacó.

### Las cifras de la resolución, al final y como consecuencia

Todas en el suelo del cuerpo (#81: `BODY_FLOOR = 382`, lienzo de 282 px de alto) y en el carril
más estrecho que la app envía (el riel, lienzo de 980 px de ancho); en el carril con el pin echado
(1 034) son ligeramente más holgadas.

| | eje vertical (antes) | eje horizontal (ahora) |
| --- | --- | --- |
| tarjeta más estrecha por el eje del Level | 23,6 px (listón, 8 filas) | **113 px** (142 unidades al tope de ocho columnas, cualquier clase) |
| pista del relleno | 11,6 px | **102 px** |
| un punto de Level | 0,12 px | **1,02 px** |
| 99 contra 96 | 0,35 px | **3,1 px** |
| luz entre el techo y el borde, a 99 con portadora encendida | 6,1 px derivados en la tarjeta de 23,6; **6,5 juzgados** en la de 31 (§7) | 6,02 px (apilado, ocho columnas) · 7,91 px (listón, tres columnas), **derivados y sin mirar** |
| hueco fijo de la pista | 8 px | **7 px** en la ancha, **8 px** en la rejilla, cada uno ganado contra la tarjeta más estrecha de su composición (`levelTrackInset()`) |

El techo es **una marca repetida en cajas idénticas** al mismo desplazamiento de una pista idéntica:
un origen y una escala. Donde las tarjetas están apiladas en una columna comparten origen y escala y
las marcas se alinean en una regla que se puede seguir con la vista —el caso hondo, que era donde
peor fallaba—; donde el dibujo las pone lado a lado por ramas, y en la rejilla, leen por nodo, que
es lo que siempre han hecho. Se afirma **como geometría** —el desplazamiento en los ocho, y un
`left` y un `width` únicos a través de los ocho del 66— y nunca como `element-exists`.

## 3 · La condición que mata esta ADR

**Si la mirada 1 de §8 —la barra horizontal, en la tinta de la app, sobre el nodo apilado ancho al
tope de ocho columnas— vuelve negativa, esta ADR queda *sustituida*, no enmendada, y las demás
miradas de la lista no se toman.** Una hoja de diseño puede rechazar y no bendecir; lo que ya se
tiene es que no rechazó (#78): sobre la hoja, con los tokens reales, 99 contra 96 es una muesca de
**9 px** de superficie oscura antes de la regla del techo en una pista de 292 px, y las tres
longitudes desde un origen común leen como tres magnitudes y no como tres barras de progreso. La
instancia que decide no es esa: es la pista de **102 px** del nodo apilado a ocho columnas, donde el
mismo par son 3,1 px y que la hoja no dibuja. Ahí es donde se confirma o se mata.

Por eso el estado es **aceptada** y no propuesta: la decisión la asienta la puja, que no necesita
pantalla, y las cifras sin juzgar son consecuencias y no fundamentos. Una ADR propuesta que el
código ya implementa no es una cosa; una aceptada con condiciones abiertas es lo normal, y el
veredicto de #67 (§7) es el precedente de anotar qué se ha mirado y qué no.

## 4 · El pliegue

**Un dibujo que no puede sostener sus hechos pliega sus hechos y nunca sus posiciones.** La
profundidad es altura: los operadores más hondos conservan su fila, su orden y su sitio encima de lo
que modulan, y entregan la ratio, el glifo, la Hz y el detalle por cifra a **una banda** que conserva
la identidad y el Level, a plena longitud contra la misma regla. Lo que se pierde es detalle; lo que
nunca se pierde es topología, y el más alto del patch se sigue encontrando a ojo.

### Un mecanismo, dos disparadores

Los dos son un `||` en el sitio que dibuja (`foldsFacts()`, `wide-layout.ts`), juzgados sobre el
dibujo **sin plegar** para que la decisión no se apoye en su propia consecuencia:

- **Demasiado hondo para sus filas.** El hueco entre filas ha caído por debajo de lo que un hueco
  tiene que sostener: su punta de flecha más un tramo visible (regla 20 del `DESIGN.md` que #87
  escribe). El umbral se **deriva** y no se elige: `rowGapFloor() = ARROWHEAD + VISIBLE_SEGMENT /
  yScale`, evaluado **en el suelo del cuerpo**, que es lo que impide que el suelo y el umbral se
  persigan: el suelo es el lienzo más pequeño que la app dibuja, así que un hueco que lo cumple ahí lo
  cumple en cualquier ventana. Evaluado a la altura real, una ventana más alta desplegaría el 37 y un
  arrastre lo plegaría otra vez.
- **Demasiado estrecho para sus cinco hechos.** La tarjeta es más estrecha que la tarjeta en la que
  esos mismos cinco hechos se sabe que caben: la del nodo de la rejilla 3 × 3, misma plantilla y misma
  tipografía, **131 px** (`fittedCardWidth()`). Es una comparación y no un umbral, así que los dos
  lados se mueven juntos y ninguno se puede afinar hasta que un algoritmo pliegue. Por carril, porque
  el carril lo es: **164,7 unidades en el riel y 156,1 con el pin**, contra la tarjeta más estrecha de
  142. Este disparador sí se mueve con la ventana, y la asimetría es deliberada: ahí la tarjeta de
  verdad es más estrecha.

Son un mecanismo porque son una frase —*este dibujo no puede sostener lo que se le pide que dibuje*—
y porque lo que hacen es idéntico. Dos mecanismos serían dos cosas que aprender, dos interruptores y
dos bandas que podrían separarse en lo que conservan.

### Sobre quién dispara, forzado por número

Contra el histograma de filas leído del dibujo (#81: `1×1, 2×26, 3×37, 4×17, 5×5, 6×1, 8×1`), el
disparador de profundidad cae en `filas ≥ 6`: **exactamente {37, 66}**. El de anchura dispara en el
**1** —ocho portadoras en la fila del bus, ocho columnas, 142 unidades— **en la ventana de fábrica y
sin arrastrar nada**, en los dos carriles. Eso es lo que hace al pliegue ordinario y no una
curiosidad de dos entre ochenta y ocho, y más de la tabla pliega cuanto más estrecho es el carril. Y
desde #83 un aparcado es una fila: el 55, cinco filas y el más hondo que no pliega, con una
portadora a cero es cinco y la banda, y pliega. Los tres casos se fuerzan **por número de
algoritmo** en `wide-layout.spec.ts`; un predicado podría derivar hasta darse la razón a sí mismo.

### La banda lleva un sello, y es el más débil

Una cifra en pantalla cuya procedencia está detrás de una pulsación es una cifra que afirma lo que no
está respaldando (§20.7). La banda lleva **un** sello y es el más débil de los cuatro que tiene
detrás: `FRESHNESS` escribe el rango —`invalidated < stale < polled`, los tres grados de **una**
fuente— y `weakest()` lanza por nombre ante un grado de otra fuente en vez de ordenarlo, porque la
banda sólo contiene lecturas del anillo: `MEASURED`, `PREDICTED` y `DOCUMENTED` no pueden aparecer en
ella, y decirlo es parte de la regla. Escrito y afirmado, el sello único es una derivación; sin
escribir, era una convención.

### Lo que el pliegue no resuelve

El ancho de la composición tiene dos suelos debajo y sólo uno es condición de pliegue. El brazo de
la **anchura ajustada** pregunta si los cinco hechos caben, y plegar lo resuelve por construcción.
El brazo de **legibilidad** —un punto de Level nunca más pequeño que un píxel en el eje que lo
lleva— **no lo toca el pliegue**: plegar los hechos no ensancha la tarjeta un píxel. Sigue siendo un
suelo duro sobre la ventana (§5). Quien pliegue los hechos y dé por desaparecido el suelo ha cambiado
una medida por una imagen de una.

### Las entradas del umbral, todas

Dos de ellas aparecieron sin nombre en una sesión, así que la lista es exhaustiva y no por ejemplo.

Del lado del **criterio** (`rowGapFloor()`, `folding.ts`), en píxeles CSS convertidos una vez a
unidades:

1. `ARROWHEAD = 9` — la declaración `markerWidth/markerHeight` del `<marker>`, leída, no medida.
2. `VISIBLE_SEGMENT = 6` — **elegido**, ni derivado ni juzgado (mirada 4).
3. `WIDE_CANVAS_H = 400` — la caja en la que el dibujo está escrito.
4. `floorCanvasHeight()` = `BODY_FLOOR` − `ZONE_PAD_TOP` 12 − `ZONE_HEAD_BAND` 18 −
   `CANVAS_MARGIN_Y` 8 − `LEGEND_H` 62 = **282 px**. Y `BODY_FLOOR` es a su vez `max(NODES_FLOOR +
   LEGEND_H, VIEWS_FLOOR)` con `VIEWS_FLOOR = 360` (sin testigo, §5), `NODES_FLOOR = 360 −
   legendHeight(1) = 320` y `LEGEND_H = legendHeight(2)` — que entra **dos veces** en la cadena, una
   sumando y otra restando, de modo que el dibujo sólo ve la diferencia y el suelo se equivoca en
   exactamente lo que se equivoque la banda de la leyenda. `legendHeight()` depende del número de
   filas de `LEGEND` y de la caja de la muestra con su filete **fuera** de la caja declarada (#81).
   La banda de la cabecera, 18, es el único término que no puede ser exacto: es una métrica de fuente.

Del lado del **dibujo** (`wideRowPitch()`, `wide-layout.ts`), en unidades:

5. `WIDE_CANVAS_H` otra vez, con `MARGIN_Y = 6`, `BUS_OFFSET = 20` y `OUT_ROOM = 22`: `pitchY = 352 /
   filas`.
6. El cuarto: `rowGap = min(ROW_GAP_MAX, pitchY / 4)`, con `ROW_GAP_MAX = 26` como tope.
7. Las filas: `max(filas ocupadas + (1 si hay aparcado), MIN_ROWS = 3)`, con las filas ocupadas leídas
   de `chain_depth()` sobre los operadores **colocados** (`algorithms.rs`), y la banda del aparcado
   contando como una.

Con todo eso el suelo del hueco es **17,51 unidades**, contra las 26 del tope, así que los dos nunca
pelean (afirmado). A cinco filas el hueco natural es 17,6.

### Los márgenes, anotados y no clasificados

- **0,06 px a cinco filas.** Es lo que le sobra de tramo visible al 55 —12,41 px de hueco menos
  6,35 de punta menos los 6 pedidos— y es la cifra más ajustada de la ronda: está dentro del redondeo
  de la métrica de fuente de la cabecera. El test afirma el margen y no el cajón, porque «cinco filas
  no pliegan» seguiría verde con la edición que lo pone en negativo. La propuesta lo anotó como 0,15
  contra un lienzo de 286; a 282 es 0,06, y al lienzo de 278 que la pantalla dibujaba antes de #81 era
  **−0,02**: el umbral habría sido `filas ≤ 4` y habrían plegado 38, 39, 40, 41 y 55 sin que nada
  fallara. Es exactamente el fallo que la propuesta nombró por adelantado, y lo que se movió no fue la
  ventana sino la leyenda.
- **2,7 px en la banda.** Lo único de la ronda que puede decir que el pliegue **falló**: en el
  suelo, a ocho filas, la tarjeta plegada mide 18,7 px y la banda necesita 16 (`foldedBandHeight()`:
  borde, un píxel de relleno a cada lado, una línea a `--text-micro`). Derivado, sin mirar (mirada 5).
- **1,33 unidades entre tres filas y la clase del listón.** Es la que se **anota y no se retira**, con
  sus cinco entradas nombradas, porque es el siguiente `bottom: 99%`: a tres filas `pitchY = 117,33`,
  `rowGap = min(26, 29,33) = 26` y `nodeH = 91,33` contra `STACK_H = 90`. Treinta y siete algoritmos
  están a 1,33 unidades de convertirse en listones, y un cambio de dos unidades mueve el radio de la
  rotación de 24 a 61. Las cinco entradas: **`WIDE_CANVAS_H`, `MARGIN_Y`, `BUS_OFFSET`, `OUT_ROOM` y
  `ROW_GAP_MAX`**, ninguna de ellas obviamente sobre representación. `STACK_H = 90` se re-gana por
  esto y no se toca. Se afirma como margen en #85 —*tres filas superan `STACK_H` en al menos N*—,
  nunca como *tres filas dan un apilado*, que pasa a 90,01 y no dice nada.

### Lo que el pliegue aún debe

**La pulsación que despliega** (historia 9 de #73: *una pulsación despliega la banda en el dibujo
que hoy se envía*) no está en la build: hoy lo plegado está plegado, que es «escondido» y no «puesto
aparte». Necesita decisiones de control que ni la propuesta ni esta ADR toman —dónde vive, qué dice,
si es por nodo o por dibujo, si persiste cuando el disparador deja de disparar, qué hace el dibujo
desplegado con el sitio que no tiene— y está archivado como #92. No es un refinamiento de esta ADR
cuando llegue; es su segunda mitad.

## 5 · Los suelos, y el desplazamiento como un comportamiento en dos ejes

**El alto.** `BODY_FLOOR = 382`, derivado: *lo que la leyenda tome, el lienzo se queda con lo que le
dejó el 360*. #81 lo midió por primera vez sobre el dibujo que va a gobernar (banco, escala de
dispositivo 1, 1 280 px de ancho, pliegue apagado, 66 sin nada a cero, `90 · 90 · 71 · 90 · 90 · 85 ·
90 · 99`) y **el ancla no nombra un suelo que la ventana pueda guardar**: los cinco hechos sin cortar
piden un cuerpo de 561 px y el hueco con su punta más 6 px pide unos 1 300; la ventana de fábrica da
534. Los dos son criterios que el pliegue resuelve, así que fijar la ventana en cualquiera de ellos
haría a la app desplazarse en reposo para proteger un dibujo que después de #82 no se dibuja nunca.
Lo que el ancla compra es lo que se le pidió, y está afirmado y no supuesto: el alto de una tarjeta
lo decide el número de filas y **nada más** —ni el patch, ni el aparcado, ni la clase— y nunca crece
con él; y con el interruptor puesto ningún nodo recibe una tarjeta más alta que sin él, en las dos
clases anchas. Así el 66 es el peor caso, el pliegue sólo puede comprar margen y el umbral derivado
en el suelo no puede entrar en espiral. **El 360 sigue sin testigo**: #19, el ticket que citaba, es
«*Text collides at full size*» y no contiene ninguna medida de altura; #81 es una primera medida que
no sustituye nada, y volver a tomar la mitad de las vistas es de nadie todavía.

**El ancho.** No hay suelo: `tauri.conf.json` no tiene `minWidth` y `diagramLane()` no está
acotado, así que cualquier arrastre rompe el eje de inmediato. El suelo es el brazo de legibilidad —
un punto de Level nunca menor que un píxel— y se **deriva por forma, de la misma fuente que el suelo
del alto, y nunca como literal en una hoja** (#86): 100 px de pista, 7 de hueco fijo y 4 de borde
son una tarjeta de **111 px**; a 142 unidades de 1 232 eso es un lienzo de 963 y un carril de 999;
más `FIGURES_W` 208, más el riel de 52 y los dos filetes, **1 263 px de cuerpo en el riel** y
**1 209 con el pin** (la propuesta dijo 1 211 antes de que `bodyGap()` bajara el filete a la mitad en
#76; la build gana). Holgura a 1 280: **17 px en el riel**, que es el brazo que ata, y 71 con el pin.
Una sola constante sobre-restringiría la forma del pin en 54 px.

**El desplazamiento es un comportamiento, con una diferencia que hay que nombrar.** En los dos ejes
es lo mismo: un mínimo, el cuerpo desplazándose por debajo, y el dibujo sin dibujar nunca una medida
que no puede respaldar. Ni mecanismo nuevo, ni vocabulario nuevo, ni estado nuevo. **La diferencia
es el origen.** Girado, las barras miden desde un origen **común y remoto** —el borde izquierdo de
la tarjeta, compartido por toda una columna—, y el desplazamiento horizontal puede sacar ese origen
de la pantalla con las barras todavía a la vista, que es la gráfica engañosa clásica. El eje vertical
nunca tuvo ese problema: el cero del relleno era el borde de abajo de su propia tarjeta, siempre
pegado a él. Así que hay una decisión que #86 toma y **escribe aquí cuando aterrice**: o la columna
del origen se fija y sólo la pista se desplaza, o el dibujo deja de afirmar el eje en cuanto el
origen sale. Es la mirada 7. Si el desplazamiento horizontal acaba moviendo o fijando algo distinto
del vertical, «una frase cubre los dos» es una exageración de las que leen correctas durante un año,
y esta sección dirá en qué difieren.

## 6 · Lo que se retira, por su nombre

- **`TRACK_INSET = 8`.** Era el entero más pequeño que dejaba 6 px **en el eje vertical de la
  tarjeta achatada**; ni el eje ni esa tarjeta existen. Lo sustituye `trackInset()`, la derivación de
  #67 resuelta para una tarjeta y ganada por composición contra su tarjeta más estrecha: 8 en la
  rejilla, 7 en la ancha. La hoja ya no declara ningún hueco fijo: los cuatro bordes se atan desde el
  módulo.
- **`DAYLIGHT_FLOOR = 6`.** Sobrevive como `DAYLIGHT_CRITERION = 6`, que es el **criterio** y no el
  veredicto (§7). Y no puede ser un segundo criterio junto al de la pista: el hueco fijo se deriva de
  él, así que la luz lo cumple por construcción en toda tarjeta; cuando `d` se mueve lo que se mueve
  es el hueco fijo y nunca el suelo de la pista.
- **La nota de veredicto de #67**, retirada con su registro entero en §7.
- **La medida pendiente de #66** —el ancho de la composición no tenía suelo medido—. Se convierte en
  el suelo calculado de §5 (#86) más su brazo de anchura ajustada, que **nunca es suelo de ventana**:
  los 1 436 px que pediría contra 1 280 de diseño no son un mínimo que imponer, son lo que el
  disparador de anchura resuelve plegando.
- **`WIDE_ROWS = 8`.** Decía el número de filas del 66, y las filas ya no son lo que el dibujo tiene
  sino lo que se le pide; una constante que declarase el más hondo se leería como una cota que la
  disposición impone. Ocho sigue siendo el más hondo de los 88 y se afirma donde está la tabla.
- **La dirección del aparcado de ADR-0007 §4** (a la derecha). Su principio no.

Y tres que cambian de razón sin cambiar de valor: `ROW_GAP_MAX` gana un suelo y deja de ser un
máximo solo; `STACK_H = 90` se re-gana por el margen de 1,33; `SQUAT_NODE_W_MAX = 380` sobrevive
**por valor y no por razón**: deja de ser consuelo por el alto perdido y pasa a ser el eje de la
medida. `DESIGN.md` §10 sigue diciendo «aparcado a la derecha sobre un cabo punteado» hasta #87; la
build y el papel discrepan y la build gana.

## 7 · El veredicto de #67, llevado aquí y no borrado

Un juicio anotado y borrado en silencio es el mismo defecto que uno conservado más allá de su
geometría. Lo que anotó:

- **Valor.** `DAYLIGHT_FLOOR = 6` px de superficie oscura entre la tinta del techo y el borde de la
  tarjeta, juzgado en pantalla.
- **Tarjeta.** La composición ancha con las dos ranuras vacías y la tira de 156 px arriba, ventana
  restaurada y arrastrada hacia abajo, en un display 2×: una tarjeta de **unos 31 px** de alto.
- **Patch, como Levels.** Algoritmo 66 con `99 · 0 · 99 · 99 · 0 · 0 · 99 · 99` — techo a 99 con
  una **portadora encendida en el techo**, que es el caso que merece juicio porque el techo cae
  entonces contra `--carrier` a plena fuerza.
- **Medido**, sobre el PNG a 1:1 en la tarjeta de OP8: 4 px de dispositivo de tinta de borde, 13 de
  `--surface-raised` limpio, 4 de techo. Unos 6,5 px CSS.
- **Cómo leyó.** Como una regla a una altura común, claramente separada del borde, y no como un
  reborde del relleno.

**El criterio se traslada y el veredicto no.** La luz corre de borde a techo con los dos extremos
fijados por el hueco fijo, explícitamente independiente de la dimensión que se mide: por eso pasó de
la tarjeta de 31 px a la de 24, y por eso pasa ahora noventa grados. Lo que no pasa es qué aspecto
tenían seis píxeles de *aquella* superficie: fue un juicio sobre una regla horizontal tendida sobre
un borde ámbar con `--carrier-fill` desvaneciéndose a `.04` debajo; en el dibujo girado el techo es
una regla vertical con otra tinta al lado. **La geometría en la que se juzgó ya no existe.** Las dos
luces giradas —6,02 px en la tarjeta más estrecha y 7,91 en el listón a tres columnas— son cifras
derivadas que nadie ha mirado, del mismo tipo que fue `bottom: 99%`, y son las miradas 2 y 3.

## 8 · La lista de verificación

Vive aquí y en ningún otro sitio. Cada mirada se toma en el banco (#79) y se anota **en esta
sección**, en el formato del veredicto de arriba: qué había en pantalla, el patch como Levels, qué se
midió, cómo leyó. Una cifra que se mueva como resultado aterriza con su razón. Las miradas son de
#88 salvo donde se dice otra cosa; hoy todas están **pendientes**.

1. **La barra horizontal, en la tinta de la app.** Confirmación de #78, que sólo pudo no rechazar
   sobre la hoja. Se toma sobre el **nodo apilado ancho al tope de ocho columnas** —pista de 102 px en
   el riel, 108 con el pin; 99 contra 96 son 3,1 px— y no sobre el listón, que es la pregunta fácil.
   **Es la condición que mata** (§3): negativa, esta ADR se sustituye y el resto de la lista no se
   toma.
2. **La luz del listón en su pista larga.** 7,91 px derivados a tres columnas, en el riel. Dos
   lecturas en la misma mirada: la **luz**, con una portadora encendida en el techo, que es el caso
   que #67 juzgó; y el **borde**, a un Level medio —`70 · 85` en dos operadores— y no en el techo,
   donde el hueco es degenerado y el desvanecido no tiene nada que emborronar. Del borde se anota
   **desde cuál** se midió —duro o suave— y si el extremo suave hizo ambiguo dónde acaba el relleno,
   preguntado tal cual: *¿se podía decir dónde terminaba?* Es lo que decide #71 (#89).
3. **La luz del nodo apilado ancho a ocho columnas.** 6,02 px derivados en la tarjeta más estrecha:
   la instancia que ata y el caso mayoritario. Mirarla sólo en el listón es la misma trampa que juzgar
   el techo viejo en la tarjeta de la rejilla. Las mismas dos lecturas y las mismas anotaciones que
   la 2.
4. **El tramo visible.** `VISIBLE_SEGMENT = 6` px es elegido, ni derivado ni juzgado, y decide el
   cajón de cinco filas a 0,06 px: si 6 px de línea leen como línea. A 7 plegarían cinco algoritmos
   más.
5. **La banda plegada: ¿profundidad o nota al pie?** 16 px de banda en 18,7 de tarjeta en el suelo a
   ocho filas.
6. **El dibujo cambiando de forma a mitad de un arrastre**, ahora que el disparador de anchura hace
   al pliegue común: el 1 pliega en la ventana de fábrica, y `KEEP IT BIG` puede cambiarlo.
7. **Una barra desplazada contra un origen que no se ve.** La decisión de #86 (§5), mirada y no
   argumentada.
8. **La banda del aparcado: ¿lee como fuera de la cadena o como otra fila?** Añadida por #83, que la
   dejó sin mirar; la banda está encima de la fila más honda y en el extremo del origen.
9. **La única línea que sube: ¿lee como una ruta hacia un callejón sin salida?** Añadida por #83. La
   ruta inerte hacia un aparcado cruza por debajo de todas las barras a 0,75 del hueco y aterriza en
   la barra a 0,4.

**Más una comprobación de instrumento, con el MODX conectado:** que un operador a Level 0 no emite
nada, de modo que modularlo es inaudible. Es la única regla de la ronda cuyas condiciones de verdad
viven enteras fuera del código. Nota sostenida, aparcar el operador modulado, capturar, no ver nada.
Lo que falsaría: la decisión 5 de §2 dice que la ruta *entrante* lleva tinta inerte porque lo que
modula no tiene salida; si un operador a cero sí saliera, la tinta estaría diciendo algo falso y la
ruta debería dibujarse llena. Se debe, no se ha hecho.

## 9 · Consecuencias

- Toda frase de la app o de los documentos que diga hacia dónde corre el Level tiene que decir **en
  qué composición**, y ninguna puede leerlo de la forma de la caja. Las entradas *Techo del patch* y
  *Pista del relleno* de `CONTEXT.md` están hoy mal en los dos sentidos —una línea a través de los
  ocho; un hueco fijo *arriba*— y #87 las corrige sin ninguna palabra de dirección en ninguna de las
  dos.
- El dibujo pliega en la ventana de fábrica (el 1), así que el pliegue es algo que el pianista ve
  ocurrir en un arrastre y en una pulsación del pin, no un caso de dos entre ochenta y ocho. La
  mirada 6 existe por esto, y #92 es su otra mitad.
- La leyenda **no gana entrada** para el pliegue ni para la banda del aparcado: sus dos filas
  emparejan por tipo de afirmación —los dos roles que confiere el algoritmo; los dos hechos que no son
  roles— y el pliegue es un hecho sobre el **dibujo**. `FB 0` ya se envía inerte sin entrada. Se
  afirman los dos brazos de la leyenda —el número de filas **y** el ancho medido de cada una contra
  el sitio que deja el carril más estrecho— porque el peligro es la reparación: alguien añade una
  fila para que quepa y `LEGEND_H`, `BODY_FLOOR` y `floorCanvasHeight()` se mueven juntos.
- Dos algoritmos, el 12 y el 14, tienen el arco de realimentación con sus dos extremos en operadores
  distintos: el arco conserva la conjunción vieja para la regla saliente y no recibe la entrante,
  porque es una oreja en el borde derecho de una tarjeta y una tarjeta en la banda no tiene oreja que
  la tome sin redibujar el arco. Planteado en #83 y no resuelto en silencio.
- El `FB n` no tiene banda libre en seis algoritmos hondos (22, 24, 37, 51, 60, 88) y se re-comprueba
  contra la geometría plegada (#91): es la misma condición que la regla 20 fallando a la misma
  profundidad por la misma razón.
- `MARGIN_X` y `COL_GAP` son parte de la superficie de `wide-layout.ts`, porque el suelo es ahora un
  hecho público de la disposición y sus entradas también: la tarjeta más estrecha se recalcula de
  `WIDE_CANVAS_W`, `MARGIN_X`, `COL_GAP` y `WIDE_COLUMNS` —**ningún tope entra**, porque a ocho
  columnas `NODE_W_MAX` y `SQUAT_NODE_W_MAX` quedan los dos por encima y no deciden nada— y una
  copia en el test sería el defecto original de `legend.ts` en otro sitio.

## 10 · Alternativas descartadas

- **Dejar el Level vertical y sólo dar luz al techo** (hoja `10b`, candidato A). Correcto, visible e
  ilegible: la pista es de 11,6 px en el suelo y 99 y 96 caen en la misma fila de píxeles. Es lo que
  se envía hoy y lo que esta ADR retira.
- **Una marca fuera de la tarjeta** (`10b`, B). Las marcas siguen a 0,35 px porque el eje no cambió,
  y gasta el canal que las rutas necesitan.
- **El eje por caja, o leído de la proporción.** Giraría la medida dentro de una composición en
  `STACK_H`, o dejaría que la ventana la girase; y haría del techo una regla común sólo en el caso
  minoritario. §2.1.
- **Pagar el hueco entre filas con el ancho de la tarjeta.** Después de la decisión 1 el ancho es la
  medida; partirlo lleva el eje a 1,4 px por punto. Y el 66 es una rama: sus rutas son caídas rectas y
  ninguna línea cruza entre bandas, así que el ancho no compraba nada para las rutas.
- **Plegar posiciones: quitar filas o compactar la cadena.** La profundidad es altura; una posición
  plegada es una topología plegada. Lo que se puede perder es detalle.
- **Que la banda enseñe el valor y pliegue la procedencia.** Es la media tinta que en revisión
  parecería más razonable, y es una cifra afirmando lo que no respalda. Rechazada sin más.
- **Dos ADR, una para la rotación y otra para el pliegue.** El pliegue es consecuencia de la rotación
  y no su vecino: la rotación necesita el ancho que la tarjeta conserva, y lo conserva porque el
  pliegue libera el alto. Dos documentos de un mecanismo. Pero una cláusula tampoco: tiene su sección.
- **Presentar esto como refinamiento de ADR-0007.** La edición de #67 a §20.2 fue un refinamiento —
  separó una afirmación de un accidente y no pidió ADR—. Esto cambia qué eje lleva el Level y retira
  una constante juzgada y una dirección documentada; como afinado dejaría al siguiente lector pensando
  que el vocabulario posicional nunca estuvo en duda en el único eje en el que ahora se mueve.
- **Mantener el aparcado a la derecha y explicarlo en la leyenda.** Una posición que contradice su
  propia cifra, y una entrada de leyenda para taparlo, en la composición cuyo principio es que la
  posición lo dice sin rótulo.
- **Estado «propuesta» hasta que se tomen las miradas.** El código ya la implementa; una propuesta
  implementada no es una cosa. Lo que la mirada 1 puede hacer no es enmendarla sino sustituirla, y eso
  está escrito en §3.

# ADR-0008: El Level corre por el eje que declara su composición

Fecha: 2026-09-11 · Estado: aceptada · Contexto: #73 (la especificación de la ronda 10), #78, #80,
#81, #82, #83 · Se apoya en ADR-0007 y no la sustituye: de ella retira **una dirección** (§4, el
aparcado a la derecha) y ningún principio · No es un refinamiento: cambia qué eje lleva el Level, y
eso es vocabulario del dibujo, no un ajuste de una cifra · **Enmendada el 2026-09-11 por #93**: la
tinta del relleno no había girado con el eje; añade §2.6, corrige §3 y §7, reescribe las miradas 2
y 3 de §8 y les añade la parada tenue como la comparación que llevan, y amplía §9 y §10 ·
**Enmendada el 2026-09-11 por #86**: el suelo del ancho existe y la decisión del origen está tomada;
reescribe los dos párrafos del ancho y del desplazamiento de §5 y añade tres descartes a §10 ·
**Enmendada el 2026-09-11 por #88**: las diez miradas de §8 están tomadas y cada una lleva su
veredicto; la mirada 1 confirma (§3); la parada tenue del relleno pasa de `.04` / `.05` a **`.10`**
en las dos composiciones por la comparación de la 10, y §2.6 deja de llamarla provisional; §9 gana
dos hallazgos y §10 dos descartes; la comprobación de instrumento sigue debida · **Enmendada el
2026-09-11 por #89**: #71 queda cerrado como arreglado por la parada de #88, a partir de la lectura
de la mirada 3 de §8 y no de un argumento; §9 lo anota con lo que no se tomó y §10 gana un descarte

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

### 6 · La tinta corre con el eje: el rol pone las paradas y la composición la dirección

Añadida por #93. El relleno no es sólo un largo: es una rampa, densa en el origen del eje y
desvanecida hacia el extremo lejano, y una rampa tiene dirección. #80 giró el largo y dejó la
dirección donde estaba: `--carrier-fill` y `--modulator-fill` seguían siendo
`linear-gradient(to top, …)` y `.node--level-width .node__fill` cambiaba sólo el `inset`. En la
composición ancha la rampa corría a través del **grosor** de la barra —densa en el borde de abajo,
`.05` en el de arriba, e idéntica en el origen y en la punta—. Medido en la build de `bccdf1a` sobre
OP8 a 71: cruzar el extremo del relleno en `x = 595 → 596` era un escalón de ~20 en la cabeza de la
barra y de ~89 en su pie. **La luz del techo no era una cantidad**: era distinta en cada punto del
largo de la propia regla, y por eso las miradas 2 y 3 de §8 no estaban bien planteadas hasta esta
enmienda —no había *una* luz que mirar—. Es lo que hace a #93 bloqueante y no un arreglo de aseo.

**La decisión**, en tres partes y en este orden:

- **Ningún token lleva un eje.** Los tres degradados `to top` se sustituyen por pares de paradas
  —`--carrier-fill-dense` / `-faint`, `--modulator-fill-dense` / `-faint`, `--signal-fill-dense` /
  `-faint`—, los mismos valores, sin dirección. La razón que decide no es la limpieza: es que **un
  eje metido en un token es un eje que ninguna prueba puede afirmar.** El banco de pruebas es jsdom
  y jsdom no sustituye `var()`: con la dirección en un token, el `background-image` calculado del
  relleno leería `linear-gradient(var(--carrier-fill-along), …)` y el literal `to right` no estaría
  en ningún sitio que la prueba vea. El defecto que se envió fue exactamente un eje que nadie podía
  afirmar; lo que se elige es la única forma de las tres consideradas (§10) que pone el eje donde una
  prueba lo lee, y eso vale más que el argumento del cambio pequeño.
- **El rol pone las paradas; la composición pone la dirección; nunca el producto.** `.node--carrier`
  y `.node--modulator` declaran `--fill-dense` / `--fill-faint` y ninguna dirección; un
  `background-image` compone la rampa para la rejilla (`to top`) y uno bajo `.node--level-width` la
  gira (`to right`). Tres roles más dos composiciones, y no tres por dos: componerla por rol —
  `.node--carrier .node__fill`, `.node--carrier.node--level-width .node__fill`, …— son cuatro
  declaraciones para dos roles, seis con `--signal-fill`, el doble el día que exista una tercera
  composición, y es el mismo par de declaraciones «que hay que mantener a mano» reapareciendo dentro
  de la solución a mayor escala. `.node--inert` y `.node--stale` conservan `background: none`.
  `--signal-fill-*` queda sin consumidor, como lo estaba `--signal-fill`: un par de paradas sin regla
  que lo ponga, que es su estado desde siempre, y no una invitación a inventar un `.node--signal`.
- **Las mismas paradas en las dos composiciones, giradas, y —hasta #88— provisionales.** La ancha
  dibujaba `.50 → .04` (portadora) y `.46 → .05` (modulador) hacia la derecha, que es lo que la
  rejilla dibujaba hacia arriba; **desde #88 la parada tenue es `.10` en los dos roles y en las dos
  composiciones**, juzgada por la comparación de la mirada 10 de §8, y las densas no se tocan. No se
  adopta ninguna cifra de la hoja, y la hoja misma es la prueba de por qué: para
  una sola convención dibuja **seis rampas** —`.40 → .10` en el panel juzgado (10b · C, líneas
  298–322) y en casi todos los horizontales, `.38 → .08` en el de tres cajas (370, 382) y en el ámbar
  (526), `.34 → .08` en el aparcado (621); en vertical `.48 → .04` casi siempre, `.44 → .04` en la
  358 y `.46 → .04` en el ámbar de la 157—. Son aproximaciones `rgba` tecleadas a mano de una tinta
  que en la app es `oklch`; adoptar cualquiera de ellas es adoptar la aproximación. Lo que la hoja
  transfirió es la convención —**el extremo denso es el cero, en los dos ejes**— y no los dígitos.
  La frase de la nota de veredicto de #78 que decía «coincide con el relleno vertical» significa
  ahora eso: dirección y extremo denso, no dos cifras (y la nota lleva su fe de erratas: comparaba la
  hoja con la hoja).

**Y no es la opción gratis.** Cambia la única cantidad sobre la que descansa la no-negativa de #78.
El extremo lejano —el que miden las miradas 2 y 3, el de #71— se dibuja en la parada tenue. La hoja
lo enseñó a `.10` y la nota anota la lectura: en la barra de 45, el último píxel encendido es
`rgb(23,39,47)` contra `rgb(15,20,23)`, un escalón real y el más suave del dibujo. Es la única
observación que existe de ese borde, y se tomó a más o menos **el doble** de la tinta de la app.
Llevar `.05` / `.04` a la ancha es por tanto un cambio de la cantidad, hacia menos, y no se toma en
silencio: se toma **como provisional**, la parada tenue entra en §8 como la siguiente constante sin
juzgar de la ronda, y se decide **por comparación** y no por veredicto contra una sola rampa —`.05`
y `.10` a la vez en pantalla—, porque un sí/no contra una rampa sin alternativa que salga *no* deja
a alguien eligiendo un número a ciegas. Por qué podrían separarse después, y sólo después: la parada
tenue hace un trabajo distinto en cada composición. En vertical evita que un relleno al 99 % lea
como un reborde de la tarjeta; girada, **es la punta que mide**. Es la misma lógica «por
composición» del eje, aplicada a la tinta. No se separan ahora porque no hay ninguna cifra juzgada a
la que separarlas. **Tomada la comparación (#88, §8 · 10):** a `.04` el final de la barra era un
escalón de ~10 de RGB en la tarjeta de ocho columnas y el par 99 / 96 no se distinguía; a `.10`
es ~23 y la muesca de 3 px se ve; en la rejilla `.10` no hizo del techo un reborde. Una cifra,
`.10`, para las dos composiciones, y la razón hipotética de separarlas no se convirtió en una
juzgada.

**Cómo se afirma.** Cuatro afirmaciones positivas en una prueba: portadora y modulador, rejilla
(`to top`) y ancha (`to right`), leídas de `background-image` y nunca del atajo `background`, que
jsdom reserializa perdiendo el degradado. Cuatro y no dos porque las dos declaraciones de dirección
son ciegas al rol por construcción, y dos afirmaciones no distinguen esa estructura del producto;
cuatro fallan el día que alguien «arregle» un rol escribiendo un `background` con dirección en
`.node--carrier`. Es la prueba de regresión de la decisión y no del valor. Lo que afirma es que
**la hoja de estilos deletrea el eje**, no que el dibujo lea: la única evidencia de eso es la mirada
1, y una suite verde citada como esa evidencia sería el fallo del fósil con una prueba como fósil.
El retroceso está nombrado por adelantado, para que no lo improvise al final de un PR quien esté
cansado: si jsdom devolviera vacío, se afirma contra la fuente de la hoja (`componentCss()`) o se
retira la prueba y se anota aquí que el eje de la tinta no está afirmado. Lo que no se hace es la
negativa —«ya no contiene `to top`»—, que pasa cuando el banco no ve nada en absoluto.

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
tiene es que no rechazó (#78): sobre la hoja, con la geometría a escala real y **la punta del relleno
a más o menos el doble de la densidad de la app** —la hoja dibuja `.40 → .10` en `rgba` y la app
`.46 → .05` en `oklch`; §2.6—, 99 contra 96 es una muesca de **9 px** de superficie oscura antes de
la regla del techo en una pista de 292 px, cuyo borde cercano es esa punta, y las tres longitudes
desde un origen común leen como tres magnitudes y no como tres barras de progreso. La
instancia que decide no es esa: es la pista de **102 px** del nodo apilado a ocho columnas, donde el
mismo par son 3,1 px y que la hoja no dibuja. Ahí es donde se confirma o se mata.

**Confirmada el 2026-09-11 (#88, §8 · 1).** Sobre esa pista, en la tinta de la app, las ocho
longitudes desde un mismo origen leyeron como ocho magnitudes en una escala común; y el par del
techo —3,07 px medidos— leyó con la parada tenue a `.10` y no con la de #93, que enterraba la muesca
en la cola de la rampa. La ADR se mantiene; lo que la confirmación movió es la parada (§2.6).

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

**El ancho.** *(Enmendado el 2026-09-11 por #86, que es el que lo pone.)* Tiene suelo desde #86, y
`tauri.conf.json` sigue sin `minWidth` **a propósito**: el suelo es por forma y una sola constante en
la ventana del sistema sobre-restringiría la forma del pin en 54 px. El suelo es el brazo de
legibilidad —un punto de Level nunca menor que un píxel, `PIXELS_PER_POINT = 1` en
`node-geometry.ts`, la única cifra elegida de toda la cadena— y se **deriva, de la misma fuente que
el suelo del alto, y nunca como literal en una hoja**: 100 px de pista, 7 de hueco —en la forma *de
pista* de la derivación de #67, `6 + 2 − 1`, exacto— y 4 de borde son una tarjeta de **111 px**
(`readableCard()`); a 142 unidades de 1 232 eso es un lienzo de **963,04** (`floorCanvasWidth()`) y
un carril de **999,04** (`laneFloor()`), y se quedan con su fracción: redondear sería declarar el
mismo suelo dos veces a un píxel de distancia. Ese carril es **un número** y no uno por forma: lo que
cambia entre el riel y el pin no es lo que el dibujo necesita sino lo que hay al lado, y eso lo suma
la rejilla sola. `app.ts` lo ata a `.body` como `--lane-floor` y la hoja lo lee como mínimo de la
primera pista en las dos formas anchas —`minmax(var(--lane-floor), 1fr)`, donde antes había un
`0`—, igual que el filete se ata desde `bodyGap()` (#76); la forma de las ranuras conserva su pista
sin suelo porque su Level corre por el alto y ese suelo ya lo tiene la fila, y su ancho es la
pregunta de #66. El mínimo del cuerpo sale entonces por forma sin constante por forma: más
`FIGURES_W` 208, más el riel de 52 y los dos filetes, **1 263,04 px de cuerpo en el riel** y
**1 209,04 con el pin** (`bodyWidthFloor()`, que es la inversa de `diagramLane()` —
`bodyWidthFor()` en `column-geometry.ts`— aplicada al carril; la propuesta dijo 1 211 antes de que
`bodyGap()` bajara el filete a la mitad en #76; la build gana). Holgura a 1 280: **17 px en el
riel**, que es el brazo que ata, y 71 con el pin. Y la tarjeta más estrecha de la composición ancha
es ahora la del suelo, 111 y no los 113,0 que dejaba el riel en la ventana de fábrica: el hueco de
7 px se gana contra ella, y `operator-diagram.spec.ts` afirma que las dos formas de la derivación
—la de pista, que da la tarjeta, y la de tarjeta, que da el hueco— coinciden en 111 → 7 → 111,
porque en coma flotante `111/share·share` queda un pelo por debajo de 111 y `⌈ ⌉` habría hecho de
ese pelo un píxel entero de hueco.

**El desplazamiento es un comportamiento, con una diferencia que hay que nombrar, y ya está
nombrada.** En los dos ejes es lo mismo: un mínimo en la pista de la rejilla —`minmax(382px, 1fr)`
en la fila, `minmax(var(--lane-floor), 1fr)` en la primera columna—, el cuerpo desplazándose por
debajo (`overflow: auto` en la misma caja, que ya era `overflow-y: auto`), y el dibujo sin dibujar
nunca una medida que no puede respaldar. Ni mecanismo nuevo ni vocabulario nuevo. **La diferencia es
el origen, y cuesta un estado.** Girado, las barras miden desde un origen **común y remoto** —el
borde izquierdo de la tarjeta, compartido por toda una columna—, y el desplazamiento horizontal
puede sacar ese origen de la pantalla con las barras todavía a la vista, que es la gráfica engañosa
clásica. El eje vertical nunca tuvo ese problema: el cero del relleno era el borde de abajo de su
propia tarjeta, siempre pegado a él. La decisión, tomada en #86: **el dibujo deja de afirmar el eje
en cuanto el origen sale, tarjeta a tarjeta.** El cuerpo cuenta a `Composition` hasta dónde se ha
desplazado (`scrollLeft`, el único estado nuevo de la ronda, y no es una preferencia: el navegador
lo devuelve a cero solo cuando el cuerpo vuelve a caber), y una tarjeta cuyo cero ha quedado a la
izquierda del borde —`originGone()` en `node-geometry.ts`— pierde el relleno y el techo y conserva
la cifra: el número sigue siendo verdad y el largo que lo confirmaba ya no está en pantalla para
confirmarlo. Por tarjeta y no por dibujo, porque el origen es de una columna y la columna de más a
la izquierda lo pierde primero, así que lo que el pianista ve es la barra yéndose por donde se ha
ido su borde. La otra respuesta —fijar la columna del origen y desplazar sólo la pista— se descarta
en §10. El sitio del origen es aritmética y no medida: el cuerpo sólo se desplaza de lado por debajo
del suelo, y entonces la primera pista está exactamente en su mínimo, así que el lienzo mide
`floorCanvasWidth()` y la `x` de una tarjeta es una parte conocida de un ancho conocido —a 18 px
de acolchado de la zona más 2 de borde, el primer origen del 1 está a unos 34 px del borde del
cuerpo. Sigue siendo la mirada 7: lo que aquí hay es una respuesta, y si el relleno que se va lee
como *la razón por la que se fue* es lo que la mirada decide.

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
un borde ámbar con `--carrier-fill` (hoy `--carrier-fill-dense` → `-faint`) desvaneciéndose a
`.04` debajo; en el dibujo girado el techo es una regla vertical con la misma rampa girada al lado,
de modo que la tinta que toca la luz es ahora la **parada tenue**, la punta que mide. Y hasta #93 ni
siquiera eso: con la rampa a través del grosor, la luz medía ~20 en la cabeza de la barra y ~89 en
su pie a lo largo de una misma regla, y «la luz» no era una cantidad (§2.6). **La geometría en la
que se juzgó ya no existe.** Las dos luces giradas —6,02 px en la tarjeta más estrecha y 7,91 en el
listón a tres columnas— son cifras derivadas que nadie ha mirado, del mismo tipo que fue
`bottom: 99%`, y son las miradas 2 y 3.

## 8 · La lista de verificación

Vive aquí y en ningún otro sitio. Cada mirada se toma en el banco (#79) y se anota **en esta
sección**, en el formato del veredicto de arriba: qué había en pantalla, el patch como Levels, qué se
midió, cómo leyó. Una cifra que se mueva como resultado aterriza con su razón. Las miradas son de
#88 salvo donde se dice otra cosa; **las diez se tomaron el 2026-09-11 (#88)** y cada una lleva su
veredicto debajo de su pregunta. La comprobación de instrumento sigue debida.

**Lo que había en pantalla, común a las diez.** El banco (#79) sobre `17ea802` —el árbol de #86,
con la parada tenue de la mirada 10 sobrescrita en la raíz para la comparación, y después el árbol
de este commit para confirmar la cifra que aterriza—, en Chrome 152.0.7977.76 sin cabeza sobre el
portátil objetivo (14", 1920 × 1200 físicos, 150 %, Windows 11 Pro 26200), a **1280 × 800 px CSS
y DPR 1,5**, que es la ventana de la app, salvo donde una mirada dice otra cosa. La tira del banco
oculta en todas. Las cajas son `getBoundingClientRect`; las tintas se leen del PNG a DPR 1,5 en una
línea de exploración al 35 % del alto de la tarjeta, que no cruza ninguna cifra, y se dan como
`rgb` de Chrome (la superficie `--surface-raised` sale `rgb(21,28,28)`, no el `#0f1417` del
comentario del token; es la conversión de `oklch` del navegador y da igual, porque todas las cifras
son diferencias sobre la misma lectura). El patch de las miradas 1, 2, 3 y 10 es **`99 · 96 · 85 ·
70 · 45 · 90 · 20 · 99`**: el par del techo, los dos Levels medios que la lista pide, y tres más
para que la fila tenga longitudes que comparar. Las demás miradas van con el patch del banco,
`90 · 90 · 71 · 90 · 90 · 85 · 90 · 99`, con lo que cada una aparca a cero. Nada de esto es la
pantalla del dueño: es la misma máquina y la misma escala de #78 y #81, y las lecturas son de una
sola persona en una sentada.

1. **La barra horizontal, en la tinta de la app.** Confirmación de #78, que sólo pudo no rechazar
   sobre la hoja. Se toma sobre el **nodo apilado ancho al tope de ocho columnas** —pista de 102 px en
   el riel, 108 con el pin; 99 contra 96 son 3,1 px— y no sobre el listón, que es la pregunta fácil.
   **Es la condición que mata** (§3): negativa, esta ADR se sustituye y el resto de la lista no se
   toma.

   > **Veredicto: confirmada. La ADR se mantiene.**
   > - **Tarjeta.** Algoritmo 1 —una fila de ocho portadoras, la única de las 88 a ocho columnas—,
   >   plegado por anchura en las tres formas: **119,2 px de tarjeta y 108,2 de pista con el pin;
   >   112,9 y 101,9 en el riel; 111,1 y 100,1 en el suelo del ancho** (ventana a 1264, cuerpo a
   >   1264, un píxel por encima del suelo de 1263,04). Luz 6,08 · 6,02 · 6,01 px, derivada y
   >   comprobada caja a caja: la tarjeta menos sus dos bordes, menos el techo al 99 % de la pista,
   >   menos los 2 px del trazo.
   > - **Medido.** En el riel, el relleno de 99 termina a 100,93 px del origen y el de 96 a 97,86:
   >   **3,07 px** de superficie oscura antes de la regla, que es la cifra de la puja de §1 en la
   >   instancia que ata (0,35 px en el eje viejo). El de 45 termina a 45,9 y el de 20 a 20,4.
   > - **Cómo leyó.** Las ocho longitudes desde un mismo borde izquierdo leen como **ocho magnitudes
   >   en una escala común**, y no como ocho barras de progreso: el 20 y el 45 son barras cortas sin
   >   discusión, el 70 acaba a dos tercios, y el 90 se ve más corto que el 99. Lo que **no** leyó a
   >   la tinta con la que se envió #93 fue el par del techo: a `.04` el último píxel del relleno es
   >   `rgb(35,36,30)` sobre una superficie `rgb(27,31,28)` —un escalón de **~8** en el canal
   >   rojo—, y 99 contra 96 son la misma tarjeta a ojo, con los 3,07 px de muesca enterrados en la
   >   cola de la rampa. Es exactamente la lectura que #78 dejó abierta (*el borde que mide la regla
   >   es la tinta más tenue de la tarjeta*), trasladada del listón a la tarjeta donde importa. La
   >   mirada 10 es la que la resuelve, y con la parada tenue a `.10` —la que aterriza con este
   >   commit— la misma tarjeta enseña la muesca: el relleno del 96 acaba en `rgb(47,45,32)`,
   >   escalón de **~23** contra el techo a 3 px, y el 99 toca la regla. **La barra horizontal lee
   >   como sonoridad en la tinta de la app, y el par del techo lee con la parada juzgada y no con
   >   la provisional.** No rechaza; confirma.

2. **La luz del listón en su pista larga.** 7,91 px derivados a tres columnas, en el riel. Dos
   lecturas en la misma mirada: la **luz**, con una portadora encendida en el techo, que es el caso
   que #67 juzgó; y el **borde**, a un Level medio —`70 · 85` en dos operadores— y no en el techo,
   donde el hueco es degenerado y el desvanecido no tiene nada que emborronar. Girada la rampa (§2.6)
   el extremo lejano entero es tenue —ya no hay un borde duro y uno suave entre los que elegir, y
   «desde cuál se midió» dejó de ser la pregunta—: lo que se anota es **cuán tenue**, y si esa punta
   hizo ambiguo dónde acaba el relleno, preguntado tal cual: *¿se podía decir dónde terminaba?* Es lo
   que decide #71 (#89). Se toma **dos veces en la misma sentada**, a las dos paradas de la 10, y se
   anota una vez.

   > **Veredicto: la luz lee como regla; el borde se podía decir a las dos paradas, y mejor a `.10`.**
   > - **Tarjeta.** Algoritmo 79 en el riel —cuatro filas, cuatro columnas, listón al tope de
   >   `SQUAT_NODE_W_MAX`—: **302,3 × 71,6 px**, pista de 291,3, cinco datos en una línea. No hay
   >   ningún listón a tres columnas sin plegar (el 37 es a tres y pliega; el 69 y el 79 son el
   >   mismo tope a dos y a cuatro), así que se tomó a cuatro, que es la misma caja.
   > - **Patch.** `99 · 96 · 85 · 70 · 45 · 90 · 20 · 99`: OP8 es portadora a 99 (la luz con una
   >   portadora encendida en el techo), OP4 portadora a 70, OP3 modulador a 85.
   > - **Medido.** Luz 7,91 px derivada, comprobada por caja. En OP8 el relleno toca la regla y la
   >   regla —`rgb(91,97,97)`, gris, 2 px— está a 8 px de superficie del borde ámbar. En el borde
   >   lejano a `.04`/`.05`: el último píxel del 70 (ámbar) es `rgb(30,34,29)` contra `rgb(21,28,28)`,
   >   y el del 85 (azul) `rgb(24,37,40)`: escalones de **~9 y ~13**. A `.10`: `rgb(44,43,31)` y
   >   `rgb(27,46,52)`, **~23 y ~24**. El 96 deja **8,8 px** de superficie antes de la regla.
   > - **Cómo leyó.** La luz como una regla gris a una distancia común del borde en los ocho, no como
   >   un reborde del relleno, con el ámbar a plena fuerza tocándola por un lado: el juicio de #67
   >   sobrevive girado. El borde lejano a la parada de #93: *sí se podía decir* dónde acababa el 70
   >   y el 85 en una pista de 291 px, a un par de píxeles, porque la cola de la rampa se estira
   >   sobre 200 px y el escalón final, aunque flojo, es un escalón; y el 96 contra el 99 es una
   >   muesca visible de 9 px, la misma que #78 midió sobre la hoja. A `.10` lo mismo con menos duda
   >   y sin que la barra pierda su carácter de tinta que se disuelve hacia la punta. **En el listón
   >   la parada provisional no fallaba**; falla en la 3.

3. **La luz del nodo apilado ancho a ocho columnas.** 6,02 px derivados en la tarjeta más estrecha:
   la instancia que ata y el caso mayoritario. Mirarla sólo en el listón es la misma trampa que juzgar
   el techo viejo en la tarjeta de la rejilla. Las mismas dos lecturas, la misma pregunta y las dos
   mismas paradas que la 2.

   > **Veredicto: la luz lee; el borde a un Level medio no se podía decir a `.04`/`.05` y sí a `.10`.**
   > - **Tarjeta y patch.** Los de la mirada 1, en el riel (112,9 px, pista 101,9) y en el suelo
   >   (111,1, pista 100,1): las dos son la instancia que ata, y las dos leyeron igual.
   > - **Medido.** Luz 6,02 y 6,01 px, por caja. En el borde lejano, a `.04`: el 70 acaba en
   >   `rgb(31,35,29)` y el 85 en `rgb(32,34,29)` sobre `rgb(21,28,28)`, escalones de **~10**; toda la
   >   rampa —de `rgb(132,100,42)` en el origen a eso— cabe en 71 y 87 px. A `.10`: `rgb(44,43,31)` y
   >   `rgb(45,43,31)`, **~23**.
   > - **Cómo leyó.** La luz como en el listón: una regla clara del borde, con el 99 tocándola. El
   >   borde, a la parada de #93, **no**: en 100 px la rampa entera se gasta antes de la punta, y el
   >   último cuarto de la barra está por debajo de lo que el ojo separa de la superficie; dónde
   >   acababa el 85 era una pregunta con **unos 10 px** de respuesta, y el 70 poco mejor. Lo que
   >   #67 anotó del desvanecido —que entrando como degradado evitaba que la marca leyera como
   >   reborde— era verdad en el techo, donde el hueco es degenerado; a un Level medio en esta
   >   tarjeta el desvanecido no evita nada y sí borra el final. A `.10` el final del 70 y del 85 se
   >   dice a ~2 px, la muesca del 96 se ve, y el 99 sigue tocando la regla sin leer como reborde.
   >   **Es la lectura que decide #71 (#89): el borde era ambiguo a un Level medio en la tarjeta
   >   mayoritaria, y deja de serlo con la parada a `.10`.** Esta mirada, y no la 2, es la que mueve
   >   la cifra. **Decidido el 2026-09-11 (#89):** #71 se cierra como arreglado por esa parada, sobre
   >   esta lectura y ninguna predicción; §9 dice cuál de las cuatro respuestas de #71 es y cuáles no.

4. **El tramo visible.** `VISIBLE_SEGMENT = 6` px es elegido, ni derivado ni juzgado, y decide el
   cajón de cinco filas a 0,06 px: si 6 px de línea leen como línea. A 7 plegarían cinco algoritmos
   más.

   > **Veredicto: 6 px leen como línea, sin margen que regalar. La cifra no se mueve.**
   > - **Tarjeta.** Algoritmo 55 —cinco filas, cuatro columnas, el cajón que la cifra decide— con el
   >   pin, en el suelo del cuerpo: ventana a **1280 × 648**, cuerpo a **382 px** y sin
   >   desplazamiento, lienzo de 282. Listón de 245,1 × 37,2 px sin plegar, cinco datos en dos
   >   líneas; paso de fila 49,62 y **hueco de 12,40 px**, que es 9 unidades de punta a escala
   >   0,705 (6,35 px) más **6,06 px** de línea, la cifra de §4 vista.
   > - **Cómo leyó.** A 3× sobre el hueco entre OP4 y OP5: un asta y una punta, y el asta es
   >   aproximadamente tan larga como la punta. Lee como **una flecha corta**, y no como una punta
   >   apoyada en una tarjeta: hay línea. Pero es el mínimo que lee, no una cifra cómoda: un píxel
   >   menos y la punta se come el asta. Se queda en 6, elegido y ahora **mirado**, con esta nota
   >   como lo único que lo separa de un número al azar. Los cinco datos del listón a 37 px, sin
   >   cortar, con `PREDICTED` y `POLLED` legibles.

5. **La banda plegada: ¿profundidad o nota al pie?** 16 px de banda en 18,7 de tarjeta en el suelo a
   ocho filas.

   > **Veredicto: profundidad.**
   > - **Tarjeta.** Algoritmo 66 con el pin en el suelo del cuerpo (382 px): ocho bandas de
   >   **318,9 × 18,7 px**, todas `node--folded node--squat`, una columna, paso 31,02, hueco 12,35.
   >   Y el 37 a seis filas en el mismo suelo: 318,9 × 29,0.
   > - **Cómo leyó.** Ocho bandas apiladas con siete flechas bajando entre ellas leen como **una
   >   cadena de ocho**, que es lo que el 66 es; la identidad, el rol y el Level se leen en cada
   >   banda a `--text-micro`, y el 71 de OP3 es la única muesca visible en una regla de ocho marcas
   >   que se puede mirar de canto. No es una nota al pie: **es el dibujo**, y lo que perdió —ratio,
   >   glifo, Hz— no se echa de menos para leer la topología. Dos cosas que se vieron y no son de
   >   esta mirada: el sello `POLLED` a `--ink-inert` en 18,7 px es casi invisible (es la tinta que
   >   el sello tiene por diseño, y una banda no es donde se juzga); y la marca de la esquina, de
   >   22 px, en una banda de 18,7 queda recortada a un trazo horizontal con un cabo, pegada al
   >   techo —#94, visto aquí también—. En el 37 la banda es una línea a la cabeza de una tarjeta de
   >   29 px con aire debajo: la mitad de la mirada que #92 tiene.

6. **El dibujo cambiando de forma a mitad de un arrastre**, ahora que el disparador de anchura hace
   al pliegue común: el 1 pliega en la ventana de fábrica, y `KEEP IT BIG` puede cambiarlo.

   > **Veredicto: la pulsación del pin lee; el arrastre no cambia nada, y eso es un hallazgo.**
   > - **Tarjeta.** Algoritmo 7 —dos filas, siete columnas—: en el riel la tarjeta es de **130,0 px**
   >   y pliega (131 es el umbral, `fittedCardWidth()`); con el pin es de **137,2** y no pliega. La
   >   misma pantalla antes y después de `KEEP IT BIG`.
   > - **Cómo leyó.** Ninguna posición se mueve: las siete portadoras y OP1 quedan donde estaban, la
   >   columna se ensancha 7 px, y las tarjetas pasan de cuatro datos a cinco. Se lee como *el pin
   >   ha hecho sitio y el sitio se ha gastado en los datos*, y no sobresalta. Lo que sí se vio: la
   >   tarjeta plegada por estrecha —99 px de alto con dos datos apilados y la mitad de abajo vacía—
   >   no dice que ha plegado; lo único que lo delata es el aire. No es de esta mirada y se anota.
   > - **El hallazgo.** Se arrastró la ventana de 1280 a 1450 px en las dos formas, y el 1 **no se
   >   despliega nunca**: a 1400 con el pin la tarjeta mide 133,0 px, por encima de los 131 que
   >   tienen los cinco datos, y sigue `node--folded`. El disparador de anchura lee
   >   `canvasWidth(shape)`, que es el carril en la ventana de diseño (`DESIGN_BODY_W`) y no el
   >   carril en pantalla, así que el pliegue es una función de *(algoritmo, forma)* y no de la
   >   ventana. Por debajo de 1280 el cuerpo se desplaza y la tarjeta no cambia; por encima, la
   >   tarjeta crece y el pliegue no la sigue. Consecuencia: *a mitad de un arrastre* el dibujo no
   >   cambia de forma jamás, sólo en una pulsación del pin o al vaciar o llenar una ranura. Por
   >   debajo de la ventana de fábrica eso es lo que §5 quería; por encima es una tarjeta que pliega
   >   datos que le caben, y el comentario de `canvasWidth()` —«la tarjeta que juzga es la que hay en
   >   pantalla»— sólo es verdad a 1280. Anotado en §9 y abierto como ticket (#100); no es una cifra que
   >   mover.

7. **Una barra desplazada contra un origen que no se ve.** La decisión de #86 (§5), mirada y no
   argumentada.

   > **Veredicto: no miente; tampoco explica. Se acepta.**
   > - **Tarjeta.** Ventana a **1150 × 800** con el pin: cuerpo a 1150 contra un suelo de 1209,04,
   >   rejilla `999,04 · 0 · 208`, **59 px** de desplazamiento posible. Algoritmo 2 (una columna de
   >   cuatro apilados y cuatro portadoras) y el 1. A 30 px de desplazamiento el primer origen está a
   >   5,6 px del borde y nada está desanclado; a 40 la primera columna lo pierde (pista a −4,4 px)
   >   y las cuatro tarjetas del 2 en esa columna pasan a `node--unanchored`; a 59, el tope, siguen
   >   siendo sólo esas.
   > - **Cómo leyó.** Las cuatro tarjetas de la primera columna, cortadas por el borde izquierdo,
   >   están sin relleno y sin techo y con su cifra; las de las otras columnas siguen midiendo. Lee
   >   como *tarjetas cortadas*, que es lo que son: la cifra sigue siendo verdad y nada en pantalla
   >   afirma una longitud contra un cero que no está. No leen como a cero —el contorno sigue
   >   continuo y del color del rol— ni como caducas. Lo que no leen es *por qué* se fue la tinta:
   >   nada lo dice, y un lector podría tomarlas por tarjetas sin barra. Contra el sticky que §10
   >   descarta, esto es la mentira menor. Se acepta como está. Y el cuerpo entero se desplaza —el
   >   título `ALGORITHM` queda `RITHM`, la leyenda se corre—, que es el comportamiento del eje
   >   vertical en el otro eje, como §5 dice.

8. **La banda del aparcado: ¿lee como fuera de la cadena o como otra fila?** Añadida por #83, que la
   dejó sin mirar; la banda está encima de la fila más honda y en el extremo del origen.

   > **Veredicto: por posición lee como otra fila; lo que la saca de la cadena es la tinta.**
   > - **Tarjeta.** Algoritmo 2 con OP2 a cero (`90 · 0 · 71 · 90 · 90 · 85 · 90 · 99`), con el pin:
   >   la banda en `y = 99`, OP1 en 194, OP3 en 289, OP4 en 385 — el **mismo paso de 95 px** entre
   >   la banda y OP1 que entre OP1 y OP3, en la misma columna, a la misma anchura. También con OP2 y
   >   OP6 a cero (dos en la banda) y el 7 con OP1 a cero (la banda sola sobre siete portadoras).
   > - **Cómo leyó.** Con un solo aparcado en la columna de la cadena, la banda es *la fila de
   >   arriba*: la columna se lee OP2 → OP1 → OP3 → OP4 a primera vista, y hay que ver el contorno
   >   discontinuo, el `ZERO`, el `0`, el cabo con su barra y la flecha discontinua que **sube** para
   >   corregirlo. Todo eso está y corrige; pero la posición, que es lo que esta composición dice
   >   sin rótulo, dice *fila*. Con dos aparcados de ramas distintas, o con la banda sola sobre una
   >   fila, lee mejor —dos tarjetas muertas en lo alto, apartadas— porque ya no está encima de su
   >   propia cadena. §4 dice que la banda es una fila y que eso es lo que cuesta; esta mirada dice
   >   que también es lo que se ve. No hay cifra que mover: la banda no tiene un hueco propio que
   >   ajustar. Abierto como ticket para el dueño (#101), con esta lectura.

9. **La única línea que sube: ¿lee como una ruta hacia un callejón sin salida?** Añadida por #83. La
   ruta inerte hacia un aparcado cruza por debajo de todas las barras a 0,75 del hueco y aterriza en
   la barra a 0,4.

   > **Veredicto: sí.**
   > - **Tarjeta.** La de la 8: OP1 → OP2 con OP2 a cero, `M 136 94 V 88.5 H 136 V 80.8` inerte y el
   >   cabo `M 136 72 V 80.8 M 119 80.8 H 153`, en un hueco de 23,6 px.
   > - **Cómo leyó.** Una línea discontinua con punta que sube hasta una barra horizontal y se para
   >   ahí: lee como **una flecha contra un muro**, que es lo que un callejón sin salida es. La barra
   >   y la punta no se pisan —8 px entre el 0,4 y el 0,75— y la barra se lee como terminal y no como
   >   parte de la flecha. Es la única línea del dibujo que sube y se nota que sube, y eso es lo que
   >   la marca como excepción antes de leer el `0`.

10. **La parada tenue del relleno girado: `.05` contra `.10`.** Añadida por #93 y **no es una mirada
   aparte: es la 2 y la 3 tomadas dos veces.** Está en la lista para que la constante pendiente se
   vea —ese es el trabajo de esta sección—, y se escribe así para que nadie tome la 2 a `.05`,
   escriba un veredicto, y llegue aquí con el veredicto ya en el archivo. Las dos rampas en pantalla
   a la vez, una nota. El instrumento **no tiene la forma de `FOLDING`**: `FOLDING` es un token de
   inyección que alimenta una entrada real de la app, y la parada tenue es una propiedad CSS. El
   banco (#79) sobrescribe `--carrier-fill-faint` / `--modulator-fill-faint` en la raíz y la hoja de
   la app compone las dos rampas ella sola; un banco que dibujara su propio segundo degradado sería
   este mismo defecto reproducido dentro de la herramienta para mirarlo, y sobrescribir el token es
   lo que mantiene honesta la comparación. Lo que decide: si las paradas se separan por composición
   (§2.6 dice por qué podrían), y a qué cifra.

   > **Veredicto: `.10`, en las dos composiciones, y aterriza con #88.**
   > - **Cómo se tomó.** Cuatro rampas sobre la misma tarjeta y el mismo patch, por sobrescritura de
   >   `--carrier-fill-faint` / `--modulator-fill-faint` en `:root` con la hoja de la app componiendo:
   >   `.04`/`.05` (la de #93), `.10`, y las dos **normalizadas a la pista** en vez de a la barra
   >   —la tercera candidata que #88 anotó, hecha con `background-size` sobre `.node__fill` para la
   >   mirada y no con un segundo degradado—. Sobre el nodo apilado del 1 en el riel y el listón del
   >   79, y la rejilla del 2 a las dos paradas.
   > - **Medido**, último píxel del relleno sobre `rgb(21,28,28)`, canal más alto: por barra a `.04`,
   >   **~8–13** a todo Level; por barra a `.10`, **~23**; por pista a `.04`, de 16 (99) a 91 (20);
   >   por pista a `.10`, de 24 a 94.
   > - **Cómo leyó.** Por barra a `.10` lee en las dos tarjetas: el final de cada barra se puede
   >   decir, el 96 enseña su muesca en la tarjeta de 100 px, y la barra sigue siendo tinta que se
   >   disuelve hacia la punta y no un bloque. Por pista invierte la pregunta: la barra corta acaba
   >   en tinta densa y lee como un **bloque de progreso** —el 20 y el 45 son rectángulos—, y las
   >   largas, que son las que el techo compara, acaban igual de tenues que antes; hace fácil lo que
   >   ya leía y deja igual lo que no. En la rejilla, `.10` no convierte el techo en reborde: el 99
   >   toca la regla y la regla sigue siendo la regla. Así que **una cifra y no dos**: no hay motivo
   >   juzgado para separarlas por composición, y §2.6 sólo tenía uno hipotético. Coincide con el
   >   dígito tenue de la hoja (`.10`), y no se adopta *de* la hoja: sale de la comparación, y la
   >   parada densa no se toca (§10). `--signal-fill-faint` se queda en `.04`: sin consumidor y sin
   >   mirada.

**Más una comprobación de instrumento, con el MODX conectado:** que un operador a Level 0 no emite
nada, de modo que modularlo es inaudible. Es la única regla de la ronda cuyas condiciones de verdad
viven enteras fuera del código. Nota sostenida, aparcar el operador modulado, capturar, no ver nada.
Lo que falsaría: la decisión 5 de §2 dice que la ruta *entrante* lleva tinta inerte porque lo que
modula no tiene salida; si un operador a cero sí saliera, la tinta estaría diciendo algo falso y la
ruta debería dibujarse llena. **Se debe, y sigue debida el 2026-09-11 (#88): las diez miradas se
tomaron en el banco sin instrumento, y esta no se puede tomar ahí.** Queda para la próxima sesión
con el MODX conectado; #90 la lista como debida.

## 9 · Consecuencias

- Toda frase de la app o de los documentos que diga hacia dónde corre el Level tiene que decir **en
  qué composición**, y ninguna puede leerlo de la forma de la caja. Las entradas *Techo del patch* y
  *Pista del relleno* de `CONTEXT.md` están hoy mal en los dos sentidos —una línea a través de los
  ocho; un hueco fijo *arriba*— y #87 las corrige sin ninguna palabra de dirección en ninguna de las
  dos. #93 le añade a #87 una **tercera**, la tinta del relleno —densa en el origen del eje que su
  composición declara, desvanecida hacia el extremo lejano; ni *abajo* ni *a la izquierda*—, con el
  sustantivo por elegir, y **bloqueada en #93**: en el árbol anterior a #93 la frase era falsa en la
  ancha, y #93 no hace a las dos entradas viejas más falsas de lo que ya eran, que es por lo que la
  deja a #87 en vez de tocar `CONTEXT.md` con el código.
- Hasta #93 la luz del techo en la ancha no era una cantidad —~20 en la cabeza de la barra y ~89 en
  su pie a lo largo de una misma regla— y las miradas 2 y 3 no eran preguntas bien planteadas. #93
  es lo que las hace contestables, y no sólo lo que pone la tinta a lo largo del eje; por eso #88 las
  toma sólo después de que aterrice, y #89 con ellas.
- El dibujo pliega en la ventana de fábrica (el 1), así que el pliegue es algo que el pianista ve
  ocurrir en una pulsación del pin, no un caso de dos entre ochenta y ocho. La mirada 6 existe por
  esto, y #92 es su otra mitad. **Y no en un arrastre** (#88, §8 · 6): el disparador de anchura
  lee `canvasWidth(shape)`, que es el carril de la ventana de diseño y no el de la pantalla, así que
  el pliegue es función de *(algoritmo, forma)* y la ventana no lo mueve en ningún sentido. Por
  debajo de 1280 eso es lo que §5 quiere —el cuerpo se desplaza y la tarjeta no cambia—; por encima
  es una tarjeta plegando datos que ya le caben (el 1 a 1400 px con el pin mide 133 y sigue plegado
  contra un umbral de 131), y el comentario de `canvasWidth()` sólo es verdad en la ventana de
  fábrica. Es un hallazgo y no una cifra: abierto como ticket (#100), sin decidir aquí si el disparador
  debe medir.
- La banda del aparcado **lee como una fila** cuando está sola encima de su propia cadena (#88,
  §8 · 8): mismo paso, misma columna, misma anchura, y lo que la saca de la cadena es la tinta —el
  contorno discontinuo, el `0`, el cabo y la flecha que sube— y no la posición. §4 ya decía que la
  banda es una fila y que eso es lo que cuesta; la mirada dice que también es lo que se ve. Sin
  cifra que mover; abierto como ticket para el dueño (#101).
- La parada tenue del relleno es **`.10`** en los dos roles y las dos composiciones (#88, §8 · 10),
  **y #71 está cerrado sobre ella (#89, 2026-09-11)**, a partir de la lectura de la mirada 3 y no de
  un argumento: el borde lejano era ambiguo a un Level medio —`70 · 85`, unos 10 px de respuesta en
  la pista de 100 px de la tarjeta mayoritaria— con la parada de #93, y se dice a ~2 px con esta. De
  las cuatro respuestas que #71 dejaba abiertas, la tomada es **el suelo al alfa de la rampa**, y la
  tomó #88 con su lectura adjunta; el filete en la punta y la parada dura no se tocan (§10); y la
  cuarta —que el desvanecido es el dibujo honesto de una cantidad sin final nítido— sobrevive en la
  tinta, porque a `.10` la barra sigue disolviéndose hacia la punta y no es un bloque (§8 · 10). El
  caso que daba nombre al ticket —la tarjeta chata de 24 px con 14 px de relleno— no existe en
  ningún árbol desde la rotación: el listón mide por su largo de 291 px y la banda plegada de
  18,7 px lleva ese mismo largo, así que la pregunta se contestó donde ahora ata, en la pista de
  100 px. Lo que no se miró y se dice: el borde de un Level medio en la rejilla a `.10`. #71 decía
  que en la rejilla leía a `.04`, y lo único que `.10` podía romper ahí era el reborde del techo,
  que la 10 midió y no apareció.
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
- **Un segundo token por rol con la dirección dentro** (`--carrier-fill-along`). El cambio más
  pequeño y dos declaraciones por rol que hay que mantener a mano; pero lo que lo descarta es que el
  literal `to right` viviría en un token, y el banco no sustituye `var()`: un eje que ninguna prueba
  puede afirmar, que es el defecto de #93 con otro nombre. §2.6.
- **Componer la rampa por rol y por composición.** Cuatro `background` para dos roles, seis con el
  fósforo, el doble con una tercera composición: las dos declaraciones «a mano» del anterior
  reapareciendo dentro de la solución a mayor escala. El rol pone las paradas y la composición la
  dirección; nunca el producto. §2.6.
- **Adoptar la rampa de la hoja (`.40 → .10`) en la ancha.** La hoja dibuja seis rampas para una
  convención y todas son `rgba` tecleado a mano; la tinta de la app sería distinta por composición
  sin que ninguna mirada lo hubiera pedido. Lo que se lleva es la convención, provisional, y la
  cifra se decide por comparación (§8, 10). Que la comparación diera `.10` —el dígito tenue de la
  hoja— no reabre esto: la parada densa sigue siendo la de la app (`.50` / `.46`, no `.40`), la
  cifra es la misma en las dos composiciones, y sale de una lectura en la tinta de la app y no de la
  hoja.
- **Normalizar la rampa a la pista y no a la barra** (la tercera candidata de #88, §8 · 10). Hace que
  una barra corta acabe en tinta densa y lea como un bloque de progreso —el miedo de §10c de la hoja,
  materializado—, y deja a las largas, que son las que el techo compara, exactamente igual de tenues
  que antes: hace fácil lo que ya leía y no toca lo que no. Mirada sobre la misma tarjeta y el mismo
  patch que la ganadora.
- **Separar la parada tenue por composición.** §2.6 tenía una razón hipotética —en vertical evita el
  reborde, girada es la punta que mide—; la rejilla a `.10` no enseñó el reborde, así que la razón
  no se convirtió en una juzgada, y dos cifras para una tinta sin una mirada que las separe es una
  cifra de más.
- **Un filete en la punta del relleno, o una parada dura en la rampa** (las dos primeras respuestas
  de #71; #89). No se miraron, y no se descartan por una mirada sino por no hacer falta: a `.10` la
  mirada 3 sitúa el final del 70 y del 85 a ~2 px sin ningún borde duro, y un filete sería tinta
  cambiada que ninguna lectura pidió, que es el trato con el que #89 se escribió. Si una mirada
  futura dijera que ~2 px no bastan, la candidata es esta y entra con esa lectura, no desde aquí.
- **Estado «propuesta» hasta que se tomen las miradas.** El código ya la implementa; una propuesta
  implementada no es una cosa. Lo que la mirada 1 puede hacer no es enmendarla sino sustituirla, y eso
  está escrito en §3.
- **Fijar la columna del origen y desplazar sólo la pista** (#86, §5). No hay columna que fijar: las
  tarjetas son porcentajes de un solo `viewBox` que el panel estira, así que «la columna del origen»
  es una fracción de un SVG y no una caja que el cuerpo pueda sujetar. Fijar el dibujo entero con
  `position: sticky` sí se puede, y es peor: la columna de cifras se desliza *por encima* del
  extremo alto de las barras al ir a buscarla, que es cambiar una mentira por otra. Y repartir el
  dibujo en columnas del DOM para poder fijar una sería rehacer la composición ancha por un caso
  que sólo existe por debajo de un suelo que la ventana de fábrica no cruza.
- **Un `minWidth` en la ventana de Tauri** (#86, §5). Una constante, y el suelo es dos: 1 263 con
  el riel y 1 209 con el pin. Puesta al riel sobre-restringe el pin en 54 px; puesta al pin deja al
  riel 54 px por debajo de lo legible. El mínimo va en la pista de la rejilla, que lo suma por forma.
- **Dejar de afirmar el eje para el dibujo entero en cuanto sale el primer origen** (#86, §5). Más
  simple y menos honesto: siete tarjetas con su cero en pantalla perderían la barra por el cero de
  una octava. El origen es de la columna; la tinta se va con el borde que se ha ido, y no antes.

# MODX Analyzer

Herramienta de escritorio para aprender síntesis FM-X con un Yamaha MODX8 delante: lee el teclado
por SysEx, captura y analiza su audio, escribe parámetros de vuelta y convierte la diferencia entre
dos estados en una lección. El vocabulario de abajo es el que usan el diseño, las mediciones y el
código; cuando el papel y la medida discrepen, manda la medida.

El vocabulario es castellano y la pantalla habla inglés: la palabra que un término lleva en
pantalla es una propiedad del término, no su sustituto, y se anota como _Pantalla_. La lista de
esas palabras la fija `design_handoff/GLOSSARY.md` §6.

## Language

### El teclado y su estado

**Performance**:
Lo que el usuario carga en el MODX; contiene hasta 16 Parts. La app no puede cargarla ni cambiarla,
sólo detectar que cambió.

**Part**:
Una de las 16 ranuras de una Performance. Fase 1 trabaja sólo con la Part 1, de tipo FM-X.

**Patch**:
El estado completo de la Part 1 FM-X tal como está en el buffer de edición: algoritmo, feedback,
cadena y los ocho operadores.
_Avoid_: preset, voice, sonido (sólo en texto de pantalla dirigido al usuario)

**Buffer de edición**:
La memoria volátil del MODX donde viven los valores actuales. Todo lo que la app escribe va ahí y
desaparece al apagar el teclado.

**Memoria del MODX**:
El almacenamiento persistente del teclado. La app nunca escribe en él.

**Operador**:
Una de las ocho unidades FM-X de una Part. Su rol lo da el algoritmo, no el operador.

**Algoritmo**:
Número 1–88 que fija la topología entre los ocho operadores. Es la topología: no hay matriz de
rutado aparte.
_Pantalla_: `ALGORITHM` en el panel; `ALG 37` en la píldora de cabecera.

**Portadora / Modulador / Inactivo**:
Los tres roles de un operador. Portadora y modulador se derivan de la topología del algoritmo;
inactivo es un operador con Level 0, sea cual sea su posición.
_Pantalla_: `CARR` / `MOD` / `ZERO` en el nodo; `CARRIERS · YOU HEAR THESE` / `MODULATORS · THEY COLOUR IT` / `AT ZERO · SILENT` en la leyenda.

**Techo del patch**:
El Level más alto que hay entre los ocho operadores, dibujado como una línea a la misma altura en
los ocho nodos. No es del rol de ningún operador: es del patch, y por eso es lo único de la leyenda
que no nombra un rol. Existe porque los patches reales agrupan sus operadores entre 71 y 99, donde
ocho alturas absolutas se ven iguales; contra una línea compartida lo que se lee son los **huecos**,
que son siete y son la comparación que importa. Es siempre el Level más alto leído, nunca una cifra
fija.
El techo es una **medida** y se calcula siempre; lo que se suprime es la línea, y se suprime por dos
razones distintas que no hay que confundir. Sin nada leído no hay techo, porque no hay Level del que
ser el más alto. Con los ocho leídos a cero sí hay techo y vale 0, y la línea tampoco se dibuja: no
por falta de cifra, sino porque contra un suelo plano no hay huecos que hacer, y `THE LOUDEST
OPERATOR IN THIS PATCH` estaría nombrando a uno callado.
_Avoid_: techo fijo, máximo, 99
_Pantalla_: sin palabra en el nodo —es una línea—; en la leyenda, `THE LOUDEST OPERATOR IN THIS PATCH`.

**Pista del relleno**:
La escala contra la que se dibuja el Level: el interior del nodo menos un hueco constante arriba. El
relleno **era** la tarjeta, así que un Level de 99 sobre 99 dejaba un uno por ciento por encima y el
techo caía dentro del propio borde, donde no había nada que ver —que es el patch de arranque, y es
lo primero que abre cualquiera (#67)—. El Level sigue siendo la altura del relleno, lineal y anclado
en cero: lo que se ha separado de la cifra es el borde que hacía de tope. El hueco se mide en píxeles
y nunca en porcentaje, porque un hueco proporcional cambia con la forma de la columna y vuelve a
cerrarse en la composición donde la tarjeta es más pequeña.
_Avoid_: margen, padding del relleno, hueco relativo
_Pantalla_: nada —es donde la escala deja de estar, no algo que se dibuje—.

**Cadena**:
Lo que hay entre los operadores y la salida Main L/R de la Part: filtro, inserciones, EQ y sends.
Está **limpia** cuando no interviene (se mide FM puro) y **sucia** cuando sí.
_Pantalla_: `CLEAN CHAIN` / `DIRTY CHAIN · THIS IS NOT PURE FM`; el botón, `CLEAN THE CHAIN`.

### Leer y escribir

**Dirección**:
La terna `ah am al` que identifica un parámetro en SysEx.

**Dirección reservada**:
Dirección que contesta a una lectura como si fuera real pero no debe escribirse. No se puede
descubrir sondeando: la lista sale del Data List.

**Dirección de sólo lectura**:
Dirección que se lee, y puede emitir, pero no acepta escritura (`30 4B 00`, el Super Knob). La app
la aprende midiendo y la recuerda.

**Sondeo**:
Obtener el estado del teclado leyendo direcciones a intervalos, porque el teclado no notifica
ediciones, navegación ni cambios de Performance.
_Pantalla_: `POLLING` en el cajón; el interruptor, `POLL` / `STOP POLLING`.

**Anillo**:
Un conjunto de direcciones que se sondea cíclicamente con su propia cadencia. El **anillo ancho**
vigila pocos parámetros de los ocho operadores; el **anillo estrecho** vigila los 43 del operador
abierto. Comparten canal, así que abrir un operador ralentiza el ancho.

**Barrido**:
Pedir **todas** las direcciones de un bloque, una a una, sin escribir nada, para saber cuáles
contestan y con qué. No es una relectura: la relectura pregunta por los parámetros que la tabla
dice que hay, y un barrido pregunta por los 47 huecos del bloque precisamente porque la tabla es lo
que se está poniendo a prueba. Es la única forma de contestar dos cosas: si `am = (op<<4)|parte`
vale más allá de la Part 1 —medido sólo ahí— y cuántos de los 47 del bloque `49 op` contestan de
verdad, que es la contradicción entre el Data List (39) y el barrido de la fase 0c (43).
_Avoid_: escaneo, sondeo (un sondeo es cíclico y un barrido es una pasada)
_Pantalla_: `SWEEP`.

**Ancla**:
El nombre de la Part 1 (`31 00 00`–`13`), sondeado a 1 Hz. Su cambio es la única señal de que la
Performance cambió por debajo. Una pasada a la que le falte una letra no es un nombre nuevo: se
descarta entera, porque un blanco por un timeout invalidaría toda la pantalla. Su agujero conocido:
dos Performances cuyo nombre de Part 1 coincida son, para el ancla, la misma.
_Pantalla_: `ANCHOR`. Ni la cadencia ni la dirección van en la cabecera.

**Aval**:
El latido del ancla que convierte una lectura del anillo en cifra dibujada. Una lectura cuyo valor
difiere del que ya está en pantalla no se pinta hasta que un latido **empezado después de ella**
conteste que el nombre no ha cambiado; si contesta que sí cambió, esa lectura se tira sin haberse
visto nunca. Una lectura que repite el número dibujado no necesita aval: si viniera de otra
Performance diría de ella exactamente lo mismo, y por eso un teclado en reposo no pide ninguno. El
anillo puede pedir un latido fuera de turno mientras retiene algo, y el ancla se lo da o no según el
puerto (ADR-0005). Un aval no sabe más que el ancla que lo firma: hereda su agujero entero. Una Medida también lo necesita: su ventana mira 1,5 s hacia atrás y el ancla tarda hasta un segundo en ver un cambio, así que una Medida sólo se pinta cuando un latido empezado después de su última muestra contesta que el nombre no cambió y el latido anterior a su primera muestra leyó el mismo nombre; si contesta que cambió, se tira sin haberse visto.
_Avoid_: confirmación, validación

**Relectura**:
La lectura completa del patch —una petición por parámetro de `48 0p` y de los ocho `49 op`— al
arrancar y después de cada cambio de ancla. Se ve ocurrir (`118 DE 384`); después toma el relevo el
anillo. Son 384 y no las 416 del diseño porque el barrido de la fase 0c pedía byte a byte y un
parámetro de dos bytes contesta entero desde su primera dirección, y porque la contradicción de
`49 op 2A` sigue sin resolver (`docs/results`).
_Pantalla_: `REREAD · 118 OF 384`.

**Desconectado**:
El puerto `MODX-1` ha desaparecido de la enumeración, o el ancla lleva tres timeouts seguidos. Un
solo timeout ya es anómalo (0 pérdidas en 27 000 peticiones), pero uno solo no es desconexión.
_Avoid_: sin respuesta, offline
_Pantalla_: `DISCONNECTED`.

**Nota viva**:
Una altura que el teclado tiene pulsada ahora, según sus Note On/Off. Se cuenta por altura
distinta, no por mensaje, porque en modo Multi una tecla llega una vez por Part.
_Pantalla_: `HELD` (`NEEDS A HELD NOTE`, `3 HELD`).

**Escritura verificada**:
Toda escritura al teclado se relee. Pasa por `pendiente → releída → confirmada | fallida`; una
escritura sin confirmación nunca se pinta como buena.
_Pantalla_: `UNCONFIRMED` / `WRITTEN AND VERIFIED · ✓ read back` / `REPAIR AND VERIFY`.

**Copia**:
Un estado del patch guardado por la app y restaurable con un toque. Es el término de cara al
usuario; tiene dos formas, que no restauran igual: el volcado de seguridad y el snapshot.
_Avoid_: backup, respaldo

**Volcado de seguridad**:
La forma de Copia que es un bulk dump del buffer de edición (`0E 25 00`, 7 669 bytes). Se toma al
arrancar y antes de que la app escriba nada, y se restaura byte a byte con un solo envío.
_Pantalla_: `SAFETY DUMP`.

**Snapshot**:
La forma de Copia que es parámetro a parámetro (las mismas direcciones que la relectura). Restaurarlo es verificar y
reparar, no escribir en orden, porque escribir un parámetro puede modificar otro.

**Pánico**:
All Sound Off + All Notes Off + 2 048 Note Off explícitos por los 16 canales. No toca ningún
parámetro, no cierra el puerto y no pide confirmación. Antes de mandar para el generador de notas:
es lo único de la app que un pánico cambia, y lo cambia porque un generador que siguiera generando
metería un Note On detrás de los 2 080 mensajes que iban a ser el final.
_Pantalla_: `HUSH`.

**Generador de notas**:
El patrón de notas densas que la app manda por el mismo puerto para cargar el puente (#8): un acorde
de cuatro alturas que se mueve cada 40 ms por el canal 1. Es un **instrumento de medida y no una
función**: va el último de todos los carriles (ADR-0004), cuenta aparte lo que pidió y lo que salió,
y suelta todas las teclas que pulsó pase lo que pase con su bucle. Junto al pánico, son los dos
únicos emisores de mensajes de canal de esta sesión.
_Avoid_: secuenciador, reproductor
_Pantalla_: `GENERATOR`, en el cajón de instrumentos; sus botones, `DENSE NOTES` / `STOP`.

### Procedencia de una cifra

Cada cifra en pantalla lleva exactamente uno de estos sellos.

**Medido**:
Sale de una Medida sobre audio real.
_Pantalla_: `MEASURED`, con el tamaño de la ventana (`MEASURED · 65536`); contorno continuo.

**Teoría**:
Calculado a partir de parámetros (Bessel, formas espectrales). Nunca se confunde con medido.
_Pantalla_: `PREDICTED`; contorno discontinuo. La palabra se eligió porque es la única que dice que la cifra puede estar mal.

**Sondeado**:
Leído del teclado por SysEx, con marca de tiempo, y avalado. Una lectura sin Aval no lleva este
sello porque no llega a pintarse: no hay un sexto sello para «leído pero todavía no sé de qué
sonido».
_Pantalla_: `POLLED`, una vez por zona y con la cadencia (`POLLED · 10.4 Hz`).

**Caduco**:
Sondeado hace más de cuatro periodos de su propio anillo. Sigue siendo de este patch.
_Pantalla_: Sin palabra propia: `POLLED · 0.40 s` (la edad en vez de la cadencia) y contorno partido.

**Invalidado**:
Pertenece a un patch anterior: el ancla cambió. Conserva su forma y pierde su cifra; no se recupera
solo si era una Medida.
_Avoid_: muerto, pausado, congelado
_Pantalla_: Sin palabra: un guion dentro del contorno, que se conserva. En la cabecera, una vez, `NOT MEASURED IN THIS SOUND`.

### Audio

**Vista viva**:
Scope, espectro, armónicos y waterfall a ~30 fps sobre FFT corta. Son **cuatro y no tres**: los
armónicos se comían de la lista por vivir pegados al espectro, pero se alimentan de la trama igual
que los otros, llevan el sello `LIVE` igual que los otros y no se invalidan igual que los otros. Las
cuatro son exactamente las que una Ranura puede tener dentro. Es audio que entra ahora: nunca se invalida.
Sus cifras no llevan ninguno de los cinco sellos de procedencia —no salen de una Medida, ni de un
sondeo, ni de una fórmula— sino el sello **`LIVE`** de su zona, con la cadencia medida al lado.
_Pantalla_: `LIVE`, con la cadencia (`LIVE · 30 fps`).

**Medida**:
FFT larga disparada explícitamente sobre una nota sostenida. Produce parciales, fc, fm, ratio
medido, índice I ajustado y artefactos, y lleva sello con tamaño y antigüedad. No se pinta sin Aval: la ventana ya estaba grabada cuando se pulsó, y una Medida a caballo de un cambio de Performance sería una cifra válida a la vista de un sonido que no es.
_Avoid_: medición (como nombre del resultado)
_Pantalla_: El acto es `CAPTURE · 65536`; el resultado no tiene nombre en pantalla, sus cifras llevan `MEASURED` y la última se llama `LAST CAPTURE`.

**Mirar / Medir**:
Los dos actos distintos del transporte: mirar late en continuo, medir es un obturador que se pulsa.
_Pantalla_: `LIVE` / `CAPTURE`: un estado y un acto, para que la gramática los separe antes que la lectura.

**Obturador**:
El control que dispara una Medida: un componente en dos sitios —la cabecera, donde vive el
transporte, y el pie de la columna medida, donde el ojo ya está—. **El acto es Medir y el obturador
es el control**, y los dos se nombran aparte porque no leen el mismo hecho: el obturador se **arma**
con audio entrando y el anillo sin pausar, mientras que su pista se escribe desde la Nota viva. Que
esté armado sin ninguna nota pulsada no es un fallo: es lo que hace que exista la respuesta «el
obturador se abrió sobre un silencio».
_Avoid_: botón de captura, disparador
_Pantalla_: `CAPTURE`, con la ventana (`65536`) y debajo `NEEDS A HELD NOTE` o `3 HELD`.

**Bloque**:
Un paquete de muestras crudas (f32, Main L/R) que el lado nativo entrega al front tal cual salen
del dispositivo. No lleva análisis.

**Trama**:
Un paquete de resultados de la vista viva, ya analizado y listo para dibujar. Presupuesto: 33 ms.
_Avoid_: frame (en prosa), bloque
_Pantalla_: `FRAME` (`22 FRAMES` en el pie del waterfall). En la prosa de este documento sigue siendo trama.

**Puente**:
El camino entero de un bloque, desde el callback del dispositivo hasta el worker: tres callbacks,
dos sellos monótonos, el IPC y la transferencia. Se mide, no se prueba. Tiene tres **tramos**, y una
latencia que no diga en cuál de ellos se pasó la espera no dice nada (#23): la **cola** —lo que el
bloque espera entre el hilo del audio y el que alimenta el IPC—, el **IPC** —el encode, el canal de
Tauri y el bucle de eventos del webview— y el **worker** —lo que espera detrás de las tramas que ya
tenía encoladas—. Dos de los tres se miden con un solo reloj y son exactos; sólo el IPC salta de
época, y es de él de donde se resta el suelo, así que los tres siguen sumando el total.
_Avoid_: pipeline, canal (el canal es el de Tauri, que es un tramo y no el camino)
_Pantalla_: `BRIDGE`, en el cajón de instrumentos; sus tres tramos, `QUEUE · IPC · WORKER`.

**Arranque**:
Los primeros cinco segundos de una captura, contados aparte del resto. Un percentil tomado sobre una
ventana que todavía contiene un estallido es una cifra sobre el arranque con el nombre del puente: a
132 bloques el `p99` marcó 167,9 ms y a 4 917 todavía marcaba 150,2. Ni se promedia ni se esconde:
sus bloques se cuentan, el peor se dibuja entero y partido en sus tres tramos, y los percentiles
dicen **sobre cuántos bloques** hablan. **No es una excusa**: cinco lanzamientos del 2026-09-09
dieron un bloque 204,9 ms tarde a los 48,5 s y tres arranques sin estallido ninguno, así que la
ventana sirve para contar el arranque con honradez y nunca para hacer pasar una cifra (ADR-0006). Lo
que sobreviva a la ventana sale en el `max` de después, con su hora puesta.
_Avoid_: calentamiento, warm-up
_Pantalla_: `LAUNCH` (`LAUNCH 167 BLOCKS max …`). Nunca *warm-up*.

**Parón**:
El rato más largo que el frente pasó sin recibir ningún bloque. Con bloques cada 30 ms, un parón sano
mide unos 30. Existe porque un `max` solo no distingue un bloque lento de una ausencia: si el frente
deja de recibir 50 ms y luego se pone al día de golpe, el peor de esos bloques parece una entrega
tardía y no lo es. Medido en el hilo principal, y su compañero es el **bucle** —lo tarde que ese
mismo hilo llega a su propio temporizador de 25 ms, que no sabe nada de audio—. Cuando los dos
coinciden en el mismo segundo, la tardanza del puente es un síntoma del hilo y no del camino.
_Avoid_: hueco (un hueco es un bloque que no llegó nunca), corte
_Pantalla_: `STALL`; su compañero, `LOOP`.

**Enganche**:
Lo que el scope hace con la traza: se engancha a la fundamental de la nota viva —la fc de la
última Medida cuando la hay, la altura de la nota cuando no—, enseña exactamente cuatro periodos
con sus fronteras dibujadas y dice cuánto dura la ventana. Nunca cuenta cruces de cero: un timbre
FM brillante cruza el cero varias veces por periodo, y eso es lo que convirtió 349,23 Hz en 43,8.
Cuando no puede engancharse lo dice, dibuja la ventana cruda en el registro de la teoría y nombra
la causa (sin nota viva, altura inestable, más de una nota, sin Medida). Que la onda se quede
quieta es una afirmación sobre el enganche, no sobre el sonido. La palabra es castellana a
propósito: el término es del dominio y la pantalla dice `LOCKED`, igual que trama/frame.
_Avoid_: disparo, trigger (nombran el mecanismo descartado)
_Pantalla_: `LOCKED 349.23 Hz · 4 CYCLES · 11.5 ms`; `NO LOCK · no held note` / `pitch unstable` / `MORE THAN ONE NOTE`; `SIGNAL BELOW FLOOR` cuando el pico a pico no supera el suelo en 6 dB.

**Artefacto**:
Parcial que no es armónica y se conoce su origen (el comb de 2 756,25 Hz del generador). Se marca
con su frecuencia; no se oculta y no cuenta como armónico.
_Pantalla_: `NOT A HARMONIC · 2756 Hz`, siempre con la frecuencia. La palabra «artefacto» no sale en pantalla.

**Suelo**:
La mediana de los bins del espectro, en dBFS absolutos. No es relativo al pico: las cifras de la
fase 0 (−104 sobre los WAV de oro) se tomaron «rel. al pico» y llevan ese calificativo allá donde
se citen, porque comparadas con un suelo absoluto dirían que la app está rota. Con el suelo del
flujo USB en vivo el comb del generador queda por debajo y los chips `NOT A HARMONIC` siguen
saltando porque el buscador de parciales tiene su propio umbral absoluto.
_Avoid_: ruido de fondo, suelo relativo
_Pantalla_: `FLOOR −66 dBFS`.

**Vector de oro**:
Cada uno de los cuatro WAV de la fase 0 con resultado conocido. Son los tests de regresión del DSP
y valen sin teclado.

### La pantalla

**Composición**:
Una de las **dos** disposiciones de los mismos elementos de la pantalla principal. La **ancha** le da
la holgura entera al diagrama del algoritmo; la **estrecha** abre la columna de cristal a su lado. No
son dos pantallas ni dos modos: son los mismos elementos con otro reparto, y la transición se
interpola porque las dos son la misma lista de carriles.

Elige entre ellas **el estado de las dos Ranuras**, y antes elegía si había una Medida. Es un cambio
de causa y no de mecanismo: con las dos ranuras vacías, o con el pin echado, la composición es ancha.
La composición decide además cuál de los dos dibujos del algoritmo se ve, y por tanto cuál es el que
enseña la topología por la posición (ADR-0007).
_Avoid_: modo, vista, layout

**Ranura**:
Una de las **dos** posiciones fijas de la columna de cristal. Cada una tiene dentro una Vista viva —
las cuatro— o nada, y su geometría **no depende de lo que haya en la otra**: la de arriba es siempre
la mitad de arriba. Una ranura vacía es cristal vacío y no un panel que se estira.

Dos y nunca tres, y fijas y nunca configurables: la tesis de la app es que la composición se aprende
y la posición enseña, y en cuanto el número o el sitio se pudieran cambiar ninguna frase de la
aplicación podría volver a decir «arriba a la derecha». Un elector sobre cuatro paneles sigue siendo
un elector; una rejilla que el usuario coloca ya no lo es.
_Avoid_: pestaña, panel configurable, hueco
_Pantalla_: sin palabra propia — el título del panel **es** su selector (`SPECTRUM ▾`); con las dos
vacías queda el asa, del mismo vocabulario que el cajón cerrado.

### Modos y enseñanza

**Crear**:
Modo en que el usuario hace el sonido y la app le sigue y le enseña qué pasa.
_Pantalla_: `BUILD`.

**Aprender**:
Modo en que el tutor lleva de la mano paso a paso y puede escribir en el teclado.
_Pantalla_: `LEARN`.

**A/B**:
Modo de la pantalla principal para comparar dos valores del mismo parámetro. No es una pantalla.

**Lección / Paso**:
Una lección es una secuencia de pasos; un paso es un conjunto de parámetros con un estado
restaurable. Volver a un paso es restaurar, sin castigo.

**Ruta de menú**:
La secuencia literal de pantallas del MODX que el usuario tiene que recorrer para hacer lo que la
app no puede hacer por él.

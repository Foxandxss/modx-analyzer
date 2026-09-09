# MODX Analyzer

Herramienta de escritorio para aprender síntesis FM-X con un Yamaha MODX8 delante: lee el teclado
por SysEx, captura y analiza su audio, escribe parámetros de vuelta y convierte la diferencia entre
dos estados en una lección. El vocabulario de abajo es el que usan el diseño, las mediciones y el
código; cuando el papel y la medida discrepen, manda la medida.

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

**Portadora / Modulador / Inactivo**:
Los tres roles de un operador. Portadora y modulador se derivan de la topología del algoritmo;
inactivo es un operador con Level 0, sea cual sea su posición.

**Cadena**:
Lo que hay entre los operadores y la salida Main L/R de la Part: filtro, inserciones, EQ y sends.
Está **limpia** cuando no interviene (se mide FM puro) y **sucia** cuando sí.

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

**Ancla**:
El nombre de la Part 1 (`31 00 00`–`13`), sondeado a 1 Hz. Su cambio es la única señal de que la
Performance cambió por debajo. Una pasada a la que le falte una letra no es un nombre nuevo: se
descarta entera, porque un blanco por un timeout invalidaría toda la pantalla. Su agujero conocido:
dos Performances cuyo nombre de Part 1 coincida son, para el ancla, la misma.

**Aval**:
El latido del ancla que convierte una lectura del anillo en cifra dibujada. Una lectura cuyo valor
difiere del que ya está en pantalla no se pinta hasta que un latido **empezado después de ella**
conteste que el nombre no ha cambiado; si contesta que sí cambió, esa lectura se tira sin haberse
visto nunca. Una lectura que repite el número dibujado no necesita aval: si viniera de otra
Performance diría de ella exactamente lo mismo, y por eso un teclado en reposo no pide ninguno. El
anillo puede pedir un latido fuera de turno mientras retiene algo, y el ancla se lo da o no según el
puerto (ADR-0005). Un aval no sabe más que el ancla que lo firma: hereda su agujero entero.
_Avoid_: confirmación, validación

**Relectura**:
La lectura completa del patch —una petición por parámetro de `48 0p` y de los ocho `49 op`— al
arrancar y después de cada cambio de ancla. Se ve ocurrir (`118 DE 384`); después toma el relevo el
anillo. Son 384 y no las 416 del diseño porque el barrido de la fase 0c pedía byte a byte y un
parámetro de dos bytes contesta entero desde su primera dirección, y porque la contradicción de
`49 op 2A` sigue sin resolver (`docs/results`).

**Desconectado**:
El puerto `MODX-1` ha desaparecido de la enumeración, o el ancla lleva tres timeouts seguidos. Un
solo timeout ya es anómalo (0 pérdidas en 27 000 peticiones), pero uno solo no es desconexión.
_Avoid_: sin respuesta, offline

**Nota viva**:
Una altura que el teclado tiene pulsada ahora, según sus Note On/Off. Se cuenta por altura
distinta, no por mensaje, porque en modo Multi una tecla llega una vez por Part.

**Escritura verificada**:
Toda escritura al teclado se relee. Pasa por `pendiente → releída → confirmada | fallida`; una
escritura sin confirmación nunca se pinta como buena.

**Copia**:
Un estado del patch guardado por la app y restaurable con un toque. Es el término de cara al
usuario; tiene dos formas, que no restauran igual: el volcado de seguridad y el snapshot.
_Avoid_: backup, respaldo

**Volcado de seguridad**:
La forma de Copia que es un bulk dump del buffer de edición (`0E 25 00`, 7 669 bytes). Se toma al
arrancar y antes de que la app escriba nada, y se restaura byte a byte con un solo envío.

**Snapshot**:
La forma de Copia que es parámetro a parámetro (las mismas direcciones que la relectura). Restaurarlo es verificar y
reparar, no escribir en orden, porque escribir un parámetro puede modificar otro.

**Pánico**:
All Sound Off + All Notes Off + 2 048 Note Off explícitos por los 16 canales. No toca ningún
parámetro, no cierra el puerto y no pide confirmación. Antes de mandar para el generador de notas:
es lo único de la app que un pánico cambia, y lo cambia porque un generador que siguiera generando
metería un Note On detrás de los 2 080 mensajes que iban a ser el final.

**Generador de notas**:
El patrón de notas densas que la app manda por el mismo puerto para cargar el puente (#8): un acorde
de cuatro alturas que se mueve cada 40 ms por el canal 1. Es un **instrumento de medida y no una
función**: va el último de todos los carriles (ADR-0004), cuenta aparte lo que pidió y lo que salió,
y suelta todas las teclas que pulsó pase lo que pase con su bucle. Junto al pánico, son los dos
únicos emisores de mensajes de canal de esta sesión.
_Avoid_: secuenciador, reproductor

### Procedencia de una cifra

Cada cifra en pantalla lleva exactamente uno de estos sellos.

**Medido**:
Sale de una Medida sobre audio real.

**Teoría**:
Calculado a partir de parámetros (Bessel, formas espectrales). Nunca se confunde con medido.

**Sondeado**:
Leído del teclado por SysEx, con marca de tiempo, y avalado. Una lectura sin Aval no lleva este
sello porque no llega a pintarse: no hay un sexto sello para «leído pero todavía no sé de qué
sonido».

**Caduco**:
Sondeado hace más de cuatro periodos de su propio anillo. Sigue siendo de este patch.

**Invalidado**:
Pertenece a un patch anterior: el ancla cambió. Conserva su forma y pierde su cifra; no se recupera
solo si era una Medida.
_Avoid_: muerto, pausado, congelado

### Audio

**Vista viva**:
Scope, espectro y waterfall a ~30 fps sobre FFT corta. Es audio que entra ahora: nunca se invalida.
Sus cifras no llevan ninguno de los cinco sellos de procedencia —no salen de una Medida, ni de un
sondeo, ni de una fórmula— sino el sello **`VIVO`** de su zona, con la cadencia medida al lado.

**Medida**:
FFT larga disparada explícitamente sobre una nota sostenida. Produce parciales, fc, fm, ratio
medido, índice I ajustado y artefactos, y lleva sello con tamaño y antigüedad.
_Avoid_: medición (como nombre del resultado)

**Mirar / Medir**:
Los dos actos distintos del transporte: mirar late en continuo, medir es un obturador que se pulsa.

**Bloque**:
Un paquete de muestras crudas (f32, Main L/R) que el lado nativo entrega al front tal cual salen
del dispositivo. No lleva análisis.

**Trama**:
Un paquete de resultados de la vista viva, ya analizado y listo para dibujar. Presupuesto: 33 ms.
_Avoid_: frame (en prosa), bloque

**Puente**:
El camino entero de un bloque, desde el callback del dispositivo hasta el worker: tres callbacks,
dos sellos monótonos, el IPC y la transferencia. Se mide, no se prueba. Tiene tres **tramos**, y una
latencia que no diga en cuál de ellos se pasó la espera no dice nada (#23): la **cola** —lo que el
bloque espera entre el hilo del audio y el que alimenta el IPC—, el **IPC** —el encode, el canal de
Tauri y el bucle de eventos del webview— y el **worker** —lo que espera detrás de las tramas que ya
tenía encoladas—. Dos de los tres se miden con un solo reloj y son exactos; sólo el IPC salta de
época, y es de él de donde se resta el suelo, así que los tres siguen sumando el total.
_Avoid_: pipeline, canal (el canal es el de Tauri, que es un tramo y no el camino)

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

**Parón**:
El rato más largo que el frente pasó sin recibir ningún bloque. Con bloques cada 30 ms, un parón sano
mide unos 30. Existe porque un `max` solo no distingue un bloque lento de una ausencia: si el frente
deja de recibir 50 ms y luego se pone al día de golpe, el peor de esos bloques parece una entrega
tardía y no lo es. Medido en el hilo principal, y su compañero es el **bucle** —lo tarde que ese
mismo hilo llega a su propio temporizador de 25 ms, que no sabe nada de audio—. Cuando los dos
coinciden en el mismo segundo, la tardanza del puente es un síntoma del hilo y no del camino.
_Avoid_: hueco (un hueco es un bloque que no llegó nunca), corte

**Disparo**:
El punto donde empieza la traza del scope: un cruce de cero ascendente alineado al periodo de la
nota. Que la onda se quede quieta es una afirmación sobre el disparo, no sobre el sonido.

**Artefacto**:
Parcial que no es armónica y se conoce su origen (el comb de 2 756,25 Hz del generador). Se marca
con su frecuencia; no se oculta y no cuenta como armónico.

**Vector de oro**:
Cada uno de los cuatro WAV de la fase 0 con resultado conocido. Son los tests de regresión del DSP
y valen sin teclado.

### Modos y enseñanza

**Crear**:
Modo en que el usuario hace el sonido y la app le sigue y le enseña qué pasa.

**Aprender**:
Modo en que el tutor lleva de la mano paso a paso y puede escribir en el teclado.

**A/B**:
Modo de la pantalla principal para comparar dos valores del mismo parámetro. No es una pantalla.

**Lección / Paso**:
Una lección es una secuencia de pasos; un paso es un conjunto de parámetros con un estado
restaurable. Volver a un paso es restaurar, sin castigo.

**Ruta de menú**:
La secuencia literal de pantallas del MODX que el usuario tiene que recorrer para hacer lo que la
app no puede hacer por él.

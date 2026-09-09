# El estallido del puente no es del puente (#23)

Cinco lanzamientos sobre el MODX8 el 2026-09-09, con el teclado conectado y sin tocar nada: la app
abierta, un minuto quieta, y la tira de desarrollo copiada. Ningún lanzamiento perdió un bloque ni
recibió ninguno fuera de orden.

## Lo que decía el ticket

#23 lo describía como **un estallido de arranque**: los primeros bloques de *todos* los lanzamientos
llegaban tarde, entre 208 y 379 ms contra un presupuesto de 33 ms, y la cifra se leía como un fallo
si mirabas el `p99` pronto. La única cifra que existía era `llegada − sello`, que cubre de una vez
la cola hasta el hilo del IPC, el encode, el canal de Tauri, el bucle de eventos del webview y la
cola del worker. Nadie lo había perfilado: había cinco lecturas de `max` y un `p99` tomado pronto.

## El instrumento

El bloque lleva ahora **dos sellos monótonos** en vez de uno —el del callback del dispositivo y otro
al salir de la cola hacia el IPC— y el hilo principal pone un tercero al entregarlo al worker. Eso
parte el camino en tres tramos. Dos son duraciones exactas sobre un solo reloj; sólo el cruce salta
de época, así que es el único del que se resta el suelo, y los tres siguen sumando el total.

Junto a ellos van tres cifras más: **cuándo** ocurrió el peor bloque, **cuánto tiempo seguido estuvo
el frente sin recibir ninguno** (`PARÓN`), y **cuánto llegó tarde el hilo principal a su propio
temporizador** (`BUCLE`), medido por un temporizador de 25 ms que no sabe nada del audio.

### Un error del propio instrumento, y por qué está escrito aquí

La primera versión daba `WORKER −447,5 ms`. Una duración negativa no es un resultado: `performance.now()`
dentro de un worker cuenta desde que **el worker** se creó, no desde la página, y los 447,5 ms eran
exactamente lo que tardó `new Worker` en volver. Se arregló sumando `performance.timeOrigin` en los
dos lados. Lo que quedó de ello es que la tira ahora dibuja `RELOJ ROTO` en cuanto un tramo sale
negativo: lo cazó un humano viendo un signo menos, y no debería haber hecho falta.

## Las cinco medidas

| # | ARRANQUE max | a los | DESPUÉS max | a los | PARÓN | BUCLE | p50 | p99 |
|---|---|---|---|---|---|---|---|---|
| 1 | **217,4 ms** | 1,3 s | **204,9 ms** | 48,5 s | — | — | 0,7 ms | 3,2 ms |
| 2 | **226,1 ms** | 1,3 s | 19,6 ms | 98,2 s | — | — | 0,8 ms | 3,0 ms |
| 3 | 4,8 ms | 1,0 s | 19,7 ms | 57,2 s | — | — | 0,6 ms | 2,9 ms |
| 4 | 5,0 ms | 0,3 s | 20,6 ms | 74,7 s | 49,6 ms a los 74,7 s | 58,6 ms | 0,8 ms | 3,4 ms |
| 5 | 4,0 ms | 3,0 s | 16,0 ms | 169,8 s | 44,5 ms a los 169,8 s | 63,6 ms | 0,8 ms | 3,0 ms |

`COLA` y `WORKER` quedaron entre 0,0 y 0,8 ms en los cinco. `HUECOS 0` y `DESORDEN 0` en los cinco.

## Qué dicen

**1. El puente cumple el criterio de #8.** `p99` fue 3,2 · 3,0 · 2,9 · 3,4 · 3,0 ms contra un
presupuesto de 33. No hay nada que arreglar en el puente: la cifra que #23 leía como un fallo era la
ventana, no el camino.

**2. Toda la tardanza está en un solo tramo.** `COLA` en cero significa que el hilo que alimenta el
IPC nunca se atasca —los bloques salen hacia Tauri en cuanto existen— y `WORKER` en cero significa
que el worker nunca acumula cola detrás de las tramas. Lo que queda entre esos dos es el cruce.

**3. El bloque no llega tarde: el frente desaparece y luego se pone al día.** En los lanzamientos 4
y 5, el peor bloque y el `PARÓN` caen **en el mismo segundo** (74,7 s y 169,8 s), y la cuenta cuadra:
el frente estuvo ciego 49,6 ms donde tocaban 30, y el peor bloque llegó 20,4 ms tarde; 44,5 contra
30, y 15,9 ms tarde. La tardanza **es** la ceguera menos la cadencia. Y el `BUCLE` —que no mide
audio— vio paradas de 58,6 y 63,6 ms en las mismas sesiones: el hilo principal se para de verdad.

**4. No es del arranque.** Es lo que más cambia respecto al ticket. El lanzamiento 1 tuvo su peor
bloque a los **48,5 s**, a un minuto de cualquier arranque, y los lanzamientos 3, 4 y 5 arrancaron
con 4,8 · 5,0 · 4,0 ms, o sea sin estallido ninguno. Dos de cinco estallaron, ambos a los 1,3 s.
Así que no es una propiedad del arranque sino **un parón del hilo principal del webview que suele
caer pronto y no siempre cae**.

## Lo que sigue sin saberse

Qué bloquea el hilo principal ~200 ms a los 1,3 s en dos de cada cinco lanzamientos. El volcado
queda descartado: su evento lleva ocho campos, no los 19 003 bytes. Quedan el arranque de Angular,
el primer pintado de los lienzos, la avalancha de `modx://patch` y `modx://operators` durante la
relectura, y una pausa de recolección del WebView2 — y separarlos pide una traza de DevTools tomada
durante un lanzamiento que estalle, no otra cifra en la tira. Es una pregunta del frente, no del
puente, y no bloquea #23.

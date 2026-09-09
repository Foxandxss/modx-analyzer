# El parón del hilo principal es real, dura 60–85 ms y no cuesta un bloque (#24)

Cuatro lanzamientos sobre el MODX8 el 2026-09-09, con el teclado conectado y sin tocar nada: la app
abierta, un minuto largo quieta, y la tira de desarrollo copiada. **Sin DevTools abierto**, y esa
condición resultó no ser un detalle — abajo está por qué. Ningún lanzamiento perdió un bloque ni
recibió ninguno fuera de orden, y los cuatro releyeron el patch entero (`383 DE 384`).

## Lo que decía el ticket

#24 salía de #23 con una afirmación en el título: **el hilo principal del webview se para ~200 ms a
los 1,3 s en dos de cada cinco lanzamientos**. Venía de cinco medidas del mismo día en las que dos
lanzamientos dieron `ARRANQUE max` de 217,4 y 226,1 ms, ambos a los 1,3 s. De esas dos, ninguna
tenía `PARÓN` ni `BUCLE` anotados: los dos números que dicen si el hilo se paró de verdad se
apuntaron sólo en los lanzamientos 4 y 5, que no estallaron. La afirmación del título era, por
tanto, una extrapolación desde dos sesiones distintas de las que la sostenían.

## Lo que cambió en el código antes de medir

Una fuga, encontrada leyendo y arreglada antes de esta tanda. `Audio::broadcast` sólo soltaba un
suscriptor cuando `channel.send` fallaba, y `send` es un `webview.eval`: un eval contra un webview
que se ha limitado a **navegar** sigue teniendo éxito — el script corre en la página nueva, no
encuentra ningún callback con ese id y no hace nada. Así que un canal que sobrevivía a una recarga
no fallaba nunca, no salía nunca del `retain`, y seguía costando a cada bloque un segundo encode, un
segundo eval y un segundo fetch durante toda la vida del proceso. Una vez por recarga, que bajo el
recargado en caliente de `tauri dev` es una por fichero guardado.

Ahora los suscriptores van con la etiqueta de su webview y volver a suscribirse **reemplaza** lo que
ese webview tenía. No está demostrado que la fuga fuera la causa de nada de #24 — ninguno de estos
cuatro lanzamientos recargó — pero era un error, y está escrito aquí porque cambia lo que se puede
comparar con las medidas de la mañana del 2026-09-09.

## Las cuatro medidas

| # | ARRANQUE max | a los | DESPUÉS max | a los | PARÓN | a los | BUCLE | a los | p50 | p99 | max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 11,4 ms | 3,1 s | 9,8 ms | 62,1 s | 48,7 ms | 3,1 s | **84,2 ms** | **0,4 s** | 0,9 | 3,3 | 9,8 |
| B | 6,3 ms | 0,3 s | 21,0 ms | 27,8 s | 50,1 ms | 27,8 s | **62,8 ms** | **0,3 s** | 0,6 | 2,4 | 21,0 |
| C | 3,2 ms | 0,3 s | 21,0 ms | 61,8 s | 49,5 ms | 50,6 s | **58,9 ms** | **0,3 s** | 0,7 | 2,8 | 21,0 |
| D | 2,8 ms | 1,3 s | 14,7 ms | 61,4 s | 44,4 ms | 61,4 s | **65,7 ms** | **0,3 s** | 0,8 | 3,0 | 14,7 |

`COLA` quedó entre 0,0 y 0,1 ms y `WORKER` entre 0,1 y 0,3 ms en los cuatro. `HUECOS 0` y
`DESORDEN 0` en los cuatro.

## Qué dicen

**1. No hubo estallido. Ninguno, en cuatro de cuatro.** `ARRANQUE max` de 11,4 · 6,3 · 3,2 · 2,8 ms
contra los 208–379 ms que #23 daba por propios de *todos* los lanzamientos y los ~220 ms que #24
esperaba en dos de cada cinco. Y no es sólo que pase el `p99`: **el `max` entero de cada lanzamiento
cabe dentro del presupuesto de 33 ms** — 9,8 · 21,0 · 21,0 · 14,7 —, que es algo que ninguna medida
de #23 ni de #24 había enseñado nunca. El criterio de #8 se cumple aquí sin necesidad de hablar de
ventanas.

**2. El hilo principal sí se para, y es lo más reproducible de todo el ticket.** `BUCLE` marcó 84,2
· 62,8 · 58,9 · 65,7 ms, **los cuatro a los 0,3–0,4 s**. Cuatro de cuatro, contra los dos de cinco
que #24 perseguía. Eso es el arranque de Angular y el primer pintado, y no hace falta suerte para
verlo: pasa siempre.

**3. Y no cuesta un bloque.** Es el hallazgo del ticket. Mírense los lanzamientos B y C: `BUCLE` de
62,8 y 58,9 ms a los 0,3 s, y el peor bloque **de ese mismo instante** midió 6,3 y 3,2 ms. Una
parada de 60 ms que la entrega apenas nota, porque a los 0,3 s el frente acaba de suscribirse y
detrás de la parada no hay casi nada encolado. Cuando los bloques fluyen de verdad, la parada ya
terminó. El parón del hilo principal es real, está identificado, ocurre siempre — y es inocuo.

**4. Los `PARÓN` que quedan no son del hilo.** 48,7 · 50,1 · 49,5 · 44,4 ms contra una cadencia de
30: entre 15 y 20 ms de holgura, en momentos repartidos (3,1 · 27,8 · 50,6 · 61,4 s) y sin ningún
`BUCLE` cerca de ninguno de ellos. Los peores bloques que salen de ahí miden 9,8–21,0 ms, dentro de
presupuesto.

## La medida que hay que tirar, y por qué está escrita

Antes de esta tanda se tomó una lectura **con DevTools abierto y perfilando**. Dio esto:

```
p99 848,2 ms · max 896,6 ms
DESPUÉS max 896,6 ms A LOS 16,1 s (COLA 0,1 · IPC 896,3 · WORKER 0,3)
PARÓN 922,4 ms A LOS 16,1 s · BUCLE 93,0 ms A LOS 15,2 s
```

Casi un segundo de ceguera. **No es un resultado sobre la app**: es DevTools instrumentando el
camino. Cada bloque viaja por un `fetch`, y DevTools instrumenta todos los `fetch`. Queda escrito
porque es una trampa en la que caerá quien vuelva a medir #23 con el perfilador delante — y porque
también dice algo que sí vale: `BUCLE` marcó 93 ms mientras el frente estuvo ciego 922. Ni siquiera
ahí el hilo principal era el que se paraba.

**Regla, entonces: las cifras del puente son nulas con DevTools conectado.**

## El camino del bloque, escrito de una vez

#23 y #24 llamaron «el cruce» a un tramo del que no se sabía la forma. Es esto, y explica por qué el
tramo es frágil:

Un bloque son 10 616 B (`32 + 1323·2·4`). El canal de Tauri sólo mete un payload directamente en un
`eval` si baja de **1 024 bytes**, así que **todos** los bloques van por el camino largo:

1. Rust hace `webview.eval(...)` — encolado en el proxy de tao, en **el hilo de la interfaz nativa**
2. `ExecuteScript` hacia WebView2 — mismo hilo
3. el eval corre en el renderer y llama a `fetch()` — **este hilo es el que mide `BUCLE`**
4. `WebResourceRequested` sirve los bytes — **otra vez el hilo de la interfaz nativa**
5. respuesta → promesa → `runCallback` → el orden del `Channel` → nuestro `onmessage` — renderer

Dos consecuencias que no estaban dichas en ningún sitio:

- **`BUCLE` sólo ve los pasos 3 y 5.** Un atasco en 1, 2 ó 4 para la entrega sin que el hilo del
  webview se entere, que es exactamente lo que enseña la lectura con DevTools.
- **`HUECOS 0` y `DESORDEN 0` no eran una medida sobre el puente.** El `Channel` de JavaScript
  guarda todo mensaje cuyo índice no sea el siguiente y los suelta de golpe cuando llega el que
  faltaba. El desorden es imposible por construcción, y la ceguera-seguida-de-avalancha que #23
  describió es la forma que tiene ese buffer de vaciarse. Los dos ceros siguen siendo ciertos y
  siguen valiendo para el go/no-go; lo que no son es evidencia de que el camino no reordene.

`send_user_message` no bloquea cuando se llama desde otro hilo, así que el hilo que alimenta el IPC
nunca espera: por eso `COLA` marca 0,1 ms y lo dice en serio.

## Lo que sigue sin saberse

**Por qué la tanda de la mañana del 2026-09-09 estalló dos veces a los 1,3 s.** No se ha reproducido
en cuatro lanzamientos limpios, y los registros del servidor de desarrollo no enseñan ninguna
recarga en estos cuatro. Queda como candidato la fuga de suscriptores de arriba —aquella tanda se
midió mientras se escribía el propio instrumento, o sea con recargas en caliente— pero **es un
candidato y no una explicación**: nadie ha visto la fuga producir un estallido.

Lo que sí se puede decir es que el título de #24 no sobrevive a esta tanda. El hilo principal se
para, se para siempre, se para 60–85 ms y no 200, y no cuesta ningún bloque.

## Un error que no se ha perseguido

Tras una recarga de la página, `RELECTURA` se queda en `— · sin releer` para siempre aunque la
cabecera lleve el nombre de la Performance: el evento `modx://reread` se emitió cuando no había
nadie escuchando, y a diferencia de la conexión, el volcado, el generador y el sondeo, el gateway no
pregunta por el estado de la relectura al arrancar. Es la misma forma que #18. Sólo se ve en
desarrollo, y ahí es donde se vio.

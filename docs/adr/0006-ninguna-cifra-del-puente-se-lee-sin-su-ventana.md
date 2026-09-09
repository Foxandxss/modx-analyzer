# ADR-0006: Ninguna cifra del puente se lee sin su ventana

Fecha: 2026-09-09 · Estado: aceptada · Contexto: #23, #8

## El problema

El puente se mide, no se prueba (ADR-0001): las cifras de la tira de desarrollo son el resultado, y
alguien las copia a mano a un documento. El criterio de #8 es «`p99` de latencia de entrega por
debajo de 33 ms».

Un percentil no es una propiedad del puente. Es una propiedad del puente **y de la ventana sobre la
que se tomó**, y la tira no decía cuál era la ventana. Con 132 bloques, antes de tocar una tecla, el
`p99` marcaba 167,9 ms y el criterio fallaba; unos minutos después el mismo lanzamiento pasaba, no
porque nada hubiera cambiado sino porque un estallido de dos bloques deja de estar en el 1 % cuando
la tirada se hace cien veces más larga. La misma cifra decía dos cosas opuestas sobre el mismo
lanzamiento y nada en pantalla avisaba.

Eso ya había torcido una lectura: en #8 el puente parecía medir **mejor** bajo 28 618 mensajes de
carga que en reposo. No era la carga ayudando; era el estallido todavía dentro de la ventana en
reposo y ya fuera de la cargada.

## La decisión

**Una cifra del puente se dibuja siempre con la ventana que la hace verdadera.** En concreto:

1. Los percentiles dicen **sobre cuántos bloques** hablan (`SOBRE 2341`).
2. El **Arranque** —los primeros cinco segundos— se cuenta aparte, con su propio peor bloque a la
   vista. Ni se promedia con el resto ni se esconde.
3. Todo `max` dice **cuándo** ocurrió (`A LOS 48,5 s`). Un peor bloque a los tres segundos y otro a
   los cuatro minutos son dos respuestas distintas con el mismo número.
4. Toda latencia se dibuja **partida en sus tres tramos** (`COLA · IPC · WORKER`), porque una espera
   sin sitio no se puede arreglar ni descartar.
5. El instrumento dice cuándo está roto: un tramo negativo no es una duración, así que la tira
   dibuja `RELOJ ROTO` y las cifras de al lado no se copian.

## Por qué no basta con excluir el arranque

Fue la tentación, y la medida la desmintió el mismo día: un lanzamiento entregó un bloque **204,9 ms
tarde a los 48,5 s**, y otros tres arrancaron sin estallido ninguno. Ninguna ventana de arranque
habría atrapado el primero ni tenía nada que excluir en los otros.

Así que el punto 2 es una forma de **contar el arranque con honradez**, y nunca el mecanismo que
hace pasar las cifras. Lo que las mantiene honradas son los puntos 1, 3 y 4: si algo estalla fuera
de la ventana, sale en el `max` de después, con su hora puesta.

## Consecuencias

- Durante los primeros cinco segundos no hay percentil: la tira dibuja rayas. Es correcto —todavía no
  hay tirada sobre la que hablar— y es lo contrario de lo que hacía antes, que era contestar.
- La cabecera del bloque creció a 32 bytes por el segundo sello monótono. El contrato está escrito en
  los dos lados (`block.rs` y `bridge.ts`) y comprobado por longitud, no por confianza.
- El puente guarda tres arrays de latencia en vez de uno: 1,5 MB para 33 minutos de tirada.
- La tira mide además **el hilo principal contra su propio temporizador**, que no es audio. Es lo que
  permitió decir que el bloque no llega tarde sino que el frente se ausenta y se pone al día, y con
  ello sacar al puente de la investigación.

## Alternativas descartadas

- **Dejar el percentil sobre todo y explicarlo en el documento.** Es lo que había. La cifra en
  pantalla seguiría siendo leíble como un aprobado, y quien mida después no habrá leído la nota.
- **Bajar el estallido a un aviso y nada más.** Un aviso que salta en cada lanzamiento es un aviso
  que nadie lee; por eso `LATENCIA` sólo se dibuja en alerta cuando el bloque tardío cae **fuera**
  del arranque, que es lo que el criterio de #8 mira de verdad.

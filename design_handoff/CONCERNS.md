# CONCERNS.md — donde no estoy de acuerdo, y qué me falta

Lista viva. Cada punto dice **qué pediste**, **qué he hecho**, y **qué te discuto o te debo**.
Los cerrados se quedan como registro.

Estado a 2026-09-07, tras la ronda 7.

---

## CERRADOS

### 1–7 · Ronda 4

Waterfall promovido (`4a`) con el `ARTEFACTO 2756 Hz` recuperado · las dos pantallas que faltaban
entregadas · el pánico con su tensión resuelta · lo que costó encajar aceptado · mis tres errores de
dato corregidos · el riesgo del Op3 reencuadrado · ninguna decisión revertida.

### 8–14 · Ronda 5

**8** El A/B es un modo, no pantalla — cerrado a mi favor. **9** El chip dice la consecuencia, no el
fallo. **10** El badge que salta de 12 Hz a 2 Hz, con tu motivo, que era mejor que el mío: es el único
sitio donde se ve que medir cuesta. **11** El orden de la sonda de `Receive Bulk` estaba mal y tenías
razón; `4e` dibuja los cinco pasos y repone con Parameter Change. **12** El editor de operador es
`5a`, y era el hueco grande, no «un hueco sin drama». **13** El barrido es `5b` y las trayectorias
**son** las funciones de Bessel. **14** La consola SysEx es `5c`, y como cajón: hay que ver la
verificación mientras pasa.

### 15 · Cuántas medidas por paso — **cerrado por tu decisión, y es mejor que mi pregunta**

Yo te pedía un número; me has dado un criterio. **Una por paso, y una segunda pasada sólo sobre los
dudosos.** Dibujado en `6e`, y tienes razón en que abre un estado que no había previsto: el mapa se
dibuja **completo con puntos marcados como poco fiables**, y eso mete al barrido en el vocabulario de
procedencia del resto de la app — no es «medido» contra «no medido», es *medido con cuánta
confianza*.

Lo que he añadido por mi cuenta, y que va con tu criterio: **cuándo un paso sale dudoso es un
cálculo, no un umbral que el usuario ponga** (parcial a menos de 12 dB del suelo, o a menos de un
paso de un cero de la `|Jₙ|` ajustada), y el punto afinado **muestra su dispersión** (`−43.8 ±0.6`).
Sin la dispersión, tres medidas promediadas son igual de opacas que una.

### 16 · `TOCAS TÚ` — **cerrado: medido, y ya no es inferencia**

Fuera el recuadro ámbar de `4c`; ese chip pasa a `MEDIDO · fase 0e`. Acepto tu corrección de mi §16
anterior: **MIDI primero, audio como respaldo degradado**. Tenías razón en el argumento que a mí se
me escapaba — la cuenta de notas y la velocity es lo que hace del chip información en vez de un
piloto, y eso el audio no lo puede dar. Mi frase se queda donde de verdad sirve: si el MIDI de
entrada está cerrado, `ENTRA AUDIO QUE NO HE PEDIDO`.

### 18 · `48 00 52` → `48 00 48` — **cerrado: explicado**

Dirección reservada, comportamiento indefinido, se llevó por delante al vecino en su default `1E`.
Texto de `5c` actualizado. Y estoy de acuerdo en que **lo que queda en su sitio es peor**: las
reservadas contestan a una lectura como si fueran reales (`51→00 · 52→00 · 53→00 00 · 55→00`, sólo
`54` calla), así que la lista **no es descubrible preguntando** y la app la lleva dentro. Está escrita
en `6d` al lado de la lista que sí se aprende midiendo.

---

## ABIERTOS

### 17 · Lo que sigue sin diseñar — sin cambios, y de acuerdo con tu orden

- **Guardar en la memoria del MODX.** Todo el trabajo es sobre el buffer de edición, que es lo que
  hace que nada de esto sea peligroso. El día que se guarde de verdad hará falta pantalla y aviso.
- **Biblioteca de patches y corpus DX7.** Fuera por decisión tuya, última fase.

### 19 · El aviso bloquea, pero sólo lo que se rompió — **decidido, y aquí está la defensa**

Me pedías que lo decidiera yo. Tu instinto («con estado vivo sí, sin estado vivo no») es el correcto y
lo he aplicado, con una matización que creo que importa: **bloqueante no significa modal**.

- **Sin nada en curso** (`6b`): no hay aviso que atender. El nombre nuevo, la relectura de los 416, y
  dos avisos que se van solos. Trastear sonidos es exactamente lo que Jesús va a hacer; si la app le
  riñe cada vez, estorba en lo único que él iba a hacer de todas formas.
- **Con estado vivo** (`6c`): el aviso se ancla **a la cosa invalidada** y le quita sus acciones
  normales. El resto de la app sigue viva. Un modal centrado apagaría también lo que **sí** sigue
  siendo verdad — y hay algo que nunca deja de serlo: la vista viva, que es audio que entra ahora.

El motivo de fondo, que es el mismo de toda la app: **una medida inválida que parece válida es el
único fallo que este proyecto no se puede permitir.** Seguir en silencio produciría una lección falsa.

Lo que sí te discuto es la palabra «pausado»: en `6c` no hay ningún «reanudar». Reanudar un barrido
partido por un cambio de sonido daría un mapa de Bessel que parece bueno y no lo es.

### 20 · La cuenta de notas se hace por altura, no por mensaje — y lo que eso cuesta

Tu trampa del `Multi` es real y la resuelvo así: **la app cuenta alturas distintas**, no mensajes. Una
tecla que llega por cuatro canales en 28 ms es **una nota**, porque la altura es lo que suena y el
canal es transporte. Correcto en `Single` y en `Multi` sin saber en cuál estás.

Dos consecuencias que asumo, y una te la debo:

- **El modo se deriva, no se lee**: si la misma altura llega por más de un canal, la app *sabe* que
  está en Multi y puede decirlo. No hace falta leer el ajuste (y no sabemos si se puede).
- **Se pierde un caso legítimo**: dos Parts en capa que suenan la misma tecla son, para la app, una
  nota. Me parece el intercambio bueno — es una app de análisis FM, no un contador de polifonía.
- **Lo que te debo**: los recuentos crudos (mensajes por canal) siguen existiendo, pero **sólo en el
  cajón de `5c`**, que es donde vive el tráfico. En la cabecera va la cifra que se puede leer de un
  vistazo.

### 21 · La lista de sólo lectura — **cerrado, y tu tercera opción es la buena**

Yo te di un par (recordar u olvidar) y tú has visto lo que a mí se me escapó: **comprobarlo es
gratis**. Una escritura y una relectura son ~4 ms, así que no hay que elegir entre congelar una
conclusión y pagar un fallo por sesión.

Aplicado en `6d`: **recordar, y reprobar en silencio una vez por sesión**, la primera vez que la app
vaya a escribir esa dirección. Si sigue sin entrar **no se dice nada** — la app ya lo sabía, no es una
noticia. Si entra, la dirección **sale de la lista** y eso sí se cuenta, con tarjeta en
`SIN CONFIRMAR`: la app había aprendido algo falso y acaba de corregirse.

Y sobre tu pregunta de si «reconfirmada» es ruido: **no lo es, pero sólo como marca**. Va como una
píldora de 9 px en la entrada (`RECONFIRMADA HOY`), no como una línea de prosa. El motivo es
consistente con el resto de la app: es la diferencia entre *«esto lo sé de esta sesión»* y *«esto lo
arrastro de otro día»*, que es exactamente lo que distingue `MEDIDO` de `CADUCO` en cualquier otra
cifra. Si la ves y sigue pareciéndote ruido, se cae con una línea.

### 22 · El tempo no va en el badge — **decidido, y no pido pantalla**

Me pedías una decisión, no una pantalla. Es la mía: **el badge de sondeo se queda como está** (12 Hz /
2 Hz, dos valores estables) y el tempo va **al lado del ancla**, en el chequeo (`6a`), como
`TEMPO 90 BPM · fondo 40 msg/s`.

El motivo es el tuyo del §10 llevado a su conclusión: un número que salta cuando cambia la situación es
información, pero **un badge con tres causas distintas ya no dice cuál cambió**. Y el tempo no es una
propiedad del teclado ni del momento: es una **propiedad del sonido cargado**, igual que el algoritmo o
la cadena. Su sitio es donde vive el nombre del sonido.

### 23 · Riesgos de datos que siguen vivos — ninguno bloquea, todos afectan a una frase

Ordenados por lo que costaría si salen al revés:

1. **El ancla tiene un punto ciego de ~1,5 s por medida** — y de acuerdo: **declarado, no dibujado**.
   Ya no vive sólo aquí; está en el `README.md` como propiedad conocida del ancla, junto a su cadencia
   y su coste. Un hueco documentado es una decisión; uno que sólo está en el documento de quejas es una
   sorpresa esperando a la fase 1. El sondeo del nombre a 1 Hz no puede correr
   dentro de la ventana de FFT de 65 536 (1,486 s) sin meter tráfico en la medida. Así que si el
   sonido cambia justo ahí, la app se enterará **al acabar la medida**, no durante. El diseño lo
   aguanta (la medida se marca como de otro sonido en cuanto el ancla vuelve), pero **es el único hueco
   real** y lo digo aquí porque no está dibujado en ninguna pantalla.
2. ~~Si `Bank Select` / `Pgm Change` son de recepción y no de transmisión~~ — **cerrado por papel, y
   me corriges bien**: el Reference Manual dice que gobiernan *both in transmission and reception*, y
   estaban los dos en `ON`. Así que la explicación fácil del cero está muerta y no hay «ajuste remoto
   que sí lo transmita»: **el sondeo del ancla no es la mejor fuente, es la única**. Frase del
   `README.md` corregida.
3. **`MIDI I/O Mode = Hybrid` no se ha probado.** Si reparte las notas de otra forma, mi regla del §20
   (contar por altura) sigue valiendo — es justamente por eso que la elegí.
4. **`Super Knob CC` volvió a 95 sin verificar** (lo devolvió el usuario, no la medición). Si se quedó
   en `off`, la app verá SysEx entrante en `30 4B 00` que no ha pedido. `6d` lo trata como lo que es:
   emisión legítima del teclado, no un fallo.
5. **MODX-2 y MODX-3 no entregan ni clock**, así que su silencio no es interpretable. Nada de lo
   dibujado los usa.
6. **WinMM y los mensajes de 2 bytes** siguen sin verificar de punta a punta. Es riesgo del escucha,
   no del diseño.

### 24 · El seguimiento (ronda 7) — tres decisiones, y una te la discuto a medias

**Sugerencia y no salto**, incluso con el rail de los ocho a un toque. Tu argumento a favor del salto
(el rail te devuelve) es cierto pero incompleto: lo que no se puede interrumpir no es la navegación,
es **el gesto**. Si el foco salta mientras arrastras un punto de la AEG del OP3, el arrastre se rompe a
media curva. Una sugerencia espera a que levantes el dedo; un salto no. En `3a` la cuestión no existe:
los ocho ya están en pantalla, así que ahí el seguimiento **no mueve nada** — deja rastro.

**La frase no promete lo que no puede saber.** Nunca «estás en el OP7»: siempre «acabas de tocar algo
del OP7», con la dirección, el valor viejo y el nuevo. Y una sugerencia por vez, la última, que se va
sola a los 6 s. Cinco cambios en cinco operadores no son cinco bandas: son una banda y cinco marcas en
el rail.

**Los dos anillos: se dice.** Y hay una consecuencia que me pareció más interesante que la propia
pregunta del `CADUCO`: **abrir un operador ralentiza el seguimiento**, porque los dos anillos comparten
el mismo canal — 12,2 Hz para los ocho pasan a ~6 Hz cuando hay 43 direcciones más en la ronda. Así que
el umbral de `CADUCO` es **cuatro veces el periodo de su propio anillo** (0,33 s el ancho, 0,66 s el
estrecho), y la cadencia se dice **una vez por zona en su cabecera**, no en cada cifra. Sin badge nuevo:
el vocabulario de procedencia que ya existe basta, y meterle un segundo sello a cada número sería
justo lo que el §22 rechazó para el tempo.

Lo que **no** he hecho, y era el riesgo: convertir esto en un modo. No hay «modo espejo». Hay un
conmutador (`TE SIGO`), un rastro por tarjeta y una sugerencia reversible.

### 25 · Mi lectura de dónde está la fase 1

Me lo pides con esas palabras, así que te contesto con esas palabras: **la superficie está completa.
Lo que falta es implementar.**

Lo que hay dibujado cubre las dos formas de usar la app (crear y aprender), su modo de comparación, las
cinco pantallas de trabajo, las tres piezas transversales, los cuatro estados que no son felices, el
cambio de patch por debajo, los tres modos de fallo de la escritura y el seguimiento. No se me ocurre
una pantalla que la fase 1 necesite y no esté, y las dos que faltan por decisión tuya (guardar en la
memoria del MODX, biblioteca) son fase posterior **y no son huecos: son alcance**.

Lo que queda abierto, y por eso esta lista no se cierra, son **tres decisiones y seis riesgos de dato**
que se resuelven implementando o midiendo, no dibujando. Si aparece una pantalla nueva, aparecerá
porque una medición la exija — como pasó con el ancla en la ronda 6 —, y eso ya no es diseño
pendiente: es diseño reactivo, que es como ha funcionado bien hasta aquí.

**Recomendación, dicha claro:** parad de pulir y empezad por el orden de implementación del
`README.md`. Yo estaría más útil revisando lo implementado contra la hoja de sistema que dibujando una
ronda 8.

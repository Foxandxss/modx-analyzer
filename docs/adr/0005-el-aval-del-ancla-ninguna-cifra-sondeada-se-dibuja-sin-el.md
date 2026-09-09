---
status: accepted
date: 2026-09-09
---

# El aval del ancla: ninguna cifra sondeada se dibuja sin él

El anillo ancho no dibuja una lectura por haberla recibido. Una lectura **cuyo valor difiere del
que hay dibujado** se queda retenida, sin sello y sin pantalla, hasta que un latido del ancla
**empezado después de esa lectura** conteste `Same`. Ese latido es el **aval**. Si en vez de `Same`
contesta `Changed`, la generación sube, el anillo olvida —lo dibujado y lo retenido— y la cifra
retenida no llega a verse nunca.

Una lectura que **repite** el número que ya está dibujado no necesita aval y refresca su marca de
tiempo tal cual: puede venir de otra Performance, pero entonces dice de la nueva exactamente lo
mismo que decía de la vieja, y un número verdadero en los dos sonidos no es una mentira en ninguno.
Eso es lo que mantiene el puerto callado: en reposo el teclado contesta lo mismo pasada tras pasada
y no se pide ni un aval.

Cada dirección retiene **dos** lecturas sin avalar y no una: la más nueva, que es el número en el
que está el teclado ahora, y la más vieja, que es la que garantiza que la pantalla se mueva. Un
latido cuesta ~40 ms y una pasada ~100 ms, así que dos de cada cinco latidos aterrizan **después**
de que el anillo haya sustituido justo la lectura de la que iban a hablar. Guardando sólo la más
nueva, un mando que sigue girando pierde esa carrera latido tras latido y la cifra se queda quieta
mientras la mano se mueve —medido en el MODX8 real durante la verificación de este ADR, y con eso
el arreglo de #20 rompía la pantalla que venía a arreglar—. Con la vieja detrás, cada latido puede
hablar siempre de algo: la cifra va un latido por detrás de la mano, pero va.

Mientras el anillo retiene algo pide un latido **fuera de turno**. El ancla se lo da si ha pasado el
hueco `CONFIRM_GAP` desde el último: `max(250 ms, 5 × lo que costó el último latido)`. Con el
teclado quieto el latido cuesta ~40 ms y el hueco son 250 ms; tocando cuesta ~200 ms y el hueco se
va a ~1 s, que es el latido de siempre — los latidos fuera de turno **se apagan solos justo cuando
el puerto está disputado**, que es lo que ADR-0004 decidió que pasara con el ancla: conserva su
hueco, no lo agranda.

## El problema

Medido sobre el MODX8 real (#20, captura a 60 fps de un cambio `FM CS80 Brass` → `FM Warm Brass`):
durante **≈ 0,65 s** la pantalla enseñó ocho tarjetas con el nombre viejo, el algoritmo nuevo, los
Levels de OP1 y OP2 del sonido viejo re-rolados por la topología del sonido nuevo, y **todo sellado
`SONDEADO`**. Ese patch no existe en ningún teclado.

La causa no es un fallo: el anillo gira a 5–10 Hz y el ancla late a 1 Hz, así que entre el cambio
real y el momento en que el ancla lo nota caben pasadas enteras que preguntan mitad a un sonido y
mitad al otro. `WideRing::forget` vacía el diagrama de golpe y es el mecanismo correcto, pero sólo
se dispara cuando el ancla se entera. Nada distinguía una pasada partida de una limpia.

Es el único sitio de esta pantalla donde la app **miente con confianza**. Todas las demás muertes
son honestas: la medida muere y lo dice, la vista viva se niega a morir y lo dice, un algoritmo sin
entrada en la tabla dice `ALGORITMO SIN TABLA`.

## Por qué el aval y no las otras tres

- **Latir más rápido.** Acorta la ventana, no la quita, y le come al anillo el carril que ya le
  falta. Se descarta porque no contesta al criterio: seguiría habiendo un intervalo en el que la
  cifra es de otro sonido y lleva sello de fresca.
- **Que el anillo se invalide con su propia evidencia (el número de algoritmo).** Es gratis y
  hubiera cazado *esta* captura 0,65 s antes. No cubre un cambio de Performance que conserve el
  algoritmo, así que tampoco contesta al criterio. El aval lo incluye: el algoritmo es una de las
  42 direcciones y cambiar de valor es exactamente lo que retiene una lectura.
- **Sellar la pasada y no el valor.** Cuesta una pasada de latencia en *toda* lectura, siempre,
  incluida la del usuario girando un mando —que es para lo que existe esta pantalla—. El aval sólo
  cuesta cuando algo ha cambiado de verdad, que es cuando vale la pena pagarlo.
- **Decir que la ventana existe.** Honesto y barato, y no impide dibujar la quimera. Se queda como
  complemento, no como respuesta.

## Consequences

- **No hace falta un sexto sello.** Una cifra retenida no se pinta de otro color: no se pinta. El
  front no cambia ni una línea — sigue dibujando la raya para lo ausente y `SONDEADO` para lo
  presente. Lo que cambia es *cuándo* algo está presente.
- Se respeta por construcción el criterio de #13, «ninguna cifra sondeada cambia sin pasar antes
  por la raya»: una cifra avalada sólo puede ser sustituida por otra avalada del mismo sonido,
  porque si el sonido hubiera cambiado el latido habría contestado `Changed` y el anillo habría
  vaciado el diagrama.
- **El agujero del ancla es ahora el agujero del aval**, y es el mismo de siempre: dos Performances
  cuyo nombre de Part 1 coincida son, para el ancla, la misma. Un aval no sabe más que el ancla que
  lo firma. Documentado ya en `CONTEXT.md`; no se ensancha ni se estrecha aquí.
- **Girar un mando tiene ahora hasta 250 ms más de retardo** con el teclado quieto (era ≤ 1 pasada,
  ~84 ms; pasa a ≤ 1 pasada + el hueco). Tocando, el retardo lo pone el latido de 1 Hz. Es el
  precio, se paga sólo sobre lo que cambia, y es el intercambio explícito de este ADR: **latencia a
  cambio de no mentir**.
- Arrancar y cambiar de Performance cuestan un aval extra: tras la relectura el diagrama está
  entero retenido y aparece cuando el primer latido lo avala, ~una pasada + 40 ms después. La banda
  de `RELECTURA` ya está en pantalla durante ese tramo.
- El ancla ya no duerme un segundo de una pieza: duerme a rebanadas de 20 ms y mira si le piden un
  latido. Sigue midiendo el segundo desde el **principio** del latido, como hasta ahora.

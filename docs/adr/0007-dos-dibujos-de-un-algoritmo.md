# ADR-0007: Dos dibujos de un algoritmo, y cuál es el de por defecto

Fecha: 2026-09-10 · Estado: aceptada · Contexto: #54, #42, #29 · Revisada en #63 contra lo que 3a
(#58) y 3b (#62) dejaron efectivamente en la build

## El problema

El mismo algoritmo se dibuja de dos maneras y las dos son correctas.

En la **composición ancha** (`wide-layout.ts`) el rol se lee de la posición: las portadoras están
sobre el bus, todas las flechas bajan, la profundidad de cadena es la altura, cada rama ocupa su
banda y un operador a Level 0 está aparcado a la derecha sobre un cabo punteado que no llega a
ninguna parte. Nada de eso está escrito: se ve.

En la **composición estrecha** (`layout.ts`) los mismos ocho operadores son una rejilla 3 × 3
ordenada por profundidad. Es el dibujo verificado y con especificación propia, y no enseña el rol por
la posición: lo dice con la palabra del nodo (`CARR` / `MOD` / `ZERO`) y con la forma del contorno.
Las líneas sí están —dibuja todas las rutas, las caídas al bus, el bus y el arco—, pero una ruta
puede tener que saltar por encima de un vecino para llegar, porque la rejilla se llena de tres en
tres y no por ramas.

El coste es viejo y conocido: la topología que se aprende en una no se reconoce en la otra. Lo que
cambió con #54 es **cuál de las dos es la que se ve por defecto**. Hasta ahora la ancha era la de
reposo —la app arrancaba sin Medida, y sin Medida el algoritmo se llevaba la holgura entera— y la
estrecha aparecía como consecuencia de una captura. Con las ranuras, la composición la eligen ellas,
y el par de fábrica es `SCOPE` y vacía: la columna está abierta desde el primer fotograma, así que
**la rejilla estrecha pasa a ser el dibujo con el que la app abre** y la ancha pasa a ser la que hay
que pedir.

Eso invierte cuál de los dos dibujos hace de primera lección sobre la topología, y lo hace de
refilón, dentro de un ticket cuyo asunto era la geometría del scope.

## La decisión

**Las dos conviven, y se escribe qué lleva el usuario de una a otra.** No se rehace la rejilla
estrecha en esta sesión.

1. La **ancha** es el dibujo que enseña topología. El rol viene de la posición, la profundidad es la
   altura, las ramas no se cruzan porque no hay línea entre ellas, y el aparcado a Level 0 se dibuja
   y no se borra.
2. La **estrecha** no enseña topología **por la posición** y no pretende hacerlo. Dibuja las mismas
   líneas y los mismos nodos ordenados por profundidad, y lo que no pone en el sitio lo pone en la
   palabra.
3. Lo que el usuario **lleva** de la ancha a la estrecha son dos cosas, y hay que separarlas porque
   la segunda estaba mal escrita en la primera redacción de esta ADR:

   - **El nodo entero.** Hay un componente y una plantilla para los dos dibujos, así que los cinco
     hechos del nodo son literalmente los mismos: la identidad (`OP1`…`OP8`) con el rol escrito al
     lado, el Level como altura del relleno contra el techo común del patch, la ratio, la forma
     espectral como glifo y la Hz de la nota viva — más el sello que califica lo sondeado, el guion
     de lo invalidado (#56) y la esquina inerte. Lo único que cambia es cómo se reparten dentro de
     la caja: en la ancha, cuando la profundidad deja menos alto del que necesitan para apilarse, el
     nodo los pone en fila (`squat`).
   - **Las líneas.** Las rutas, las caídas al bus, el bus con su `OUT L/R` y el arco de
     realimentación con su `FB n` se dibujan en las **dos**, y la discontinua del `FB 0` (#57)
     también. **«Quién modula a quién» no es exclusivo de la ancha**: está en las dos, y decir lo
     contrario era describir la rejilla como un inventario sin líneas, que no es lo que es.

4. Lo que **no** lleva es la **posición**, no el dato:

   - **El rol por el sitio.** En la estrecha la fila de abajo no es la de las portadoras: la rejilla
     se llena de tres en tres por orden de profundidad, así que una fila puede mezclar dos
     profundidades y una portadora puede acabar a media altura. El rol lo dicen la palabra y la
     forma, no el sitio.
   - **La banda de la rama.** En la ancha cada estructura conexa tiene su banda de columnas y
     ninguna línea cruza de una a otra, porque no hay línea entre ellas que cruzar. En la rejilla las
     ramas se entremezclan y no hay nada que diga dónde acaba una.
   - **La profundidad como altura.** En la ancha una fila es una profundidad. En la estrecha la
     profundidad sólo ordena la lectura —más honda primero, y por número de operador dentro de una
     profundidad— y no se lee de la posición.
   - **El aparcado a cero.** En la ancha el operador a Level 0 sale de las ramas, se va a la derecha
     sobre un cabo que no llega a ninguna parte y **sus rutas no se dibujan**. En la estrecha se
     queda en su casilla y lo que se dibuja es su ruta **cortada**, en discontinua. Las dos dicen
     «esto no suena»; no lo dicen con la misma cosa, y sólo una lo dice con la posición.

5. La ancha se alcanza de dos maneras, y desde #62 **no son la misma caja**. Con `KEEP IT BIG` el
   carril de en medio se cierra del todo y el diagrama se lleva 1 070 px a 1 280 de ventana. Vaciando
   las dos ranuras el carril se queda en el asa —52 px, `RAIL_W`— y el diagrama son 1 016 px, con un
   riel a su derecha que lleva escrito el panel que una pulsación devolvería. Las dos son `wide()` y
   el mismo `wideLayout`, y el dibujo se estira al hueco (`preserveAspectRatio="none"`), así que la
   topología se lee igual en las dos. En ambos casos es una acción deliberada y ya no una
   consecuencia de no haber medido nada.

## Por qué no se rehace la rejilla estrecha ahora

Porque es un rediseño y no un pulido. La rejilla tiene especificación, tiene `layout.spec.ts` y es lo
único de las dos que está verificado contra la tabla; llevarle el vocabulario posicional a 3 × 3
significa resolver a esa escala los dos problemas que la ancha resuelve con sitio —bandas por rama y
una fila por profundidad— en una caja que no tiene ni la anchura ni la altura para ninguno de los
dos. Es su propia sesión, con su propia medida delante.

Escribir la decisión cuesta un documento; equivocarse en el rediseño cuesta el único dibujo
comprobado que hay.

## Consecuencias

- El dibujo por defecto es el que **menos** enseña de topología. Se acepta a sabiendas: el que la
  enseña está a una pulsación, y el par de fábrica se eligió para que el scope —la vista que sirve
  con una nota viva y sin ninguna Medida— esté delante desde el arranque.
- `composition.wide()` sigue siendo lo que elige entre los dos dibujos (`operator-diagram.ts`), pero
  ni su causa ni su forma son las de antes: es `shape() !== 'ranuras'` sobre las **tres** formas de
  la columna —`ranuras` / `rail` / `gone`, en `column-geometry.ts`— y ya no «no hay Medida».
  Cualquier lectura de ese signal que dé por buena la causa vieja está mal, y cualquier código que
  necesite distinguir el pin del riel tiene que leer `shape()`, porque `wide()` los da iguales a
  propósito: para el dibujo lo son.
- Toda frase de la app o de la documentación que enseñe rol o profundidad **por la posición** tiene
  que decir en qué composición, porque ya no se puede dar por supuesto cuál está en pantalla.
- El documento de resultados de la sesión repite el punto 3 y el 4 en prosa —
  `docs/results/2026-09-10-fase1-sesion3.md` §1, abierto en #63 y cerrado por #64—: es lo que un
  lector necesita para no buscar en la rejilla una forma que sólo existe arriba.

## Alternativas descartadas

- **Rehacer la estrecha con vocabulario posicional.** Es la reconciliación de verdad y sigue siendo
  la salida buena a plazo. Ahora mismo cambiaría el único dibujo verificado por uno sin medir, dentro
  de una sesión de pulido.
- **Un solo dibujo escalado a las dos anchuras.** Ya se probó de hecho y es de donde vienen los dos:
  a 208 px de columna las bandas por rama dejan de caber y los nodos pierden las cifras de dentro
  (#19). Un dibujo que a una escala miente es peor que dos dibujos que dicen cosas distintas.
- **Par de fábrica `SPECTRUM + HARMONICS`.** La app abriría estrecha igual, así que no arregla nada
  de esto, y además tapa el scope, que es la vista que se puede leer sin haber medido.
- **Par de fábrica con las dos ranuras vacías.** La app abriría ancha y el problema desaparecería.
  Con el riel de #62 el coste ya no es exactamente el que se escribió aquí —el asa está en pantalla y
  lleva escrito el panel que devuelve, así que no hay nada que descubrir— pero sigue siendo una
  pantalla que abre sin ninguna señal dibujada, con una pulsación por delante de la primera y sin que
  la captura traiga ninguna. El par de fábrica existe para que el scope, la única vista que se lee
  sin haber medido, esté delante desde el primer fotograma.

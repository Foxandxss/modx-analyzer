# Vectores de oro

Los cuatro WAV con los que se prueba el DSP. Son audio real del MODX8, capturado en la fase 0 con la
cadena limpia; cada cifra que los tests afirman tiene detrás una línea de
`design_handoff/sources/fase0_RESULTS.md` §3 o §7.

| fichero | qué es | lo que fija |
| --- | --- | --- |
| `fmx-1op-sine.wav` | un operador, ratio 1.0 | suelo de ruido −105 dB rel. al pico (−130 dBFS, que es lo que dice `FLOOR`); el 3.er armónico a −84 dB es el único contenido armónico real; **los dos picos más altos después de la fundamental son el comb del generador**, a −72 dB |
| `fmx-ratio2-modlow.wav` | ratio 2:1, modulador `Level ≈ 40` | sólo armónicos impares: 1 a 0 dB, 3 a −29,5, 5 a −68, 7 a −82 |
| `fmx-ratio2-modhigh.wav` | ratio 2:1, modulador `Level ≈ 90` | el pico ya no es la fundamental sino el **9.º armónico**; impares hasta el 21 |
| `fmx-ratio1414.wav` | `Coarse 1`/`Fine 41`, ratio medido 1,4103 | once parciales inarmónicas en `\|fc ± k·fm\|`, ninguna de ellas armónico |

## De dónde salen y qué se les ha hecho

Los originales están en el spike de la fase 0 (`modx-spike-fase0/wav/`), intactos. Lo que hay aquí lo
escribe `node golden/trim.mjs <carpeta wav del spike>`, y hace tres cosas, cada una con su motivo:

- **Sólo el canal 0**, que es el que lee todo el análisis. Ahorra la mitad del peso.
- **131 072 muestras desde el segundo 1,0** (2,97 s, lo mismo que aguanta el ring buffer). Empieza
  después del ataque del más lento de los cuatro —la senoide no arranca hasta 0,844 s— así que el
  vector es régimen permanente desde su primera muestra. Deja sitio para la ventana de 65 536 de la
  Medida con una ventana entera de margen.
- **Se mantiene float32.** Estos vectores tienen el suelo de ruido en −105 dB rel. al pico, que
  sobre un pico de −25 dBFS son unos −130 dBFS; 16 bits pone el suyo en −96 dBFS y sustituiría al
  número que se está midiendo.

## Dos cosas que conviene saber antes de usarlos

- **La ventana que se analiza es la última**, no la primera: `liveTrama` lee las últimas 4 096
  muestras de lo que se le pasa. En el segundo 1 la senoide todavía tiene una envolvente moviéndose
  por debajo y la falda de su propia fuga se sienta 45 dB por encima del suelo; una ventana temprana
  mide el ataque y lo llama ruido.
- **Los dos canales no son idénticos en `fmx-1op-sine`**, al contrario de lo que dice la fase 0
  («los dos canales son idénticos muestra a muestra»). En ese vector el derecho difiere del izquierdo
  hasta 0,0063 en valor absoluto —un 11 % del pico— y la razón entre canales no es constante, así que
  no es un desfase ni una ganancia. En los otros tres la diferencia es exactamente 0. No cambia nada
  aquí, porque el análisis lee el canal 0 por decisión, pero sí convierte esa decisión en una que
  tiene consecuencias en ese vector.

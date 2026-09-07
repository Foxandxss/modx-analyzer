# Synthesizer Parameter Manual — material conceptual para el tutor

Fuente: **Yamaha Synthesizer Parameter Manual**, `modx/modx_synth_parameter_manual.pdf`
(`synthesizer_en_pm_c0.pdf`, 90 pág., septiembre 2018). **No es específico del MODX**: cubre AWM2 y
FM-X para toda la familia, así que no trae direcciones ni rutas de menú. Su valor es que **define
los parámetros y los términos** — es la fuente de los textos explicativos del modo tutor, no del
mapa. Extractos crudos en `modx/spm_pages4-9.txt` y `modx/spm_pages30-40.txt`.

## La analogía que usa el propio Yamaha para explicar FM

Del apartado *Algorithm*, y merece la pena porque es un puente pedagógico entre lo que Jesús ya sabe
(síntesis sustractiva) y lo que quiere aprender:

- El **ratio de frecuencia** entre Modulador y Portadora determina **dónde** caen los armónicos.
- El **nivel de salida del Modulador** hace de **frecuencia de corte del filtro**.
- La **envolvente del Modulador** hace de **envolvente del filtro**.
- La **frecuencia de la Portadora** determina el **tono**.
- El **nivel de la Portadora** determina el **volumen**, y su envolvente, la envolvente de amplitud.

Es decir: en FM, subir el Level del modulador "abre" el sonido igual que abrir un filtro. Justo el
A/B que la app puede tocar sola —misma frase, modulador a 20 y a 90— y que en la fase 0 ya se vio
medido: con el índice alto, el pico más alto deja de ser la fundamental y pasa a ser el 9.º
armónico.

**Feedback**: realimentar parte de la señal de un operador sobre sí mismo. Definición y poco más;
el manual no da la fórmula.

## Spectral Form — definiciones, y son verificables con el espectro

| valor | definición del manual |
|---|---|
| `Sine` | senoide simple, **sin armónicos** |
| `All 1` | armónicos en un rango **ancho** |
| `All 2` | armónicos en un rango **estrecho** |
| `Odd 1` | armónicos **impares**, rango ancho |
| `Odd 2` | armónicos **impares**, rango estrecho |
| `Res 1` | **picos** armónicos, rango ancho |
| `Res 2` | **picos** armónicos, rango estrecho |

- **`Skirt`**: la anchura de la falda al pie de la curva de armónicos. Más valor, falda más ancha.
  Activo en todas las formas **menos** `Sine`.
- **`Resonance`**: desplaza la frecuencia central hacia arriba. Solo con `Res 1`/`Res 2`.

Esto es material de lección **y** de test: cada una de esas siete frases es una afirmación
comprobable en el analizador que ya sabemos construir. "All 1 tiene un rango más ancho que All 2"
se mide, no se cree. Es el mismo patrón de la fase 0 con Bessel.

## Envolventes

- **AEG** de FM-X: Hold, Attack, Decay 1, Decay 2, Release, con sus niveles. Figura 39.
- **Amplitude Scale (Level Scaling)**: el teclado se parte en dos por el **Break Point**. A la
  derecha mandan `High Depth`/`High Curve`, a la izquierda `Low Depth`/`Low Curve`. Las curvas
  `Exp` cambian el nivel de forma exponencial desde el break point y las `Lin` de forma lineal.
  El nivel *en* el break point es el Operator Level. — Esto explica los cinco parámetros
  `49 op 1B`-`1F` que el mapa tiene por nombre pero no por significado.
- **PEG** del operador: Initial Level, Attack Level, Attack Time, Decay Time.

## Qué NO trae

Direcciones SysEx (eso es el Data List), rutas de menú (eso es el Reference Manual) y cualquier cosa
específica del MODX. Para los algoritmos concretos remite al Data List.

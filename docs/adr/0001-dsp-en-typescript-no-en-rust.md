---
status: accepted
date: 2026-09-07
---

# El análisis de audio vive en TypeScript (Web Worker), no en Rust

El lado nativo (Rust, `cpal`) sólo abre el dispositivo, mantiene el ring buffer y entrega bloques
de f32 al front por un channel de Tauri: del orden de cien líneas que no se vuelven a tocar. Todo el
análisis —FFT, picos, armónicos, ratio, índice de modulación, Bessel— es TypeScript en un Web
Worker, como funciones puras con los cuatro vectores de oro como tests.

Se decidió así porque el proyecto existe para que su dueño aprenda FM, y el aprendizaje vive en los
picos, los armónicos y Bessel; cederlos a Rust a cambio de ancho de banda que sobra (~350 KB/s por
IPC) es mal cambio. Una FFT de 4 096 a 30 fps cuesta menos de un milisegundo en cualquier lenguaje;
lo que cuesta es pintar, y eso va en canvas en las dos opciones.

## Considered options

- Todo el DSP en Rust, el front sólo dibuja. Rechazado: mueve la parte instructiva a un lenguaje
  que el dueño no conoce, sin ganancia medida.
- Partir el análisis (FFT en Rust, ajustes en TS). Rechazado: dos implementaciones del mismo
  espectro y los vectores de oro repartidos.

## Consequences

- **Lo primero que se construye y se mide es el puente**: audio continuo sostenido por el IPC de
  Tauri con el front pintando. `RESULTS.md` dice si aguanta sin pérdidas y cuánta latencia añade.
- Si el puente no aguantara, mover funciones puras a Rust es un cambio acotado; construir encima
  sin medirlo no lo es.
- **El go/no-go está tomado y sale que sí** (#8, 2026-09-08, MODX8 real). Diez minutos bajo notas
  densas —20 394 bloques, 28 618 mensajes por el mismo puerto, ninguno rechazado— con **`HUECOS 0`,
  `DESORDEN 0` y un p99 de 4,0 ms** contra un presupuesto de 33 ms: el 12 %. La pasada con manos de
  verdad, otros 1 221 bloques, da lo mismo: `HUECOS 0`, `DESORDEN 0`, p99 8,0 ms. La carga no
  empeoró el puente, lo dejó **mejor** que en reposo (p50 1,1 → 0,7 ms; p99 5,5 → 3,8 ms).
- Ese margen es el que sostiene la decisión: no hay nada que mover a Rust por rendimiento, y este
  ADR no se reabre por el puente. Los detalles y la única anomalía —una ráfaga de arranque de
  ~210 ms, siempre en los primeros segundos y sin perder un solo bloque— están en
  `docs/results/2026-09-07-fase1-sesion1.md`.
- El documento `prompt.md` de la primera sesión decía lo contrario; este ADR lo sustituye.

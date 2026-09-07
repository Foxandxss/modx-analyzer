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
- El documento `prompt.md` de la primera sesión decía lo contrario; este ADR lo sustituye.

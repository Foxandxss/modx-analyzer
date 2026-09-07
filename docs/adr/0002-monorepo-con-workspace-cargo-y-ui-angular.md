---
status: accepted
date: 2026-09-07
---

# Un solo repositorio: workspace Cargo, app Tauri y UI Angular

El repositorio contiene un workspace Cargo con `crates/modx-midi` (extraído del spike de la fase
0c: puerto, Parameter Request/Change, emparejado de respuestas, bulk, pánico, mapa) y
`crates/modx-dsp` (funciones puras y sus tests), la app Tauri en `src-tauri/` y la UI Angular en
`ui/`. Los cuatro WAV de oro van commiteados tal cual en `crates/modx-dsp/tests/vectors/` (7 MB en
total no justifican LFS).

Los spikes `modx-spike-fase0*` se quedan donde están, intactos y sin commits, como referencia: son
binarios de un solo `main.rs`, sin `lib.rs` ni tests, así que absorberlos es una extracción, no un
traslado. Reescribir el MIDI desde cero sería tirar tres sesiones de medición.

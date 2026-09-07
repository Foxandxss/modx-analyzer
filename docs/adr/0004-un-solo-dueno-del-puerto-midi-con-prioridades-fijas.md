---
status: accepted
date: 2026-09-07
---

# Un solo dueño del puerto MIDI, con prioridades fijas

Una única tarea en Rust abre y posee las dos direcciones del puerto `MODX-1`; todo lo demás le
pide. Cuando el canal está disputado el orden es fijo: pánico, escritura-y-verificación, ancla,
anillo ancho, anillo estrecho. El pánico además intenta reabrir el puerto si se ha perdido y manda
igualmente.

Se decidió así porque en Windows el puerto de entrada es exclusivo (no puede haber dos dueños) y
porque un reparto round-robin dejaría que el anillo estrecho ahogue al ancla justo cuando el usuario
está tocando, que es cuando la latencia sube de 2 ms a 10 ms de mediana y el peor momento para dejar
de saber si le han cambiado el patch por debajo.

## Consequences

- Bajo notas densas los anillos bajan a ~2,4 Hz, pero el ancla conserva su hueco de 1 Hz.
- Ningún componente del front habla con el puerto: sólo pide lecturas, escrituras o el pánico.

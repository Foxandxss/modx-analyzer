---
status: accepted
date: 2026-09-07
---

# Un solo dueño del puerto MIDI, con prioridades fijas

Una única tarea en Rust abre y posee las dos direcciones del puerto `MODX-1`; todo lo demás le
pide. Cuando el canal está disputado el orden es fijo: pánico, escritura-y-verificación, ancla,
anillo ancho, anillo estrecho, **generador de notas**. El pánico además intenta reabrir el puerto si
se ha perdido y manda igualmente.

El generador va el último de todos y no es una excepción a la regla, sino su consecuencia: es el
instrumento con el que se mide el puente (#8), y un instrumento que apartara al ancla estaría
midiendo una app que no existe. Que se quede sin turno es por tanto un **resultado** sobre el puerto
bajo carga y no una avería, y por eso se cuentan por separado los mensajes que pidió y los que
salieron.

Se decidió así porque en Windows el puerto de entrada es exclusivo (no puede haber dos dueños) y
porque un reparto round-robin dejaría que el anillo estrecho ahogue al ancla justo cuando el usuario
está tocando, que es cuando la latencia sube de 2 ms a 10 ms de mediana y el peor momento para dejar
de saber si le han cambiado el patch por debajo.

El carril del anillo estrecho tiene ya un consumidor aunque el editor de operador para el que se
nombró no sea de esta sesión: el **barrido** de #16, que son esas mismas direcciones de un operador
pedidas una vez en vez de en ciclo. Va detrás del anillo ancho a propósito — es una pulsación y 47
ida y vuelta, y el diagrama no puede pararse por ella.

## Consequences

- Bajo notas densas los anillos bajan a ~2,4 Hz, pero el ancla conserva su hueco de 1 Hz. **Medido
  el 2026-09-08 (#8): el anillo ancho baja de 9,3 a 6,7 Hz**, un 28 % y no el 80 % que temía esta
  línea, con 28 618 mensajes del generador por el mismo puerto y ninguno rechazado.
- **El sondeo no se pausa durante una Medida, y eso está medido, no supuesto** (#14, 2026-09-08).
  Dos ventanas de 65 536 de la misma nota sostenida, una con el ancla y el anillo corriendo y otra
  con los dos parados, difieren **0,191 dB** como mucho sobre sus 191 bins de contenido — el mismo
  0,16 dB que difieren dos ventanas **ambas** sondeadas tomadas con nueve minutos de por medio. El
  punto ciego que el diseño reservaba sale del diseño: pausar el ancla costaría 1,5 s sin mirar si
  han cambiado el sonido y no compraría nada.
- Ningún componente del front habla con el puerto: sólo pide lecturas, escrituras o el pánico.
- Los mensajes de canal tienen exactamente dos emisores, los dos dentro de `modx-midi`: el pánico y
  el generador. La única entrada pública para los del generador (`OwnerHandle::send_notes`) fija
  también el carril, así que nadie puede colar una nota por delante del ancla.

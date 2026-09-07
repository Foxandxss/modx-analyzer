---
status: accepted
date: 2026-09-07
---

# Las tablas del teclado viven en código, con procedencia por entrada

Las direcciones SysEx (rango, longitud en bytes, default), la lista de direcciones reservadas y las
88 topologías de algoritmo son tablas estáticas en código. Cada entrada lleva su procedencia,
`medido` o `documentado`, y la promoción a `medido` se hace **por entrada**, nunca en bloque.
`modx-map.json` del spike es fuente para transcribir, no fuente en tiempo de ejecución.

Se hace así porque nada de esto se puede descubrir preguntando: las direcciones reservadas contestan
a una lectura como si fueran reales, y el Data List imprime los algoritmos como láminas. Transcribir
88 diagramas es el único sitio del proyecto donde un error es silencioso —sale un diagrama mal
dibujado y nadie se entera—, así que la marca de procedencia es criterio de aceptación, no
burocracia.

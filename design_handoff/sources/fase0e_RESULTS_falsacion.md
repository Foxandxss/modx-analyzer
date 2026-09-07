# MODX Analyzer — fase 0e: falsar el cero del cambio de Performance

Fecha: 2026-09-07. Ronda corta para cerrar la grieta de método de la fase 0d.

## Veredicto

**El cero de la fase 0d queda CONFIRMADO**, y por partida doble: en modo crudo (sin clasificar
nada) y con autoverificación del ancla dentro de cada ventana.

**Pero la sesión encontró algo que reinterpreta el resultado**: el MODX **sí tiene emisor de
Parameter Change y funciona**. Con `Super Knob CC` en `off`, mover el Super Knob emite **635 mensajes
SysEx en 25 s**. No es que el teclado no sepa emitir Parameter Change: es que solo lo hace para un
control concreto. Ver punto 4, que ha resultado ser lo más importante de la ronda.

---

## 1. El instrumento de medida

### Modo crudo

Añadido `listen --raw`: imprime **todos los bytes que entran, en hexadecimal, sin clasificar**, con
timestamp. Único filtro `F8`/`FE`, contándolos. En modo crudo **ningún byte que no sea clock puede
desaparecer del log**, porque no hay clasificación que pueda fallar.

### Autoprueba: parcial, y qué prueba exactamente

**Loopback: no disponible.** Se probaron las **nueve** combinaciones de puerto de entrada y salida
del MODX enviando `C0 05` y `B0 00 01`. Ninguna devolvió nada. No hay dispositivo MIDI virtual en la
máquina.

```
escucha MODX-1 <- envio MODX-1 : 0 mensajes impresos, 129 clock
escucha MODX-1 <- envio MODX-2 : 0 mensajes impresos, 133 clock
escucha MODX-1 <- envio MODX-3 : 0 mensajes impresos, 133 clock
escucha MODX-2 <- envio MODX-1/2/3 : 0 mensajes, 0 clock
escucha MODX-3 <- envio MODX-1/2/3 : 0 mensajes, 0 clock
```

**Autoprueba por inyección: PASA.** Se inyectaron mensajes sintéticos por el **mismo canal que usa
el callback de midir**:

```
[     0.0 ms] ProgramChange ch1 5        C0 05
[     0.0 ms] CC ch1 cc0=1               B0 00 01
[     0.0 ms] ChannelAT ch1 64           D0 40
```

Los tres se imprimen correctamente, incluidos los **dos estatus de canal de 2 bytes** (`C0` y `D0`).

**Qué prueba y qué no.** Prueba todo de la callback de midir hacia abajo: cola, clasificación,
impresión. **No prueba el tramo WinMM → callback de midir** para mensajes de 2 bytes. Lo que sí está
demostrado de punta a punta en esta sesión y las anteriores: mensajes de **1 byte** (`F8`, `FE`,
miles), de **3 bytes** (notas, CC, pitch bend, y 473 del Super Knob) y **SysEx de longitud variable**
(635 del Super Knob, más todas las respuestas a Parameter Request). El único tamaño sin verificar
extremo a extremo es el de 2 bytes.

> **Honestidad sobre el alcance:** la hipótesis concreta del brief — «un parser escrito asumiendo dos
> bytes se desincroniza o descarta el `0xC0` en silencio» — **queda descartada**. Pero no se ha
> podido demostrar que WinMM entregue un mensaje de 2 bytes a midir. Cerrarlo requeriría instalar
> **loopMIDI**, que se ofreció y no se llegó a usar.
>
> Atenuante fuerte: en **modo crudo no hay clasificación**, así que la ruta que podía fallar no se
> ejecuta; y el punto 4 demuestra que el escucha captura cientos de mensajes por ese mismo puerto y
> en esa misma configuración cuando el teclado emite de verdad.

### Autoverificación del ancla

`listen --anchor` lee el nombre de la Part 1 (`31 00 00`-`13`) **antes y después** de la ventana y
dicta el veredicto solo. Control en seco, sin tocar el teclado:

```
ancla ANTES  : 'CFX Padded          '
ancla DESPUES: 'CFX Padded          '
EL ANCLA NO CAMBIO -> la accion no ocurrio dentro de la ventana. Prueba NO VALIDA.
```

El control negativo funciona: la herramienta invalida sus propias pruebas.

## 2. Cambio de Performance en crudo — CERO CONFIRMADO, dos veces

### A — Performance de fábrica

```
ancla ANTES : 'CFX Padded          '

--- log crudo: TODO byte que no fuera F8/FE ---
   (ni una linea)

--- resumen de 40 s ---
clock/sensing filtrados : 2016   <- prueba de que el escucha estaba vivo
mensajes de canal       : 0
mensajes SysEx          : 0

ancla ANTES  : 'CFX Padded          '
ancla DESPUES: 'Upright Tack Piano  '
el ancla cambio dentro de la ventana: la accion ocurrio y el resultado es atribuible.
```

### B — Performance de usuario

```
--- log crudo: TODO byte que no fuera F8/FE ---
   (ni una linea)

--- resumen de 40 s ---
clock/sensing filtrados : 2014
mensajes de canal       : 0
mensajes SysEx          : 0

ancla ANTES  : 'Upright Tack Piano  '
ancla DESPUES: 'FM Lately Bass      '
el ancla cambio dentro de la ventana: la accion ocurrio y el resultado es atribuible.
```

**Cargar una Performance no emite un solo byte**, ni de fábrica ni de usuario, con `Bank Select` y
`Pgm Change` en `ON`, en modo crudo, y con la acción verificada dentro de la ventana.

> Nota de método: una primera tanda se descartó porque solo se grabó uno de los dos ficheros y el
> cambio de nombre no era atribuible a esa ventana concreta. En vez de pedir más cuidado al operador
> se movió la verificación dentro de la herramienta. **La coordinación humana es el eslabón débil de
> este tipo de medición; conviene eliminarla en vez de reforzarla.**

## 3. Los otros puertos — resultado AMBIGUO, y hay que decirlo

| puerto | clock en la ventana | mensajes | ancla |
|---|---|---|---|
| MODX-1 | ~2015 en 40 s (~50/s) | 0 | cambió |
| **MODX-2** | **0 en 30 s** | 0 | cambió (`FM Lately Bass` → `Imperial Breakup`) |
| **MODX-3** | **0 en 30 s** | 0 | cambió (`Imperial Breakup` → `Init Normal (FM-X)`) |

Los tres puertos **abren sin error**. Pero MODX-2 y MODX-3 **no entregan ni clock**, mientras MODX-1
entrega ~50 mensajes por segundo en la misma máquina y el mismo momento.

**Por tanto su silencio no es concluyente.** No se puede distinguir «no tienen nada que decir» de «no
están entregando nada». La fase 0b ya los había visto mudos durante 345 s; esto lo confirma y añade
que tampoco hay clock, que es la parte informativa. Para resolverlo haría falta hacerlos hablar de
alguna forma conocida, y no se ha encontrado ninguna.

## 4. Super Knob — la única emisión SysEx del MODX, medida

Era el «extra si sobra tiempo» y ha resultado ser el hallazgo de la ronda.

### Con `Super Knob CC` = 95 (valor original)

```
--- resumen de 25 s ---
clock/sensing filtrados : 1001
mensajes de canal       : 473
   estatus B0     473

[  2561.7 ms]   3 bytes  B0 5F 3F
[  2581.6 ms]   3 bytes  B0 5F 3D
```

**473 mensajes de CC 95** (`0x5F`) en canal 1. Cero SysEx.

### Con `Super Knob CC` = `off`

```
--- resumen de 25 s ---
clock/sensing filtrados : 1001
mensajes de canal       : 0
mensajes SysEx          : 635
   estatus F0     635

[  1931.9 ms]  11 bytes  F0 43 10 7F 1C 07 30 4B 00 40 F7
[  1952.8 ms]  11 bytes  F0 43 10 7F 1C 07 30 4B 00 3F F7
[  1972.6 ms]  11 bytes  F0 43 10 7F 1C 07 30 4B 00 3E F7
```

**635 mensajes SysEx**, todos **Parameter Change** (`1n` = `10`) en la dirección **`30 4B 00`**, con
los **128 valores** distintos observados. Confirma la afirmación del Reference Manual, que hasta hoy
era papel.

### Y esto reinterpreta los ceros de las fases 0b, 0d y 0e

**El MODX tiene emisor de Parameter Change y funciona perfectamente.** No estamos ante un teclado
incapaz de notificar: estamos ante uno que **solo notifica un control**. Los ceros de las ediciones
de panel y del cambio de Performance no son una limitación de firmware, son una decisión de diseño
de Yamaha.

Para el proyecto no cambia la arquitectura — sigue habiendo que sondear — pero sí cambia la
explicación, y cierra la duda de si el emisor existía siquiera.

### `30 4B 00` es de SOLO LECTURA

Primera dirección así encontrada en todo el proyecto:

```
leer   30 4B 00 -> [3F] = 63     (coincide con donde quedo el knob)
escribir 20 -> relectura [3F]    sin efecto
escribir 60 -> relectura [3F]    sin efecto
```

Se lee, emite, pero no se escribe. La app puede **observar** el Super Knob pero no **moverlo**.

---

## Correcciones

**A `RESULTS-fase0d.md` — el apartado «Preguntas que este spike NO contesta».** Dejaba el Super Knob
como «caso documentado que no se ha medido». **Ya está medido**, en las dos configuraciones. Y añade
un hecho que la fase 0d no tenía: el emisor de Parameter Change del MODX existe y funciona.

**A `modx.md`** — además de las dos correcciones que ya señaló la fase 0d (clock ~40 msg/s y no 125;
latencia 2,0 ms y no 16 ms en las líneas 320 y 586), añadir:

- la única emisión SysEx del MODX es el Super Knob con `Super Knob CC = off`, en `30 4B 00`;
- existe al menos una dirección de solo lectura, así que la regla «toda escritura se verifica
  releyendo» no es solo por el no-op silencioso de longitud: hay direcciones que **nunca** aceptarán
  la escritura.

**Nada que corregir en el veredicto de la fase 0d.** Se confirma.

## Estado del teclado

- **No se guardó nada en la memoria del MODX.** Todo sobre el buffer de edición.
- Copia previa a esta ronda: `safety/03-previo-fase0e.bin`.
- Ajustes tocados: **`Super Knob CC`**, de 95 a `off` para el punto 4. **La devolución a 95 la hizo
  el usuario y NO está verificada por medición** — comprobarlo requiere mover el knob y ver si sale
  CC 95 o SysEx, y no se hizo. Queda pendiente de confirmar. `MIDI I/O Mode` no se tocó en esta
  ronda; sigue en `Single`.
- La Performance actual es `Init Normal (FM-X)`, cargada por el usuario durante la prueba de MODX-3.

## Preguntas que este spike NO contesta

- **Si WinMM entrega mensajes de 2 bytes a midir.** Único tramo sin verificar del escucha. Se
  necesita loopMIDI. Atenuado porque el modo crudo no clasifica y porque el punto 4 demuestra
  captura masiva por el mismo puerto.
- **Si MODX-2 y MODX-3 entregan algo alguna vez.** No dan ni clock, así que su silencio no es
  interpretable. No se ha encontrado forma de hacerlos hablar.
- **Por qué `30 4B 00` no acepta escritura.** Medido que no la acepta; no se sabe si es de solo
  lectura por diseño o si requiere alguna condición.
- **Si hay más controles con emisión SysEx** como el Super Knob. Solo se ha probado ese.

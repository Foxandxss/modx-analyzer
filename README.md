# MODX Analyzer

Aplicación de escritorio para aprender síntesis FM-X con un Yamaha MODX8 delante. Lee el teclado por
SysEx, captura su audio y dibuja lo que está pasando. Lo que significa cada palabra está en
[`CONTEXT.md`](CONTEXT.md); las decisiones, en [`docs/adr/`](docs/adr).

## Forma del repositorio

| Sitio | Qué hay |
|---|---|
| `crates/modx-midi` | El puerto `MODX-1`: mensajes, emparejado de respuestas, anillos, pánico |
| `crates/modx-audio` | Abrir `Line (MODX)`, el ring buffer y los bloques crudos. Sin análisis |
| `src-tauri` | La app Tauri: la ventana, los comandos y los eventos hacia el front |
| `packages/modx-dsp` | El análisis, en TypeScript y con los vectores de oro (ADR-0001) |
| `ui` | La UI en Angular: standalone, zoneless, señales, OnPush |
| `design_handoff` | El paquete de diseño. `design-tokens.css` es la fuente de verdad de los valores |

## Qué hace falta

- **Node 22** (fijado en `.nvmrc`) y **pnpm** por corepack: `corepack enable pnpm`.
- **Rust estable con MSVC**, en el PATH. El `rust-toolchain.toml` fija el triple completo
  (`stable-x86_64-pc-windows-msvc`) porque en el portátil el host por defecto de rustup es GNU y
  `stable` a secas acaba buscando `dlltool.exe`.
- Las dependencias de sistema de Tauri v2 en Windows (WebView2, que ya viene con Windows 11).

```
pnpm install
pnpm dev        # abre la app con recarga en caliente
```

## El banco sin teclado

Para ver un patch en pantalla sin el MODX delante y sin el lado Rust corriendo:

```
pnpm run harness   # abre el banco en el navegador, con recarga en caliente
```

Es la app entera —los mismos componentes, las mismas hojas, la misma geometría— con tres cambios
de cableado: la pasarela es `FakeBackendGateway`, el worker de audio es el falso y el interruptor
del pliegue está atado a algo que se puede mover con la mano. La tira negra de abajo a la derecha
es el banco: algoritmo (1-88, o 89 para `ALGORITHM n · NO TABLE`), los ocho Levels, el nombre que
lee el ancla, la nota que se está pisando y el pliegue. Se oculta con un botón, porque una mirada
tomada con un panel encima del dibujo es una mirada al panel.

El banco abre en la composición **estrecha**, como la app (ADR-0007): el dibujo ancho se consigue
con `KEEP IT BIG` o vaciando las dos Ranuras, igual que delante del teclado.

Lo que **no** trae es audio: no llegan bloques, así que las Vistas vivas se quedan en su aspecto
vacío y no hay Medida. Una medida es la lectura de un instrumento y el banco no tiene ninguno.

La ventana es la del navegador, así que se arrastra y se redimensiona como cualquier otra: es lo
que hace falta para medir el suelo del cuerpo (#81).

Los 88 algoritmos viven en Rust (ADR-0003) y el teclado sólo contesta un *número*, así que el
banco no puede deducir el dibujo de nada: lleva un volcado de la tabla en
`ui/src/app/dev/algorithms.json`, escrito por `every_topology()` en `src-tauri/src/patch.rs`. Si
se toca una ruta de la tabla, el volcado se regenera y el test lo dice:

```
MODX_WRITE_HARNESS_TABLE=1 cargo test -p modx-analyzer-app
```

Nada de `ui/src/app/dev/` es alcanzable desde `src/main.ts`: el banco es una **entrada aparte**
(`src/main.harness.ts`), así que «no llega a un build de producción» es un hecho del grafo de
módulos y no una promesa.

## Los tres bucles

```
pnpm run lint    # prettier + eslint + cargo fmt + clippy
pnpm run test    # vitest (ui y modx-dsp) + cargo test
pnpm run build   # bundle de Angular + cargo build del workspace
```

Cada uno tiene su mitad por separado (`lint:ts` / `lint:rust`, y lo mismo con `test` y `build`) por
si no hay `cargo` a mano.

## Los spikes

Los tres spikes de la fase 0 (`modx-spike-fase0*`) viven **fuera** de este repositorio y no se tocan:
son la referencia medida de la que se extrae `modx-midi`.

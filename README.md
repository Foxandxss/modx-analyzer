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

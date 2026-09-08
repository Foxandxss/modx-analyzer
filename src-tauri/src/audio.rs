//! The app's one connection to `Line (MODX)`, and the pipe that carries it to the
//! Web Worker.
//!
//! Everything about *how* lives in `modx-audio`. What is here is the wiring: open
//! the device at startup, say so in the header, and forward every bloque down the
//! Tauri channels that asked for one.
//!
//! The bloques cross as [`InvokeResponseBody::Raw`], which reaches JavaScript as an
//! `ArrayBuffer` — the front hands that buffer straight to the worker by transfer,
//! so between the audio thread and the analysis the samples are copied by the IPC
//! and by nobody else.

use std::sync::mpsc::Receiver;
use std::sync::Mutex;
use std::thread;

use modx_audio::{encode_mono, AudioBlock, Capture, RING_SAMPLES};
use tauri::ipc::{Channel, InvokeResponseBody, Response};
use tauri::{AppHandle, Manager};

use crate::connection::Connection;

/// The open device and whoever is listening to it.
#[derive(Default)]
pub struct Audio {
    capture: Mutex<Option<Capture>>,
    /// One per `subscribe_audio_blocks`. In practice there is exactly one — the
    /// front's audio service — but a channel that outlived a reload would
    /// otherwise silently keep a dead webview's callback alive.
    subscribers: Mutex<Vec<Channel<InvokeResponseBody>>>,
}

impl Audio {
    pub fn new() -> Self {
        Self::default()
    }

    /// Hand a bloque to everybody listening, dropping the channels that have gone.
    fn broadcast(&self, block: &AudioBlock) {
        let bytes = block.encode();
        let mut subscribers = self
            .subscribers
            .lock()
            .expect("the audio subscribers lock is not held across a panic");
        subscribers.retain(|channel| channel.send(InvokeResponseBody::Raw(bytes.clone())).is_ok());
    }
}

/// Open the device at startup and start forwarding.
///
/// Failing is not fatal and never has been: the screen opens either way, the
/// header's audio line stays a dash, and the pánico — which is the only thing that
/// must always work — does not go through here.
pub fn start(app: &AppHandle) {
    match Capture::open() {
        Ok((capture, blocks)) => {
            let device = capture.device().clone();
            log::info!(
                "{} abierto a {} Hz, {} canales",
                device.name,
                device.sample_rate,
                device.channels
            );
            Connection::set_audio(app, Some((device.name, device.sample_rate)));

            app.state::<Audio>()
                .capture
                .lock()
                .expect("the capture lock is not held across a panic")
                .replace(capture);

            forward(app.clone(), blocks);
        }
        Err(error) => {
            log::warn!("Line (MODX) no se pudo abrir: {error}");
            Connection::set_audio(app, None);
        }
    }
}

/// The thread between the audio callback and the IPC.
///
/// It exists so that the audio thread never waits on a webview: it puts the bloque
/// on a channel and goes back to the device, and the waiting happens here.
fn forward(app: AppHandle, blocks: Receiver<AudioBlock>) {
    thread::Builder::new()
        .name("modx-audio-ipc".into())
        .spawn(move || {
            for block in blocks {
                app.state::<Audio>().broadcast(&block);
            }
        })
        .expect("the audio forwarding thread starts");
}

/// The window MEDIR analyses: the most recent `samples` of channel 0, oldest
/// first, as little-endian f32 and nothing else.
///
/// **The shutter looks backwards.** When the finger moves, the sound it was
/// pointing at is already in the past — the note was held before the press — so
/// the samples come out of the ring rather than being collected after it. Without
/// that, a medida would start by making the owner hold the note another second
/// and a half.
///
/// How many samples is the front's business, not this side's: 65 536 is a
/// parameter of the analysis and the analysis lives in TypeScript (ADR-0001).
/// What is decided here is only what the ring can honestly serve, so the ask is
/// clamped to its size.
///
/// It answers an error rather than a short window when the ring has not filled
/// that far yet — at launch, or when the device is not open. Padding it would be
/// measuring a silence that never entered.
#[tauri::command]
pub fn measure_window(app: AppHandle, samples: u32) -> Result<Response, String> {
    let wanted = (samples as usize).min(RING_SAMPLES);
    let audio = app.state::<Audio>();
    let capture = audio
        .capture
        .lock()
        .map_err(|_| "el bloqueo de la captura está envenenado".to_owned())?;

    let taken = capture
        .as_ref()
        .ok_or_else(|| format!("`{}` no está abierto", modx_audio::DEVICE_NAME))?
        .tail(wanted)
        .ok_or_else(|| format!("todavía no hay {wanted} muestras en el anillo"))?;

    Ok(Response::new(encode_mono(&taken)))
}

/// Start receiving bloques on this channel. The front calls it once, from the
/// service that owns the worker.
#[tauri::command]
pub fn subscribe_audio_blocks(app: AppHandle, channel: Channel<InvokeResponseBody>) {
    app.state::<Audio>()
        .subscribers
        .lock()
        .expect("the audio subscribers lock is not held across a panic")
        .push(channel);
}

/// Write one 65 536 window to disk, labelled by whether the app was polling.
///
/// #14's instrument. The comparison it feeds is bin by bin over two windows of
/// the **same held note**, so what is written is the samples and not a spectrum:
/// the analysis then runs once, in `modx-dsp`, over both files, instead of twice
/// in two places that could drift.
///
/// The label is **taken from the flag and not from the caller**, because the one
/// mistake that would silently ruin this measurement is filing a polled window as
/// an unpolled one. Format is raw `f32` little-endian mono — the same
/// `encode_mono` the bloques cross with, and the same shape as the golden
/// vectors, so the comparison script reads them with the code that already exists.
#[tauri::command]
pub fn export_window(app: AppHandle, samples: u32) -> Result<String, String> {
    let wanted = (samples as usize).min(RING_SAMPLES);
    let taken = {
        let audio = app.state::<Audio>();
        let capture = audio
            .capture
            .lock()
            .map_err(|_| "el bloqueo de la captura está envenenado".to_owned())?;
        capture
            .as_ref()
            .ok_or_else(|| format!("`{}` no está abierto", modx_audio::DEVICE_NAME))?
            .tail(wanted)
            .ok_or_else(|| format!("todavía no hay {wanted} muestras en el anillo"))?
    };

    let label = if crate::polling::Polling::is_paused(&app) {
        "sin-sondeo"
    } else {
        "sondeo"
    };
    let folder = crate::dumps::folder(&app)?.join("medidas");
    std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    let path = folder.join(format!(
        "{}-{label}-{wanted}.f32",
        chrono::Local::now().format("%Y-%m-%d_%H%M%S")
    ));

    std::fs::write(&path, encode_mono(&taken)).map_err(|error| error.to_string())?;
    log::info!("medida exportada: {}", path.display());
    Ok(path.to_string_lossy().into_owned())
}

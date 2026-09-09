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

use std::sync::Mutex;
use std::thread;

use modx_audio::{encode_mono, AudioBlock, Bloques, Capture, RING_SAMPLES};
use tauri::ipc::{Channel, InvokeResponseBody, Response};
use tauri::{AppHandle, Manager, Webview};

use crate::connection::Connection;

/// A webview listening to the bloques, and the channel it listens on.
///
/// **The label is what makes a reload survivable.** `Channel::send` is a
/// `webview.eval`, and an eval into a webview that merely *navigated* still
/// succeeds: the script runs in the new page, finds no callback of that id, and
/// does nothing. So a channel left behind by a reload never errors, never falls
/// out of the `retain` in [`Audio::broadcast`], and goes on costing every bloque
/// a second encode, a second eval and a second fetch for the life of the process
/// — once per reload, which under `tauri dev`'s live reload is once per file
/// saved. A webview has exactly one audio subscription, so its label is the
/// identity: subscribing again replaces what that webview had.
struct Subscriber {
    webview: String,
    channel: Channel<InvokeResponseBody>,
}

/// The open device and whoever is listening to it.
#[derive(Default)]
pub struct Audio {
    capture: Mutex<Option<Capture>>,
    /// One per webview. In practice there is exactly one — the front's audio
    /// service — and a reload replaces its entry rather than adding one.
    subscribers: Mutex<Vec<Subscriber>>,
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
        subscribers.retain(|subscriber| {
            subscriber
                .channel
                .send(InvokeResponseBody::Raw(bytes.clone()))
                .is_ok()
        });
    }
}

/// Open the device at startup and start forwarding.
///
/// Failing is not fatal and never has been: the screen opens either way, the
/// header's audio line stays a dash, and the pánico — which is the only thing that
/// must always work — does not go through here.
/// Throw `Line (MODX)` away and open it again, for `REINTENTAR`.
///
/// The device dies with the USB cable — `MODX-1` and `Line (MODX)` come down the
/// same one — and until #22 nothing ever reopened it: `start` ran once at setup
/// and `retry_connection` reopened only the MIDI port, so the audio stayed dead
/// for the life of the process while the button said it had retried.
///
/// The old `Capture` is dropped **before** the new one is opened, and that order
/// is the whole of it: its `Drop` stops the audio thread and releases the device,
/// and ASIO will not hand the same device to a second stream. The subscribers are
/// not touched — the front's channel outlives the device it was listening to, so
/// bloques start arriving again on the same pipe.
pub fn reopen(app: &AppHandle) {
    let audio = app.state::<Audio>();
    let closed = audio
        .capture
        .lock()
        .expect("the capture lock is not held across a panic")
        .take();
    if closed.is_some() {
        // Dropped here, with the lock already released: `Capture::drop` joins the
        // audio thread, and joining it while holding the lock the forwarder may
        // want is how a deadlock gets written by accident.
        drop(closed);
        log::info!("Line (MODX): cerrado para reabrir");
    }
    start(app);
}

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
fn forward(app: AppHandle, blocks: Bloques) {
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
///
/// It takes the [`Webview`] rather than the [`AppHandle`] so that the caller can
/// be told apart from itself across a reload: see [`Subscriber`] for why a
/// channel the front has walked away from cannot be detected any other way.
#[tauri::command]
pub fn subscribe_audio_blocks(webview: Webview, channel: Channel<InvokeResponseBody>) {
    let label = webview.label().to_owned();
    let app = webview.app_handle();
    let audio = app.state::<Audio>();
    let mut subscribers = audio
        .subscribers
        .lock()
        .expect("the audio subscribers lock is not held across a panic");

    // The page that had this webview is gone, and so is the callback its channel
    // was eval-ing into. Dropped here rather than left to the broadcast, which
    // has no way of knowing.
    subscribers.retain(|subscriber| subscriber.webview != label);
    subscribers.push(Subscriber {
        webview: label,
        channel,
    });
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

    // The stamp has one-second resolution, so two exports inside the same second
    // and the same polling state would land on one name and the first window
    // would be gone without anybody being told. A measurement that quietly
    // overwrote half of itself is worse than one that refuses.
    let stamp = chrono::Local::now().format("%Y-%m-%d_%H%M%S");
    let mut path = folder.join(format!("{stamp}-{label}-{wanted}.f32"));
    for again in 2.. {
        if !path.exists() {
            break;
        }
        path = folder.join(format!("{stamp}-{label}-{wanted}-{again}.f32"));
    }

    std::fs::write(&path, encode_mono(&taken)).map_err(|error| error.to_string())?;
    log::info!("medida exportada: {}", path.display());
    Ok(path.to_string_lossy().into_owned())
}

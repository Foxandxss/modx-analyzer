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

use modx_audio::{AudioBlock, Capture};
use tauri::ipc::{Channel, InvokeResponseBody};
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

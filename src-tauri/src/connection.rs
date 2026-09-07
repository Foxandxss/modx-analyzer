//! The one line of the header that says what the app is attached to.
//!
//! `MODX-1` and `Line (MODX)` are two separate devices opened by two separate
//! modules, but the front sees them as one `ConnectionView`. If each module
//! emitted its own the second would erase the first's fields, so the state lives
//! here and both go through it.

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

/// The event the header's connection dot and audio line listen to.
const EVENT_CONNECTION: &str = "modx://connection";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionView {
    /// `connected` or `disconnected`, matching the front's `PortState`.
    pub port: &'static str,
    pub port_name: Option<String>,
    /// `Line (MODX)`, or nothing while the audio device is not open: the header
    /// draws the dash rather than a zero.
    pub audio_device: Option<String>,
    pub sample_rate: Option<u32>,
}

impl Default for ConnectionView {
    fn default() -> Self {
        Self {
            port: "disconnected",
            port_name: None,
            audio_device: None,
            sample_rate: None,
        }
    }
}

/// The merged view, and the only thing that emits it.
#[derive(Default)]
pub struct Connection {
    view: Mutex<ConnectionView>,
}

impl Connection {
    pub fn new() -> Self {
        Self::default()
    }

    /// Say whether `MODX-1` is open, leaving the audio fields as they were.
    pub fn set_port(app: &AppHandle, name: Option<String>) {
        Self::update(app, |view| {
            view.port = if name.is_some() {
                "connected"
            } else {
                "disconnected"
            };
            view.port_name = name;
        });
    }

    /// Say what the audio device reports, leaving the port fields as they were.
    pub fn set_audio(app: &AppHandle, device: Option<(String, u32)>) {
        Self::update(app, |view| match device {
            Some((name, rate)) => {
                view.audio_device = Some(name);
                view.sample_rate = Some(rate);
            }
            None => {
                view.audio_device = None;
                view.sample_rate = None;
            }
        });
    }

    fn update(app: &AppHandle, change: impl FnOnce(&mut ConnectionView)) {
        let state = app.state::<Connection>();
        let view = {
            let mut view = state
                .view
                .lock()
                .expect("the connection lock is not held across a panic");
            change(&mut view);
            view.clone()
        };
        let _ = app.emit(EVENT_CONNECTION, view);
    }
}

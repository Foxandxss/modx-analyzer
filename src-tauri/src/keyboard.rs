//! The app's one connection to the MODX, and the two things the front can ask of
//! it this session: how many notes are live, and make them stop.
//!
//! Everything about *how* lives in `modx-midi`. What is here is the wiring: open
//! the port at startup, push the connection state and the live-note count out as
//! events, and expose the pánico as a command that works from any screen.

use std::sync::Mutex;

use modx_midi::hardware::HardwarePort;
use modx_midi::owner::OwnerHandle;
use modx_midi::port::{PortError, PORT_NAME};
use tauri::{AppHandle, Emitter, Manager};

/// The event the header's connection dot listens to.
const EVENT_CONNECTION: &str = "modx://connection";
/// The event the pánico's live state listens to.
const EVENT_LIVE_NOTES: &str = "modx://live-notes";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionView {
    /// `connected` or `disconnected`, matching the front's `PortState`.
    port: &'static str,
    port_name: Option<&'static str>,
    /// Both stay `null` until the audio bridge exists; the header draws the dash.
    audio_device: Option<String>,
    sample_rate: Option<u32>,
}

impl ConnectionView {
    fn of(connected: bool) -> Self {
        Self {
            port: if connected {
                "connected"
            } else {
                "disconnected"
            },
            port_name: connected.then_some(PORT_NAME),
            audio_device: None,
            sample_rate: None,
        }
    }
}

/// What one press of the pánico did.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PanicOutcome {
    /// Notas vivas held when the messages went out. It is the number the notice
    /// says out loud, so it is counted before the silencing, not after.
    pub silenced: usize,
    /// Whether the port had to be reopened to get the messages out.
    pub reopened: bool,
}

/// The port owner, or nothing when `MODX-1` was not there at startup.
pub struct Keyboard {
    owner: Mutex<Option<OwnerHandle>>,
}

impl Keyboard {
    pub fn new() -> Self {
        Self {
            owner: Mutex::new(None),
        }
    }

    /// Open `MODX-1` and start the owner. Failing is not fatal: the screen opens
    /// either way, with every slot in its invalidated look, which is the state this
    /// session is specified to start in.
    pub fn connect(&self, app: &AppHandle) -> Result<(), PortError> {
        let mut owner = self
            .owner
            .lock()
            .expect("the keyboard lock is never poisoned");
        if owner.is_some() {
            return Ok(());
        }

        let port = HardwarePort::open()?;
        let notify = app.clone();
        *owner = Some(OwnerHandle::spawn(port, move |live| {
            let _ = notify.emit(EVENT_LIVE_NOTES, live);
        }));

        let _ = app.emit(EVENT_CONNECTION, ConnectionView::of(true));
        Ok(())
    }

    /// Silence the keyboard, from any screen and in any state.
    ///
    /// It is the last thing that stops working: if the port was lost it tries to
    /// open it again and sends anyway, because a hung note does not care why the
    /// app thinks it is disconnected.
    pub fn panic(&self, app: &AppHandle) -> Result<PanicOutcome, PortError> {
        let mut reopened = false;
        if self.owner.lock().expect("lock").is_none() {
            self.connect(app)?;
            reopened = true;
        }

        let owner = self.owner.lock().expect("lock");
        let handle = owner.as_ref().ok_or(PortError::OwnerGone)?;
        Ok(PanicOutcome {
            silenced: handle.panic()?,
            reopened,
        })
    }
}

impl Default for Keyboard {
    fn default() -> Self {
        Self::new()
    }
}

/// Open the port at startup and say so, whichever way it went.
///
/// The pánico is wired before the first note is ever generated, which is the
/// precondition the fase 0c hung notes bought at full price.
pub fn start(app: &AppHandle) {
    let keyboard = app.state::<Keyboard>();
    match keyboard.connect(app) {
        Ok(()) => log::info!("{PORT_NAME} abierto"),
        Err(error) => {
            log::warn!("{PORT_NAME} no se pudo abrir: {error}");
            let _ = app.emit(EVENT_CONNECTION, ConnectionView::of(false));
        }
    }
}

#[tauri::command]
pub fn panic_keyboard(app: AppHandle) -> Result<PanicOutcome, String> {
    app.state::<Keyboard>()
        .panic(&app)
        .map_err(|error| error.to_string())
}

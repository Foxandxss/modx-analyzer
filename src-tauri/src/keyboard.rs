//! The app's one connection to the MODX, and the two things the front can ask of
//! it this session: how many notes are live, and make them stop.
//!
//! Everything about *how* lives in `modx-midi`. What is here is the wiring: open
//! the port at startup, push the connection state and the live-note count out as
//! events, and expose the pánico as a command that works from any screen.

use std::sync::{Arc, Mutex};

use modx_midi::dump::Dump;
use modx_midi::hardware::HardwarePort;
use modx_midi::owner::{LiveNotes, OwnerHandle};
use modx_midi::port::{PortError, PORT_NAME};
use modx_midi::sysex::Address;
use tauri::{AppHandle, Emitter, Manager};

use crate::connection::Connection;

/// The event the pánico's live state and every node's `TEORÍA` line listen to.
const EVENT_LIVE_NOTES: &str = "modx://live-notes";

/// The hands, as the front draws them.
///
/// The count is the pánico's glow. The lowest pitch is what the eight operators'
/// real-frequency lines are computed from: the ratio is a multiple of the note,
/// so with no note there is no `TEORÍA` Hz and the node shows a dash.
#[derive(Clone, Copy, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveNotesView {
    pub count: usize,
    pub lowest_pitch: Option<u8>,
}

impl From<LiveNotes> for LiveNotesView {
    fn from(live: LiveNotes) -> Self {
        Self {
            count: live.count,
            lowest_pitch: live.lowest,
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
///
/// The handle is behind an `Arc` because the anillo ancho polls from a thread of
/// its own and must not hold this lock while it waits for the keyboard: the
/// pánico takes the same lock, and a pánico that queues behind a poll is not a
/// pánico. Serialising the port is the owner's job, not this mutex's.
pub struct Keyboard {
    owner: Mutex<Option<Arc<OwnerHandle>>>,
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
        *owner = Some(Arc::new(OwnerHandle::spawn(port, move |live| {
            let _ = notify.emit(EVENT_LIVE_NOTES, LiveNotesView::from(live));
        })));

        Connection::set_port(app, Some(PORT_NAME.to_owned()));
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

        let handle = self.owner().ok_or(PortError::OwnerGone)?;
        Ok(PanicOutcome {
            silenced: handle.panic()?,
            reopened,
        })
    }

    /// A bulk dump through the one owner. Unlike the pánico it does **not** reopen
    /// a lost port: a volcado of a keyboard that is not there is not a volcado, and
    /// pretending otherwise would put an empty safety file on disk.
    pub fn dump(&self, address: Address) -> Result<Dump, PortError> {
        self.with_owner(|owner| owner.dump(address))
    }

    /// The Part name, for the volcado to be filed under and for the ancla later.
    pub fn part_name(&self, part: u8) -> Result<String, PortError> {
        self.with_owner(|owner| owner.part_name(part))
    }

    /// The owner to ask from another thread, or nothing while the port is not
    /// open. The `Arc` is taken and the lock let go: what the caller does with it
    /// afterwards can take as long as the keyboard takes.
    pub fn owner(&self) -> Option<Arc<OwnerHandle>> {
        self.owner.lock().expect("lock").clone()
    }

    fn with_owner<T>(
        &self,
        ask: impl FnOnce(&OwnerHandle) -> Result<T, PortError>,
    ) -> Result<T, PortError> {
        let owner = self.owner().ok_or(PortError::OwnerGone)?;
        ask(&owner)
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
            Connection::set_port(app, None);
        }
    }
}

#[tauri::command]
pub fn panic_keyboard(app: AppHandle) -> Result<PanicOutcome, String> {
    app.state::<Keyboard>()
        .panic(&app)
        .map_err(|error| error.to_string())
}

//! The app's one connection to the MODX, and the two things the front can ask of
//! it this session: how many notes are live, and make them stop.
//!
//! Everything about *how* lives in `modx-midi`. What is here is the wiring: open
//! the port at startup, push the connection state and the live-note count out as
//! events, and expose the pánico as a command that works from any screen.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use modx_midi::dump::Dump;
use modx_midi::hardware::HardwarePort;
use modx_midi::link::{Link, Loss};
use modx_midi::owner::{LiveNotes, OwnerHandle};
use modx_midi::port::{PortError, PORT_NAME};
use modx_midi::sysex::Address;
use tauri::{AppHandle, Emitter, Manager};

use crate::connection::Connection;
use crate::generator::Generator;

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
    /// Bumped once per reopen. The ancla reads it between beats and forgets the
    /// timeouts it counted against the connection that has just been thrown away.
    reopens: AtomicU64,
}

impl Keyboard {
    pub fn new() -> Self {
        Self {
            owner: Mutex::new(None),
            reopens: AtomicU64::new(0),
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

        Connection::set_link(app, Link::Connected);
        Ok(())
    }

    /// `REINTENTAR`: throw the port away, enumerate again and open what is there.
    ///
    /// This was written on the assumption that a `midir` connection to a port
    /// that has been unplugged **does not heal** when the cable goes back in —
    /// the handle stays, the reads keep timing out, and nothing in the app can
    /// tell that from a keyboard that has stopped answering. So the handle goes
    /// first and the enumeration decides what comes back.
    ///
    /// **That assumption is contradicted by measurement** (2026-09-08, #15). On
    /// the target machine the cable was pulled — sends failed with
    /// `OutPrepareHeader`, the card appeared by the enumeration road in 3 s —
    /// and on plugging it back in the app read the patch again **without anybody
    /// pressing this button**. Nothing here reopens on its own: `connect` runs
    /// once at startup and the ancla's watchdog only writes the link state. So
    /// the original handle healed, in both directions.
    ///
    /// It is kept, and kept as the button's whole action, for two reasons that
    /// survive the correction: healing once is not healing always, and a port
    /// taken by another app in exclusive mode is a different failure that only
    /// re-enumeration can clear. What is no longer true is that reopening is the
    /// *only* way back, and the button has never been pressed against real
    /// hardware — the one path here that a keyboard session has not exercised.
    ///
    /// It writes the link state itself, both ways, because a `REINTENTAR` that
    /// failed has to *say* it failed: waiting for the ancla's next beat would
    /// leave the button looking as if it had worked for a second.
    pub fn reopen(&self, app: &AppHandle) -> Result<(), PortError> {
        self.close();
        self.reopens.fetch_add(1, Ordering::Release);
        match self.connect(app) {
            Ok(()) => Ok(()),
            Err(error) => {
                Connection::set_link(app, Link::Disconnected(Loss::Enumeration));
                Err(error)
            }
        }
    }

    /// How many times the port has been reopened since launch. The ancla watches
    /// it so the timeouts of a connection that is gone are not counted against
    /// the one that replaced it.
    pub fn reopens(&self) -> u64 {
        self.reopens.load(Ordering::Acquire)
    }

    /// Let the port go. Whoever is mid-request keeps their `Arc` and finishes;
    /// the thread ends when the last one drops it.
    fn close(&self) {
        *self.owner.lock().expect("lock") = None;
    }

    /// Silence the keyboard, from any screen and in any state.
    ///
    /// It is the last thing that stops working. Three ways in, in this order:
    ///
    /// 1. In `DESCONECTADO` it reopens **first**. The app already knows the link
    ///    is not answering, and 2 080 messages handed to a dead port is a second
    ///    of a note that will not stop.
    /// 2. Otherwise it sends down the port it has, which is every ordinary press.
    /// 3. If that send fails it reopens and sends again, because a port that died
    ///    between two events is exactly the case nobody has been told about yet.
    ///
    /// A reopen that failed is not a reason to stop: the send is attempted anyway
    /// and it is the send's error that comes back, because what the owner needs to
    /// know is whether the notes stopped and not which of the two steps failed.
    ///
    /// **The note generator is stopped before anything goes out.** It is the one
    /// piece of app state a pánico changes, and it changes it because a generator
    /// still generating would put a Note On behind the 2 080 messages that were
    /// supposed to be the end of it. It touches no parameter either way: what is
    /// stopped is something this app was doing to the keyboard, not something in
    /// the patch.
    pub fn panic(&self, app: &AppHandle) -> Result<PanicOutcome, PortError> {
        Generator::stop(app);

        let reopened = self.owner().is_none() || Connection::is_disconnected(app);
        if reopened {
            let _ = self.reopen(app);
        }

        match self.send_panic() {
            Ok(silenced) => Ok(PanicOutcome { silenced, reopened }),
            // Already reopened once: a second attempt would enumerate the same
            // ports and find the same nothing.
            Err(error) if reopened => Err(error),
            Err(error) => {
                log::warn!("pánico: el puerto no lo aceptó ({error}); se reabre y se reintenta");
                let _ = self.reopen(app);
                Ok(PanicOutcome {
                    silenced: self.send_panic()?,
                    reopened: true,
                })
            }
        }
    }

    fn send_panic(&self) -> Result<usize, PortError> {
        self.owner().ok_or(PortError::OwnerGone)?.panic()
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
            Connection::set_link(app, Link::Disconnected(Loss::Enumeration));
        }
    }
}

#[tauri::command]
pub fn panic_keyboard(app: AppHandle) -> Result<PanicOutcome, String> {
    app.state::<Keyboard>()
        .panic(&app)
        .map_err(|error| error.to_string())
}

/// `REINTENTAR`, from the «teclado no conectado» card.
///
/// What clears here is only what this can know: `MODX-1` was in the enumeration
/// and it opened. Whether the keyboard behind it **answers** is the ancla's next
/// whole pass, and if it does not, three more passes put the card back. So a
/// `REINTENTAR` into a keyboard that is switched off shows the card leaving and
/// coming back a few seconds later, which is the truth rather than a spinner.
#[tauri::command]
pub fn retry_connection(app: AppHandle) -> Result<(), String> {
    // Both halves, because on this hardware they are one cable: `MODX-1` and
    // `Line (MODX)` go together and they come back together. Reopening only the
    // MIDI half is what #22 caught — the card cleared, the diagram came back and
    // the audio stayed dead for the rest of the process without saying so.
    //
    // The audio goes first and its failure is **not** fatal to the retry: a
    // keyboard whose patch can be read again is worth having even if the device
    // did not come back, and `Connection::set_audio(None)` says which happened.
    crate::audio::reopen(&app);
    app.state::<Keyboard>()
        .reopen(&app)
        .map_err(|error| error.to_string())
}

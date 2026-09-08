//! Stop asking the keyboard anything, and say so.
//!
//! This exists for **one measurement** and is not a feature of the app: #14 asks
//! whether the ancla's second and the anillo ancho's dozen requests a second show
//! up in a 65 536 window of audio. The only way to answer that is to take the same
//! window twice, once with them running and once without, so there has to be a way
//! to turn them off — and the honest way is a dev control, not a hidden constant.
//!
//! **A paused app cannot see a Performance change.** The ancla is what notices,
//! and it is one of the two things this stops. That is why the pause is loud on
//! screen and why nothing in the design reaches for it: the figures go `CADUCO` on
//! their own while it lasts, which is exactly what they are for, but the name in
//! the header would go on saying a sound that is no longer loaded.
//!
//! It goes when #14 is decided and its numbers are in `docs/results`.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager};

/// The event the dev readout draws its button off.
const EVENT_POLLING: &str = "modx://polling";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollingView {
    pub paused: bool,
}

/// Whether the two polling loops are asking for anything.
#[derive(Default)]
pub struct Polling {
    paused: AtomicBool,
}

impl Polling {
    pub fn new() -> Self {
        Self::default()
    }

    /// Read by both loops once per turn, never inside a request.
    ///
    /// `Acquire`/`Release` rather than `Relaxed` so that a pause taken between two
    /// exports is ordered against the samples the export reads: the point of the
    /// whole measurement is that the window belongs to one side of this flag.
    pub fn is_paused(app: &AppHandle) -> bool {
        app.state::<Polling>().paused.load(Ordering::Acquire)
    }

    fn set(app: &AppHandle, paused: bool) {
        app.state::<Polling>()
            .paused
            .store(paused, Ordering::Release);
        let _ = app.emit(EVENT_POLLING, PollingView { paused });
    }
}

/// Stop or resume the ancla and the anillo ancho, for #14's two windows.
#[tauri::command]
pub fn set_polling(app: AppHandle, paused: bool) {
    log::info!("sondeo: {}", if paused { "parado" } else { "corriendo" });
    Polling::set(&app, paused);
}

/// What the flag says, for a window that opened after it was last written.
///
/// Same guard as `last_dump` and `connection_state` (#18): the event may have
/// gone before this window was listening.
#[tauri::command]
pub fn polling_state(app: AppHandle) -> PollingView {
    PollingView {
        paused: Polling::is_paused(&app),
    }
}

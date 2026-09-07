//! El ancla and the relectura, on a thread of their own.
//!
//! Loading another Performance emits **zero bytes** — measured twice, in fase 0d
//! and 0e — so the only way the app can stop lying about which sound it is
//! describing is to keep asking for the Part 1 name. This is the loop that asks,
//! once a second, and the one that reads the whole patch back afterwards.
//!
//! What it emits:
//!
//! - `modx://patch`, through [`Patch::set_anchor`], which is the merged header
//!   state and the only place either half writes to it.
//! - `modx://reread` — the relectura, seen happening. The count is the point: it
//!   says the keyboard is answering and at what rate, which a spinner does not,
//!   and it is what the design means by not hiding what the app costs.
//!
//! **Nothing here invalidates anything directly.** A figure is invalidated where
//! it lives: [`Patch::set_anchor`] bumps a generation, and the anillo ancho empties
//! itself between two steps. Two places that both blanked the diagram would be two
//! places that could disagree about which patch it belongs to.

use std::sync::Arc;
use std::time::{Duration, Instant};

use modx_midi::anchor::{self, Anchor, Beat};
use modx_midi::hardware::HardwarePort;
use modx_midi::link::LinkWatch;
use modx_midi::owner::{OwnerHandle, Priority};
use tauri::{AppHandle, Emitter, Manager};

use crate::connection::Connection;
use crate::keyboard::Keyboard;
use crate::patch::Patch;

/// The relectura, as the strip draws it.
const EVENT_REREAD: &str = "modx://reread";

/// The Part the ancla watches. Fase 1 works on the Part 1 only; see `patch.rs`.
const PART: u8 = 1;

/// One pass a second, measured from the **start** of the pass: what the design
/// asks for is a beat a second, not a second of silence between beats. Twenty
/// ASCII addresses cost ~40 ms of it.
const BEAT: Duration = Duration::from_secs(1);

/// How long to wait before looking again when there is no port to ask.
const NO_PORT_PATIENCE: Duration = Duration::from_millis(500);

/// How many addresses of a relectura go by between two progress events.
///
/// The whole pass is ~0,9 s over 384 addresses, so every address would be four
/// hundred IPC hops in under a second to move a counter nobody can read that
/// fast. Every eight is fifty events and a count that still visibly climbs.
const PROGRESS_EVERY: usize = 8;

/// The relectura, running or finished.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RereadView {
    pub done: usize,
    pub total: usize,
    /// How many of `done` came back with a value. The fase 0c sweep put this at
    /// 415 of 416 on the first pass, so it is counted rather than assumed: an
    /// address that stopped answering is news.
    pub answered: usize,
    /// `None` while it is running, and the whole pass once it is over. It is what
    /// turns the strip off, and the figure the dev readout carries so that the
    /// real ~0,9 s can be copied down in one pass with the keyboard.
    pub took_ms: Option<u64>,
}

/// Start the ancla. Like the ring, it runs for as long as the app does: there is
/// no state in which not knowing whether the sound changed is the right answer.
pub fn start(app: &AppHandle) {
    let app = app.clone();
    std::thread::Builder::new()
        .name("modx-ancla".into())
        .spawn(move || run(&app))
        .expect("the ancla thread is spawned once at startup");
}

fn run(app: &AppHandle) {
    let mut anchor = Anchor::new(PART);
    let mut link = LinkWatch::new();
    let mut reopens = app.state::<Keyboard>().reopens();

    loop {
        // The watchdog rides on the ancla and is not a thread of its own: the two
        // facts it needs are the enumeration and this loop's own count of passes
        // with a hole, and a second thread would only be a second opinion about
        // the same second. It looks once per turn of this loop — every second
        // while the keyboard answers, and every two while it is timing out, which
        // is the cadence the card's `ÚLTIMO SONDEO N s` is drawn against.
        watch(app, &mut link, &anchor);

        // `REINTENTAR` threw the port away and opened another one. The passes
        // that timed out belong to the connection that is gone.
        let now = app.state::<Keyboard>().reopens();
        if now != reopens {
            reopens = now;
            anchor.rearm();
            watch(app, &mut link, &anchor);
        }

        let Some(owner) = app.state::<Keyboard>().owner() else {
            std::thread::sleep(NO_PORT_PATIENCE);
            continue;
        };

        let started = Instant::now();
        let beat = anchor.beat(&mut |address| owner.read(Priority::Anchor, address));
        let read_at = Instant::now();

        match beat {
            // The name it already had, or a pass with a hole in it. A hole is
            // compared with nothing at all: `Init Normal (FM-X)` missing a letter
            // reads as a different name, and a different name would throw away
            // every figure on the screen over one lost byte.
            Ok(Beat::Same | Beat::Incomplete) => {}
            Ok(Beat::First(name)) => {
                log::info!("ancla: «{name}»");
                Patch::set_anchor(app, name, None, anchor.changes(), read_at);
                reread(app, &owner);
            }
            Ok(Beat::Changed { name, previous }) => {
                log::info!("ancla: «{previous}» → «{name}»");
                // The generation goes up here, so the diagram is already empty by
                // the time the relectura starts taking the port.
                Patch::set_anchor(app, name, Some(previous), anchor.changes(), read_at);
                reread(app, &owner);
            }
            Err(error) => {
                log::warn!("ancla: {error}");
                std::thread::sleep(NO_PORT_PATIENCE);
                continue;
            }
        }

        if let Some(rest) = BEAT.checked_sub(started.elapsed()) {
            std::thread::sleep(rest);
        }
    }
}

/// Look at the two facts a disconnection is made of and say so if either moved.
///
/// The rule is [`LinkWatch`]'s and lives in `modx-midi` with the fake in front of
/// it; what is here is where the facts come from — the enumeration, which is the
/// one thing about the port that can be asked without opening it, and the ancla's
/// own count of passes that came back with a hole.
fn watch(app: &AppHandle, link: &mut LinkWatch, anchor: &Anchor) {
    if let Some(now) = link.observe(HardwarePort::is_present(), anchor.incomplete_in_a_row()) {
        log::info!("enlace: {now:?}");
        Connection::set_link(app, now);
    }
}

/// Read the whole patch back, saying how far it has got.
///
/// It runs in the ancla's own lane, which starves the anillo ancho for as long as
/// it lasts (ADR-0004). That is the intended shape and not a side effect: the
/// diagram has just lost its numbers, so there is nothing for the ring to keep
/// fresh, and the fastest way back to a drawn patch is to let the relectura have
/// the port. The ring picks up again on its own the moment this returns.
fn reread(app: &AppHandle, owner: &Arc<OwnerHandle>) {
    let started = Instant::now();
    let mut announced = 0usize;
    let mut reached = anchor::Progress {
        done: 0,
        total: anchor::reread_total(PART),
        answered: 0,
    };

    let read = anchor::reread(
        PART,
        &mut |address| owner.read(Priority::Anchor, address),
        &mut |step| {
            reached = step;
            if step.done - announced >= PROGRESS_EVERY || step.done == step.total {
                announced = step.done;
                let _ = app.emit(
                    EVENT_REREAD,
                    RereadView {
                        done: step.done,
                        total: step.total,
                        answered: step.answered,
                        took_ms: None,
                    },
                );
            }
        },
    );

    match read {
        Ok(read) => {
            let took = started.elapsed();
            log::info!(
                "relectura: {} de {} en {} ms",
                read.answered,
                read.total,
                took.as_millis()
            );
            let _ = app.emit(
                EVENT_REREAD,
                RereadView {
                    done: read.total,
                    total: read.total,
                    answered: read.answered,
                    took_ms: Some(took.as_millis() as u64),
                },
            );
        }
        Err(error) => {
            log::warn!("relectura: {error}");
            // The strip has to come down: what is on screen is a count that
            // stopped climbing, and leaving it up would say the app is still
            // reading. What it read stays; the ring takes over from here.
            let _ = app.emit(
                EVENT_REREAD,
                RereadView {
                    done: reached.done,
                    total: reached.total,
                    answered: reached.answered,
                    took_ms: Some(started.elapsed().as_millis() as u64),
                },
            );
        }
    }
}

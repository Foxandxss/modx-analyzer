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
//! - `modx://anchor-beat` — every pass, with the two instants that bracket it and
//!   what it answered. Nothing draws it. It exists because the aval below is a
//!   rule about *time*, and the medida is on the other side of the IPC: a window
//!   of audio can only be vouched for by a beat that began after its last sample,
//!   and the front cannot ask that question of a name and a counter.
//!
//! **Nothing here invalidates anything directly.** A figure is invalidated where
//! it lives: [`Patch::set_anchor`] bumps a generation, and the anillo ancho empties
//! itself between two steps. Two places that both blanked the diagram would be two
//! places that could disagree about which patch it belongs to.
//!
//! **Nothing here draws anything either, and that is newer.** A beat that finds
//! the same name is the **aval** (ADR-0005): it is what lets the anillo ancho put
//! up a number that changed, because a reading taken before this beat started and
//! a name that has not moved since bracket that number inside one Performance.
//! Without it the ring holds the reading rather than stamping it `SONDEADO`, which
//! is #20 — a pass that straddled a Performance change used to be drawn as a
//! confident diagram of a patch that exists on no keyboard. The ring can ask for a
//! beat ahead of the second when it is holding something, and so can the front for
//! a medida; how often that is answered is decided here, because the port is the
//! ancla's before it is anybody else's (ADR-0004).

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
use crate::polling::Polling;

/// The relectura, as the strip draws it.
const EVENT_REREAD: &str = "modx://reread";

/// One pass of the ancla, as the front sees it.
///
/// The name and the change counter already cross on `modx://patch`, and neither
/// can say *when* the app last confirmed the sound: a counter that has not moved
/// says nothing about the last second. The medida needs exactly that — a beat that
/// began after the last sample of its window and found the same name is what turns
/// the window into a figure (ADR-0005) — so every pass is announced, with the two
/// instants that bracket it.
const EVENT_BEAT: &str = "modx://anchor-beat";

/// The Part the ancla watches. Fase 1 works on the Part 1 only; see `patch.rs`.
const PART: u8 = 1;

/// One pass a second, measured from the **start** of the pass: what the design
/// asks for is a beat a second, not a second of silence between beats. Twenty
/// ASCII addresses cost ~40 ms of it.
const BEAT: Duration = Duration::from_secs(1);

/// The shortest gap between two beats when the anillo ancho asks for one out of
/// turn, and how many times the last beat's own cost that gap has to be.
///
/// The ring asks because it is holding a number it will not draw until the name
/// has been confirmed (ADR-0005), and the sooner the beat the shorter the wait.
/// The multiple is what keeps that from eating the port: idle, a beat costs
/// ~40 ms and the gap stays at the floor of 250 ms; under notes it costs ~200 ms
/// and the gap goes to ~1 s, so the out-of-turn beats **fade out by themselves
/// exactly when the channel is disputed**. The ancla keeps its slot, which is
/// ADR-0004's rule; it does not grow it.
const AVAL_GAP_FLOOR: Duration = Duration::from_millis(250);
const AVAL_GAP_BEATS: u32 = 5;

/// How often the wait between two beats looks up to see whether it is still
/// wanted. Short enough not to add anything anyone can see to the 250 ms floor.
const WAIT_SLICE: Duration = Duration::from_millis(20);

/// How long to wait before looking again when there is no port to ask.
const NO_PORT_PATIENCE: Duration = Duration::from_millis(500);

/// How many addresses of a relectura go by between two progress events.
///
/// The whole pass is ~0,9 s over 384 addresses, so every address would be four
/// hundred IPC hops in under a second to move a counter nobody can read that
/// fast. Every eight is fifty events and a count that still visibly climbs.
const PROGRESS_EVERY: usize = 8;

/// One pass of the ancla, and the two instants that bracket it.
///
/// **Ages and not timestamps**, like every other figure that crosses: the pass is
/// timed with a monotonic clock whose epoch has nothing to do with the front's
/// `performance.now()`, so what travels is how long before the event left each of
/// the two moments happened. The gateway turns both back into stamps on its own
/// clock the instant the event arrives.
///
/// The two are not one: a pass takes ~40 ms idle and ~200 ms under notes, and what
/// a beat can vouch for is everything read before it **started** — the end is when
/// the answer is known, and the difference between them is the whole reason
/// [`Beat`] cannot be reported as a single moment.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatView {
    /// 1-based, in the order the ancla took them, so the front can tell a beat it
    /// has already seen from one it has not.
    pub beat: u64,
    pub started_ago_ms: u64,
    pub ended_ago_ms: u64,
    /// `same`, `first`, `changed` or `incomplete`: [`Beat`]'s own four answers.
    pub answer: &'static str,
    /// The name **this pass** read, or `None` for `incomplete`, which read none.
    ///
    /// An incomplete pass is compared with nothing, so putting the last known name
    /// here would be the app claiming a reading it did not take.
    pub name: Option<String>,
}

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
    let mut beats = 0u64;

    loop {
        // The watchdog rides on the ancla and is not a thread of its own: the two
        // facts it needs are the enumeration and this loop's own count of passes
        // with a hole, and a second thread would only be a second opinion about
        // the same second. It looks once per turn of this loop — at most every
        // second while the keyboard answers, and every two while it is timing
        // out, which is the cadence the card's `ÚLTIMO SONDEO N s` is drawn
        // against. A turn can come round sooner than the second when the anillo
        // ancho pulls a beat forward for an aval; looking more often than the
        // card can move is free, because `LinkWatch` only speaks when something
        // actually changed.
        watch(app, &mut link, &anchor);

        // `REINTENTAR` threw the port away and opened another one. The passes
        // that timed out belong to the connection that is gone.
        let now = app.state::<Keyboard>().reopens();
        if now != reopens {
            reopens = now;
            anchor.rearm();
            watch(app, &mut link, &anchor);
        }

        // #14's pause, and it is checked **after** the watchdog on purpose: with
        // the ancla silent the link state is the one thing that can still be told
        // honestly, from the enumeration alone, and a paused app that also stopped
        // knowing whether the cable was in would be two lies for the price of one.
        //
        // What it does cost is the name: nothing notices a Performance change
        // while this is on. That is why the control says so in alert, and why it
        // exists for a measurement rather than for the design.
        if Polling::is_paused(app) {
            std::thread::sleep(BEAT);
            continue;
        }

        let Some(owner) = app.state::<Keyboard>().owner() else {
            std::thread::sleep(NO_PORT_PATIENCE);
            continue;
        };

        // Whatever asked for a beat out of turn, this is the beat that answers it.
        // The flag is cleared **before** the pass rather than after: a request that
        // arrives while these twenty addresses are in flight is about a window this
        // pass began too early to speak for, so it has to survive into the next one.
        Patch::answer_beat_request(app);

        let started = Instant::now();
        let beat = anchor.beat(&mut |address| owner.read(Priority::Anchor, address));
        let read_at = Instant::now();

        let cost = read_at.duration_since(started);
        // A beat that came back with a hole has nothing to vouch for, so there is
        // nothing to be gained by pulling the next one forward — and something to
        // lose: `DESCONECTADO` is three holes in a row, and at 250 ms apart that
        // verdict would be about three quarters of a second instead of about
        // three seconds. A hole keeps its full second.
        let complete = !matches!(&beat, Ok(Beat::Incomplete));

        // Every pass is announced, including the incomplete ones and including the
        // ordinary `Same` that is the overwhelming majority of them: what the front
        // needs is not the interesting beats but *each* beat, because a medida is
        // vouched for by the pass that happened to follow it. An error is not a
        // pass and is not counted as one.
        if let Ok(found) = &beat {
            beats += 1;
            announce(app, beats, started, read_at, found, &anchor);
        }

        match beat {
            // The same name, and that is the aval (ADR-0005): every reading the
            // ring took before this beat *started* is bracketed inside one
            // Performance, so those numbers can be drawn. It is the ordinary
            // outcome, and it is what turns a held reading into a figure.
            Ok(Beat::Same) => Patch::vouch(app, started),
            // A pass with a hole in it is compared with nothing at all:
            // `Init Normal (FM-X)` missing a letter reads as a different name,
            // and a different name would throw away every figure on the screen
            // over one lost byte. It cannot vouch for anything either — it did
            // not read a name, so it has nothing to say about which sound the
            // ring was talking to.
            Ok(Beat::Incomplete) => {}
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

        wait_for_next_beat(app, started, cost, complete);
    }
}

/// Say what one pass found, with the two instants that bracket it.
///
/// The name comes from the ancla and not from the [`Beat`], because a `Same` beat
/// carries no name and the front needs the one it read: two Performances that share
/// their Part 1 name are one sound to the ancla, and a beat that says *which* name
/// it saw is what lets the medida check both ends of its own window. An incomplete
/// pass gets `None` — it read no whole name, so it has none to report.
fn announce(
    app: &AppHandle,
    beat: u64,
    started: Instant,
    ended: Instant,
    found: &Beat,
    anchor: &Anchor,
) {
    let answer = match found {
        Beat::Same => "same",
        Beat::First(_) => "first",
        Beat::Changed { .. } => "changed",
        Beat::Incomplete => "incomplete",
    };
    let name = match found {
        Beat::Incomplete => None,
        _ => anchor.name().map(str::to_owned),
    };

    let _ = app.emit(
        EVENT_BEAT,
        BeatView {
            beat,
            started_ago_ms: started.elapsed().as_millis() as u64,
            ended_ago_ms: ended.elapsed().as_millis() as u64,
            answer,
            name,
        },
    );
}

/// The shortest a beat is allowed to follow the last one, from what the last one
/// cost (ADR-0005).
///
/// The floor is what an idle beat gets and the multiple is what a beat under notes
/// gets, and the second is the point: at ~40 ms a pass the gap stays at 250 ms, and
/// at ~200 ms a pass it goes past the ancla's own second, so out-of-turn beats fade
/// out by themselves exactly when the port is disputed. Nobody who asks for one can
/// change this — the ancla owns its cadence (ADR-0004).
fn aval_gap(cost: Duration) -> Duration {
    AVAL_GAP_FLOOR.max(cost * AVAL_GAP_BEATS)
}

/// Hold until the next beat is due — or until somebody says one would put a figure
/// on the screen and enough time has passed to give it one.
///
/// Two things ask: the anillo ancho, which is holding a reading no beat has vouched
/// for, and the front, which is holding a medida (ADR-0005, extended to the
/// capture). They are one question here — the gap is the same for both, because
/// what it protects is the port and not whoever wanted the beat.
///
/// The second is still measured from the **start** of the last beat, as it always
/// was: what the design asks for is a beat a second, not a second of silence
/// between beats.
fn wait_for_next_beat(app: &AppHandle, started: Instant, cost: Duration, complete: bool) {
    if !complete {
        if let Some(rest) = BEAT.checked_sub(started.elapsed()) {
            std::thread::sleep(rest);
        }
        return;
    }

    let gap = aval_gap(cost);

    loop {
        let Some(rest) = BEAT.checked_sub(started.elapsed()) else {
            return;
        };
        if started.elapsed() >= gap && (Patch::aval_wanted(app) || Patch::beat_asked(app)) {
            return;
        }
        std::thread::sleep(WAIT_SLICE.min(rest));
    }
}

/// The front asks for a beat sooner than the ancla's second.
///
/// It is the same request the anillo ancho makes and it buys the same thing: a
/// medida is drawn only once a beat that began after its window closed has found
/// the same name, so the sooner that beat comes the shorter the shutter's wait.
/// It is a **hint**, not a demand: the gap rule above decides when, and under notes
/// the answer is «at the usual second».
#[tauri::command]
pub fn request_anchor_beat(app: AppHandle) {
    Patch::ask_for_beat(&app);
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

#[cfg(test)]
mod tests {
    use super::*;

    /// The rule the out-of-turn beat lives under, and the one thing a new caller
    /// could quietly change. It is asserted at the two costs that were actually
    /// measured, because that is where it has to hold.
    #[test]
    fn the_out_of_turn_gap_is_the_floor_idle_and_a_whole_second_under_notes() {
        // Idle: a pass costs ~40 ms, five of which is under the floor, so the
        // floor governs and a medida waits at most a quarter of a second.
        assert_eq!(aval_gap(Duration::from_millis(40)), AVAL_GAP_FLOOR);
        assert_eq!(aval_gap(Duration::ZERO), AVAL_GAP_FLOOR);

        // Under notes: a pass costs ~200 ms and the multiple governs, which puts
        // the gap at the ancla's own second. The out-of-turn beat fades out by
        // itself exactly when the port is disputed — nothing switches it off.
        assert_eq!(aval_gap(Duration::from_millis(200)), BEAT);
        assert!(aval_gap(Duration::from_millis(430)) > BEAT);
    }

    /// The four answers the front is given, and the one that carries no name.
    #[test]
    fn every_answer_has_a_word_and_only_the_incomplete_one_has_no_name() {
        let words = |found: &Beat| match found {
            Beat::Same => "same",
            Beat::First(_) => "first",
            Beat::Changed { .. } => "changed",
            Beat::Incomplete => "incomplete",
        };

        assert_eq!(words(&Beat::Same), "same");
        assert_eq!(words(&Beat::First("Init Normal (FM-X)".into())), "first");
        assert_eq!(
            words(&Beat::Changed {
                name: "Bright FM Keys".into(),
                previous: "Init Normal (FM-X)".into(),
            }),
            "changed",
        );
        assert_eq!(words(&Beat::Incomplete), "incomplete");
    }
}

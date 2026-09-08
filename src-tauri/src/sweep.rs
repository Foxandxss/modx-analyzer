//! El barrido de una Part, on a thread of its own: #16's instrument.
//!
//! Everything about *what* is asked lives in `modx-midi` ([`modx_midi::sweep`]).
//! What is here is the wiring: a thread that walks one operator block offset by
//! offset in the narrow ring's lane, pushes the count out as it goes, and keeps
//! the last sweep of each operator so that the next one can say which offset
//! moved.
//!
//! It runs on a thread and not on the command because a sweep of a Part that is
//! not there is 47 timeouts — nearly five seconds — and a Tauri command without
//! `async` is served on the main thread, which is the one that draws. A window
//! frozen for five seconds is the app looking broken at exactly the moment it is
//! working correctly.
//!
//! **It writes nothing**, and that is the crate's doing rather than this file's:
//! [`modx_midi::sweep::sweep_operator`] is handed a closure that reads, so there
//! is no path from here to a Parameter Change.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Instant;

use modx_midi::owner::Priority;
use modx_midi::sweep::{self, Sweep};
use modx_midi::table::Provenance;
use tauri::{AppHandle, Emitter, Manager};

use crate::keyboard::Keyboard;

/// The event the dev readout's `BARRIDO` block listens to.
const EVENT_SWEEP: &str = "modx://sweep";

/// One offset of the block, as the readout draws it.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OffsetView {
    /// The `al` byte, which is how the Data List's own table is indexed.
    pub al: u8,
    /// `49 21 1A`. The whole terna, so a line can be read straight onto paper.
    pub address: String,
    /// The decoded value, or `None` when the offset did not answer. The dash on
    /// screen is the interesting half of this sweep: the Data List and the fase 0c
    /// map disagree about how many of the 47 answer at all.
    pub value: Option<u32>,
    /// The table's name for whatever owns this offset, or `None` where the table
    /// accounts for nothing.
    pub name: Option<&'static str>,
    /// ADR-0003's grade for that entry, in the table's own two words.
    pub provenance: Option<&'static str>,
    /// Whether the table has this offset down as reserved. It is shown because a
    /// reserved address answers a read exactly like a real one: the only thing
    /// that can tell them apart is the table, and this is the readout where the
    /// two are being compared.
    pub reserved: bool,
    /// Whether the bytes differ from the previous sweep of this same operator.
    pub changed: bool,
}

/// One sweep, running or finished.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SweepView {
    pub part: u8,
    pub operator: u8,
    pub done: usize,
    pub total: usize,
    /// How many of `done` came back with a value.
    pub answered: usize,
    pub running: bool,
    /// `None` while it is running, and the whole pass once it is over.
    pub took_ms: Option<u64>,
    /// The offsets, once there are any. Empty while the sweep is going: a half
    /// table on screen would be a Part that answers nowhere for a second and then
    /// suddenly does.
    pub offsets: Vec<OffsetView>,
    /// Whether there was a previous sweep of this same operator to compare with.
    ///
    /// «Nothing moved» and «there is nothing to have moved from» are two
    /// different facts and the readout says which: a first sweep with an empty
    /// `changed` drawn as SIN CAMBIOS would be the app claiming a comparison it
    /// never made.
    pub compared: bool,
    /// The `al` of every offset that moved since the previous sweep of this same
    /// operator. This is the answer to «did the panel change land where the
    /// addressing says it would», and it is a list rather than a flag because a
    /// change landing in *two* places is the interesting failure.
    pub changed: Vec<u8>,
}

/// The sweeps the app has taken: at most one running, and the last one of each
/// operator kept for the comparison.
#[derive(Default)]
pub struct Sweeps {
    running: AtomicBool,
    last: Mutex<HashMap<(u8, u8), Sweep>>,
}

impl Sweeps {
    pub fn new() -> Self {
        Self::default()
    }

    /// Take a sweep of one operator of one Part, on a thread.
    ///
    /// A second press while one is going changes nothing: two sweeps would be two
    /// sets of 47 requests interleaved in the same lane, and neither of the two
    /// tables on screen would be a pass over anything.
    pub fn start(app: &AppHandle, part: u8, operator: u8) -> Result<(), String> {
        if !(1..=16).contains(&part) {
            return Err(format!("la Part {part} no existe: son 1-16"));
        }
        if !(1..=8).contains(&operator) {
            return Err(format!("el operador {operator} no existe: son 1-8"));
        }

        let state = app.state::<Sweeps>();
        if state
            .running
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err("ya hay un barrido en curso".into());
        }

        let handle = app.clone();
        std::thread::Builder::new()
            .name("modx-barrido".into())
            .spawn(move || {
                run(&handle, part, operator);
                handle
                    .state::<Sweeps>()
                    .running
                    .store(false, Ordering::Release);
            })
            .map_err(|error| {
                state.running.store(false, Ordering::Release);
                format!("no se pudo lanzar el barrido: {error}")
            })?;

        Ok(())
    }
}

fn run(app: &AppHandle, part: u8, operator: u8) {
    let started = Instant::now();
    let Some(owner) = app.state::<Keyboard>().owner() else {
        // No port. Nothing is emitted as a finished sweep with 47 dashes: that
        // would read as «the keyboard answered nowhere», which is the result this
        // whole ticket turns on and must never be manufactured by a missing cable.
        log::warn!("barrido: no hay puerto");
        emit(
            app,
            SweepView {
                part,
                operator,
                done: 0,
                total: sweep::offsets(),
                answered: 0,
                running: false,
                took_ms: None,
                offsets: Vec::new(),
                compared: false,
                changed: Vec::new(),
            },
        );
        return;
    };

    let swept = sweep::sweep_operator(
        part,
        operator,
        // The narrow ring's lane: behind the ancla and behind the diagram, so a
        // sweep never costs the app its grip on which sound is loaded.
        &mut |address| owner.read(Priority::NarrowRing, address),
        // Once per offset, because 47 is not 384: the relectura thins its count
        // because four hundred events in under a second move a number nobody can
        // read, and a sweep whose every step can take a whole 100 ms timeout is
        // the opposite case.
        &mut |step| {
            emit(
                app,
                SweepView {
                    part,
                    operator,
                    done: step.done,
                    total: step.total,
                    answered: step.answered,
                    running: true,
                    took_ms: None,
                    offsets: Vec::new(),
                    compared: false,
                    changed: Vec::new(),
                },
            );
        },
    );

    let swept = match swept {
        Ok(swept) => swept,
        Err(error) => {
            log::warn!("barrido: {error}");
            emit(
                app,
                SweepView {
                    part,
                    operator,
                    done: 0,
                    total: sweep::offsets(),
                    answered: 0,
                    running: false,
                    took_ms: None,
                    offsets: Vec::new(),
                    compared: false,
                    changed: Vec::new(),
                },
            );
            return;
        }
    };

    let took = started.elapsed();
    log::info!(
        "barrido: parte {part}, op {operator} — {} de {} en {} ms",
        swept.answered(),
        swept.total(),
        took.as_millis()
    );

    let sweeps = app.state::<Sweeps>();
    let mut kept = sweeps
        .last
        .lock()
        .expect("the sweep lock is not held across a panic");
    let before = kept.get(&(part, operator));
    let changed = before
        .map(|before| swept.changes_from(before))
        .unwrap_or_default();
    let view = view(&swept, before.is_some(), &changed, took.as_millis() as u64);
    kept.insert((part, operator), swept);
    drop(kept);

    emit(app, view);
}

fn view(swept: &Sweep, compared: bool, changed: &[u8], took_ms: u64) -> SweepView {
    SweepView {
        part: swept.part,
        operator: swept.operator,
        done: swept.total(),
        total: swept.total(),
        answered: swept.answered(),
        running: false,
        took_ms: Some(took_ms),
        compared,
        offsets: swept
            .offsets
            .iter()
            .map(|offset| {
                let entry = offset.entry();
                OffsetView {
                    al: offset.al,
                    address: offset.address.to_string(),
                    value: offset.value(),
                    name: entry
                        .filter(|entry| !entry.is_reserved())
                        .map(|entry| entry.name),
                    provenance: entry.map(|entry| match entry.provenance {
                        Provenance::Medido => "medido",
                        Provenance::Documentado => "documentado",
                    }),
                    reserved: entry.is_some_and(|entry| entry.is_reserved()),
                    changed: changed.contains(&offset.al),
                }
            })
            .collect(),
        changed: changed.to_vec(),
    }
}

fn emit(app: &AppHandle, view: SweepView) {
    let _ = app.emit(EVENT_SWEEP, view);
}

/// Sweep one operator of one Part, read-only. The dev control of #16.
///
/// It answers as soon as the thread is running, not when the sweep is done: what
/// happens is on `modx://sweep`, the same one-writer rule the connection and the
/// relectura follow.
#[tauri::command]
pub fn sweep_operator(app: AppHandle, part: u8, operator: u8) -> Result<(), String> {
    Sweeps::start(&app, part, operator)
}

#[cfg(test)]
mod tests {
    use super::*;
    use modx_midi::fake::FakeModx;
    use modx_midi::owner::{PortOwner, Request, Served};
    use modx_midi::port::PortError;
    use modx_midi::sysex::Address;

    /// One sweep of the fake, with the Part 2 the ticket asks the owner to build.
    fn swept(part: u8, operator: u8, changed: &[u8]) -> SweepView {
        let mut fake = FakeModx::init_normal_fmx();
        fake.load_fmx_part(2);
        let mut owner = PortOwner::new(fake);

        let pass = sweep::sweep_operator(
            part,
            operator,
            &mut |address| -> Result<Option<Vec<u8>>, PortError> {
                match owner.serve(Request::Read(address))? {
                    Served::Read { data, .. } => Ok(data),
                    other => unreachable!("a read answers with data, not {other:?}"),
                }
            },
            &mut |_| {},
        )
        .unwrap();

        view(&pass, !changed.is_empty(), changed, 310)
    }

    #[test]
    fn every_offset_reaches_the_screen_with_its_address_and_what_the_table_calls_it() {
        let view = swept(2, 3, &[]);

        assert_eq!(view.total, 47);
        assert_eq!(view.offsets.len(), 47);
        let level = &view.offsets[0x1A];
        assert_eq!(
            level.address, "49 21 1A",
            "(op << 4) | part, both base zero"
        );
        assert_eq!(level.name, Some("Operator Level"));
        assert_eq!(level.provenance, Some("medido"));
        assert!(!level.reserved);
        assert_eq!(level.value, Some(0));
    }

    /// The four the MODX8 leaves silent reach the screen as the dash and not as a
    /// zero — `26`-`29`, measured on 2026-09-08 (#16). They are bytes 2 to 5 of
    /// the five-byte `Controller Set 1-16 Element Switch` at `25`, so they are
    /// **not** reserved and they are **not** an entry of their own: a multibyte
    /// parameter answers its whole field from its first address, and its tail is
    /// a gap in the table because it is a gap on the keyboard.
    #[test]
    fn an_offset_that_did_not_answer_carries_the_dash_and_not_a_zero() {
        let view = swept(2, 3, &[]);

        for al in [0x26, 0x27, 0x28, 0x29] {
            let offset = &view.offsets[al];
            assert_eq!(offset.value, None, "at {al:02X}");
            assert!(!offset.reserved, "at {al:02X}");
            assert_eq!(
                offset.name,
                Some("Controller Set 1-16 Element Switch"),
                "the tail carries the name of the field it belongs to, so the dash \
                 reads as «this parameter answered at 25» and not as a hole"
            );
        }

        // And the other four the sources argued about are the opposite case: five
        // reserved bytes are five one-byte holes, and every one of them answers.
        for al in [0x2B, 0x2C, 0x2D, 0x2E] {
            let offset = &view.offsets[al];
            assert_eq!(offset.value, Some(0), "at {al:02X}");
            assert!(offset.reserved, "at {al:02X}");
            assert_eq!(
                offset.name, None,
                "a reserved offset is not looked up by name"
            );
        }
    }

    #[test]
    fn the_offsets_that_moved_are_marked_one_by_one_and_listed_once() {
        let view = swept(2, 5, &[0x1A]);

        assert_eq!(view.changed, vec![0x1A]);
        assert!(view.offsets[0x1A].changed);
        assert_eq!(
            view.offsets.iter().filter(|offset| offset.changed).count(),
            1
        );
    }

    /// A Performance whose Part 2 is not FM-X: the sweep answers nowhere and the
    /// view says so with 47 dashes and `0 DE 47`, which is a result and not an
    /// error.
    #[test]
    fn a_part_that_answers_nowhere_is_a_finished_sweep_and_not_a_failure() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let pass = sweep::sweep_operator(
            2,
            1,
            &mut |address: Address| -> Result<Option<Vec<u8>>, PortError> {
                match owner.serve(Request::Read(address))? {
                    Served::Read { data, .. } => Ok(data),
                    other => unreachable!("a read answers with data, not {other:?}"),
                }
            },
            &mut |_| {},
        )
        .unwrap();

        let view = view(&pass, false, &[], 4_700);

        assert_eq!(view.answered, 0);
        assert_eq!(view.done, view.total);
        assert!(!view.running);
        assert!(view.offsets.iter().all(|offset| offset.value.is_none()));
    }
}

//! El anillo ancho, running, and what it draws.
//!
//! `modx-midi` knows how to cycle the 42 addresses and what they mean; this is the
//! thread that keeps it turning and the two events the front listens to:
//!
//! - `modx://patch` — the header's facts: the algorithm, the feedback and the
//!   operator its loop sits on. The ancla's name is in the same payload and stays
//!   empty until #13, which is why the state is merged here rather than emitted by
//!   whoever happens to have read something: two emitters would erase each other's
//!   fields, the way `connection.rs` learned the hard way.
//! - `modx://operators` — the eight nodes, plus how long the last pass took.
//!
//! **Ages, not timestamps.** A reading is stamped with a monotonic `Instant` whose
//! epoch has nothing to do with the front's `performance.now()`, so what crosses is
//! how long ago the address answered. The gateway turns that back into a stamp on
//! its own clock the moment it arrives. It is the same trick the audio bloque uses,
//! and for the same reason: two unrelated clocks cannot be subtracted, but an
//! elapsed time can be carried across.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use modx_midi::algorithms::{self, Role};
use modx_midi::owner::Priority;
use modx_midi::ring::{self, FrequencyMode, OperatorReadings, Reading, WideRing, OPERATORS};
use tauri::{AppHandle, Emitter, Manager};

use crate::keyboard::Keyboard;

/// The header's facts.
const EVENT_PATCH: &str = "modx://patch";
/// The eight nodes and the ring's cadence.
const EVENT_OPERATORS: &str = "modx://operators";

/// The Part the diagram draws. Fase 1 works on the Part 1 only; the Part is a
/// parameter everywhere below this line, so #16 changes this constant and nothing
/// else if the `(op << 4) | part` addressing holds.
const PART: u8 = 1;

/// How long the ring waits before looking again when there is no port to poll.
/// Long enough not to spin, short enough that plugging the keyboard back in is
/// noticed within a second.
const NO_PORT_PATIENCE: Duration = Duration::from_millis(500);

/// One figure and how long ago the keyboard said it.
#[derive(Clone, Copy, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Aged<T> {
    pub value: T,
    /// Milliseconds between the reply arriving and this payload being built.
    pub age_ms: u64,
}

impl<T> Aged<T> {
    fn of(
        reading: Option<Reading>,
        now: Instant,
        value: impl FnOnce(u32) -> Option<T>,
    ) -> Option<Self> {
        let reading = reading?;
        Some(Self {
            value: value(reading.value)?,
            age_ms: now.duration_since(reading.at).as_millis() as u64,
        })
    }

    /// The same figure aged by the oldest of the readings it was derived from: a
    /// role is only as fresh as the older of the algorithm and the Level.
    fn aged_with(self, other: Option<Reading>, now: Instant) -> Self {
        let older = other
            .map(|reading| now.duration_since(reading.at).as_millis() as u64)
            .unwrap_or(self.age_ms);
        Self {
            age_ms: self.age_ms.max(older),
            ..self
        }
    }
}

/// What the header says about the loaded patch.
#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchView {
    /// The ancla. Nothing polls the Part name yet (#13), so it stays empty and the
    /// header keeps drawing the dash it opens with.
    pub performance_name: Option<Aged<String>>,
    pub previous_performance_name: Option<String>,
    /// 1-88 as the keyboard's own screen numbers it: the byte at `48 0p 4F` plus
    /// one. A byte outside the 88 crosses as it came, because what the keyboard
    /// said is a fact and inventing a topology for it is #12's refusal to make.
    pub algorithm: Option<Aged<u32>>,
    pub feedback: Option<Aged<u32>>,
    /// The operator the feedback loop re-enters. For the two algorithms whose loop
    /// wraps a chain (12 and 14) that is the head of the chain, not a single
    /// operator, and the header can only name one.
    pub feedback_operator: Option<Aged<u8>>,
}

/// One node of the diagram, as the front draws it.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorView {
    pub operator: u8,
    /// `carrier`, `modulator` or `inert`. Absent until both the algorithm and this
    /// operator's Level have been read: no topology, no role, and never a guess.
    pub role: Option<Aged<&'static str>>,
    /// 0-99. The height of the fill inside the node; the figure only confirms it.
    pub level: Option<Aged<u32>>,
    /// The nominal frequency ratio, absent in `fixed` mode where Coarse and Fine
    /// do not mean a ratio at all.
    pub ratio: Option<Aged<f32>>,
    pub frequency_mode: Option<Aged<&'static str>>,
    pub spectral_form: Option<Aged<&'static str>>,
}

/// The eight, and the cadence they were read at.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorsView {
    pub operators: Vec<OperatorView>,
    /// How long the last completed pass took. `CADUCO` is four times this and the
    /// zone header says `LOS OCHO · N Hz` from it; both are `null` until the first
    /// pass closes, and neither is ever a constant.
    pub pass_ms: Option<u64>,
    pub passes: u64,
}

/// The merged header state, and the only thing that emits `modx://patch`.
#[derive(Default)]
pub struct Patch {
    view: Mutex<PatchView>,
}

impl Patch {
    pub fn new() -> Self {
        Self::default()
    }

    /// Say what the ring read, leaving the ancla's fields as they were.
    pub fn set_from_ring(
        app: &AppHandle,
        algorithm: Option<Aged<u32>>,
        feedback: Option<Aged<u32>>,
        feedback_operator: Option<Aged<u8>>,
    ) {
        Self::update(app, |view| {
            view.algorithm = algorithm;
            view.feedback = feedback;
            view.feedback_operator = feedback_operator;
        });
    }

    fn update(app: &AppHandle, change: impl FnOnce(&mut PatchView)) {
        let state = app.state::<Patch>();
        let view = {
            let mut view = state
                .view
                .lock()
                .expect("the patch lock is not held across a panic");
            change(&mut view);
            view.clone()
        };
        let _ = app.emit(EVENT_PATCH, view);
    }
}

/// Start the anillo ancho. It runs for as long as the app does: there is no other
/// way to know what the keyboard is doing, so there is no state in which not
/// polling is the right answer.
pub fn start(app: &AppHandle) {
    let app = app.clone();
    std::thread::Builder::new()
        .name("modx-anillo-ancho".into())
        .spawn(move || run(&app))
        .expect("the ring thread is spawned once at startup");
}

fn run(app: &AppHandle) {
    let mut ring = WideRing::new(PART);

    loop {
        let Some(owner) = app.state::<Keyboard>().owner() else {
            // No port: nothing to ask and nothing new to draw. What is on screen
            // keeps ageing on its own, which is the whole point of the stamps.
            std::thread::sleep(NO_PORT_PATIENCE);
            continue;
        };

        match ring.step(&mut |address| owner.read(Priority::WideRing, address)) {
            Ok(false) => {}
            Ok(true) => publish(app, &ring),
            Err(error) => {
                log::warn!("anillo ancho: {error}");
                std::thread::sleep(NO_PORT_PATIENCE);
            }
        }
    }
}

/// Turn what the ring has into the two payloads and send them.
fn publish(app: &AppHandle, ring: &WideRing) {
    let now = Instant::now();
    let algorithm_read = ring.algorithm();
    let topology = algorithm_read.and_then(|read| algorithms::from_read_value(read.value as u8));

    Patch::set_from_ring(
        app,
        // Base zero on the wire, one-based on the screen.
        Aged::of(algorithm_read, now, |value| value.checked_add(1)),
        Aged::of(ring.feedback(), now, Some),
        Aged::of(algorithm_read, now, |_| {
            topology.map(|topology| topology.feedback.into)
        }),
    );

    let operators = (1..=OPERATORS)
        .map(|operator| node(operator, ring.operator(operator), algorithm_read, now))
        .collect();

    let _ = app.emit(
        EVENT_OPERATORS,
        OperatorsView {
            operators,
            pass_ms: ring.last_pass().map(|took| took.as_millis() as u64),
            passes: ring.passes(),
        },
    );
}

fn node(
    operator: u8,
    read: OperatorReadings,
    algorithm: Option<Reading>,
    now: Instant,
) -> OperatorView {
    let topology = algorithm.and_then(|read| algorithms::from_read_value(read.value as u8));
    let mode = read
        .frequency_mode
        .and_then(|read| FrequencyMode::from_value(read.value));

    OperatorView {
        operator,
        role: Aged::of(read.level, now, |level| {
            topology.map(|topology| match topology.role(operator, level as u8) {
                Role::Portadora => "carrier",
                Role::Modulador => "modulator",
                Role::Inactivo => "inert",
            })
        })
        .map(|role| role.aged_with(algorithm, now)),
        level: Aged::of(read.level, now, Some),
        // A ratio needs both halves of the pair, so it is stamped with the older
        // of the two — and it means nothing at all in `fixed` mode.
        ratio: match (mode, read.coarse, read.fine) {
            (Some(FrequencyMode::Ratio), Some(coarse), Some(fine)) => {
                Aged::of(Some(coarse), now, |coarse| {
                    Some(ring::ratio(coarse, fine.value))
                })
                .map(|ratio| ratio.aged_with(Some(fine), now))
            }
            _ => None,
        },
        frequency_mode: Aged::of(read.frequency_mode, now, |value| {
            FrequencyMode::from_value(value).map(|mode| match mode {
                FrequencyMode::Ratio => "ratio",
                FrequencyMode::Fixed => "fixed",
            })
        }),
        spectral_form: Aged::of(read.spectral_form, now, ring::spectral_form),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use modx_midi::fake::FakeModx;
    use modx_midi::owner::{PortOwner, Request, Served};
    use modx_midi::port::PortError;
    use modx_midi::sysex::Address;

    /// A ring that has read the fase 0c Performance once, off the fake.
    fn read_once() -> WideRing {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(PART);
        ring.pass(&mut |address| -> Result<Option<Vec<u8>>, PortError> {
            match owner.serve(Request::Read(address))? {
                Served::Read { data, .. } => Ok(data),
                other => unreachable!("a read answers with data, not {other:?}"),
            }
        })
        .unwrap();
        ring
    }

    #[test]
    fn draws_the_role_from_the_topology_and_the_level_together() {
        let ring = read_once();
        let now = Instant::now();
        let algorithm = ring.algorithm();

        // Algorithm 2 with Op3 at 75 and Op4 at 99: the other six are at Level 0
        // and are inactivos wherever the algorithm put them.
        let roles: Vec<&str> = (1..=OPERATORS)
            .map(|operator| {
                node(operator, ring.operator(operator), algorithm, now)
                    .role
                    .expect("both halves were read")
                    .value
            })
            .collect();
        assert_eq!(
            roles,
            vec![
                "inert",
                "inert",
                "modulator",
                "carrier",
                "inert",
                "inert",
                "inert",
                "inert"
            ]
        );
    }

    #[test]
    fn without_an_algorithm_there_is_no_role_and_the_level_still_crosses() {
        let ring = read_once();
        let now = Instant::now();

        let drawn = node(3, ring.operator(3), None, now);

        assert!(drawn.role.is_none(), "a role was guessed with no topology");
        assert_eq!(drawn.level.expect("the Level was read").value, 75);
    }

    #[test]
    fn a_node_carries_the_ratio_and_the_form_it_read() {
        let ring = read_once();
        let drawn = node(1, ring.operator(1), ring.algorithm(), Instant::now());

        // `Init Normal (FM-X)`: Coarse 1, Fine 0, Ratio mode, Sine.
        assert_eq!(drawn.frequency_mode.expect("read").value, "ratio");
        assert_eq!(drawn.ratio.expect("read").value, 1.0);
        assert_eq!(drawn.spectral_form.expect("read").value, "Sine");
    }

    #[test]
    fn a_fixed_operator_has_no_ratio_at_all() {
        let mut fake = FakeModx::init_normal_fmx();
        // Freq Mode of Op1 to `Fixed`. Coarse and Fine stop meaning a ratio.
        fake.set(Address::operator(1, PART, 0x03), &[0x01]);
        let mut owner = PortOwner::new(fake);
        let mut ring = WideRing::new(PART);
        ring.pass(&mut |address| -> Result<Option<Vec<u8>>, PortError> {
            match owner.serve(Request::Read(address))? {
                Served::Read { data, .. } => Ok(data),
                other => unreachable!("a read answers with data, not {other:?}"),
            }
        })
        .unwrap();

        let drawn = node(1, ring.operator(1), ring.algorithm(), Instant::now());
        assert_eq!(drawn.frequency_mode.expect("read").value, "fixed");
        assert!(drawn.ratio.is_none(), "a fixed operator was given a ratio");
    }

    #[test]
    fn a_derived_figure_is_as_old_as_the_oldest_reading_behind_it() {
        let now = Instant::now();
        let fresh = Reading {
            value: 1,
            at: now - Duration::from_millis(10),
        };
        let stale = Reading {
            value: 1,
            at: now - Duration::from_millis(400),
        };

        let aged = Aged::of(Some(fresh), now, Some)
            .expect("a value")
            .aged_with(Some(stale), now);

        assert!(
            aged.age_ms >= 400,
            "a derived figure looked fresher than its source"
        );
    }

    #[test]
    fn nothing_read_is_nothing_drawn() {
        let ring = WideRing::new(PART);
        let drawn = node(1, ring.operator(1), None, Instant::now());

        assert!(drawn.role.is_none());
        assert!(drawn.level.is_none());
        assert!(drawn.ratio.is_none());
        assert!(drawn.spectral_form.is_none());
        assert_eq!(ring.last_pass(), None);
    }
}

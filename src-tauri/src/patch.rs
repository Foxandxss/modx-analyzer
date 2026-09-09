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

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use modx_midi::algorithms::{self, Role, Topology};
use modx_midi::owner::Priority;
use modx_midi::ring::{self, FrequencyMode, OperatorReadings, Reading, WideRing, OPERATORS};
use modx_midi::table::Provenance;
use tauri::{AppHandle, Emitter, Manager};

use crate::keyboard::Keyboard;
use crate::polling::Polling;

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

/// One line of the algorithm's drawing: `from` modulates `into`. Also the shape
/// the feedback loop takes, which is the same thing said about the loop the chart
/// draws as a rectangle — a single operator when `from == into`, a whole chain
/// when it does not.
#[derive(Clone, Copy, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteView {
    pub from: u8,
    pub into: u8,
}

/// The drawing the read algorithm number selects.
///
/// It rides on the header event because it is a statement about the same reading:
/// the keyboard answers a *number* and never says who modulates whom, and the 88
/// topologies live in Rust (ADR-0003), so what crosses is the one entry that
/// number picked. It is absent both before an algorithm has been read and when
/// the byte falls outside the 88; the front tells the two apart by whether
/// `algorithm` carries a number, and draws `ALGORITMO SIN TABLA` for the second.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopologyView {
    /// 1-88, as the keyboard's own screen numbers it.
    pub number: u8,
    /// In the chart's reading order, so a route can be put next to its drawing.
    pub routes: Vec<RouteView>,
    /// The operators hanging off the output bus, ascending.
    pub carriers: Vec<u8>,
    pub feedback: RouteView,
    /// Chain depth by operator, indexed `operator - 1`: a portadora is 0 and
    /// everything else is one deeper than the deepest thing it modulates.
    ///
    /// It is computed here rather than in the front because the rule that lays
    /// out any of the 88 without a hand-made sheet is part of the table, and two
    /// copies of a rule are one copy too many.
    pub depth: Vec<u8>,
    /// `documentado` or `medido`, per entry (ADR-0003). All 88 are paper today:
    /// promotion happens by changing the algorithm on the panel and comparing the
    /// drawing with the MODX's own screen.
    pub provenance: &'static str,
}

impl TopologyView {
    fn of(topology: &'static Topology) -> Self {
        Self {
            number: topology.number,
            routes: topology
                .routes
                .iter()
                .map(|(from, into)| RouteView {
                    from: *from,
                    into: *into,
                })
                .collect(),
            carriers: topology.carriers.to_vec(),
            feedback: RouteView {
                from: topology.feedback.from,
                into: topology.feedback.into,
            },
            depth: topology.chain_depth().to_vec(),
            provenance: match topology.provenance {
                Provenance::Medido => "medido",
                Provenance::Documentado => "documentado",
            },
        }
    }
}

/// What the header says about the loaded patch.
#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchView {
    /// The ancla: the Part 1 name, polled at 1 Hz. Empty until the first whole
    /// pass, and never assembled out of a pass with a hole in it.
    pub performance_name: Option<Aged<String>>,
    /// The name it had before it changed, drawn struck through beside the new
    /// one. It stays set for the rest of the session, so it is not what says a
    /// change just happened — [`PatchView::changes`] is.
    pub previous_performance_name: Option<String>,
    /// How many times the Performance has changed underneath since launch.
    ///
    /// The first name of the session does **not** count: a launch invalidates
    /// nothing, and the front watches this number to know when to throw away the
    /// medida and start the 2 200 ms flash. It is a counter and not a flag
    /// because two changes in a row have to be two of them.
    pub changes: u32,
    /// 1-88 as the keyboard's own screen numbers it: the byte at `48 0p 4F` plus
    /// one. A byte outside the 88 crosses as it came, because what the keyboard
    /// said is a fact and inventing a topology for it is #12's refusal to make.
    pub algorithm: Option<Aged<u32>>,
    pub feedback: Option<Aged<u32>>,
    /// The operator the feedback loop re-enters. For the two algorithms whose loop
    /// wraps a chain (12 and 14) that is the head of the chain, not a single
    /// operator, and the header can only name one.
    pub feedback_operator: Option<Aged<u8>>,
    /// The routes of the algorithm that was read, or nothing at all.
    pub topology: Option<TopologyView>,
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
    /// When the ancla last answered, so the name's age is computed at the moment
    /// the payload is built and not frozen at the moment it was read. The ring
    /// re-emits this event a dozen times a second and a stored age would make the
    /// name look as if it had just been read every one of them.
    name_read_at: Mutex<Option<Instant>>,
    /// Bumped once per ancla change. The anillo ancho compares it with its own
    /// copy between steps and empties itself when they differ: the readings live
    /// in the ring, so that is where they are thrown away.
    generation: AtomicU64,
    /// When the last ancla beat that came back `Same` **began** (ADR-0005).
    ///
    /// It is the aval: a ring reading taken before this instant is bracketed
    /// inside a stretch the ancla has confirmed is one Performance, and only then
    /// does it become a figure on the screen. The instant matters and not a
    /// counter — a beat can only speak for what was read before it started.
    vouched_before: Mutex<Option<Instant>>,
    /// Set by the anillo ancho while it is holding a reading nothing has vouched
    /// for. The ancla reads it to decide whether to beat out of turn: there is a
    /// figure behind, and the beat is what brings it up.
    aval_wanted: AtomicBool,
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
        topology: Option<TopologyView>,
    ) {
        Self::update(app, |view| {
            view.algorithm = algorithm;
            view.feedback = feedback;
            view.feedback_operator = feedback_operator;
            view.topology = topology;
        });
    }

    /// Say what the ancla read, leaving the ring's fields as they were — unless
    /// the Performance changed, in which case they belong to a patch that is gone
    /// and go out in the same event as the new name.
    ///
    /// Clearing them here rather than waiting for the ring's own pass is what
    /// keeps the header from drawing the new name beside the old algorithm for
    /// the tens of milliseconds it takes the ring to notice. The ring empties
    /// itself as well, off [`Patch::generation`]; the two are idempotent.
    pub fn set_anchor(
        app: &AppHandle,
        name: String,
        previous: Option<String>,
        changes: u32,
        read_at: Instant,
    ) {
        let state = app.state::<Patch>();
        *state
            .name_read_at
            .lock()
            .expect("the patch lock is not held across a panic") = Some(read_at);
        if previous.is_some() {
            state.generation.fetch_add(1, Ordering::Release);
        }

        Self::update(app, |view| {
            view.performance_name = Some(Aged {
                value: name,
                age_ms: 0,
            });
            if let Some(previous) = previous {
                view.previous_performance_name = Some(previous);
                view.algorithm = None;
                view.feedback = None;
                view.feedback_operator = None;
                view.topology = None;
            }
            view.changes = changes;
        });
    }

    /// How many ancla changes the app has seen. The ring reads it between steps.
    pub fn generation(app: &AppHandle) -> u64 {
        app.state::<Patch>().generation.load(Ordering::Acquire)
    }

    /// The ancla beat, it began at `beat_started`, and the name had not moved.
    ///
    /// Only a `Same` beat says this. `First` names a Performance for the first
    /// time and so speaks for nothing read before it, and `Changed` empties the
    /// diagram instead of vouching for it.
    pub fn vouch(app: &AppHandle, beat_started: Instant) {
        *app.state::<Patch>()
            .vouched_before
            .lock()
            .expect("the patch lock is not held across a panic") = Some(beat_started);
    }

    /// The start of the last confirming beat, for the ring to measure its held
    /// readings against.
    pub fn vouched_before(app: &AppHandle) -> Option<Instant> {
        *app.state::<Patch>()
            .vouched_before
            .lock()
            .expect("the patch lock is not held across a panic")
    }

    /// Say whether the ring is holding anything that a beat would bring up.
    pub fn set_aval_wanted(app: &AppHandle, wanted: bool) {
        app.state::<Patch>()
            .aval_wanted
            .store(wanted, Ordering::Release);
    }

    /// Whether a beat out of turn would put a figure on the screen.
    pub fn aval_wanted(app: &AppHandle) -> bool {
        app.state::<Patch>().aval_wanted.load(Ordering::Acquire)
    }

    fn update(app: &AppHandle, change: impl FnOnce(&mut PatchView)) {
        let state = app.state::<Patch>();
        let read_at = *state
            .name_read_at
            .lock()
            .expect("the patch lock is not held across a panic");
        let view = {
            let mut view = state
                .view
                .lock()
                .expect("the patch lock is not held across a panic");
            change(&mut view);
            let mut view = view.clone();
            if let (Some(name), Some(read_at)) = (view.performance_name.as_mut(), read_at) {
                name.age_ms = Instant::now().duration_since(read_at).as_millis() as u64;
            }
            view
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
    let mut generation = Patch::generation(app);

    loop {
        // Between two steps and never inside one: an address already handed to
        // the port is served to the end, and its answer belongs to whichever
        // patch was loaded when the keyboard answered it. Forgetting is checked
        // here so that the whole diagram empties in one go rather than filling
        // with a mixture of two sounds.
        let now = Patch::generation(app);
        if now != generation {
            generation = now;
            ring.forget();
            publish(app, &ring);
        }

        // The aval (ADR-0005). The ring is holding every reading whose number
        // differs from the one on screen, because these forty-two answers cannot
        // say whether a hand moved or the sound did. A beat that began after such
        // a reading and found the same name settles it, and the figure goes up.
        if let Some(before) = Patch::vouched_before(app) {
            if ring.vouch(before) {
                publish(app, &ring);
            }
        }
        // And this is the ring asking for that beat sooner than the ancla's own
        // second. It is a hint and not a demand: the ancla owns its cadence, and
        // it costs port time in the lane that already goes ahead of this one.
        Patch::set_aval_wanted(app, ring.waiting_on_aval());

        // #14's pause. The figures already on screen age to `CADUCO` by
        // themselves while it lasts, which is what the stamps are for and is the
        // same thing that happens with no port: this loop not asking looks exactly
        // like a keyboard not answering, and both are drawn honestly.
        if Polling::is_paused(app) {
            std::thread::sleep(NO_PORT_PATIENCE);
            continue;
        }

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
        topology.map(TopologyView::of),
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

    /// A ring that has read the fase 0c Performance once, off the fake, with an
    /// ancla that beat afterwards and found the same name. Without that beat
    /// nothing is a figure yet (ADR-0005) and every assertion below would be
    /// about an empty diagram.
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
        ring.vouch(Instant::now());
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

    /// What the ring's algorithm byte turns into for the front: the number, and
    /// the one entry of the 88 it picks, ready to be drawn.
    fn drawing_of(read: Option<Reading>) -> Option<TopologyView> {
        read.and_then(|read| algorithms::from_read_value(read.value as u8))
            .map(TopologyView::of)
    }

    #[test]
    fn the_read_algorithm_carries_its_drawing_across() {
        let ring = read_once();
        let drawn = drawing_of(ring.algorithm()).expect("algorithm 2 is one of the 88");

        // `Init Normal (FM-X)` is algorithm 2: the 1-2-3-4 chain into the bus,
        // with Op5-Op8 hanging off it and the loop on Op1.
        assert_eq!(drawn.number, 2);
        assert_eq!(
            drawn
                .routes
                .iter()
                .map(|route| (route.from, route.into))
                .collect::<Vec<_>>(),
            vec![(1, 2), (2, 3), (3, 4)]
        );
        assert_eq!(drawn.carriers, vec![4, 5, 6, 7, 8]);
        assert_eq!((drawn.feedback.from, drawn.feedback.into), (1, 1));
        // Depth is what lays the nodes out: Op1 is three modulations from the
        // output, and the five portadoras are on it.
        assert_eq!(drawn.depth, vec![3, 2, 1, 0, 0, 0, 0, 0]);
        assert_eq!(drawn.provenance, "documentado");
    }

    #[test]
    fn an_algorithm_changed_underneath_redraws_the_roles_and_the_routes() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(PART);
        // A pass and the ancla beat that follows it, finding the same name: the
        // ordinary turn of the app. Without the aval the algorithm read below is
        // held rather than drawn, which is #20's whole point (ADR-0005).
        let turn = |owner: &mut PortOwner<FakeModx>, ring: &mut WideRing| {
            ring.pass(&mut |address| -> Result<Option<Vec<u8>>, PortError> {
                match owner.serve(Request::Read(address))? {
                    Served::Read { data, .. } => Ok(data),
                    other => unreachable!("a read answers with data, not {other:?}"),
                }
            })
            .unwrap();
            ring.vouch(Instant::now());
        };

        turn(&mut owner, &mut ring);
        let role_of_three = |ring: &WideRing| {
            node(3, ring.operator(3), ring.algorithm(), Instant::now())
                .role
                .expect("both halves were read")
                .value
        };
        assert_eq!(role_of_three(&ring), "modulator");

        // Somebody turns the panel to algorithm 1, where every operator hangs off
        // the output bus. Nothing announces it: the ring finds out by asking.
        owner
            .port_mut()
            .set(Address::new(0x48, 0x00, 0x4F), &[0x00]);
        turn(&mut owner, &mut ring);

        assert_eq!(role_of_three(&ring), "carrier");
        let drawn = drawing_of(ring.algorithm()).expect("algorithm 1");
        assert_eq!(drawn.number, 1);
        assert!(drawn.routes.is_empty(), "algorithm 1 modulates nothing");
        assert_eq!(drawn.carriers, vec![1, 2, 3, 4, 5, 6, 7, 8]);
    }

    #[test]
    fn a_byte_outside_the_eighty_eight_has_no_drawing() {
        // `48 0p 4F` runs 00-57. One past the end is not algorithm 89: it is a
        // number with no table, which is what draws `ALGORITMO SIN TABLA`.
        let read = Reading {
            value: 88,
            at: Instant::now(),
        };

        assert!(drawing_of(Some(read)).is_none());
        // And the number the keyboard said still crosses: it is a fact.
        assert_eq!(
            Aged::of(Some(read), Instant::now(), |value| value.checked_add(1))
                .expect("the byte was read")
                .value,
            89
        );
    }

    #[test]
    fn the_two_algorithms_whose_loop_wraps_a_chain_cross_as_a_chain() {
        let twelve = TopologyView::of(algorithms::topology(12).expect("algorithm 12"));

        // Op5's output back into Op3, which the arc has to draw around three
        // nodes rather than one.
        assert_eq!((twelve.feedback.from, twelve.feedback.into), (5, 3));
    }

    /// What the ancla asks the ring for when the Performance changed underneath.
    /// The event goes out with the whole diagram already empty, which is the
    /// rule: a number never replaces another without passing through the dash.
    #[test]
    fn a_performance_changed_underneath_takes_every_figure_with_it() {
        let mut ring = read_once();
        let now = Instant::now();
        assert_eq!(
            node(3, ring.operator(3), ring.algorithm(), now)
                .level
                .unwrap()
                .value,
            75
        );

        ring.forget();

        let drawn = node(3, ring.operator(3), ring.algorithm(), now);
        assert!(drawn.level.is_none(), "a Level of the old patch survived");
        assert!(drawn.role.is_none());
        assert!(drawn.ratio.is_none());
        assert!(drawn.spectral_form.is_none());
        // The header's two figures go with them, and so does the drawing: the
        // algorithm that chose it belonged to the sound that is gone.
        assert!(Aged::of(ring.algorithm(), now, |value| value.checked_add(1)).is_none());
        assert!(Aged::of(ring.feedback(), now, Some).is_none());
        assert!(drawing_of(ring.algorithm()).is_none());
        // The cadence is not a figure of the patch and stays: how fast the port
        // answers has nothing to do with which sound is loaded.
        assert!(ring.last_pass().is_some());
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
        ring.vouch(Instant::now());

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

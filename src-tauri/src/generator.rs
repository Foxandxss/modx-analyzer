//! The note generator, on a thread of its own: the load #8's go/no-go is taken
//! under.
//!
//! Everything about *what* it plays lives in `modx-midi`
//! ([`modx_midi::generator`]). What is here is the wiring: a thread that steps the
//! pattern at [`STEP`], hands every message to the one port owner, counts what was
//! asked for and what went out, and — the part that matters — **cannot end without
//! letting go of the keys**.
//!
//! The shutdown is a `Drop` and not a line at the end of the loop, so it runs when
//! the run is stopped, when the pánico stops it, and when the thread panics
//! halfway through a step. The one interruption it does not survive is the process
//! being killed: `Drop` does not run for a thread whose process is gone, which is
//! why the window's close is wired to [`Generator::stop`] in `lib.rs`.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use modx_midi::generator::{self, NoteGenerator};
use tauri::{AppHandle, Emitter, Manager};

use crate::keyboard::Keyboard;

/// The event the dev readout's `GENERADOR` line listens to.
const EVENT_GENERATOR: &str = "modx://generator";

/// How often the counts are pushed out while the run is going.
///
/// Once a second, and not once a step: 25 IPC hops a second to move a counter
/// nobody can read that fast would be the instrument loading the thing it is
/// measuring.
const REPORT_EVERY: Duration = Duration::from_secs(1);

/// How long the loop sleeps between two looks at the stop flag.
///
/// The step is 40 ms and the pánico stops the generator **before** it sends, so
/// this is what a pánico can wait for: a whole step would put 40 ms between the
/// press and the first All Sound Off.
const STOP_CHECK: Duration = Duration::from_millis(5);

/// What one run of the generator has done so far.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratorView {
    pub running: bool,
    /// Messages the pattern produced.
    pub asked: u64,
    /// Messages the port took. Below `asked` means the generator was starved or
    /// the port refused: either way the load did not happen and the run says so.
    pub sent: u64,
    /// Steps the port refused outright, normally because there is no port.
    pub refused: u64,
    /// Pitches held right now. Zero when it is not running, always.
    pub held: usize,
    /// Channel messages the **keyboard** has sent since the port opened.
    ///
    /// This is the self-verification #8 asks for, and what it verifies depends on
    /// what the MODX does: under real hands it climbs with the playing, and under
    /// generated notes it only climbs if the keyboard echoes them, which nobody
    /// has checked. Either way it is counted rather than assumed.
    pub traffic: u64,
    /// Milliseconds per step, so the readout can say the density without knowing
    /// the pattern.
    pub step_ms: u64,
}

/// The counts of the run in progress, shared with the thread.
#[derive(Default)]
struct Counts {
    asked: AtomicU64,
    sent: AtomicU64,
    refused: AtomicU64,
    held: AtomicU64,
}

/// The thread and the flag that stops it.
struct Running {
    stop: Arc<AtomicBool>,
    thread: JoinHandle<()>,
}

/// The generator as the app holds it: at most one run at a time.
#[derive(Default)]
pub struct Generator {
    running: Mutex<Option<Running>>,
    counts: Arc<Counts>,
}

impl Generator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Start a run. A second press while one is going changes nothing: two
    /// generators would be two loads and one number.
    pub fn start(app: &AppHandle) {
        let state = app.state::<Generator>();
        let mut running = state
            .running
            .lock()
            .expect("the generator lock is not held across a panic");
        if running.is_some() {
            return;
        }

        // A run's counts are its own: the figures that go in the results document
        // are «this ten minutes», not «since the app opened».
        state.counts.asked.store(0, Ordering::Release);
        state.counts.sent.store(0, Ordering::Release);
        state.counts.refused.store(0, Ordering::Release);
        state.counts.held.store(0, Ordering::Release);

        let stop = Arc::new(AtomicBool::new(false));
        let thread = {
            let app = app.clone();
            let stop = Arc::clone(&stop);
            let counts = Arc::clone(&state.counts);
            std::thread::Builder::new()
                .name("modx-generador".into())
                .spawn(move || run(&app, &stop, &counts))
                .expect("the generator thread is spawned on a press")
        };

        *running = Some(Running { stop, thread });
        drop(running);
        log::info!(
            "generador: {:.0} mensajes/s, acorde de {}",
            generator::messages_per_second(),
            generator::CHORD
        );
        emit(app, true);
    }

    /// Stop the run and wait for the keys to go up.
    ///
    /// The join is not politeness: it is what makes «stopped» mean the Note Offs
    /// are out. Without it the pánico could send its 2 080 messages and *then*
    /// have one more generated Note On arrive behind them.
    pub fn stop(app: &AppHandle) {
        let taken = {
            let state = app.state::<Generator>();
            let mut running = state
                .running
                .lock()
                .expect("the generator lock is not held across a panic");
            running.take()
        };

        let Some(run) = taken else {
            return;
        };
        run.stop.store(true, Ordering::Release);
        // A thread that panicked has already let go through its own `Drop`; there
        // is nothing here that can be done about it but carry on.
        let _ = run.thread.join();
        emit(app, false);
    }

    /// Whether a run is going, for the readout and for the pánico.
    pub fn is_running(app: &AppHandle) -> bool {
        app.state::<Generator>()
            .running
            .lock()
            .expect("the generator lock is not held across a panic")
            .is_some()
    }

    fn view(app: &AppHandle, running: bool) -> GeneratorView {
        let state = app.state::<Generator>();
        GeneratorView {
            running,
            asked: state.counts.asked.load(Ordering::Acquire),
            sent: state.counts.sent.load(Ordering::Acquire),
            refused: state.counts.refused.load(Ordering::Acquire),
            held: state.counts.held.load(Ordering::Acquire) as usize,
            traffic: app
                .state::<Keyboard>()
                .owner()
                .map_or(0, |owner| owner.traffic()),
            step_ms: generator::STEP.as_millis() as u64,
        }
    }
}

fn emit(app: &AppHandle, running: bool) {
    let _ = app.emit(EVENT_GENERATOR, Generator::view(app, running));
}

/// The pattern, the port and the promise to let go.
///
/// The generator lives inside [`Keys`] so that its shutdown is a `Drop`: whatever
/// ends this function — the stop flag, a panic, the app closing the window — the
/// pitches that are down go up before the thread does.
fn run(app: &AppHandle, stop: &AtomicBool, counts: &Arc<Counts>) {
    let mut keys = Keys {
        generator: NoteGenerator::new(),
        app: app.clone(),
        counts: Arc::clone(counts),
    };
    let mut reported = Instant::now();

    while !stop.load(Ordering::Acquire) {
        let started = Instant::now();

        let Some(owner) = app.state::<Keyboard>().owner() else {
            // No port. The step is not taken at all: a pattern that advanced
            // while nothing was going out would have the app believing it was
            // holding keys the keyboard never heard.
            counts.refused.fetch_add(1, Ordering::AcqRel);
            wait(stop, started + generator::STEP);
            continue;
        };

        let messages = keys.generator.step();
        counts
            .asked
            .store(keys.generator.asked(), Ordering::Release);
        match owner.send_notes(messages) {
            Ok(sent) => {
                counts.sent.fetch_add(sent as u64, Ordering::AcqRel);
                counts
                    .held
                    .store(keys.generator.held() as u64, Ordering::Release);
            }
            Err(error) => {
                log::warn!("generador: el puerto no aceptó el paso ({error})");
                counts.refused.fetch_add(1, Ordering::AcqRel);
            }
        }

        if reported.elapsed() >= REPORT_EVERY {
            reported = Instant::now();
            emit(app, true);
        }

        wait(stop, started + generator::STEP);
    }
}

/// Sleep until `until`, looking at the stop flag every [`STOP_CHECK`].
fn wait(stop: &AtomicBool, until: Instant) {
    while !stop.load(Ordering::Acquire) {
        let left = until.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return;
        }
        std::thread::sleep(left.min(STOP_CHECK));
    }
}

/// The keys the generator is holding, and the promise that they go up.
struct Keys {
    generator: NoteGenerator,
    app: AppHandle,
    counts: Arc<Counts>,
}

impl Drop for Keys {
    fn drop(&mut self) {
        let messages = self.generator.shutdown();
        self.counts
            .asked
            .store(self.generator.asked(), Ordering::Release);
        let held = messages.len();
        if held == 0 {
            return;
        }

        // Whatever port there is *now*, which need not be the one the notes went
        // out down: a run interrupted by the cable coming out has nothing to send
        // to, and that is worth an error in the log rather than a silent return —
        // it means the keyboard is holding notes this app turned on.
        match self.app.state::<Keyboard>().owner() {
            Some(owner) => match owner.send_notes(messages) {
                Ok(sent) => {
                    self.counts.sent.fetch_add(sent as u64, Ordering::AcqRel);
                    self.counts.held.store(0, Ordering::Release);
                }
                Err(error) => log::error!(
                    "generador: {held} notas se quedaron sonando, el puerto no aceptó los Note Off ({error}) — el pánico las apaga",
                ),
            },
            None => log::error!(
                "generador: {held} notas se quedaron sonando y no hay puerto por donde apagarlas — el pánico las apaga",
            ),
        }
    }
}

/// Start the note generator: the dev control of the bridge measurement.
#[tauri::command]
pub fn start_generator(app: AppHandle) {
    Generator::start(&app);
}

/// Stop it, and wait for the keys to come up.
#[tauri::command]
pub fn stop_generator(app: AppHandle) {
    Generator::stop(&app);
}

/// What the run is doing right now, for a window that arrived after it started.
///
/// The events say everything that happens; this says what already happened. A
/// reload during a ten-minute run would otherwise show `PARADO` over a keyboard
/// that is being played by the app, which is the one thing this readout must never
/// say.
#[tauri::command]
pub fn generator_state(app: AppHandle) -> GeneratorView {
    let running = Generator::is_running(&app);
    Generator::view(&app, running)
}

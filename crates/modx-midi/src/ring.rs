//! El anillo ancho: the 42 addresses the operator diagram is drawn from.
//!
//! The MODX notifies nothing — not an edit, not a knob, not a Performance change
//! — so the only way to know what the eight operators are doing is to keep asking.
//! This is the cycle that asks: Level, Coarse, Fine, Freq Mode and Spectral Form
//! for the eight, then the algorithm and the feedback, over and over, one address
//! per round trip, taking the addresses by name from [`crate::table`] so that
//! nothing here is a byte literal.
//!
//! **The pass duration is the unit of everything downstream.** A round trip costs
//! 2 ms with the keyboard sitting there and ~10 ms while somebody plays, so the
//! same 42 addresses take ~84 ms in silence and ~430 ms under notes. That is the
//! reason `CADUCO` is four times the last completed pass and not a fixed number of
//! seconds: a fixed threshold would light the whole diagram in alert every time
//! the owner touched the keyboard, which is exactly when the diagram matters.
//!
//! A read that timed out leaves the previous reading in place and does **not**
//! blank it: one timeout is anomalous but is not news (0 losses in 27 000 requests,
//! fase 0c), and the value ageing on its own is a better account of it than a dash
//! that appears and disappears.

use std::time::{Duration, Instant};

use crate::port::PortError;
use crate::sysex::{self, Address};
use crate::table::{self, Polled, WIDE_RING_OPERATOR, WIDE_RING_PART};

/// Operators in an FM-X Part.
pub const OPERATORS: u8 = 8;

/// Where each of the five the ring watches sits inside [`WIDE_RING_OPERATOR`].
/// A test asserts them against the table, so reordering the names there is caught
/// here and not on the screen.
const LEVEL: usize = 0;
const COARSE: usize = 1;
const FINE: usize = 2;
const FREQUENCY_MODE: usize = 3;
const SPECTRAL_FORM: usize = 4;

/// And the two the Part carries, inside [`WIDE_RING_PART`].
const ALGORITHM: usize = 0;
const FEEDBACK: usize = 1;

/// What one address answered, and when it answered it.
///
/// The stamp is the point: a number with no time on it cannot go `CADUCO`, and a
/// diagram that cannot go `CADUCO` is a diagram that keeps drawing while frozen.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Reading {
    pub value: u32,
    pub at: Instant,
}

/// The five figures of one operator, each with its own stamp. `None` is an address
/// that has not answered yet — a dash, never a zero.
#[derive(Clone, Copy, Default, Debug)]
pub struct OperatorReadings {
    pub level: Option<Reading>,
    pub coarse: Option<Reading>,
    pub fine: Option<Reading>,
    pub frequency_mode: Option<Reading>,
    pub spectral_form: Option<Reading>,
}

/// What `Oscillator Frequency Mode` says the Coarse and Fine pair means.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FrequencyMode {
    /// The operator tracks the note: its frequency is the ratio times the note's.
    Ratio,
    /// The operator sits at a frequency of its own and ignores the note.
    Fixed,
}

impl FrequencyMode {
    /// `documentado`: the Data List gives the parameter two values and the app has
    /// never read it as anything but 0. Which of the two is which is not measured.
    pub fn from_value(value: u32) -> Option<Self> {
        match value {
            0 => Some(Self::Ratio),
            1 => Some(Self::Fixed),
            _ => None,
        }
    }
}

/// The seven spectral forms of FM-X, in the order the Data List numbers them.
///
/// `documentado`. `Sine` at 0 is the only one this app has ever read, because it
/// is the form every operator of `Init Normal (FM-X)` starts in.
pub const SPECTRAL_FORMS: [&str; 7] =
    ["Sine", "All 1", "All 2", "Odd 1", "Odd 2", "Res 1", "Res 2"];

/// The name of a spectral form, or `None` for a value outside the seven — which
/// draws a dash rather than a form nobody transcribed.
pub fn spectral_form(value: u32) -> Option<&'static str> {
    SPECTRAL_FORMS.get(value as usize).copied()
}

/// The frequency ratio a Coarse/Fine pair means, in [`FrequencyMode::Ratio`].
///
/// **`documentado`, and the weakest figure on this screen.** It is the DX7 rule —
/// Coarse 0 means a half, every other Coarse is itself, and Fine adds hundredths —
/// and it is the only reading of Coarse and Fine that produces the ratios the
/// design's own example patch shows (`x0.50`, `x1.00`, `x1.41`, `x2.00`, `x7.00`).
/// It has never been compared with the MODX's screen. What would settle it is one
/// look: put an operator at Coarse 1 / Fine 41 and read what the keyboard says.
/// Note also that the table gives Fine a documented range of 0-127 while this rule
/// only makes sense up to 99. Both are open questions in `docs/results`.
pub fn ratio(coarse: u32, fine: u32) -> f32 {
    let base = if coarse == 0 { 0.5 } else { coarse as f32 };
    base * (1.0 + fine as f32 / 100.0)
}

/// The cycle itself: the addresses, what each last answered, and how long the last
/// complete turn around them took.
pub struct WideRing {
    polled: Vec<Polled>,
    readings: Vec<Option<Reading>>,
    /// Index of the address the next step will ask for.
    next: usize,
    pass_started: Instant,
    last_pass: Option<Duration>,
    passes: u64,
}

impl WideRing {
    /// The ring over one Part's operators. The Part is a parameter because the
    /// addressing is `(op << 4) | part` and #16 sweeps whether that holds past
    /// Part 1; nothing here hardcodes the 1.
    pub fn new(part: u8) -> Self {
        let polled = table::wide_ring(part);
        let readings = vec![None; polled.len()];
        Self {
            polled,
            readings,
            next: 0,
            pass_started: Instant::now(),
            last_pass: None,
            passes: 0,
        }
    }

    /// The 42 addresses, in polling order.
    pub fn addresses(&self) -> &[Polled] {
        &self.polled
    }

    /// The address the next [`WideRing::step`] will ask for.
    pub fn next_address(&self) -> Address {
        self.polled[self.next].address
    }

    /// How long the last complete turn took, or `None` before the first one closed.
    /// `LOS OCHO · N Hz` and the `CADUCO` threshold both come from this number.
    pub fn last_pass(&self) -> Option<Duration> {
        self.last_pass
    }

    /// Complete turns since the ring started.
    pub fn passes(&self) -> u64 {
        self.passes
    }

    /// Ask for the next address and keep what came back. Returns whether that step
    /// closed a pass, which is when the front has a whole new picture to draw.
    ///
    /// A timeout keeps the previous reading and lets it age.
    pub fn step<F>(&mut self, ask: &mut F) -> Result<bool, PortError>
    where
        F: FnMut(Address) -> Result<Option<Vec<u8>>, PortError>,
    {
        let asked = self.next;
        let answered = ask(self.polled[asked].address)?;
        if let Some(value) = answered.as_deref().and_then(sysex::decode_value) {
            self.readings[asked] = Some(Reading {
                value,
                at: Instant::now(),
            });
        }

        self.next += 1;
        if self.next < self.polled.len() {
            return Ok(false);
        }

        self.next = 0;
        let closed = Instant::now();
        self.last_pass = Some(closed.duration_since(self.pass_started));
        self.pass_started = closed;
        self.passes += 1;
        Ok(true)
    }

    /// One whole turn, for a caller that wants a picture rather than a step.
    pub fn pass<F>(&mut self, ask: &mut F) -> Result<(), PortError>
    where
        F: FnMut(Address) -> Result<Option<Vec<u8>>, PortError>,
    {
        loop {
            if self.step(ask)? {
                return Ok(());
            }
        }
    }

    /// Throw every reading away and start the pass again.
    ///
    /// It is what the ancla asks for when the Performance changed underneath:
    /// these forty-two numbers belong to a patch that is gone, and a figure from
    /// another sound is not stale, it is `INVALIDADO`. Everything empties at
    /// once, so the front draws the dash **before** the first number of the new
    /// patch arrives — a number that replaced another without passing through the
    /// dash could not be told from one somebody had just turned by hand.
    ///
    /// The cadence survives: `last_pass` is what `CADUCO` and `LOS OCHO · N Hz`
    /// are computed from, and how fast the port answers has nothing to do with
    /// which Performance is loaded.
    pub fn forget(&mut self) {
        self.readings.iter_mut().for_each(|reading| *reading = None);
        self.next = 0;
        self.pass_started = Instant::now();
    }

    /// The five figures of one operator, 1-8.
    pub fn operator(&self, operator: u8) -> OperatorReadings {
        OperatorReadings {
            level: self.at(slot(operator, LEVEL)),
            coarse: self.at(slot(operator, COARSE)),
            fine: self.at(slot(operator, FINE)),
            frequency_mode: self.at(slot(operator, FREQUENCY_MODE)),
            spectral_form: self.at(slot(operator, SPECTRAL_FORM)),
        }
    }

    /// The algorithm byte, base zero, exactly as `48 0p 4F` answered it.
    pub fn algorithm(&self) -> Option<Reading> {
        self.at(part_slot(ALGORITHM))
    }

    pub fn feedback(&self) -> Option<Reading> {
        self.at(part_slot(FEEDBACK))
    }

    fn at(&self, slot: usize) -> Option<Reading> {
        self.readings[slot]
    }
}

fn slot(operator: u8, offset: usize) -> usize {
    usize::from(operator - 1) * WIDE_RING_OPERATOR.len() + offset
}

fn part_slot(offset: usize) -> usize {
    debug_assert!(offset < WIDE_RING_PART.len());
    usize::from(OPERATORS) * WIDE_RING_OPERATOR.len() + offset
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake::{FakeModx, Latency};
    use crate::owner::{PortOwner, Request, Served};
    use crate::table::Provenance;

    /// Drive a ring off a `PortOwner`, the way the app does.
    fn asking(
        owner: &mut PortOwner<FakeModx>,
    ) -> impl FnMut(Address) -> Result<Option<Vec<u8>>, PortError> + '_ {
        move |address| match owner.serve(Request::Read(address))? {
            Served::Read { data, .. } => Ok(data),
            other => unreachable!("a read answers with data, not {other:?}"),
        }
    }

    #[test]
    fn the_five_offsets_are_where_this_module_thinks_they_are() {
        assert_eq!(WIDE_RING_OPERATOR[LEVEL], "Operator Level");
        assert_eq!(WIDE_RING_OPERATOR[COARSE], "Tune Coarse");
        assert_eq!(WIDE_RING_OPERATOR[FINE], "Tune Fine");
        assert_eq!(
            WIDE_RING_OPERATOR[FREQUENCY_MODE],
            "Oscillator Frequency Mode"
        );
        assert_eq!(WIDE_RING_OPERATOR[SPECTRAL_FORM], "Spectral Form");
        assert_eq!(WIDE_RING_PART[ALGORITHM], "Algorithm Number");
        assert_eq!(WIDE_RING_PART[FEEDBACK], "Feedback Level");
    }

    #[test]
    fn cycles_the_forty_two_addresses_of_the_table_by_name() {
        let ring = WideRing::new(1);
        let expected = table::wide_ring(1);

        assert_eq!(ring.addresses().len(), 42);
        let names: Vec<&str> = ring.addresses().iter().map(|p| p.entry.name).collect();
        let wanted: Vec<&str> = expected.iter().map(|p| p.entry.name).collect();
        assert_eq!(names, wanted);
        // Nothing the ring asks for may be an address the app must not touch.
        assert!(!ring.addresses().iter().any(|p| p.entry.is_reserved()));
    }

    #[test]
    fn reads_what_the_keyboard_has_loaded_and_stamps_every_figure() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);

        ring.pass(&mut asking(&mut owner)).unwrap();

        // The fase 0c Performance: algorithm byte `01` (algorithm 2 on the screen)
        // and Op3 at 75, Op4 at 99, the other six at 0.
        assert_eq!(ring.algorithm().unwrap().value, 0x01);
        assert_eq!(ring.feedback().unwrap().value, 0);
        let levels: Vec<u32> = (1..=OPERATORS)
            .map(|op| ring.operator(op).level.unwrap().value)
            .collect();
        assert_eq!(levels, vec![0, 0, 75, 99, 0, 0, 0, 0]);

        // Every one of the 42 came back with a time on it.
        for operator in 1..=OPERATORS {
            let read = ring.operator(operator);
            assert!(read.coarse.is_some());
            assert!(read.fine.is_some());
            assert!(read.frequency_mode.is_some());
            assert!(read.spectral_form.is_some());
        }
    }

    #[test]
    fn closes_a_pass_on_the_last_address_and_not_before() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);

        {
            let mut ask = asking(&mut owner);
            for _ in 0..41 {
                assert!(!ring.step(&mut ask).unwrap());
            }
            assert_eq!(ring.last_pass(), None);
            assert!(ring.step(&mut ask).unwrap());
        }
        assert_eq!(ring.passes(), 1);
        assert!(ring.last_pass().is_some());
        // And it comes back round to the first address.
        assert_eq!(ring.next_address(), table::wide_ring(1)[0].address);
    }

    #[test]
    fn a_pass_under_notes_takes_long_enough_to_hold_caduco_off() {
        // The point of the adaptive threshold, in one assertion: the same 42
        // addresses take about five times as long while somebody is playing, so a
        // fixed threshold would light the whole diagram in alert exactly then.
        let mut idle = PortOwner::new({
            let mut fake = FakeModx::init_normal_fmx();
            fake.set_latency(Latency::Idle);
            fake
        });
        let mut quiet = WideRing::new(1);
        quiet.pass(&mut asking(&mut idle)).unwrap();

        let mut busy = PortOwner::new({
            let mut fake = FakeModx::init_normal_fmx();
            fake.set_latency(Latency::NotesPlaying);
            fake
        });
        let mut playing = WideRing::new(1);
        playing.pass(&mut asking(&mut busy)).unwrap();

        let quiet_pass = quiet.last_pass().unwrap();
        let playing_pass = playing.last_pass().unwrap();
        assert!(
            playing_pass > quiet_pass * 3,
            "playing cost {playing_pass:?} against {quiet_pass:?} idle",
        );
    }

    #[test]
    fn keeps_the_last_reading_when_an_address_does_not_answer() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);
        ring.pass(&mut asking(&mut owner)).unwrap();
        let first = ring.operator(1).level.expect("Op1's Level answered");

        // The next address the ring asks for is Op1's Level, and it goes
        // unanswered. The figure has to age, not disappear.
        assert_eq!(ring.next_address(), Address::operator(1, 1, 0x1A));
        owner.port_mut().swallow_next_requests(1);
        assert!(!ring.step(&mut asking(&mut owner)).unwrap());

        let after = ring.operator(1).level.expect("the figure survived");
        assert_eq!(
            after, first,
            "a timeout blanked a figure instead of ageing it",
        );
    }

    #[test]
    fn the_ratio_rule_gives_the_designs_own_example_patch() {
        assert_eq!(ratio(0, 0), 0.50);
        assert_eq!(ratio(1, 0), 1.00);
        assert_eq!(ratio(2, 0), 2.00);
        assert_eq!(ratio(7, 0), 7.00);
        assert!((ratio(1, 41) - 1.41).abs() < 1e-5);
    }

    #[test]
    fn a_spectral_form_outside_the_seven_is_a_dash_and_not_a_guess() {
        assert_eq!(spectral_form(0), Some("Sine"));
        assert_eq!(spectral_form(6), Some("Res 2"));
        assert_eq!(spectral_form(7), None);
        assert_eq!(FrequencyMode::from_value(0), Some(FrequencyMode::Ratio));
        assert_eq!(FrequencyMode::from_value(2), None);
    }

    #[test]
    fn forgetting_empties_every_figure_at_once_and_keeps_the_cadence() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);
        ring.pass(&mut asking(&mut owner)).unwrap();
        assert!(ring.algorithm().is_some());
        let cadence = ring.last_pass().expect("one pass closed");

        ring.forget();

        // Not one number survives, so nothing of the previous patch can be
        // replaced by a number of the new one without a dash in between.
        assert!(ring.algorithm().is_none());
        assert!(ring.feedback().is_none());
        for operator in 1..=OPERATORS {
            let read = ring.operator(operator);
            assert!(read.level.is_none(), "OP{operator} kept its Level");
            assert!(read.coarse.is_none());
            assert!(read.fine.is_none());
            assert!(read.frequency_mode.is_none());
            assert!(read.spectral_form.is_none());
        }
        // How fast the port answers has nothing to do with which sound is loaded.
        assert_eq!(ring.last_pass(), Some(cadence));
        assert_eq!(ring.next_address(), ring.addresses()[0].address);
    }

    #[test]
    fn every_address_the_ring_polls_is_one_the_table_knows() {
        let mut documented = Vec::new();
        for polled in WideRing::new(1).addresses() {
            let entry = table::lookup(polled.address).expect("the ring polls the table");
            assert_eq!(entry.name, polled.entry.name);
            if entry.provenance == Provenance::Documentado {
                documented.push(entry.name);
            }
        }
        // Forty-one of the forty-two were answered by the keyboard in fase 0c. The
        // Feedback Level is the one this app draws from paper alone, and it is the
        // figure the header hangs off — written down here so it cannot be forgotten.
        assert_eq!(documented, vec!["Feedback Level"]);
    }
}

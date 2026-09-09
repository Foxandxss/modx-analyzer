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
//!
//! **A reading is not a figure until the ancla vouches for it** (ADR-0005). The
//! ring turns at 5-10 Hz and the ancla beats at 1 Hz, so a pass can straddle a
//! Performance change and come back half one sound and half the other. Nothing in
//! the answers tells the two apart, so this module does not try: a reading whose
//! value *differs* from the one on screen is held out of sight until a beat
//! started after it says the name has not changed. That is the **aval**. A reading
//! that repeats what is on screen needs none — it may well come from another
//! Performance, but it says of that one exactly what it said of this one, and a
//! number true of both sounds is a lie about neither.

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

/// The readings at one address that no beat has vouched for yet.
///
/// Two of them, and not one — and not all of them either. The **newest** is what
/// the screen wants: it is the number the keyboard is on now. The **oldest** is
/// what guarantees the screen gets anything at all, because a beat that began
/// after it can always speak for it however fast newer numbers arrive behind it.
///
/// Keeping only the newest starves a dial that is still turning, and it is not a
/// rare race: a beat costs ~40 ms and a pass ~100 ms, so something like two
/// beats in five land after the ring has already replaced the very reading they
/// were about to speak for. Keep losing that race and the figure sits still for
/// as long as the hand keeps moving, which is exactly what #20's fix must not do
/// to the screen it was fixing.
#[derive(Clone, Copy, Default, Debug)]
struct Waiting {
    oldest: Option<Reading>,
    newest: Option<Reading>,
}

impl Waiting {
    fn is_waiting(&self) -> bool {
        self.newest.is_some()
    }

    fn clear(&mut self) {
        *self = Self::default();
    }

    /// Hold a reading nothing has vouched for. The first is both ends at once;
    /// each one after it displaces the newest and leaves the oldest — the one
    /// with the best claim on the next beat — where it is.
    fn push(&mut self, reading: Reading) {
        if self.oldest.is_none() {
            self.oldest = Some(reading);
        }
        self.newest = Some(reading);
    }

    /// What a beat that began at `beat_started` can put on the screen: the newest
    /// reading that beat can speak for, or nothing at all.
    fn release(&mut self, beat_started: Instant) -> Option<Reading> {
        let spoken_for =
            |reading: Option<Reading>| reading.filter(|reading| reading.at < beat_started);

        if let Some(newest) = spoken_for(self.newest) {
            self.clear();
            return Some(newest);
        }

        // The beat was overtaken: something newer arrived while it was still
        // reading the name. The reading behind it is one this beat *can* speak
        // for, and putting it up is what keeps a moving figure moving. What
        // overtook it waits for the next beat, as the oldest.
        let oldest = spoken_for(self.oldest)?;
        self.oldest = self.newest;
        Some(oldest)
    }
}

/// The cycle itself: the addresses, what each last answered, and how long the last
/// complete turn around them took.
pub struct WideRing {
    polled: Vec<Polled>,
    /// What each address last said **and the ancla vouched for**. This is the
    /// diagram: nothing else is ever drawn.
    readings: Vec<Option<Reading>>,
    /// What each address has said that nothing has vouched for yet, because it
    /// differs from the figure on screen and so might belong to a sound the ancla
    /// has not noticed. Held, never drawn, and thrown away rather than shown if
    /// the beat that arrives says the Performance changed.
    waiting: Vec<Waiting>,
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
        let waiting = vec![Waiting::default(); polled.len()];
        Self {
            polled,
            readings,
            waiting,
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
    ///
    /// What came back is drawn straight away only if it repeats what is drawn
    /// already; anything else waits for a [`WideRing::vouch`] (ADR-0005).
    pub fn step<F>(&mut self, ask: &mut F) -> Result<bool, PortError>
    where
        F: FnMut(Address) -> Result<Option<Vec<u8>>, PortError>,
    {
        let asked = self.next;
        let answered = ask(self.polled[asked].address)?;
        if let Some(value) = answered.as_deref().and_then(sysex::decode_value) {
            let reading = Reading {
                value,
                at: Instant::now(),
            };
            match self.readings[asked] {
                // The same number the screen already carries. It asserts nothing
                // the screen was not asserting a moment ago, so it goes straight
                // on and takes the fresh stamp with it — and if it did come from
                // another Performance, it is a number that sound has as well.
                // This is what keeps the port quiet: a keyboard nobody is
                // touching answers this way forty-two times a pass and never
                // asks for an aval.
                Some(drawn) if drawn.value == value => {
                    self.readings[asked] = Some(reading);
                    // A change that reverted before anyone vouched for it never
                    // happened as far as the screen is concerned.
                    self.waiting[asked].clear();
                }
                // A different number, or the first at an empty address. Either
                // somebody turned something or the sound changed underneath, and
                // these forty-two answers cannot tell those apart. It waits.
                _ => self.waiting[asked].push(reading),
            }
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
    /// What is waiting on an aval goes with it, and that is the whole of #20: a
    /// reading taken across the change is exactly the one that was being held
    /// back, and it is discarded here without ever having been a figure.
    ///
    /// The cadence survives: `last_pass` is what `CADUCO` and `LOS OCHO · N Hz`
    /// are computed from, and how fast the port answers has nothing to do with
    /// which Performance is loaded.
    pub fn forget(&mut self) {
        self.readings.iter_mut().for_each(|reading| *reading = None);
        self.waiting.iter_mut().for_each(Waiting::clear);
        self.next = 0;
        self.pass_started = Instant::now();
    }

    /// Whether anything is held waiting for the ancla to speak.
    ///
    /// The app reads it to ask for a beat out of turn: the sooner that beat, the
    /// less time a figure spends behind. It costs port time in the lane that
    /// already has priority over this one, so how often that is worth paying is
    /// the ancla's call (ADR-0004, ADR-0005) and not this module's.
    pub fn waiting_on_aval(&self) -> bool {
        self.waiting.iter().any(Waiting::is_waiting)
    }

    /// The ancla says the loaded Performance is still the one the header names,
    /// and its beat began at `beat_started`. Every address puts up the newest
    /// reading that beat can speak for.
    ///
    /// The instant is the whole of the guarantee. A beat that began after a
    /// reading and found the same name brackets that reading inside one sound; a
    /// beat that began before it says nothing about it, so that one stays held
    /// for the next beat. Returns whether anything moved, so a caller only
    /// redraws when there is something to redraw.
    pub fn vouch(&mut self, beat_started: Instant) -> bool {
        let mut drew = false;
        for (slot, waiting) in self.waiting.iter_mut().enumerate() {
            if let Some(reading) = waiting.release(beat_started) {
                self.readings[slot] = Some(reading);
                drew = true;
            }
        }
        drew
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

    /// One whole pass, vouched for by an ancla that found the same name — the
    /// steady state of a keyboard sitting there with nobody changing anything.
    /// Written out here so that every test below has to say which of the two it
    /// wants: forty-two answers, or forty-two figures.
    fn vouched_pass(ring: &mut WideRing, owner: &mut PortOwner<FakeModx>) {
        ring.pass(&mut asking(owner)).unwrap();
        ring.vouch(Instant::now());
    }

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

        vouched_pass(&mut ring, &mut owner);

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
        vouched_pass(&mut ring, &mut owner);
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
        vouched_pass(&mut ring, &mut owner);
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

    /// #20, the whole of it: the pass that straddles a Performance change.
    ///
    /// The capture on the real MODX8 showed OP1 and OP2 carrying the old sound's
    /// Levels, re-roled by the new sound's algorithm, in the new sound's layout,
    /// under the old sound's name — every card stamped `SONDEADO`. This drives
    /// exactly that: half a pass answered by one Performance and half by another,
    /// with the ancla none the wiser. Nothing the second half said may reach the
    /// screen.
    #[test]
    fn a_pass_that_straddles_a_performance_change_draws_nothing_of_the_new_sound() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);
        vouched_pass(&mut ring, &mut owner);

        // What is on screen, and what the header's name belongs to.
        let before: Vec<u32> = (1..=OPERATORS)
            .map(|op| ring.operator(op).level.unwrap().value)
            .collect();
        assert_eq!(before, vec![0, 0, 75, 99, 0, 0, 0, 0]);
        assert_eq!(ring.algorithm().unwrap().value, 0x01);

        // Twenty steps of the next pass: operators 1 to 4, all answered by the
        // Performance that is loaded now.
        {
            let mut ask = asking(&mut owner);
            for _ in 0..20 {
                assert!(!ring.step(&mut ask).unwrap());
            }
        }

        // Somebody loads another Performance. Not one byte is emitted, so the
        // ancla will not know for up to a second — and the ring keeps asking.
        {
            let fake = owner.port_mut();
            fake.load_performance("FM Warm Brass");
            fake.set(Address::new(0x48, 0x00, 0x4F), &[0x10]);
            fake.set(Address::operator(3, 1, 0x1A), &[96]);
            fake.set(Address::operator(5, 1, 0x1A), &[77]);
            fake.set(Address::operator(7, 1, 0x1A), &[87]);
        }

        // The other twenty-two: operators 5 to 8, the algorithm and the feedback,
        // all answered by a sound the header is not naming.
        ring.pass(&mut asking(&mut owner)).unwrap();

        // The chimera, refused. Every figure on the diagram is still one the old
        // Performance answered, and the algorithm the layout is drawn from has
        // not moved either — so no Level can be re-roled by a topology that
        // belongs to a different sound.
        let after: Vec<u32> = (1..=OPERATORS)
            .map(|op| ring.operator(op).level.unwrap().value)
            .collect();
        assert_eq!(after, before, "a Level of the new sound reached the screen");
        assert_eq!(ring.algorithm().unwrap().value, 0x01);
        assert!(
            ring.waiting_on_aval(),
            "the new sound's answers were drawn instead of held",
        );

        // And when the ancla finally notices, they go out with everything else
        // without ever having been a figure.
        ring.forget();
        assert!(!ring.waiting_on_aval());
        assert!(ring.algorithm().is_none());
        assert!(!ring.vouch(Instant::now()), "a discarded reading came back");
    }

    /// The same straddled pass, with the algorithm byte holding still.
    ///
    /// This is the case that separates the aval from the cheap fix #20 also
    /// weighed — letting the ring invalidate itself when the algorithm number
    /// moves. Two Performances can share an algorithm and differ in every Level,
    /// and then that fix sees nothing at all and draws the chimera in full. The
    /// aval never looks at the algorithm: it holds whatever changed, and the
    /// algorithm is just one of the forty-two addresses it holds.
    #[test]
    fn a_performance_change_that_keeps_the_algorithm_is_held_back_all_the_same() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);
        vouched_pass(&mut ring, &mut owner);

        let before: Vec<u32> = (1..=OPERATORS)
            .map(|op| ring.operator(op).level.unwrap().value)
            .collect();
        assert_eq!(before, vec![0, 0, 75, 99, 0, 0, 0, 0]);

        // Operators 1 to 4, answered by the Performance that is loaded now.
        {
            let mut ask = asking(&mut owner);
            for _ in 0..20 {
                assert!(!ring.step(&mut ask).unwrap());
            }
        }

        // Another Performance, on the same algorithm. The one byte a canary
        // would have watched does not move.
        {
            let fake = owner.port_mut();
            fake.load_performance("FM Warm Brass");
            fake.set(Address::operator(5, 1, 0x1A), &[77]);
            fake.set(Address::operator(6, 1, 0x1A), &[64]);
            fake.set(Address::operator(7, 1, 0x1A), &[87]);
            fake.set(Address::operator(8, 1, 0x1A), &[42]);
        }
        ring.pass(&mut asking(&mut owner)).unwrap();

        // Four Levels of a sound the header is not naming, and not one of them
        // on the screen — with the algorithm exactly where it was throughout.
        let after: Vec<u32> = (1..=OPERATORS)
            .map(|op| ring.operator(op).level.unwrap().value)
            .collect();
        assert_eq!(after, before, "a Level of the new sound reached the screen");
        assert_eq!(
            ring.algorithm().unwrap().value,
            0x01,
            "the algorithm moved, so this test proved the wrong thing",
        );
        assert!(ring.waiting_on_aval());
    }

    #[test]
    fn a_reading_that_repeats_the_drawn_number_asks_for_no_aval() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);
        vouched_pass(&mut ring, &mut owner);

        // The keyboard sitting there, answering the same forty-two numbers. Not
        // one of them waits on anything: this is the steady state, and it costs
        // the ancla nothing.
        let stamped = ring.operator(3).level.unwrap();
        ring.pass(&mut asking(&mut owner)).unwrap();

        assert!(!ring.waiting_on_aval());
        let again = ring.operator(3).level.unwrap();
        assert_eq!(again.value, stamped.value);
        assert!(
            again.at >= stamped.at,
            "the figure did not take a fresh stamp"
        );
    }

    #[test]
    fn a_changed_number_waits_for_the_ancla_and_the_old_one_stays_up() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);
        vouched_pass(&mut ring, &mut owner);

        // Somebody turns Op3's Level. Whether that was a hand or a new sound is
        // exactly what these forty-two addresses cannot say.
        owner.port_mut().set(Address::operator(3, 1, 0x1A), &[42]);
        ring.pass(&mut asking(&mut owner)).unwrap();

        assert!(ring.waiting_on_aval());
        assert_eq!(
            ring.operator(3).level.unwrap().value,
            75,
            "an unvouched number was drawn",
        );

        // The ancla beats, finds the same name, and the number is a figure.
        assert!(ring.vouch(Instant::now()));
        assert!(!ring.waiting_on_aval());
        assert_eq!(ring.operator(3).level.unwrap().value, 42);
    }

    /// A hand that keeps moving must not outrun the aval.
    ///
    /// A beat costs ~40 ms and a pass ~100 ms, so a beat that starts after one
    /// reading routinely lands after the *next* one has already arrived. If the
    /// ring kept only the newest, every one of those beats would be handed a
    /// reading it cannot speak for, the one it could speak for would be gone, and
    /// the figure would sit still for as long as the dial kept turning. The
    /// figure lags by a beat — that is the price in ADR-0005 — but it moves.
    #[test]
    fn a_dial_that_keeps_turning_is_not_starved_by_the_beat_it_waits_for() {
        let mut owner = PortOwner::new({
            let mut fake = FakeModx::init_normal_fmx();
            fake.set_latency(Latency::Idle);
            fake
        });
        let mut ring = WideRing::new(1);
        vouched_pass(&mut ring, &mut owner);
        assert_eq!(ring.operator(3).level.unwrap().value, 75);

        // Four turns of the dial, each with a beat that begins before the pass
        // that reads it and finishes after — the losing race, every time.
        let mut drawn = Vec::new();
        for level in [70u8, 65, 60, 55] {
            let beat_started = Instant::now();
            owner
                .port_mut()
                .set(Address::operator(3, 1, 0x1A), &[level]);
            ring.pass(&mut asking(&mut owner)).unwrap();
            ring.vouch(beat_started);
            drawn.push(ring.operator(3).level.unwrap().value);
        }

        // One behind the hand throughout, and never stuck.
        assert_eq!(drawn, vec![75, 70, 65, 60], "the figure stopped following");

        // The hand stops. The next beat puts the figure on the number the dial
        // is actually on, and there is nothing left waiting.
        assert!(ring.vouch(Instant::now()));
        assert_eq!(ring.operator(3).level.unwrap().value, 55);
        assert!(!ring.waiting_on_aval());
    }

    #[test]
    fn an_aval_does_not_reach_a_reading_taken_after_the_beat_began() {
        let mut owner = PortOwner::new({
            let mut fake = FakeModx::init_normal_fmx();
            // Two milliseconds a reply, so the pass below is unambiguously later
            // than the instant taken before it.
            fake.set_latency(Latency::Idle);
            fake
        });
        let mut ring = WideRing::new(1);
        vouched_pass(&mut ring, &mut owner);

        // The beat starts here — before the reading it is being asked to vouch
        // for, so it brackets nothing and says nothing about it.
        let beat_started = Instant::now();
        owner.port_mut().set(Address::operator(3, 1, 0x1A), &[42]);
        ring.pass(&mut asking(&mut owner)).unwrap();

        assert!(
            !ring.vouch(beat_started),
            "a beat vouched for its own future"
        );
        assert_eq!(ring.operator(3).level.unwrap().value, 75);

        // The next one began after it, and that one can.
        assert!(ring.vouch(Instant::now()));
        assert_eq!(ring.operator(3).level.unwrap().value, 42);
    }

    #[test]
    fn a_change_that_reverts_before_an_aval_never_happened() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);
        vouched_pass(&mut ring, &mut owner);

        owner.port_mut().set(Address::operator(3, 1, 0x1A), &[42]);
        ring.pass(&mut asking(&mut owner)).unwrap();
        assert!(ring.waiting_on_aval());

        owner.port_mut().set(Address::operator(3, 1, 0x1A), &[75]);
        ring.pass(&mut asking(&mut owner)).unwrap();

        assert!(!ring.waiting_on_aval(), "the ring is still waiting on a 42");
        assert_eq!(ring.operator(3).level.unwrap().value, 75);
    }

    #[test]
    fn nothing_is_drawn_before_the_first_aval_of_the_session() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut ring = WideRing::new(1);

        // Forty-two answers and an empty diagram: a first reading fills a dash
        // rather than replacing a number, but a dash is not a sound either, and
        // until the ancla has named one there is nothing to hang it on.
        ring.pass(&mut asking(&mut owner)).unwrap();
        assert!(ring.waiting_on_aval());
        assert!(ring.algorithm().is_none());
        assert!(ring.operator(3).level.is_none());

        assert!(ring.vouch(Instant::now()));
        assert_eq!(ring.operator(3).level.unwrap().value, 75);
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

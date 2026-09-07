//! The fake MODX: the keyboard, minus the cable.
//!
//! It is not a stub that returns what a test wants. It is the seam for the whole
//! crate, and it reproduces the quirks that were **measured** on the real MODX in
//! fase 0b and 0c, because those quirks are what the code has to survive:
//!
//! - Parameter Requests answered from an in-memory map, with the reply carrying
//!   `1n = 0x10` whatever `n` was asked with;
//! - reserved addresses answering as if they were real — a read cannot tell them
//!   apart, which is why the list has to come from the Data List (ADR-0003);
//! - `30 4B 00` (Super Knob) accepting the write and not applying it;
//! - a write of the wrong data length as a **silent no-op**: no error, no change,
//!   no complaint. The worst failure mode there is, and the reason every write is
//!   verified by rereading;
//! - values saturating at the maximum instead of being rejected;
//! - timeouts on demand;
//! - Note On with velocity 0, and one Note On per Part in Multi mode;
//! - a **silent Performance change**: the Part 1 name changes underneath with zero
//!   bytes emitted, exactly as the real keyboard does;
//! - asymmetric latency, with a "notes playing" mode, so that the scheduler's
//!   priorities and the adaptive `CADUCO` thresholds are exercised in real time
//!   rather than asserted on paper.

use std::collections::{BTreeMap, VecDeque};
use std::time::{Duration, Instant};

use crate::port::{MidiPort, PortError};
use crate::sysex::{self, Address};

/// Median round trip with the port already open and the keyboard idle (fase 0c).
pub const LATENCY_IDLE: Duration = Duration::from_micros(2_000);
/// Median round trip while notes are playing.
///
/// It sits between the two loaded rows of fase 0c (9.1 ms at two notes per request,
/// 13.2 ms at eight); the design took 10.3 ms as the figure to build against.
pub const LATENCY_PLAYING: Duration = Duration::from_micros(10_300);
/// Worst case seen under notes. The 100 ms timeout is 4× this.
pub const LATENCY_PLAYING_WORST: Duration = Duration::from_micros(24_200);
/// One reply in this many hits the worst case rather than the median.
const WORST_CASE_EVERY: u64 = 8;

/// How fast the fake answers, and whether it is chattering while it does.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Latency {
    /// No wait at all. For tests about bytes, where time is noise.
    #[default]
    Instant,
    /// The keyboard sitting there: 2.0 ms.
    Idle,
    /// Someone is playing: ~10.3 ms, one in eight at 24.2 ms, and channel traffic
    /// arriving in between that the reader has to step over.
    NotesPlaying,
}

impl Latency {
    fn of(self, reply_number: u64) -> Duration {
        match self {
            Latency::Instant => Duration::ZERO,
            Latency::Idle => LATENCY_IDLE,
            Latency::NotesPlaying if reply_number.is_multiple_of(WORST_CASE_EVERY) => {
                LATENCY_PLAYING_WORST
            }
            Latency::NotesPlaying => LATENCY_PLAYING,
        }
    }
}

/// One address of the fake keyboard's memory.
#[derive(Clone, Debug)]
struct Parameter {
    data: Vec<u8>,
    /// The largest value the parameter takes. Above it the keyboard saturates.
    max: Option<u32>,
    /// Reads and even accepts the write, and does not apply it (`30 4B 00`).
    read_only: bool,
}

struct Pending {
    ready_at: Instant,
    message: Vec<u8>,
}

/// A MODX that lives in memory.
pub struct FakeModx {
    values: BTreeMap<Address, Parameter>,
    inbox: VecDeque<Pending>,
    sent: Vec<Vec<u8>>,
    latency: Latency,
    replies: u64,
    /// The next N Parameter Requests get no answer at all.
    swallow_next: usize,
    /// Parts that report a key press. One in Single mode, more in Multi.
    parts: u8,
}

impl Default for FakeModx {
    fn default() -> Self {
        Self::new()
    }
}

impl FakeModx {
    /// A keyboard with nothing in it: every read times out, like the 1 632 `al` of
    /// the operator block that do not exist.
    pub fn new() -> Self {
        Self {
            values: BTreeMap::new(),
            inbox: VecDeque::new(),
            sent: Vec::new(),
            latency: Latency::Instant,
            replies: 0,
            swallow_next: 0,
            parts: 1,
        }
    }

    /// The keyboard the session actually starts from: `Init Normal (FM-X)` on
    /// Part 1, `MIDI I/O Mode = Single`, with the addresses this ticket needs.
    pub fn init_normal_fmx() -> Self {
        let mut fake = Self::new();
        fake.load_performance("Init Normal (FM-X)");

        // Algorithm, base zero: `01` is algorithm 2 on the screen.
        fake.put_max(Address::new(0x48, 0x00, 0x4F), &[0x01], 87);
        // The eight operator Levels of Part 1, the patch fase 0c had loaded.
        for (operator, level) in [0x00, 0x00, 0x4B, 0x63, 0x00, 0x00, 0x00, 0x00]
            .into_iter()
            .enumerate()
        {
            fake.put_max(Address::operator(operator as u8 + 1, 1, 0x1A), &[level], 99);
        }
        // Two bytes, `(b1 << 7) | b2`: the Performance Tempo, 5-300.
        fake.put_max(Address::new(0x30, 0x40, 0x2C), &[0x00, 0x78], 300);
        // Reads, may even emit, never accepts a write.
        fake.put(Address::new(0x30, 0x4B, 0x00), &[0x00]);
        fake.set_read_only(Address::new(0x30, 0x4B, 0x00));

        fake
    }

    /// Put a value at an address, with no ceiling.
    pub fn put(&mut self, address: Address, data: &[u8]) {
        self.values.insert(
            address,
            Parameter {
                data: data.to_vec(),
                max: None,
                read_only: false,
            },
        );
    }

    /// Put a value that saturates rather than refusing what is out of range.
    pub fn put_max(&mut self, address: Address, data: &[u8], max: u32) {
        self.put(address, data);
        if let Some(parameter) = self.values.get_mut(&address) {
            parameter.max = Some(max);
        }
    }

    /// Mark an address the way `30 4B 00` behaves: readable, unwritable, silent.
    pub fn set_read_only(&mut self, address: Address) {
        if let Some(parameter) = self.values.get_mut(&address) {
            parameter.read_only = true;
        }
    }

    /// What the fake has at an address right now, bypassing the wire.
    pub fn value(&self, address: Address) -> Option<&[u8]> {
        self.values.get(&address).map(|held| held.data.as_slice())
    }

    pub fn set_latency(&mut self, latency: Latency) {
        self.latency = latency;
    }

    /// How many Parts report a key press. `MIDI I/O Mode = Single` is one.
    pub fn set_parts(&mut self, parts: u8) {
        self.parts = parts.clamp(1, 16);
    }

    /// The next `count` Parameter Requests get no answer, so the caller has to live
    /// through its own timeout. Three of these in a row on the ancla is
    /// `DESCONECTADO`; one is anomalous but not a disconnection.
    pub fn swallow_next_requests(&mut self, count: usize) {
        self.swallow_next = count;
    }

    /// Every message the app has put on the wire, in order. The test's only window
    /// onto what actually left the app.
    pub fn sent(&self) -> &[Vec<u8>] {
        &self.sent
    }

    /// Where the wire log currently ends, so a test can talk about what came after.
    pub fn mark(&self) -> usize {
        self.sent.len()
    }

    pub fn sent_since(&self, mark: usize) -> &[Vec<u8>] {
        &self.sent[mark.min(self.sent.len())..]
    }

    /// The keyboard's own Part 1 name changes, and **not one byte is emitted**.
    /// This is the whole reason the ancla exists.
    pub fn load_performance(&mut self, name: &str) {
        let mut bytes = [b' '; 20];
        for (slot, byte) in bytes.iter_mut().zip(name.bytes()) {
            *slot = byte & 0x7F;
        }
        for (offset, byte) in bytes.iter().enumerate() {
            self.put(Address::part(sysex::AH_PART, 1, offset as u8), &[*byte]);
        }
    }

    /// The Part 1 name as the keyboard would answer it, trailing blanks trimmed.
    pub fn performance_name(&self) -> String {
        let bytes: Vec<u8> = (0..20u8)
            .filter_map(|offset| {
                self.value(Address::part(sysex::AH_PART, 1, offset))
                    .and_then(|data| data.first().copied())
            })
            .collect();
        String::from_utf8_lossy(&bytes).trim_end().to_string()
    }

    /// Someone presses a key. In Multi mode it arrives once per Part, on one
    /// channel each, which is why the tracker counts pitches and not messages.
    pub fn press(&mut self, pitch: u8, velocity: u8) {
        for channel in 0..self.parts {
            self.emit(vec![0x90 | channel, pitch, velocity]);
        }
    }

    /// Someone lets go — as a Note On with velocity 0, which is what the MODX sends.
    pub fn release(&mut self, pitch: u8) {
        for channel in 0..self.parts {
            self.emit(vec![0x90 | channel, pitch, 0x00]);
        }
    }

    /// The clock the MODX sends ~125 times a second even in silence.
    pub fn tick_clock(&mut self) {
        self.emit(vec![0xF8]);
    }

    fn emit(&mut self, message: Vec<u8>) {
        self.inbox.push_back(Pending {
            ready_at: Instant::now(),
            message,
        });
    }

    fn answer(&mut self, address: Address) {
        if self.swallow_next > 0 {
            self.swallow_next -= 1;
            return;
        }

        let Some(parameter) = self.values.get(&address) else {
            // An address that is not there says nothing at all: a timeout, not an
            // error. That is how the fase 0c blind sweep cost 100 s.
            return;
        };

        self.replies += 1;
        let wait = self.latency.of(self.replies);
        let ready_at = Instant::now() + wait;

        // Under notes the reply does not arrive alone: the reader has to step over
        // the traffic that is causing the latency in the first place.
        if self.latency == Latency::NotesPlaying {
            self.inbox.push_back(Pending {
                ready_at: Instant::now() + wait / 2,
                message: vec![0xF8],
            });
        }

        self.inbox.push_back(Pending {
            ready_at,
            message: sysex::parameter_change(address, &parameter.data),
        });
    }

    fn apply(&mut self, address: Address, data: &[u8]) {
        let Some(parameter) = self.values.get_mut(&address) else {
            return;
        };
        // The two silences that cost the most: the wrong data length changes
        // nothing and says nothing, and the read-only address takes the write and
        // keeps its value.
        if parameter.read_only || data.len() != parameter.data.len() {
            return;
        }

        let written = sysex::decode_value(data).unwrap_or(0);
        let value = match parameter.max {
            Some(max) => written.min(max),
            None => written,
        };

        let width = parameter.data.len();
        for (offset, byte) in parameter.data.iter_mut().enumerate() {
            let shift = 7 * (width - 1 - offset);
            *byte = ((value >> shift) & 0x7F) as u8;
        }
    }
}

impl MidiPort for FakeModx {
    fn send(&mut self, message: &[u8]) -> Result<(), PortError> {
        self.sent.push(message.to_vec());

        // The keyboard does not echo what it is told, so a write produces nothing.
        if message.first() != Some(&sysex::SYSEX_START) {
            return Ok(());
        }
        let Some(address) = sysex::address_of(message) else {
            return Ok(());
        };

        match message.get(2).map(|kind| kind & 0xF0) {
            Some(0x30) => self.answer(address),
            Some(0x10) => {
                let data = &message[9..message.len() - 1];
                self.apply(address, data);
            }
            _ => {}
        }
        Ok(())
    }

    fn recv(&mut self, timeout: Duration) -> Result<Option<Vec<u8>>, PortError> {
        let deadline = Instant::now() + timeout;

        match self.inbox.front() {
            Some(next) if next.ready_at <= deadline => {
                let wait = next.ready_at.saturating_duration_since(Instant::now());
                if !wait.is_zero() {
                    std::thread::sleep(wait);
                }
                Ok(self.inbox.pop_front().map(|pending| pending.message))
            }
            _ => {
                let wait = deadline.saturating_duration_since(Instant::now());
                if !wait.is_zero() {
                    std::thread::sleep(wait);
                }
                Ok(None)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALGORITHM: Address = Address::new(0x48, 0x00, 0x4F);
    const SUPER_KNOB: Address = Address::new(0x30, 0x4B, 0x00);

    fn read(fake: &mut FakeModx, address: Address) -> Option<Vec<u8>> {
        fake.send(&sysex::parameter_request(address)).unwrap();
        let reply = fake.recv(Duration::from_millis(100)).unwrap()?;
        sysex::parse_parameter_change(&reply).map(|parsed| parsed.data)
    }

    #[test]
    fn answers_a_request_from_its_map() {
        let mut fake = FakeModx::init_normal_fmx();
        assert_eq!(read(&mut fake, ALGORITHM), Some(vec![0x01]));
    }

    #[test]
    fn says_nothing_at_an_address_that_does_not_exist() {
        let mut fake = FakeModx::init_normal_fmx();
        assert_eq!(read(&mut fake, Address::new(0x49, 0x20, 0x2F)), None);
    }

    #[test]
    fn swallows_the_requests_it_was_told_to_swallow() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.swallow_next_requests(2);

        assert_eq!(read(&mut fake, ALGORITHM), None);
        assert_eq!(read(&mut fake, ALGORITHM), None);
        assert_eq!(read(&mut fake, ALGORITHM), Some(vec![0x01]));
    }

    #[test]
    fn takes_a_write_of_the_wrong_length_and_changes_nothing() {
        let mut fake = FakeModx::init_normal_fmx();

        fake.send(&sysex::parameter_change(ALGORITHM, &[0x00, 0x05]))
            .unwrap();

        assert_eq!(fake.value(ALGORITHM), Some([0x01].as_slice()));
    }

    #[test]
    fn takes_a_write_to_the_super_knob_and_keeps_its_value() {
        let mut fake = FakeModx::init_normal_fmx();

        fake.send(&sysex::parameter_change(SUPER_KNOB, &[0x40]))
            .unwrap();

        assert_eq!(fake.value(SUPER_KNOB), Some([0x00].as_slice()));
    }

    #[test]
    fn saturates_out_of_range_instead_of_refusing() {
        let mut fake = FakeModx::init_normal_fmx();

        fake.send(&sysex::parameter_change(ALGORITHM, &[0x7F]))
            .unwrap();
        assert_eq!(fake.value(ALGORITHM), Some([0x57].as_slice()));

        // Two bytes saturate too: the Tempo tops out at 300 = `02 2C`.
        let tempo = Address::new(0x30, 0x40, 0x2C);
        fake.send(&sysex::parameter_change(tempo, &[0x02, 0x2D]))
            .unwrap();
        assert_eq!(fake.value(tempo), Some([0x02, 0x2C].as_slice()));
    }

    #[test]
    fn changes_the_performance_without_emitting_a_single_byte() {
        let mut fake = FakeModx::init_normal_fmx();
        assert_eq!(fake.performance_name(), "Init Normal (FM-X)");

        fake.load_performance("CFX + FM EP");

        assert_eq!(fake.recv(Duration::ZERO).unwrap(), None);
        assert_eq!(fake.performance_name(), "CFX + FM EP");
    }

    #[test]
    fn reports_one_key_once_per_part() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.set_parts(4);
        fake.press(60, 100);

        let mut messages = Vec::new();
        while let Some(message) = fake.recv(Duration::ZERO).unwrap() {
            messages.push(message);
        }

        assert_eq!(
            messages,
            vec![
                vec![0x90, 60, 100],
                vec![0x91, 60, 100],
                vec![0x92, 60, 100],
                vec![0x93, 60, 100],
            ]
        );
    }

    #[test]
    fn releases_as_a_note_on_with_velocity_zero() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.press(60, 100);
        fake.release(60);

        let _pressed = fake.recv(Duration::ZERO).unwrap();
        assert_eq!(
            fake.recv(Duration::ZERO).unwrap(),
            Some(vec![0x90, 60, 0x00])
        );
    }

    #[test]
    fn takes_longer_and_chatters_while_notes_are_playing() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.set_latency(Latency::NotesPlaying);

        let start = Instant::now();
        fake.send(&sysex::parameter_request(ALGORITHM)).unwrap();
        // The clock that is causing the latency arrives first, and the reader has
        // to step over it to find its answer.
        let first = fake.recv(Duration::from_millis(100)).unwrap().unwrap();
        assert_eq!(first, vec![0xF8]);
        let reply = fake.recv(Duration::from_millis(100)).unwrap().unwrap();

        assert!(sysex::parse_parameter_change(&reply).is_some());
        assert!(start.elapsed() >= LATENCY_PLAYING, "{:?}", start.elapsed());
    }
}

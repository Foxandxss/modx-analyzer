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
//! - values saturating at the maximum instead of being rejected, at the ceilings
//!   [`crate::table`] gives rather than at ceilings set by hand here;
//! - a write landing on a parameter nobody named: `48 0p 52` puts `48 0p 48` to
//!   zero, which is how the fase 0c restore lost a value it had never touched;
//! - timeouts on demand;
//! - Note On with velocity 0, and one Note On per Part in Multi mode;
//! - a **silent Performance change**: the Part 1 name changes underneath with zero
//!   bytes emitted, exactly as the real keyboard does;
//! - a Bulk Dump Request answered with **123 messages adding up to 7 669 bytes**,
//!   the shape the fase 0c volcado of `0E 25 00` had, spaced by a `Bulk Interval`
//!   that can be turned up until the dump comes back short;
//! - asymmetric latency, with a "notes playing" mode, so that the scheduler's
//!   priorities and the adaptive `CADUCO` thresholds are exercised in real time
//!   rather than asserted on paper.

use std::collections::{BTreeMap, VecDeque};
use std::time::{Duration, Instant};

use crate::dump;
use crate::port::{MidiPort, PortError};
use crate::sysex::{self, Address};
use crate::table;

/// `0F 25 00`: the Bulk Footer of the Performance edit buffer, the counterpart of
/// [`dump::EDIT_BUFFER`]. Documentado — the app has never looked for one, which is
/// why the end of a volcado is a silence and not this address.
const BULK_FOOTER: Address = Address::new(0x0F, 0x25, 0x00);

/// What a bulk message costs before its payload: the six header bytes, the three
/// of the address, the checksum and the `F7`.
const BULK_ENVELOPE_BYTES: usize = 11;

/// One bulk message around a payload, with the measured Yamaha checksum over the
/// address and the data.
fn bulk_envelope(address: Address, payload: &[u8]) -> Vec<u8> {
    let mut body = vec![address.ah, address.am, address.al];
    body.extend_from_slice(payload);

    let mut message = vec![
        sysex::SYSEX_START,
        sysex::YAMAHA_ID,
        0x00,
        sysex::GROUP[0],
        sysex::GROUP[1],
        sysex::MODEL_MODX,
    ];
    message.extend_from_slice(&body);
    message.push(sysex::checksum(&body));
    message.push(sysex::SYSEX_END);
    message
}

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
    /// What a Bulk Dump Request is answered with. Empty is a keyboard that says
    /// nothing, which is the only failure mode the volcado has.
    dump: Vec<Vec<u8>>,
    /// `Bulk Interval`: the gap the keyboard leaves between two bulk messages.
    /// A UTILITY setting, out of remote reach (fase 0d), so the app can neither
    /// read it nor fix it — it can only notice what a wide one does to a dump.
    bulk_interval: Duration,
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
            dump: Self::documented_dump(),
            bulk_interval: Duration::ZERO,
        }
    }

    /// The keyboard the session actually starts from: `Init Normal (FM-X)` on
    /// Part 1, `MIDI I/O Mode = Single`.
    ///
    /// The addresses, their lengths and the values they saturate at come from
    /// [`crate::table`], so the fake answers what the Data List says the keyboard
    /// answers instead of what the tests happen to need.
    pub fn init_normal_fmx() -> Self {
        let mut fake = Self::new();
        fake.load_performance("Init Normal (FM-X)");

        for operator in 1..=8 {
            fake.load_block(&table::OPERATOR, 1, operator);
        }
        fake.load_block(&table::PART_FMX, 1, 1);
        fake.load_block(&table::PERFORMANCE_COMMON, 1, 1);
        for entry in table::PART.entries {
            if !entry.name.starts_with(table::PART_NAME) {
                fake.load_entry(&table::PART, entry, 1, 1);
            }
        }

        // What the fase 0c session actually had loaded, over the defaults. Only the
        // values: the lengths and the ceilings stay the table's.
        // Algorithm, base zero: `01` is algorithm 2 on the screen.
        fake.set(Address::new(0x48, 0x00, 0x4F), &[0x01]);
        // The eight operator Levels of Part 1.
        for (operator, level) in [0x00, 0x00, 0x4B, 0x63, 0x00, 0x00, 0x00, 0x00]
            .into_iter()
            .enumerate()
        {
            fake.set(Address::operator(operator as u8 + 1, 1, 0x1A), &[level]);
        }
        // Two bytes, `(b1 << 7) | b2`: the Performance Tempo at 120.
        fake.set(Address::new(0x30, 0x40, 0x2C), &[0x00, 0x78]);
        // Reads, may even emit, never accepts a write. It is not in the table:
        // the app learns a read-only address by measuring and remembers it.
        fake.put(Address::new(0x30, 0x4B, 0x00), &[0x00]);
        fake.set_read_only(Address::new(0x30, 0x4B, 0x00));

        fake
    }

    /// A second FM-X Part, built from `Init Normal (FM-X)` the way #16 asks the
    /// owner to build one on the panel: the eight operators and the Part's own
    /// FM-X block, at the same documented defaults as the Part 1.
    ///
    /// It is what makes a Part 2 sweep testable at all, and it is **not** evidence
    /// that the keyboard behaves this way: the fake addresses it with
    /// `(op << 4) | part` because that is the rule the app assumes, so a sweep
    /// against the fake can only ever show that the app asks where it thinks it
    /// asks. Whether the MODX answers there is the measurement, and it is the
    /// whole of #16.
    pub fn load_fmx_part(&mut self, part: u8) {
        for operator in 1..=8 {
            self.load_block(&table::OPERATOR, part, operator);
        }
        self.load_block(&table::PART_FMX, part, 1);
    }

    /// Load a whole block at its documented defaults, with the table's ranges as
    /// the ceilings it saturates at. `operator` is ignored outside the operator
    /// block.
    ///
    /// Reserved offsets are loaded like any other: **answering a read as if it
    /// were real is the measured behaviour**, and it is the reason the refusal has
    /// to live in the table and not in anything that can hear the keyboard.
    pub fn load_block(&mut self, block: &'static table::Block, part: u8, operator: u8) {
        for entry in block.entries {
            self.load_entry(block, entry, part, operator);
        }
    }

    /// One entry of a block, at its documented default or at zero.
    ///
    /// **A multibyte entry answers where the keyboard answers, and the two kinds
    /// do not answer alike.** Swept on the MODX8 on 2026-09-08 (#16), the
    /// operator block gave 43 of its 47 offsets, and which four were silent says
    /// what the shape is:
    ///
    /// - A multibyte **parameter** answers its whole field from its first
    ///   address and its tail bytes say nothing. `49 op 25` is the five-byte
    ///   `Controller Set 1-16 Element Switch`, and `26`-`29` were the only four
    ///   offsets of the whole block that came back empty.
    /// - Multibyte **reserved** is not one field, it is that many one-byte holes,
    ///   and each answers on its own. `49 op 2A` is five reserved bytes and
    ///   `2B`-`2E` all answered, with zero.
    ///
    /// So the tail of a reserved run is loaded and the tail of a parameter is
    /// not. A fake that answered at both would have made the sweep's count agree
    /// with itself whatever the keyboard said, which is the whole thing #16 was
    /// there to find out.
    pub fn load_entry(
        &mut self,
        block: &'static table::Block,
        entry: &table::Entry,
        part: u8,
        operator: u8,
    ) {
        let address = block.address(entry.al, part, operator);
        let data = entry
            .default_bytes()
            .unwrap_or_else(|| vec![0x00; usize::from(entry.length)]);

        match entry.range {
            Some((_, high)) => self.put_max(address, &data, high),
            None => self.put(address, &data),
        }

        if entry.is_reserved() {
            for offset in 1..entry.length {
                let tail = block.address(entry.al + offset, part, operator);
                self.put(tail, &[0x00]);
            }
        }
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

    /// Change what an address holds, keeping the ceiling it was loaded with. For
    /// putting a patch on top of the defaults without restating the table.
    pub fn set(&mut self, address: Address, data: &[u8]) {
        match self.values.get_mut(&address) {
            Some(parameter) => parameter.data = data.to_vec(),
            None => self.put(address, data),
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

    /// The volcado the fake answers a Bulk Dump Request with:
    /// [`dump::DOCUMENTED_MESSAGES`] messages adding up to
    /// [`dump::DOCUMENTED_BYTES`] bytes.
    ///
    /// The **counts are measured** and the **contents are not**. The fase 0c spike
    /// saved the bytes and put them back on the wire without ever parsing one — the
    /// restore came back identical 7 669 of 7 669 — so what is inside a Bulk Dump
    /// message was never written down, and the app is opaque to it by design. A
    /// deterministic filler is the honest version of that: it reproduces the shape
    /// that was measured and refuses to invent the layout that was not.
    pub fn documented_dump() -> Vec<Vec<u8>> {
        let payload_total =
            dump::DOCUMENTED_BYTES - BULK_ENVELOPE_BYTES * dump::DOCUMENTED_MESSAGES;
        let between = dump::DOCUMENTED_MESSAGES - 2;
        let (each, extra) = (payload_total / between, payload_total % between);

        let mut messages = Vec::with_capacity(dump::DOCUMENTED_MESSAGES);
        messages.push(bulk_envelope(dump::EDIT_BUFFER, &[]));
        for index in 0..between {
            let length = each + usize::from(index < extra);
            let payload: Vec<u8> = (0..length)
                .map(|byte| ((index * 7 + byte) % 0x80) as u8)
                .collect();
            messages.push(bulk_envelope(dump::EDIT_BUFFER, &payload));
        }
        messages.push(bulk_envelope(BULK_FOOTER, &[]));
        messages
    }

    /// What the fake will answer the next Bulk Dump Request with. An empty list is
    /// a keyboard that says nothing at all, which is the volcado's timeout.
    pub fn set_dump(&mut self, messages: Vec<Vec<u8>>) {
        self.dump = messages;
    }

    pub fn dump_messages(&self) -> &[Vec<u8>] {
        &self.dump
    }

    /// `Bulk Interval`, the gap the keyboard leaves between two bulk messages.
    /// Turned up past the collector's silence it truncates the dump, which is the
    /// one way a volcado can come back short without anything being broken.
    pub fn set_bulk_interval(&mut self, interval: Duration) {
        self.bulk_interval = interval;
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

    /// Push the whole volcado into the inbox at once, spaced by `Bulk Interval`.
    /// Whatever bulk address was asked for gets the one dump the fake holds: the
    /// app only ever asks for `0E 25 00`, and the per-Part addresses (`52 nn`) are
    /// documented and never measured.
    fn dump_out(&mut self) {
        let interval = self.bulk_interval;
        let start = Instant::now();
        let stream: Vec<Pending> = self
            .dump
            .iter()
            .enumerate()
            .map(|(index, message)| Pending {
                ready_at: start + interval * index as u32,
                message: message.clone(),
            })
            .collect();
        self.inbox.extend(stream);
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

        self.collateral(address);
    }

    /// What a write did to something it was never told about.
    ///
    /// One case, measured 6 times out of 6: writing the reserved `48 0p 52` puts
    /// `48 0p 48` (2nd LFO Speed) to zero. The exact condition that fires it was
    /// never determined — one repetition with another precondition did not lose
    /// the value — so the fake fires it always: a test that passes here has
    /// survived the worse of the two keyboards.
    fn collateral(&mut self, written: Address) {
        if written.ah != sysex::AH_PART_FMX || written.al != 0x52 {
            return;
        }
        let victim = Address::new(written.ah, written.am, 0x48);
        if let Some(parameter) = self.values.get_mut(&victim) {
            parameter.data.iter_mut().for_each(|byte| *byte = 0x00);
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
            Some(0x20) => self.dump_out(),
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
    fn answers_a_reserved_address_as_if_it_were_real() {
        let mut fake = FakeModx::init_normal_fmx();
        // A read cannot tell a reserved address from a parameter. This is the
        // measured behaviour and the reason the reserved list comes from paper.
        assert_eq!(
            read(&mut fake, Address::new(0x48, 0x00, 0x52)),
            Some(vec![0x00])
        );
        assert_eq!(
            read(&mut fake, Address::operator(3, 1, 0x00)),
            Some(vec![0x00])
        );
    }

    #[test]
    fn a_write_to_the_reserved_52_takes_the_2nd_lfo_speed_with_it() {
        let mut fake = FakeModx::init_normal_fmx();
        let speed = Address::new(0x48, 0x00, 0x48);
        assert_eq!(fake.value(speed), Some([0x1E].as_slice()));

        fake.send(&sysex::parameter_change(
            Address::new(0x48, 0x00, 0x52),
            &[0x01],
        ))
        .unwrap();

        assert_eq!(fake.value(speed), Some([0x00].as_slice()));
    }

    #[test]
    fn loads_the_block_at_the_documented_defaults() {
        let mut fake = FakeModx::init_normal_fmx();

        // The five bytes of the Controller Set, as the spike read them back.
        assert_eq!(
            read(&mut fake, Address::operator(3, 1, 0x25)),
            Some(vec![0x00, 0x00, 0x03, 0x7F, 0x7F])
        );
        // The AEG Release Time of every operator, at the Data List's `28`.
        for operator in 1..=8 {
            assert_eq!(
                read(&mut fake, Address::operator(operator, 1, 0x17)),
                Some(vec![0x28]),
                "Op{operator}"
            );
        }
        // And the ceiling now comes from the table: Feedback is 0-7.
        fake.send(&sysex::parameter_change(
            Address::new(0x48, 0x00, 0x50),
            &[0x7F],
        ))
        .unwrap();
        assert_eq!(
            fake.value(Address::new(0x48, 0x00, 0x50)),
            Some([0x07].as_slice())
        );
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

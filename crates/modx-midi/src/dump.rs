//! El volcado de seguridad: the edit buffer, byte for byte, before anything else.
//!
//! One Bulk Dump Request goes out and the keyboard answers with a stream of SysEx
//! messages. What is *inside* those messages was never written down — the fase 0c
//! spike saved the bytes and sent them back without parsing them, and the restore
//! came back identical 7 669 of 7 669 — so this module does not parse them either.
//! A volcado is bytes the app keeps and can hand back unchanged; anything more
//! would be a layout nobody measured.
//!
//! Two things follow from that:
//!
//! - **the end of the dump is a silence, not a byte.** The Data List documents a
//!   Bulk Footer (`0F`) but the app has never seen one and would be trusting paper
//!   to decide when a safety file is finished. So the dump ends when no SysEx has
//!   arrived for [`QUIET`], with [`DEADLINE`] as the hard stop. Neither is a fixed
//!   wait: an idle keyboard finishes in the time the bytes take plus [`QUIET`].
//! - **a short dump is reported, never silently kept as good.** `Bulk Interval` is
//!   a UTILITY setting, out of remote reach (fase 0d), that spaces out what the
//!   keyboard transmits. Set high enough it puts a gap wider than [`QUIET`] inside
//!   the dump, and the honest outcome of that is a volcado that says it is short.

use std::time::{Duration, Instant};

use crate::port::{MidiPort, PortError};
use crate::sysex::{self, Address};

/// `0E 25 00`, the live Performance edit buffer.
///
/// `0E` is Bulk Header in the Data List's BULK CONTROL table and `25 00` is the
/// whole Performance. The same table documents `52 nn` (one Part) and `53 00`
/// (Common), which would let a tutorial step save only the Part it is about —
/// documentado, never measured.
pub const EDIT_BUFFER: Address = Address::new(0x0E, 0x25, 0x00);

/// The messages the fase 0c dump of `Init Normal (FM-X)` arrived in.
///
/// Medido once, on one Performance. It is what a volcado is *expected* to weigh,
/// never what it is required to weigh: the app writes what it got and says how
/// much that was.
pub const DOCUMENTED_MESSAGES: usize = 123;
/// The bytes those 123 messages added up to. Two dumps taken without touching
/// anything were identical, 7 669 of 7 669.
pub const DOCUMENTED_BYTES: usize = 7_669;

/// How long the stream has to stay quiet before the dump is called finished.
///
/// The keyboard chatters through the whole dump — the clock alone is ~125 messages
/// a second — so this is a silence of *SysEx*, not of the port. 500 ms is far more
/// than the gap between two bulk messages at the default `Bulk Interval` and far
/// less than the 8 s fixed wait the spike used.
pub const QUIET: Duration = Duration::from_millis(500);

/// The hard stop. The whole 7,7 KB came out in "unos segundos" in fase 0c, so this
/// is only ever reached when something is wrong.
///
/// It is also, exactly, how long a pánico can wait behind a volcado: the owner
/// serves one request at a time (ADR-0004) and this is the longest any request can
/// take. Shortening the worst case means making the dump interruptible, which is
/// a change to the owner loop and not this ticket's.
pub const DEADLINE: Duration = Duration::from_secs(6);

/// What came back from one Bulk Dump Request.
#[derive(Clone, Debug)]
pub struct Dump {
    /// Every SysEx message the keyboard sent, concatenated in arrival order and
    /// otherwise untouched. This is what gets written to disk and what would be
    /// put back on the wire to restore.
    pub bytes: Vec<u8>,
    pub messages: usize,
    /// From the request going out to the silence being declared, [`QUIET`]
    /// included. It is the number the dev readout shows.
    pub took: Duration,
}

impl Dump {
    /// The keyboard said nothing at all: the request timed out.
    pub fn is_empty(&self) -> bool {
        self.bytes.is_empty()
    }

    /// Something came back, but less than the one dump that was ever measured.
    /// Written to disk anyway — throwing away the bytes would make a bad dump into
    /// no dump — and reported as short.
    pub fn is_short(&self) -> bool {
        !self.is_empty()
            && (self.messages < DOCUMENTED_MESSAGES || self.bytes.len() < DOCUMENTED_BYTES)
    }
}

/// Ask for a bulk dump and collect it until the stream goes quiet.
///
/// Everything that is not SysEx — the clock, the notes somebody is playing over
/// the top of it — goes to `traffic` rather than on the floor, and does **not**
/// reset the silence: only the dump's own messages do.
pub fn take(
    port: &mut impl MidiPort,
    address: Address,
    quiet: Duration,
    deadline: Duration,
    traffic: &mut dyn FnMut(&[u8]),
) -> Result<Dump, PortError> {
    let started = Instant::now();
    port.send(&sysex::bulk_dump_request(address))?;

    let stop_at = started + deadline;
    let mut bytes = Vec::with_capacity(DOCUMENTED_BYTES);
    let mut messages = 0usize;
    let mut last = started;

    loop {
        let now = Instant::now();
        if now >= stop_at {
            break;
        }
        if messages > 0 && now.duration_since(last) >= quiet {
            break;
        }

        // Before the first message there is nothing to be quiet about, so the wait
        // is the whole deadline: a keyboard that takes its time to start answering
        // has not failed.
        let until = if messages == 0 {
            stop_at
        } else {
            stop_at.min(last + quiet)
        };

        match port.recv(until.saturating_duration_since(now))? {
            Some(message) if message.first() == Some(&sysex::SYSEX_START) => {
                messages += 1;
                bytes.extend_from_slice(&message);
                last = Instant::now();
            }
            Some(message) => traffic(&message),
            None => {}
        }
    }

    Ok(Dump {
        bytes,
        messages,
        took: started.elapsed(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake::FakeModx;
    use crate::notes::NoteTracker;

    fn take_from(fake: &mut FakeModx) -> Dump {
        take(fake, EDIT_BUFFER, QUIET, DEADLINE, &mut |_| {}).expect("the fake never fails a send")
    }

    #[test]
    fn brings_back_the_123_messages_and_the_7669_bytes() {
        let mut fake = FakeModx::init_normal_fmx();

        let dump = take_from(&mut fake);

        assert_eq!(dump.messages, DOCUMENTED_MESSAGES);
        assert_eq!(dump.bytes.len(), DOCUMENTED_BYTES);
        assert!(!dump.is_empty());
        assert!(!dump.is_short());
    }

    #[test]
    fn asks_with_a_bulk_dump_request_and_writes_nothing() {
        let mut fake = FakeModx::init_normal_fmx();
        let mark = fake.mark();

        take_from(&mut fake);

        // One message left the app, and it was a request. A volcado that writes is
        // not a volcado.
        let sent = fake.sent_since(mark);
        assert_eq!(sent.len(), 1);
        assert_eq!(sent[0], sysex::bulk_dump_request(EDIT_BUFFER));
    }

    #[test]
    fn keeps_the_bytes_exactly_as_they_arrived() {
        let mut fake = FakeModx::init_normal_fmx();
        let expected: Vec<u8> = fake.dump_messages().concat();

        let dump = take_from(&mut fake);

        // Byte for byte, in arrival order: this is the whole promise of a volcado.
        assert_eq!(dump.bytes, expected);
    }

    #[test]
    fn a_keyboard_that_says_nothing_is_an_empty_dump_and_not_an_error() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.set_dump(Vec::new());

        let dump = take(&mut fake, EDIT_BUFFER, QUIET, quick(), &mut |_| {})
            .expect("a silent keyboard is not a send failure");

        assert!(dump.is_empty());
        assert_eq!(dump.messages, 0);
        assert!(!dump.is_short(), "an empty dump is empty, not short");
    }

    #[test]
    fn a_dump_that_stops_early_comes_back_short_and_keeps_what_arrived() {
        let mut fake = FakeModx::init_normal_fmx();
        let truncated = FakeModx::documented_dump()[..40].to_vec();
        fake.set_dump(truncated.clone());

        let dump = take_from(&mut fake);

        assert!(dump.is_short());
        assert_eq!(dump.messages, 40);
        assert_eq!(dump.bytes, truncated.concat());
    }

    #[test]
    fn a_bulk_interval_wider_than_the_silence_cuts_the_dump_short() {
        // `Bulk Interval` is out of remote reach, so the app cannot check it and
        // cannot fix it. What it can do is not call the result complete.
        let mut fake = FakeModx::init_normal_fmx();
        fake.set_dump(FakeModx::documented_dump()[..4].to_vec());
        fake.set_bulk_interval(Duration::from_millis(40));

        let dump = take(
            &mut fake,
            EDIT_BUFFER,
            Duration::from_millis(10),
            quick(),
            &mut |_| {},
        )
        .unwrap();

        assert!(dump.is_short());
        assert!(dump.messages < 4, "{} messages", dump.messages);
    }

    #[test]
    fn hands_the_notes_played_over_the_top_of_it_to_the_tracker() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.press(60, 100);
        fake.tick_clock();

        let mut tracker = NoteTracker::new();
        let dump = take(&mut fake, EDIT_BUFFER, QUIET, DEADLINE, &mut |message| {
            tracker.observe(message);
        })
        .unwrap();

        assert_eq!(dump.messages, DOCUMENTED_MESSAGES);
        assert_eq!(tracker.live_notes(), 1);
        assert_eq!(tracker.traffic(), 2);
    }

    /// The quiet-path deadline: long enough that nothing races it, short enough
    /// that the timeout tests do not cost six seconds each.
    fn quick() -> Duration {
        Duration::from_millis(600)
    }
}

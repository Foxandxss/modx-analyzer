//! One request, one answer, and everything that arrived in between.
//!
//! A reply is matched on the **full three-byte address**, never on order of
//! arrival: the keyboard is talking the whole time (~125 clock messages a second
//! even in silence, plus every note the owner is playing), and under notes the
//! traffic is the latency. Whatever is not the answer goes to `traffic` rather than
//! on the floor, because it is the only place the note tracker gets fed.

use std::time::{Duration, Instant};

use crate::port::{MidiPort, PortError};
use crate::sysex::{self, Address};

/// Ask for one address and wait for its answer until `timeout` runs out.
///
/// `Ok(None)` is a timeout: anomalous on its own (0 losses in 27 000 requests) but
/// not a disconnection — that takes three in a row on the ancla.
pub fn read_parameter(
    port: &mut impl MidiPort,
    address: Address,
    timeout: Duration,
    traffic: &mut dyn FnMut(&[u8]),
) -> Result<Option<Vec<u8>>, PortError> {
    port.send(&sysex::parameter_request(address))?;
    await_reply(port, address, timeout, traffic)
}

/// Wait for the answer to a request that has already gone out.
pub fn await_reply(
    port: &mut impl MidiPort,
    address: Address,
    timeout: Duration,
    traffic: &mut dyn FnMut(&[u8]),
) -> Result<Option<Vec<u8>>, PortError> {
    let deadline = Instant::now() + timeout;

    loop {
        let left = deadline.saturating_duration_since(Instant::now());
        let Some(message) = port.recv(left)? else {
            return Ok(None);
        };

        match sysex::parse_parameter_change(&message) {
            Some(reply) if reply.address == address => return Ok(Some(reply.data)),
            // A reply to something else, or a note, or the clock. The keyboard
            // never echoes a write, so nothing here is our own bytes coming back.
            _ => traffic(&message),
        }

        if Instant::now() >= deadline {
            return Ok(None);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake::{FakeModx, Latency};
    use crate::notes::NoteTracker;
    use crate::port::REPLY_TIMEOUT;

    const ALGORITHM: Address = Address::new(0x48, 0x00, 0x4F);
    const OP3_LEVEL: Address = Address::operator(3, 1, 0x1A);

    #[test]
    fn matches_the_answer_on_the_whole_address() {
        let mut fake = FakeModx::init_normal_fmx();
        // Two requests in flight; the second answer must not be taken for the first.
        fake.send(&sysex::parameter_request(OP3_LEVEL)).unwrap();

        let mut seen = Vec::new();
        let data = read_parameter(&mut fake, ALGORITHM, REPLY_TIMEOUT, &mut |message| {
            seen.push(message.to_vec())
        })
        .unwrap();

        assert_eq!(data, Some(vec![0x01]));
        assert_eq!(
            seen.first()
                .and_then(|message| sysex::parse_parameter_change(message))
                .map(|reply| reply.address),
            Some(OP3_LEVEL),
        );
    }

    #[test]
    fn hands_the_traffic_it_stepped_over_to_the_note_tracker() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.set_latency(Latency::NotesPlaying);
        fake.set_parts(4);
        fake.press(60, 100);
        fake.tick_clock();

        let mut tracker = NoteTracker::new();
        let data = read_parameter(&mut fake, ALGORITHM, REPLY_TIMEOUT, &mut |message| {
            tracker.observe(message);
        })
        .unwrap();

        assert_eq!(data, Some(vec![0x01]));
        // One key, four Parts, counted once — and the clock counted as traffic.
        assert_eq!(tracker.live_notes(), 1);
        assert_eq!(tracker.traffic(), 6);
    }

    #[test]
    fn gives_up_at_the_timeout_instead_of_waiting_forever() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.swallow_next_requests(1);

        let started = Instant::now();
        let data =
            read_parameter(&mut fake, ALGORITHM, Duration::from_millis(20), &mut |_| {}).unwrap();

        assert_eq!(data, None);
        assert!(started.elapsed() < Duration::from_millis(200));
    }
}

//! The note generator: the load the audio bridge's go/no-go is measured under.
//!
//! ADR-0001 rests on one number — that a bloque crosses the IPC and reaches the
//! worker in time **while the three competitors are all busy at once**: audio over
//! the channel, MIDI polling under notes, and the canvases repainting. Idle is
//! already measured (#3, ten minutes, zero holes). The condition where they
//! coincide only exists when the keyboard is sounding, and nobody can play for ten
//! minutes at a fixed density with one hand free to read a screen. So the app
//! plays.
//!
//! It is a **measuring instrument and not a feature**, and two things follow from
//! that. It is served last of everything ([`crate::owner::Priority::Generator`]),
//! because an instrument that shoved the ancla aside would be measuring an app
//! that never runs. And it counts what it asked for separately from what the port
//! took, because a load that is not counted is a load that was assumed — which is
//! how the fase 0c figures were kept honest.
//!
//! **It is one of exactly two senders of channel messages in this session**, the
//! other being the pánico, and that sentence is in the results document because it
//! is what makes «the keyboard received these notes and nothing else» true.
//!
//! The hung notes of fase 0c were left by a bug in the code that generated them,
//! which is the whole reason [`NoteGenerator::shutdown`] exists and is called from
//! a `Drop`: every pitch this has turned on is turned off again, whether the loop
//! ended, was stopped, or panicked halfway through a step.

use std::collections::VecDeque;
use std::time::Duration;

/// The channel the notes go out on: MIDI channel 1, which is Part 1 with
/// `MIDI I/O Mode = Single` — the Part everything else this session reads.
pub const CHANNEL: u8 = 0;

/// How long one step of the pattern lasts.
///
/// 40 ms is 25 note events a second, which is denser than hands: the fase 0c
/// loaded rows were taken at two and at eight notes per request. It is also not a
/// multiple of the bloque's 30 ms or of the ancla's second, so the generator does
/// not fall into step with either of the things being measured.
pub const STEP: Duration = Duration::from_millis(40);

/// How many pitches are held at once. Four keys down is a chord somebody could
/// play, and it keeps the MODX sounding without pause, which is what the audio
/// half of the run needs.
pub const CHORD: usize = 4;

/// The walk: two octaves of a whole-tone-ish spread, so no two of the four held
/// pitches are ever the same note and the timbre keeps moving.
///
/// Which pitches these are does not matter to the measurement — what matters is
/// that they are fixed, so two runs are the same load.
pub const PITCHES: [u8; 12] = [48, 55, 60, 67, 52, 59, 64, 71, 50, 57, 62, 69];

/// Velocities, cycled. A constant velocity would let the MODX's own envelopes
/// settle into a repeat; four is enough that they do not.
pub const VELOCITIES: [u8; 4] = [96, 112, 80, 104];

const STATUS_NOTE_ON: u8 = 0x90;
const STATUS_NOTE_OFF: u8 = 0x80;

/// The pattern, and the pitches it is holding right now.
///
/// It is a plain state machine with no thread and no port in it: what it produces
/// is a list of messages, and who sends them is the port owner's business
/// (ADR-0004).
#[derive(Debug)]
pub struct NoteGenerator {
    /// The pitches turned on and not yet turned off, oldest first.
    held: VecDeque<u8>,
    step: u64,
    asked: u64,
    /// Set by [`shutdown`](Self::shutdown): a generator that has said goodbye does
    /// not say it twice and does not start again.
    finished: bool,
}

impl Default for NoteGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl NoteGenerator {
    pub fn new() -> Self {
        Self {
            held: VecDeque::with_capacity(CHORD),
            step: 0,
            asked: 0,
            finished: false,
        }
    }

    /// One step of the pattern: let the oldest key go when the chord is full, and
    /// press the next one.
    ///
    /// The release comes **before** the press so the count of held pitches never
    /// goes above [`CHORD`] — a generator that pressed first would leave five keys
    /// down for the length of one message, and the one thing this must never do is
    /// hold more of the keyboard than it says it does.
    pub fn step(&mut self) -> Vec<Vec<u8>> {
        if self.finished {
            return Vec::new();
        }

        let mut messages = Vec::with_capacity(2);
        if self.held.len() >= CHORD {
            if let Some(pitch) = self.held.pop_front() {
                messages.push(vec![STATUS_NOTE_OFF | CHANNEL, pitch, 0]);
            }
        }

        let pitch = PITCHES[(self.step as usize) % PITCHES.len()];
        let velocity = VELOCITIES[(self.step as usize) % VELOCITIES.len()];
        messages.push(vec![STATUS_NOTE_ON | CHANNEL, pitch, velocity]);
        self.held.push_back(pitch);

        self.step += 1;
        self.asked += messages.len() as u64;
        messages
    }

    /// Let go of everything, once.
    ///
    /// This is the shutdown the ticket asks for and it is what the fase 0c hung
    /// notes cost: whatever interrupted the loop — a stop, a pánico, a panic
    /// halfway through a step — every pitch this generator turned on is turned off
    /// again, and the second call has nothing left to say.
    pub fn shutdown(&mut self) -> Vec<Vec<u8>> {
        self.finished = true;
        let messages: Vec<Vec<u8>> = self
            .held
            .drain(..)
            .map(|pitch| vec![STATUS_NOTE_OFF | CHANNEL, pitch, 0])
            .collect();
        self.asked += messages.len() as u64;
        messages
    }

    /// Pitches held right now. Zero after a [`shutdown`](Self::shutdown), and it is
    /// what the readout puts next to the tracker's own count.
    pub fn held(&self) -> usize {
        self.held.len()
    }

    /// Every message the pattern has produced, whether or not the port took it.
    ///
    /// The difference between this and what was actually sent is the whole point
    /// of counting both: the generator sits in the last lane, so a run in which it
    /// was starved is a result about the port and not a broken instrument.
    pub fn asked(&self) -> u64 {
        self.asked
    }

    /// How many steps the pattern has taken.
    pub fn steps(&self) -> u64 {
        self.step
    }
}

/// Messages a second at the top of the pattern, for the results document: two per
/// step once the chord is full.
pub fn messages_per_second() -> f64 {
    2.0 / STEP.as_secs_f64()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notes::NoteTracker;

    /// The generator's own messages, read by the tracker: what the keyboard would
    /// count if it echoed them back.
    fn watched(generator: &mut NoteGenerator, steps: usize) -> NoteTracker {
        let mut tracker = NoteTracker::new();
        for _ in 0..steps {
            for message in generator.step() {
                tracker.observe(&message);
            }
        }
        tracker
    }

    #[test]
    fn every_note_it_turned_on_is_turned_off_again() {
        let mut generator = NoteGenerator::new();
        let mut tracker = watched(&mut generator, 500);
        assert_eq!(tracker.live_notes(), CHORD);

        for message in generator.shutdown() {
            tracker.observe(&message);
        }

        // The criterion the fase 0c hung notes bought at full price.
        assert_eq!(tracker.live_notes(), 0);
        assert_eq!(generator.held(), 0);
    }

    #[test]
    fn never_holds_more_than_a_chord() {
        let mut generator = NoteGenerator::new();
        let mut tracker = NoteTracker::new();

        for _ in 0..200 {
            for message in generator.step() {
                tracker.observe(&message);
                // Checked between the two messages of a step and not only after
                // them: releasing before pressing is what keeps this true.
                assert!(
                    tracker.live_notes() <= CHORD,
                    "{} vivas",
                    tracker.live_notes()
                );
            }
            assert_eq!(generator.held(), tracker.live_notes());
        }
    }

    #[test]
    fn says_goodbye_once() {
        let mut generator = NoteGenerator::new();
        watched(&mut generator, 10);

        assert_eq!(generator.shutdown().len(), CHORD);
        assert!(generator.shutdown().is_empty());
        // And it does not start again behind the caller's back.
        assert!(generator.step().is_empty());
    }

    #[test]
    fn a_generator_that_never_ran_has_nothing_to_let_go_of() {
        let mut generator = NoteGenerator::new();

        assert!(generator.shutdown().is_empty());
        assert_eq!(generator.asked(), 0);
    }

    #[test]
    fn touches_no_parameter() {
        let mut generator = NoteGenerator::new();
        let mut messages: Vec<Vec<u8>> = (0..50).flat_map(|_| generator.step()).collect();
        messages.extend(generator.shutdown());

        // Not one SysEx byte, exactly like the pánico: the load cannot change the
        // patch it is being measured against, and the run writes nothing.
        for message in &messages {
            assert_eq!(message.len(), 3, "{message:02X?}");
            assert!(message[0] < 0xF0, "{message:02X?} is a system message");
            assert_eq!(message[0] & 0x0F, CHANNEL, "{message:02X?} is off Part 1");
            assert!(message[1] < 128 && message[2] < 128, "{message:02X?}");
        }
    }

    #[test]
    fn counts_everything_it_asked_for() {
        let mut generator = NoteGenerator::new();
        watched(&mut generator, 10);

        // Four presses fill the chord, six more each let one go first.
        assert_eq!(generator.steps(), 10);
        assert_eq!(generator.asked(), 4 + 6 * 2);

        generator.shutdown();
        assert_eq!(generator.asked(), 16 + CHORD as u64);
    }

    #[test]
    fn is_denser_than_hands() {
        // The load has to be at least what somebody playing produces, or the run
        // measures a quieter app than the one it is asking about. The fase 0c
        // loaded rows were two and eight notes per request at ~10 ms a request.
        assert!(messages_per_second() >= 40.0, "{}", messages_per_second());
        // And the held pitches mean the MODX is sounding without a gap, which is
        // what the audio half of the measurement needs: at least two, so a key is
        // always down while another is being let go.
        let mut generator = NoteGenerator::new();
        let tracker = watched(&mut generator, 40);
        assert!(tracker.live_notes() >= 2, "{} vivas", tracker.live_notes());
    }
}

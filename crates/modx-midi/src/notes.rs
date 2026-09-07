//! Which pitches the keyboard is holding right now.
//!
//! The tracker lives in the port owner, from the channel messages it already
//! receives while it waits for its replies — there is no second listener, because
//! on Windows the input direction has one owner (ADR-0004).
//!
//! A nota viva is counted **by distinct pitch, not by message**: in Multi mode one
//! key arrives once per Part, on a different channel each time, and the same key
//! pressed once must not read as eight notes. The channel mask per pitch is what
//! makes the release symmetric too — the pitch stays alive until the last Part that
//! reported it lets go.

use crate::sysex::{self, ChannelMessage};

/// Live notes, and the traffic that produced them.
#[derive(Debug)]
pub struct NoteTracker {
    /// For each pitch, a bit per channel currently holding it.
    holders: [u16; 128],
    live: usize,
    traffic: u64,
}

impl Default for NoteTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl NoteTracker {
    pub fn new() -> Self {
        Self {
            holders: [0; 128],
            live: 0,
            traffic: 0,
        }
    }

    /// Show the tracker one message from the keyboard.
    ///
    /// Returns whether the count of live notes changed, so the owner only pushes an
    /// event when there is something new to say.
    pub fn observe(&mut self, message: &[u8]) -> bool {
        if message
            .first()
            .is_some_and(|status| *status == sysex::SYSEX_START)
        {
            return false;
        }

        // Counted before it is decoded, and clock counts: a load measurement that
        // does not verify the load measures nothing (fase 0c).
        self.traffic += 1;

        let before = self.live;
        match sysex::parse_channel(message) {
            Some(ChannelMessage::NoteOn { channel, pitch, .. }) => {
                self.holders[usize::from(pitch)] |= 1 << channel;
            }
            Some(ChannelMessage::NoteOff { channel, pitch }) => {
                self.holders[usize::from(pitch)] &= !(1u16 << channel);
            }
            _ => return false,
        }

        self.live = self.holders.iter().filter(|mask| **mask != 0).count();
        self.live != before
    }

    /// Pitches the keyboard is holding, counted once each.
    pub fn live_notes(&self) -> usize {
        self.live
    }

    pub fn live_pitches(&self) -> impl Iterator<Item = u8> + '_ {
        self.holders
            .iter()
            .enumerate()
            .filter(|(_, mask)| **mask != 0)
            .map(|(pitch, _)| pitch as u8)
    }

    /// Every channel message seen since the tracker was made, clock included. It is
    /// what makes the bridge test self-verifying: the load is counted, not assumed.
    pub fn traffic(&self) -> u64 {
        self.traffic
    }

    /// Nothing is held any more, because the pánico just said so on all 16 channels.
    /// The traffic count is kept: it is a measurement, not a state.
    pub fn silenced(&mut self) -> usize {
        let silenced = self.live;
        self.holders = [0; 128];
        self.live = 0;
        silenced
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note_on(channel: u8, pitch: u8, velocity: u8) -> Vec<u8> {
        vec![0x90 | channel, pitch, velocity]
    }

    #[test]
    fn treats_note_on_with_velocity_zero_as_note_off() {
        let mut tracker = NoteTracker::new();

        assert!(tracker.observe(&note_on(0, 60, 100)));
        assert_eq!(tracker.live_notes(), 1);

        assert!(tracker.observe(&note_on(0, 60, 0)));
        assert_eq!(tracker.live_notes(), 0);
    }

    #[test]
    fn counts_one_key_once_in_multi_mode() {
        let mut tracker = NoteTracker::new();

        // One key, eight Parts: the same pitch arrives on eight channels.
        for channel in 0..8 {
            tracker.observe(&note_on(channel, 60, 100));
        }
        assert_eq!(tracker.live_notes(), 1);
        assert_eq!(tracker.live_pitches().collect::<Vec<_>>(), vec![60]);

        // Seven Parts let go: the key is still down, so the pitch is still alive.
        for channel in 0..7 {
            tracker.observe(&[0x80 | channel, 60, 0]);
        }
        assert_eq!(tracker.live_notes(), 1);

        tracker.observe(&[0x87, 60, 0]);
        assert_eq!(tracker.live_notes(), 0);
    }

    #[test]
    fn counts_distinct_pitches_of_a_chord() {
        let mut tracker = NoteTracker::new();

        for pitch in [60, 64, 67] {
            tracker.observe(&note_on(0, pitch, 100));
        }
        assert_eq!(tracker.live_notes(), 3);

        tracker.observe(&note_on(0, 64, 0));
        assert_eq!(tracker.live_notes(), 2);
    }

    #[test]
    fn counts_the_traffic_it_is_shown_and_ignores_sysex() {
        let mut tracker = NoteTracker::new();

        // Clock, twice, and a control change: traffic, no note.
        assert!(!tracker.observe(&[0xF8]));
        assert!(!tracker.observe(&[0xF8]));
        assert!(!tracker.observe(&[0xB0, 0x07, 0x64]));
        // A reply is not traffic: it is the answer the owner asked for.
        assert!(
            !tracker.observe(&[0xF0, 0x43, 0x10, 0x7F, 0x1C, 0x07, 0x48, 0x00, 0x4F, 0x05, 0xF7])
        );

        assert_eq!(tracker.traffic(), 3);
        assert_eq!(tracker.live_notes(), 0);
    }

    #[test]
    fn reports_only_the_changes_of_the_count() {
        let mut tracker = NoteTracker::new();

        assert!(tracker.observe(&note_on(0, 60, 100)));
        // Same pitch again on the same channel: nothing new to say.
        assert!(!tracker.observe(&note_on(0, 60, 100)));
        // A second Part reporting the same key does not change the count either.
        assert!(!tracker.observe(&note_on(1, 60, 100)));
    }

    #[test]
    fn forgets_everything_when_the_panico_has_spoken() {
        let mut tracker = NoteTracker::new();
        for pitch in [60, 64, 67] {
            tracker.observe(&note_on(0, pitch, 100));
        }

        assert_eq!(tracker.silenced(), 3);
        assert_eq!(tracker.live_notes(), 0);
        assert_eq!(tracker.traffic(), 3);
    }
}

//! The pánico: the button for when everything else has already failed.
//!
//! The hung notes of fase 0c were not left by anyone playing — they were left by a
//! bug in the code that generated them, which is why the pánico depends on nothing
//! but the port. It touches **no parameter**: it does not lose the patch, does not
//! cancel a stored Medida, does not close the port and does not change mode.

/// All Sound Off.
pub const CC_ALL_SOUND_OFF: u8 = 120;
/// All Notes Off.
pub const CC_ALL_NOTES_OFF: u8 = 123;
/// MIDI channels, all of them: in Multi mode a key can arrive on any Part's.
pub const CHANNELS: u8 = 16;
/// MIDI pitches, all of them.
pub const PITCHES: u8 = 128;

/// How many messages one pánico is: 16 + 16 + 2 048.
pub const MESSAGE_COUNT: usize = CHANNELS as usize * 2 + CHANNELS as usize * PITCHES as usize;

const STATUS_CONTROL_CHANGE: u8 = 0xB0;
const STATUS_NOTE_OFF: u8 = 0x80;

/// Every message of one pánico, in the order they go out.
///
/// The two controllers first because they are what a well-behaved synth needs, and
/// the 2 048 explicit Note Offs after because the MODX of fase 0c needed them.
pub fn messages() -> Vec<Vec<u8>> {
    let mut messages = Vec::with_capacity(MESSAGE_COUNT);

    for controller in [CC_ALL_SOUND_OFF, CC_ALL_NOTES_OFF] {
        for channel in 0..CHANNELS {
            messages.push(vec![STATUS_CONTROL_CHANGE | channel, controller, 0]);
        }
    }

    for channel in 0..CHANNELS {
        for pitch in 0..PITCHES {
            messages.push(vec![STATUS_NOTE_OFF | channel, pitch, 0]);
        }
    }

    messages
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sends_all_sound_off_then_all_notes_off_then_every_note_off() {
        let messages = messages();

        assert_eq!(messages.len(), 2080);
        assert_eq!(MESSAGE_COUNT, 2080);

        let all_sound_off = &messages[..16];
        for (channel, message) in all_sound_off.iter().enumerate() {
            assert_eq!(*message, vec![0xB0 | channel as u8, 120, 0]);
        }

        let all_notes_off = &messages[16..32];
        for (channel, message) in all_notes_off.iter().enumerate() {
            assert_eq!(*message, vec![0xB0 | channel as u8, 123, 0]);
        }

        // 128 Note Offs × 16 channels, every pitch of every channel exactly once.
        let note_offs = &messages[32..];
        assert_eq!(note_offs.len(), 2048);
        for channel in 0..16u8 {
            for pitch in 0..128u8 {
                let at = usize::from(channel) * 128 + usize::from(pitch);
                assert_eq!(note_offs[at], vec![0x80 | channel, pitch, 0]);
            }
        }
    }

    #[test]
    fn touches_no_parameter() {
        // Not one SysEx byte in a pánico: a patch cannot be lost by pressing it.
        for message in messages() {
            assert!(message[0] < 0xF0, "{message:02X?} is a system message");
        }
    }
}

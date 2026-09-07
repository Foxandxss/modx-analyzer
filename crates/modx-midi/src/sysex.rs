//! The bytes on the wire, exactly as the fase 0b/0c spikes measured them.
//!
//! ```text
//! PARAMETER CHANGE    F0 43 1n 7F 1C 07 ah am al dd F7     (escribir)
//! PARAMETER REQUEST   F0 43 3n 7F 1C 07 ah am al F7        (leer)
//! BULK DUMP REQUEST   F0 43 2n 7F 1C 07 ah am al F7        (volcar)
//! ```
//!
//! Two measured facts shape the parser and are easy to get wrong:
//!
//! - the keyboard answers any device number but **always replies with `1n = 0x10`**,
//!   so the `n` of a reply is never matched against the `n` that was sent;
//! - the data field is **everything between `al` and the closing `F7`**, of whatever
//!   length. Observed lengths: 1, 2, 4 and 5 bytes (`49 xx 25` answers with five).
//!   Never a fixed position.

/// Start of a System Exclusive message.
pub const SYSEX_START: u8 = 0xF0;
/// End of a System Exclusive message.
pub const SYSEX_END: u8 = 0xF7;
/// Yamaha's manufacturer ID.
pub const YAMAHA_ID: u8 = 0x43;
/// `07` is the MODX. The Montage is `02`, which is why the examples that circulate
/// on the internet carry the wrong byte and the keyboard simply says nothing.
pub const MODEL_MODX: u8 = 0x07;
/// The two group bytes, `7F 1C`, constant for every message of the FM-X blocks.
pub const GROUP: [u8; 2] = [0x7F, 0x1C];

/// High nibble of a Parameter Change: `1n`.
const KIND_PARAMETER_CHANGE: u8 = 0x10;
/// High nibble of a Bulk Dump Request: `2n`.
const KIND_BULK_DUMP_REQUEST: u8 = 0x20;
/// High nibble of a Parameter Request: `3n`.
const KIND_PARAMETER_REQUEST: u8 = 0x30;

/// The device number the app sends. The MODX in front of the owner answers any
/// `n` (`Device Number = all`, determined by experiment), and a keyboard fixed to
/// a number is found by sweeping the sixteen `n` — not by guessing.
pub const DEVICE_NUMBER: u8 = 0x00;

/// The `ah` of the FM-X operator block.
pub const AH_OPERATOR: u8 = 0x49;
/// The `ah` of the Part block that holds the Part name — where the ancla lives.
pub const AH_PART: u8 = 0x31;
/// The `ah` of the block that holds the Algorithm and some general Part parameters.
pub const AH_PART_FMX: u8 = 0x48;

/// The terna `ah am al` that identifies one parameter.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
pub struct Address {
    pub ah: u8,
    pub am: u8,
    pub al: u8,
}

impl Address {
    pub const fn new(ah: u8, am: u8, al: u8) -> Self {
        Self { ah, am, al }
    }

    /// One offset of one operator of one Part.
    ///
    /// On the wire `am = (operador << 4) | part` with **both indices base zero**
    /// (measured, fase 0b), but the arguments here are the numbers the keyboard's
    /// own screen uses — `operator(3, 1, ..)` is Op3 of Part 1, `am = 0x20`. The
    /// subtraction lives in one place on purpose: an off-by-one in an address is
    /// the kind of error that comes back as a plausible number, not as a crash.
    pub const fn operator(operator: u8, part: u8, al: u8) -> Self {
        Self::new(AH_OPERATOR, ((operator - 1) << 4) | (part - 1), al)
    }

    /// One offset of a Part-level block, where `am` is the Part index on its own.
    /// `part` is 1-based, as everywhere else.
    pub const fn part(ah: u8, part: u8, al: u8) -> Self {
        Self::new(ah, part - 1, al)
    }

    const fn bytes(self) -> [u8; 3] {
        [self.ah, self.am, self.al]
    }
}

impl core::fmt::Display for Address {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{:02X} {:02X} {:02X}", self.ah, self.am, self.al)
    }
}

/// Position of `ah` in every message of these three kinds.
const ADDRESS_AT: usize = 6;
/// The shortest well-formed message: header, three address bytes, one data byte, `F7`.
const MIN_CHANGE_LEN: usize = ADDRESS_AT + 3 + 1 + 1;
/// A request carries no data: header, three address bytes, `F7`.
const REQUEST_LEN: usize = ADDRESS_AT + 3 + 1;

fn header(kind: u8) -> [u8; ADDRESS_AT] {
    [
        SYSEX_START,
        YAMAHA_ID,
        kind | DEVICE_NUMBER,
        GROUP[0],
        GROUP[1],
        MODEL_MODX,
    ]
}

fn build(kind: u8, address: Address, data: &[u8]) -> Vec<u8> {
    let mut message = Vec::with_capacity(REQUEST_LEN + data.len());
    message.extend_from_slice(&header(kind));
    message.extend_from_slice(&address.bytes());
    message.extend_from_slice(data);
    message.push(SYSEX_END);
    message
}

/// Read one parameter: `F0 43 3n 7F 1C 07 ah am al F7`.
pub fn parameter_request(address: Address) -> Vec<u8> {
    build(KIND_PARAMETER_REQUEST, address, &[])
}

/// Write one parameter: `F0 43 1n 7F 1C 07 ah am al dd F7`.
///
/// The length of `data` has to be the length the parameter actually takes: sending
/// two bytes to a one-byte parameter is a **silent no-op** (aviso 3 of fase 0c), so
/// every write goes through [`crate::verify`], never on its own.
pub fn parameter_change(address: Address, data: &[u8]) -> Vec<u8> {
    build(KIND_PARAMETER_CHANGE, address, data)
}

/// Ask for a bulk dump: `F0 43 2n 7F 1C 07 ah am al F7`. The edit buffer is `0E 25 00`.
pub fn bulk_dump_request(address: Address) -> Vec<u8> {
    build(KIND_BULK_DUMP_REQUEST, address, &[])
}

/// A Parameter Change coming *from* the keyboard: the answer to a request.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct ParameterReply {
    pub address: Address,
    /// Everything between `al` and the closing `F7`, whatever its length.
    pub data: Vec<u8>,
}

/// Read a Parameter Change off the wire, or `None` when the bytes are anything else.
///
/// The device number is deliberately not checked: the keyboard replies with `10`
/// regardless of what was sent, so matching it would throw away every answer.
pub fn parse_parameter_change(bytes: &[u8]) -> Option<ParameterReply> {
    if bytes.len() < MIN_CHANGE_LEN
        || bytes[0] != SYSEX_START
        || bytes[1] != YAMAHA_ID
        || bytes[2] & 0xF0 != KIND_PARAMETER_CHANGE
        || bytes[3..5] != GROUP
        || bytes[5] != MODEL_MODX
        || *bytes.last()? != SYSEX_END
    {
        return None;
    }

    Some(ParameterReply {
        address: Address::new(
            bytes[ADDRESS_AT],
            bytes[ADDRESS_AT + 1],
            bytes[ADDRESS_AT + 2],
        ),
        data: bytes[ADDRESS_AT + 3..bytes.len() - 1].to_vec(),
    })
}

/// The address a request or a change carries, without decoding the rest.
pub fn address_of(bytes: &[u8]) -> Option<Address> {
    if bytes.len() < REQUEST_LEN || bytes[0] != SYSEX_START || bytes[1] != YAMAHA_ID {
        return None;
    }
    Some(Address::new(
        bytes[ADDRESS_AT],
        bytes[ADDRESS_AT + 1],
        bytes[ADDRESS_AT + 2],
    ))
}

/// `(0x80 - suma) & 0x7F`, confirmed twice in fase 0c: a data field that drops by
/// 17 moves the checksum up by 17. Needed to build bulk messages, not parameters.
pub fn checksum(body: &[u8]) -> u8 {
    let sum = body
        .iter()
        .fold(0u32, |total, byte| total + u32::from(*byte));
    ((0x80u32.wrapping_sub(sum)) & 0x7F) as u8
}

/// Decode a value that the keyboard sends over more than one byte.
///
/// Two bytes are `(b1 << 7) | b2` — measured against the Performance Tempo, whose
/// value is readable on the keyboard's own screen: `02 2C` is 300.
pub fn decode_value(data: &[u8]) -> Option<u32> {
    if data.is_empty() {
        return None;
    }
    Some(
        data.iter()
            .fold(0u32, |value, byte| (value << 7) | u32::from(*byte & 0x7F)),
    )
}

/// What the keyboard says while someone plays it.
///
/// Note On with velocity 0 **is** a Note Off; the normalisation lives here so that
/// nothing downstream can forget it (in Multi mode one key arrives once per Part,
/// which is why the tracker counts by pitch and not by message).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ChannelMessage {
    NoteOn {
        channel: u8,
        pitch: u8,
        velocity: u8,
    },
    NoteOff {
        channel: u8,
        pitch: u8,
    },
    /// Any other voice message: control change, pitch bend, program change.
    Other,
}

const STATUS_NOTE_OFF: u8 = 0x80;
const STATUS_NOTE_ON: u8 = 0x90;

/// Classify a channel message, or `None` for SysEx and for truncated bytes.
pub fn parse_channel(bytes: &[u8]) -> Option<ChannelMessage> {
    let status = *bytes.first()?;
    if !(0x80..0xF0).contains(&status) {
        return None;
    }

    let channel = status & 0x0F;
    match (status & 0xF0, bytes.get(1), bytes.get(2)) {
        (STATUS_NOTE_ON, Some(&pitch), Some(&0)) => {
            Some(ChannelMessage::NoteOff { channel, pitch })
        }
        (STATUS_NOTE_ON, Some(&pitch), Some(&velocity)) => Some(ChannelMessage::NoteOn {
            channel,
            pitch,
            velocity,
        }),
        (STATUS_NOTE_OFF, Some(&pitch), _) => Some(ChannelMessage::NoteOff { channel, pitch }),
        _ => Some(ChannelMessage::Other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_the_three_messages_as_the_spike_measured_them() {
        let address = Address::new(0x48, 0x00, 0x4F);

        assert_eq!(
            parameter_request(address),
            vec![0xF0, 0x43, 0x30, 0x7F, 0x1C, 0x07, 0x48, 0x00, 0x4F, 0xF7]
        );
        assert_eq!(
            parameter_change(address, &[0x05]),
            vec![0xF0, 0x43, 0x10, 0x7F, 0x1C, 0x07, 0x48, 0x00, 0x4F, 0x05, 0xF7]
        );
        assert_eq!(
            bulk_dump_request(Address::new(0x0E, 0x25, 0x00)),
            vec![0xF0, 0x43, 0x20, 0x7F, 0x1C, 0x07, 0x0E, 0x25, 0x00, 0xF7]
        );
    }

    #[test]
    fn addresses_an_operator_as_op_shifted_over_the_part() {
        // Op3 of Part 1, the operator the whole fase 0c map was built on.
        assert_eq!(Address::operator(3, 1, 0x1A).am, 0x20);
        // Op3 of Part 2 — the sweep of #16.
        assert_eq!(Address::operator(3, 2, 0x1A).am, 0x21);
        assert_eq!(Address::operator(1, 1, 0x1A).am, 0x00);
        assert_eq!(Address::operator(8, 1, 0x1A).am, 0x70);
        // The Part blocks take the Part index on its own.
        assert_eq!(Address::part(AH_PART, 1, 0x00).am, 0x00);
        assert_eq!(Address::part(AH_PART_FMX, 2, 0x4F).am, 0x01);
    }

    #[test]
    fn takes_the_data_field_as_everything_up_to_the_f7() {
        let five = [
            0xF0, 0x43, 0x10, 0x7F, 0x1C, 0x07, 0x49, 0x20, 0x25, 0x00, 0x00, 0x03, 0x7F, 0x7F,
            0xF7,
        ];
        let reply = parse_parameter_change(&five).expect("a five-byte data field is legal");

        assert_eq!(reply.address, Address::new(0x49, 0x20, 0x25));
        assert_eq!(reply.data, vec![0x00, 0x00, 0x03, 0x7F, 0x7F]);
    }

    #[test]
    fn accepts_a_reply_whatever_device_number_it_carries() {
        for kind in 0x10..=0x1F {
            let bytes = [
                0xF0, 0x43, kind, 0x7F, 0x1C, 0x07, 0x48, 0x00, 0x4F, 0x05, 0xF7,
            ];
            assert!(parse_parameter_change(&bytes).is_some(), "kind {kind:02X}");
        }
    }

    #[test]
    fn refuses_bytes_that_are_not_a_parameter_change() {
        // A request, not a change.
        assert!(
            parse_parameter_change(&parameter_request(Address::new(0x48, 0x00, 0x4F))).is_none()
        );
        // The Montage's model ID.
        let montage = [
            0xF0, 0x43, 0x10, 0x7F, 0x1C, 0x02, 0x48, 0x00, 0x4F, 0x05, 0xF7,
        ];
        assert!(parse_parameter_change(&montage).is_none());
        // Truncated, and a channel message.
        assert!(parse_parameter_change(&[0xF0, 0x43, 0x10]).is_none());
        assert!(parse_parameter_change(&[0x90, 0x40, 0x64]).is_none());
    }

    #[test]
    fn decodes_two_bytes_as_b1_shifted_seven_over_b2() {
        // The three Tempo readings of fase 0c, read off the MODX's own screen.
        assert_eq!(decode_value(&[0x00, 0x5A]), Some(90));
        assert_eq!(decode_value(&[0x01, 0x48]), Some(200));
        assert_eq!(decode_value(&[0x02, 0x2C]), Some(300));
        assert_eq!(decode_value(&[0x05]), Some(5));
        assert_eq!(decode_value(&[]), None);
    }

    #[test]
    fn checksum_is_the_two_complement_of_the_body_in_seven_bits() {
        assert_eq!(checksum(&[0x00]), 0x00);
        // The measured pair of fase 0c: the Tempo's two data bytes go from `00 5A`
        // to `01 48`, so the body's sum drops by 17 and the checksum rises by 17
        // — in seven bits, which is why the comparison wraps.
        let low = checksum(&[0x0E, 0x25, 0x00, 0x00, 0x5A]);
        let high = checksum(&[0x0E, 0x25, 0x00, 0x01, 0x48]);
        assert_eq!((i32::from(high) - i32::from(low)).rem_euclid(128), 17);
    }

    #[test]
    fn reads_a_note_on_with_velocity_zero_as_a_note_off() {
        assert_eq!(
            parse_channel(&[0x90, 0x40, 0x00]),
            Some(ChannelMessage::NoteOff {
                channel: 0,
                pitch: 0x40
            })
        );
        assert_eq!(
            parse_channel(&[0x91, 0x40, 0x64]),
            Some(ChannelMessage::NoteOn {
                channel: 1,
                pitch: 0x40,
                velocity: 0x64
            })
        );
        assert_eq!(
            parse_channel(&[0x80, 0x40, 0x40]),
            Some(ChannelMessage::NoteOff {
                channel: 0,
                pitch: 0x40
            })
        );
        // Real-time (the clock the MODX sends ~125 times a second) and SysEx are
        // neither: they are traffic, and the tracker counts them without decoding.
        assert_eq!(
            parse_channel(&[0xB0, 0x07, 0x64]),
            Some(ChannelMessage::Other)
        );
        assert_eq!(parse_channel(&[0xF8]), None);
        assert_eq!(parse_channel(&[0xF0, 0x43]), None);
    }
}

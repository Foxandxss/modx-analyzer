//! Where every parameter lives, how long it is, and where that is known from.
//!
//! None of this can be discovered by asking the keyboard. A reserved address
//! answers a read exactly as if it were real, so the only thing that can say it
//! must not be written is the Data List; and a write of the wrong length is a
//! silent no-op, so the only thing that can say how long a parameter is, is a
//! table. Hence this file, with `medido` or `documentado` **per entry** and never
//! per block (ADR-0003).
//!
//! Two sources, both kept in `design_handoff/sources/`:
//!
//! - `datalist_fmx_tables.md`, the curated extraction of the Data List — lengths,
//!   ranges, defaults and the reserved list. Everything that comes from it is
//!   [`Provenance::Documentado`]: it is paper, not a measurement.
//! - `fase0c_RESULTS_mapa.md`, the spike's map — the addresses the keyboard itself
//!   answered, with the length it answered with. Those, and only those, are
//!   [`Provenance::Medido`]. The map file is a transcription source; nothing reads
//!   it at runtime.
//!
//! An entry whose name carries its offset in brackets — `Part PEG (3B)` — is one
//! the extraction groups without splitting. Its address and its length are
//! documented; **which parameter of the group it is, is not**, and the brackets are
//! there so that nobody reads a name here as if it had been looked up one by one.
//!
//! Two places where the sources disagree with each other are transcribed as the
//! more specific source says and written down at the point of the conflict:
//! `49 op 2A` (see [`OPERATOR`]) and `48 0p 2C` (see [`PART_FMX`]).

use crate::sysex::{Address, AH_OPERATOR, AH_PART, AH_PART_FMX};

/// Where an entry's numbers come from. Promotion is per entry, never per block.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Provenance {
    /// The keyboard answered at this address, with this length, in a spike.
    Medido,
    /// Transcribed from the Data List. Not a guess — but not a measurement either.
    Documentado,
}

/// What the app may do with an address.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Access {
    /// Reads, and takes writes.
    ReadWrite,
    /// Reads like anything else and must never be written. Writing one is
    /// undefined behaviour with a measured example: `48 00 52` puts `48 00 48`
    /// (2nd LFO Speed) to zero, which is how the fase 0c restore lost a value it
    /// had never touched.
    Reserved,
}

/// One parameter: its offset inside its block, and everything known about it.
#[derive(Clone, Copy, Debug)]
pub struct Entry {
    /// The `al` byte. The block supplies `ah` and the rule for `am`.
    pub al: u8,
    /// Bytes of the data field. Above one they decode as `(b1 << 7) | b2`.
    pub length: u8,
    /// The Data List's name, or the spike's where the spike named it.
    pub name: &'static str,
    /// Lowest and highest **decoded** value, when the source states it.
    pub range: Option<(u32, u32)>,
    /// The documented default, decoded, when the source states it.
    pub default: Option<u32>,
    pub provenance: Provenance,
    pub access: Access,
}

impl Entry {
    /// Whether this entry occupies an offset: `al` itself, or a byte a multibyte
    /// entry swallowed after it.
    pub fn spans(&self, al: u8) -> bool {
        let first = u16::from(self.al);
        let offset = u16::from(al);
        offset >= first && offset < first + u16::from(self.length)
    }

    /// The entry's default as it would come off the wire, `None` when the source
    /// does not give one.
    pub fn default_bytes(&self) -> Option<Vec<u8>> {
        self.default.map(|value| encode(value, self.length))
    }

    pub fn is_reserved(&self) -> bool {
        self.access == Access::Reserved
    }
}

/// Split a decoded value into the bytes the keyboard expects: seven bits each,
/// most significant first. The inverse of [`crate::sysex::decode_value`].
pub fn encode(value: u32, length: u8) -> Vec<u8> {
    (0..length)
        .rev()
        .map(|byte| ((value >> (7 * u32::from(byte))) & 0x7F) as u8)
        .collect()
}

/// How a block turns a Part (and an operator) into the `am` byte.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Layout {
    /// `am = ((operador - 1) << 4) | (part - 1)`, measured in fase 0b.
    ///
    /// **Measured on the Part 1 and on the Part 1 only.** Every function here
    /// takes the Part as a parameter and nothing hardcodes the 1, so the app is
    /// written as if the rule were parameterized — but the half of it that has
    /// been read off a keyboard is `part = 1`. What promotes the other Parts is
    /// [`crate::sweep`], read-only, and until it has been taken with the MODX in
    /// front of somebody, a Part 2 address is the app asking where it thinks the
    /// parameter is.
    Operator,
    /// `am = part - 1`: one instance of the block per Part.
    Part,
    /// `am` is fixed — the block belongs to the Performance, not to a Part.
    Fixed(u8),
}

/// One `ah` block of the address space.
#[derive(Debug)]
pub struct Block {
    pub ah: u8,
    pub name: &'static str,
    pub layout: Layout,
    /// The block's size in bytes as the Data List's Top Address table gives it,
    /// or `None` where the extraction does not carry it.
    pub size: Option<u8>,
    /// Offsets inside `size` that no entry accounts for. They are listed rather
    /// than left as a gap so that a hole in the transcription is a fact on the
    /// screen and not something nobody noticed.
    pub uncovered: &'static [u8],
    pub entries: &'static [Entry],
}

impl Block {
    /// The address of one offset of this block. `part` and `operator` are 1-based,
    /// as on the keyboard's own screen; `operator` is ignored by every layout but
    /// [`Layout::Operator`], where the caller passes the operator it means.
    pub fn address(&self, al: u8, part: u8, operator: u8) -> Address {
        match self.layout {
            Layout::Operator => Address::operator(operator, part, al),
            Layout::Part => Address::part(self.ah, part, al),
            Layout::Fixed(am) => Address::new(self.ah, am, al),
        }
    }

    /// The entry with this name. Reserved offsets all carry the Data List's
    /// *reserved* and are not reachable this way, which is deliberate: nothing
    /// looks one up on purpose.
    pub fn entry(&'static self, name: &str) -> Option<&'static Entry> {
        self.entries
            .iter()
            .find(|entry| !entry.is_reserved() && entry.name == name)
    }

    /// The entry that owns an offset — the one that starts there, or the multibyte
    /// one that swallowed it.
    pub fn owner_of(&'static self, al: u8) -> Option<&'static Entry> {
        self.entries.iter().find(|entry| entry.spans(al))
    }

    /// The entry with this name, or a panic. For the ring and the ancla, which are
    /// built out of names written two screens above: a typo there is a bug in this
    /// file, not a condition to handle at runtime.
    fn named(&'static self, name: &str) -> &'static Entry {
        self.entry(name)
            .unwrap_or_else(|| panic!("{} no tiene «{name}»", self.name))
    }

    /// Whether an `am` byte can belong to this block. The per-Part layouts accept
    /// any Part (and any operator, in the operator block); a fixed block accepts
    /// exactly its own.
    fn holds(&self, am: u8) -> bool {
        match self.layout {
            Layout::Operator => am >> 4 < 8,
            Layout::Part => am < 16,
            Layout::Fixed(fixed) => am == fixed,
        }
    }
}

// ---------------------------------------------------------------------------
// The entries. Written with the source's own hex, so that a line here can be put
// next to the table it was transcribed from without doing arithmetic first.
// ---------------------------------------------------------------------------

const fn at(al: u8, name: &'static str) -> Entry {
    Entry {
        al,
        length: 1,
        name,
        range: None,
        default: None,
        provenance: Provenance::Documentado,
        access: Access::ReadWrite,
    }
}

const fn reserved(al: u8, length: u8) -> Entry {
    Entry {
        al,
        length,
        name: "reserved",
        range: None,
        default: None,
        provenance: Provenance::Documentado,
        access: Access::Reserved,
    }
}

impl Entry {
    const fn len(mut self, length: u8) -> Self {
        self.length = length;
        self
    }

    const fn range(mut self, low: u32, high: u32) -> Self {
        self.range = Some((low, high));
        self
    }

    const fn starts_at(mut self, value: u32) -> Self {
        self.default = Some(value);
        self
    }

    /// The keyboard answered here, with this length, in the fase 0b/0c spikes.
    const fn medido(mut self) -> Self {
        self.provenance = Provenance::Medido;
        self
    }
}

/// `49 op al` — the eight FM-X operators of a Part, 47 bytes each.
///
/// The 31 offsets the spike's map named are `medido`, plus the five-byte
/// Controller Set block it read back; the rest is the Data List.
///
/// **Every `medido` here was measured at `part = 1`.** A grade belongs to an
/// entry and not to a Part, so nothing in this block says anything about where
/// the same parameter lives on a Part 2: that is the addressing rule
/// ([`Layout::Operator`]), and it is swept rather than assumed ([`crate::sweep`]).
///
/// **Where the sources disagree**: the Data List gives `2A` as five reserved bytes,
/// which leaves 39 offsets answering in this block. The fase 0c blind sweep counted
/// 43 answering and lists `2B`-`2E` among the ones it could not identify, while the
/// same document also says it saw `2B`-`2E` silent and consumed by `2A`.
/// Transcribed as the Data List has it, because it is the more specific source and
/// because treating four unknown offsets as reserved is the safe side of the
/// mistake. Closing it needs the keyboard; until then a relectura of this block is
/// 39 offsets per operator, not 43.
pub static OPERATOR: Block = Block {
    ah: AH_OPERATOR,
    name: "FM PART OPERATOR",
    layout: Layout::Operator,
    size: Some(47),
    uncovered: &[],
    entries: &[
        reserved(0x00, 1),
        at(0x01, "Oscillator Key On Reset")
            .range(0x00, 0x01)
            .starts_at(0x01)
            .medido(),
        reserved(0x02, 1),
        at(0x03, "Oscillator Frequency Mode")
            .range(0x00, 0x01)
            .starts_at(0x00)
            .medido(),
        at(0x04, "Tune Coarse")
            .range(0x00, 0x1F)
            .starts_at(0x01)
            .medido(),
        at(0x05, "Tune Fine")
            .range(0x00, 0x7F)
            .starts_at(0x00)
            .medido(),
        // Bipolar with the centre at 15, not at 64. The centre varies per
        // parameter, and assuming 64 is how a wrong value comes back plausible.
        at(0x06, "Detune")
            .range(0x00, 0x1E)
            .starts_at(0x0F)
            .medido(),
        at(0x07, "Pitch Key Follow Sens")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x08, "Pitch Velocity Sens")
            .range(0x00, 0x0E)
            .starts_at(0x07)
            .medido(),
        // Base-zero enum in the order of the screen: Sine, All 1, All 2, Odd 1,
        // Odd 2, Res 1, Res 2. The spike had only ever seen up to Res 1 = 5.
        at(0x09, "Spectral Form")
            .range(0x00, 0x06)
            .starts_at(0x00)
            .medido(),
        at(0x0A, "Spectral Skirt")
            .range(0x00, 0x07)
            .starts_at(0x00)
            .medido(),
        at(0x0B, "Spectral Resonance")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        // `0C`-`0F` are the PEG, the operator's own pitch envelope — what the fase
        // 0b spike called "the Form/Freq envelope". Same place, Yamaha's name.
        at(0x0C, "PEG Initial Level")
            .range(0x00, 0x64)
            .starts_at(0x32)
            .medido(),
        at(0x0D, "PEG Attack Level")
            .range(0x00, 0x64)
            .starts_at(0x32)
            .medido(),
        at(0x0E, "PEG Attack Time")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x0F, "PEG Decay Time")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x10, "AEG Attack Level")
            .range(0x00, 0x63)
            .starts_at(0x63)
            .medido(),
        at(0x11, "AEG Decay 1 Level")
            .range(0x00, 0x63)
            .starts_at(0x63)
            .medido(),
        at(0x12, "AEG Decay 2 Level")
            .range(0x00, 0x63)
            .starts_at(0x63)
            .medido(),
        at(0x13, "AEG Release Level")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x14, "AEG Attack Time")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x15, "AEG Decay 1 Time")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x16, "AEG Decay 2 Time")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x17, "AEG Release Time")
            .range(0x00, 0x63)
            .starts_at(0x28)
            .medido(),
        at(0x18, "AEG Hold Time")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x19, "AEG Time Key Follow Sens")
            .range(0x00, 0x07)
            .starts_at(0x00)
            .medido(),
        // The Data List prints two defaults for this one: 0, and 99 when the
        // operator is the first. One number cannot hold both, so the table keeps
        // the one that is true for seven of the eight.
        at(0x1A, "Operator Level")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        // The note scale here is **not** the MIDI one: `B 3` reads back as 50,
        // which is 21 below MIDI's 71 and fits a scale starting at A-1. Measured
        // at exactly one point, so the range is the Data List's and the mapping
        // from note to number is not in this table.
        at(0x1B, "Level Scaling Break Point")
            .range(0x00, 0x63)
            .starts_at(0x3C)
            .medido(),
        at(0x1C, "Level Scaling Low Depth")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x1D, "Level Scaling High Depth")
            .range(0x00, 0x63)
            .starts_at(0x00)
            .medido(),
        at(0x1E, "Level Scaling Low Curve")
            .range(0x00, 0x03)
            .starts_at(0x00)
            .medido(),
        at(0x1F, "Level Scaling High Curve")
            .range(0x00, 0x03)
            .starts_at(0x00)
            .medido(),
        at(0x20, "Level Velocity Sens")
            .range(0x00, 0x0E)
            .starts_at(0x07)
            .medido(),
        at(0x21, "2nd LFO Pitch Mod Depth Offset")
            .range(0x00, 0x07)
            .starts_at(0x03),
        at(0x22, "2nd LFO Amplitude Mod Depth Offset")
            .range(0x00, 0x07)
            .starts_at(0x03),
        at(0x23, "Pitch Controller Sens")
            .range(0x00, 0x0E)
            .starts_at(0x07),
        at(0x24, "Level Controller Sens")
            .range(0x00, 0x0E)
            .starts_at(0x07),
        // Five bytes, and the one place where a "value" here is a bitmap: the
        // sixteen Controller Set boxes. Decoded like any other multibyte value it
        // is 65 535 — the sixteen boxes on, which is the default the Data List
        // prints as `00 00 03 7F 7F` and the five bytes the spike read at `49 20 25`.
        at(0x25, "Controller Set 1-16 Element Switch")
            .len(5)
            .starts_at(0xFFFF)
            .medido(),
        reserved(0x2A, 5),
    ],
};

/// `48 0p al` — FM PART COMMON: the Part's filter, its 2nd LFO, its PEG, and the
/// two numbers the operator diagram is laid out from. 86 bytes.
///
/// 72 entries, which is exactly the number of offsets the fase 0c blind sweep
/// found answering in this block. Four of them the spike also named (`01`, `02`,
/// `03` and the Algorithm); the rest is the Data List.
///
/// **Where the sources disagree**: the filter table gives `26`-`2C` as one byte
/// each, and the note on lengths lists `2C` among the two-byte parameters. Both
/// cannot be true, because `2D` is a named parameter and a two-byte `2C` would eat
/// it. Transcribed at one byte, after the more specific row, and left as an open
/// question for the next keyboard session.
pub static PART_FMX: Block = Block {
    ah: AH_PART_FMX,
    name: "FM PART COMMON",
    layout: Layout::Part,
    size: Some(86),
    // The extraction names `00`-`09` and then jumps straight to the filter at `0B`.
    uncovered: &[0x0A],
    entries: &[
        at(0x00, "Random Pan Depth"),
        at(0x01, "Alternate Pan Depth").medido(),
        at(0x02, "Scaling Pan Depth").medido(),
        at(0x03, "Key On Delay Length").medido(),
        at(0x04, "Key On Delay (04)"),
        at(0x05, "Key On Delay (05)"),
        at(0x06, "Pitch velocity / random / key follow (06)"),
        at(0x07, "Pitch velocity / random / key follow (07)"),
        at(0x08, "Pitch velocity / random / key follow (08)"),
        at(0x09, "Pitch velocity / random / key follow (09)"),
        // 19 types, and the Data List's default for Thru is `15`, which is above
        // the 18 that a base-zero count of 19 types allows. The range is left out
        // rather than written down wrong; what #12 needs from here is only that a
        // clean chain reads Thru = `15`.
        at(0x0B, "Filter Type").starts_at(0x15),
        at(0x0C, "Filter Cutoff Frequency").len(2).range(0, 255),
        at(0x0E, "Filter Cutoff Velocity Sens"),
        at(0x0F, "Filter Resonance/Width").range(0, 127),
        at(0x10, "Filter Resonance Velocity Sens"),
        at(0x11, "HPF Cutoff Frequency").len(2),
        at(0x13, "Distance").len(2),
        at(0x15, "Filter Gain").len(2),
        at(0x17, "FEG Hold Time"),
        at(0x18, "FEG Attack Time"),
        at(0x19, "FEG Decay 1 Time"),
        at(0x1A, "FEG Decay 2 Time"),
        at(0x1B, "FEG Release Time"),
        at(0x1C, "FEG Hold Level").len(2),
        at(0x1E, "FEG Attack Level").len(2),
        at(0x20, "FEG Decay 1 Level").len(2),
        at(0x22, "FEG Decay 2 Level").len(2),
        at(0x24, "FEG Release Level").len(2),
        at(0x26, "FEG depth and sens (26)"),
        at(0x27, "FEG depth and sens (27)"),
        at(0x28, "FEG depth and sens (28)"),
        at(0x29, "FEG depth and sens (29)"),
        at(0x2A, "FEG depth and sens (2A)"),
        at(0x2B, "FEG depth and sens (2B)"),
        at(0x2C, "FEG depth and sens (2C)"),
        at(0x2D, "Filter Cutoff Key Follow Sens"),
        at(0x2E, "Filter Cutoff Scaling Break Point 1"),
        at(0x2F, "Filter Cutoff Scaling Break Point 2"),
        at(0x30, "Filter Cutoff Scaling Break Point 3"),
        at(0x31, "Filter Cutoff Scaling Break Point 4"),
        at(0x32, "Filter Cutoff Scaling Offset 1").len(2),
        at(0x34, "Filter Cutoff Scaling Offset 2").len(2),
        at(0x36, "Filter Cutoff Scaling Offset 3").len(2),
        at(0x38, "Filter Cutoff Scaling Offset 4").len(2),
        at(0x3A, "HPF Cutoff Key Follow Sens"),
        at(0x3B, "Part PEG (3B)"),
        at(0x3C, "Part PEG (3C)"),
        at(0x3D, "Part PEG (3D)"),
        at(0x3E, "Part PEG (3E)"),
        at(0x3F, "Part PEG (3F)"),
        at(0x40, "Part PEG (40)"),
        at(0x41, "Part PEG (41)"),
        at(0x42, "Part PEG (42)"),
        at(0x43, "Part PEG (43)"),
        at(0x44, "Part PEG (44)"),
        at(0x45, "Part PEG (45)"),
        at(0x46, "Part PEG (46)"),
        at(0x47, "2nd LFO Wave"),
        // The one address in this block known by its side effect before its name:
        // writing the reserved `52` put this to zero, and the value that went
        // missing was `1E` = 30, the default the Data List prints for the Speed.
        at(0x48, "2nd LFO Speed").starts_at(0x1E),
        at(0x49, "2nd LFO Phase"),
        at(0x4A, "2nd LFO Delay"),
        at(0x4B, "2nd LFO Key On Reset"),
        at(0x4C, "2nd LFO Pitch Mod Depth"),
        at(0x4D, "2nd LFO Amplitude Mod Depth"),
        at(0x4E, "2nd LFO Filter Mod Depth"),
        // Base zero: `00` is algorithm 1 on the screen and `57` is 88. Writing
        // above `57` saturates instead of being refused, which is why a write is
        // only good once it has been reread.
        at(0x4F, "Algorithm Number")
            .range(0x00, 0x57)
            .starts_at(0x00)
            .medido(),
        // Per Part, not per operator — which is why the fase 0c sweep of the eight
        // operators was right to rule them out and still could not find it.
        at(0x50, "Feedback Level").range(0x00, 0x07).starts_at(0x00),
        reserved(0x51, 1),
        reserved(0x52, 1),
        reserved(0x53, 1),
        reserved(0x54, 1),
        reserved(0x55, 1),
    ],
};

/// The name every entry of the Part name starts with.
pub const PART_NAME: &str = "Part Name";
/// The Part name is twenty ASCII bytes, one per address: `31 0p 00`-`13`.
pub const PART_NAME_BYTES: u8 = 20;

/// `31 0p al` — the Part itself: its name (the ancla) and how it sits in the mix.
///
/// Every entry here is `medido`. This block was never transcribed from paper: it
/// was mapped by changing values on the panel and diffing two reads.
pub static PART: Block = Block {
    ah: AH_PART,
    name: "PART",
    layout: Layout::Part,
    // The extraction does not carry this block's Top Address size.
    size: None,
    uncovered: &[],
    entries: &[
        at(0x00, "Part Name 1").medido(),
        at(0x01, "Part Name 2").medido(),
        at(0x02, "Part Name 3").medido(),
        at(0x03, "Part Name 4").medido(),
        at(0x04, "Part Name 5").medido(),
        at(0x05, "Part Name 6").medido(),
        at(0x06, "Part Name 7").medido(),
        at(0x07, "Part Name 8").medido(),
        at(0x08, "Part Name 9").medido(),
        at(0x09, "Part Name 10").medido(),
        at(0x0A, "Part Name 11").medido(),
        at(0x0B, "Part Name 12").medido(),
        at(0x0C, "Part Name 13").medido(),
        at(0x0D, "Part Name 14").medido(),
        at(0x0E, "Part Name 15").medido(),
        at(0x0F, "Part Name 16").medido(),
        at(0x10, "Part Name 17").medido(),
        at(0x11, "Part Name 18").medido(),
        at(0x12, "Part Name 19").medido(),
        at(0x13, "Part Name 20").medido(),
        at(0x18, "Mute Switch").medido(),
        at(0x1C, "Velocity Limit Low").medido(),
        at(0x1D, "Velocity Limit High").medido(),
        // MIDI numbering, C-2 = 0: measured at two points, `F#-2` = 6 and
        // `D8` = 122. The operator's Break Point does **not** use this scale.
        at(0x1E, "Note Limit Low").medido(),
        at(0x1F, "Note Limit High").medido(),
        at(0x22, "Velocity Depth").medido(),
        at(0x23, "Velocity Offset").medido(),
        at(0x24, "Volume").medido(),
        at(0x25, "Pan").medido(),
        at(0x29, "Reverb Send").medido(),
        at(0x2A, "Variation Send").medido(),
        at(0x2C, "Dry Level").medido(),
    ],
};

/// `30 40 al` — the Performance's own block. One entry, and it earns its place:
/// the Tempo is where `(b1 << 7) | b2` was measured against a number the MODX
/// shows on its own screen (`02 2C` is 300).
pub static PERFORMANCE_COMMON: Block = Block {
    ah: 0x30,
    name: "PERFORMANCE COMMON",
    layout: Layout::Fixed(0x40),
    size: None,
    uncovered: &[],
    entries: &[at(0x2C, "Tempo").len(2).range(5, 300).medido()],
};

/// Every block the table knows, in `ah` order.
pub static BLOCKS: &[&Block] = &[&PERFORMANCE_COMMON, &PART, &PART_FMX, &OPERATOR];

/// The block an address belongs to, if the table knows it.
pub fn block_of(address: Address) -> Option<&'static Block> {
    BLOCKS
        .iter()
        .copied()
        .find(|block| block.ah == address.ah && block.holds(address.am))
}

/// The entry that governs an address — the one that starts there, or the multibyte
/// one that swallowed it. `None` for an address the table does not cover.
pub fn lookup(address: Address) -> Option<&'static Entry> {
    block_of(address).and_then(|block| block.owner_of(address.al))
}

/// Whether an address must never be written.
///
/// True for the reserved offset itself and for every byte a multibyte reserved
/// entry swallows: `48 0p 51`-`55` and, in the operator block, `00`, `02` and
/// `2A`-`2E`. An address the table does not know is not reserved — it is unknown,
/// and refusing everything unknown would refuse the whole `0x30` space.
pub fn is_reserved(address: Address) -> bool {
    lookup(address).is_some_and(Entry::is_reserved)
}

/// Every reserved address of one Part, the eight operator blocks included. The
/// list the crate refuses writes to, laid out so that it can be read.
pub fn reserved_addresses(part: u8) -> Vec<Address> {
    let mut addresses = Vec::new();
    for operator in 1..=8 {
        for entry in OPERATOR.entries.iter().filter(|entry| entry.is_reserved()) {
            for al in entry.al..entry.al + entry.length {
                addresses.push(OPERATOR.address(al, part, operator));
            }
        }
    }
    for entry in PART_FMX.entries.iter().filter(|entry| entry.is_reserved()) {
        for al in entry.al..entry.al + entry.length {
            addresses.push(PART_FMX.address(al, part, 1));
        }
    }
    addresses
}

/// One address a ring polls, with what the table says about it.
#[derive(Clone, Copy, Debug)]
pub struct Polled {
    pub address: Address,
    pub entry: &'static Entry,
    /// The operator it belongs to, 1-8, or `None` when it is the Part's own.
    pub operator: Option<u8>,
}

impl Polled {
    /// What the keyboard would answer at rest, when the table documents it.
    pub fn default_bytes(&self) -> Option<Vec<u8>> {
        self.entry.default_bytes()
    }
}

/// The five offsets of every operator the anillo ancho watches, in polling order.
pub const WIDE_RING_OPERATOR: [&str; 5] = [
    "Operator Level",
    "Tune Coarse",
    "Tune Fine",
    "Oscillator Frequency Mode",
    "Spectral Form",
];

/// And the two the Part carries: what the diagram is laid out from.
pub const WIDE_RING_PART: [&str; 2] = ["Algorithm Number", "Feedback Level"];

/// The 42 addresses of the anillo ancho, by name: five per operator for the eight,
/// then the algorithm and the feedback.
pub fn wide_ring(part: u8) -> Vec<Polled> {
    let mut ring = Vec::with_capacity(42);
    for operator in 1..=8 {
        for name in WIDE_RING_OPERATOR {
            let entry = OPERATOR.named(name);
            ring.push(Polled {
                address: OPERATOR.address(entry.al, part, operator),
                entry,
                operator: Some(operator),
            });
        }
    }
    for name in WIDE_RING_PART {
        let entry = PART_FMX.named(name);
        ring.push(Polled {
            address: PART_FMX.address(entry.al, part, 1),
            entry,
            operator: None,
        });
    }
    ring
}

/// Every address of one Part's patch: the FM-X common block and the eight
/// operators, one read per **parameter** and not per byte.
///
/// This is what the relectura goes through, and its length is the total the strip
/// counts against. It is deliberately not the design's 416: that figure is the
/// fase 0c sweep, which asked every `al` of `ah` 48 and 49 one byte at a time,
/// and a two-byte parameter answers its whole data field from its first address —
/// so asking its second byte separately asks for something that is not a
/// parameter. The rest of the difference is the table's one unresolved
/// contradiction (`49 op 2A`: five reserved bytes, or five loose offsets), which
/// is written down in `docs/results` rather than rounded away to match the sheet.
///
/// Reserved addresses are in the list. A read cannot tell them apart from a real
/// one anyway, and leaving them out would make the count say the patch is smaller
/// than it is; nothing here writes.
///
/// The Part's own block goes first so the algorithm and the feedback are among a
/// relectura's earliest answers rather than its last.
pub fn patch_addresses(part: u8) -> Vec<Address> {
    let mut addresses: Vec<Address> = PART_FMX
        .entries
        .iter()
        .map(|entry| PART_FMX.address(entry.al, part, 1))
        .collect();
    for operator in 1..=8 {
        addresses.extend(
            OPERATOR
                .entries
                .iter()
                .map(|entry| OPERATOR.address(entry.al, part, operator)),
        );
    }
    addresses
}

/// The 20 addresses of the ancla: the Part name, one byte per address.
///
/// It is the only signal there is that the Performance changed underneath, and it
/// has a hole nothing here can close: two Performances whose Part 1 shares a name
/// are, to the ancla, the same Performance.
pub fn anchor(part: u8) -> Vec<Address> {
    PART.entries
        .iter()
        .filter(|entry| entry.name.starts_with(PART_NAME))
        .map(|entry| PART.address(entry.al, part, 1))
        .collect()
}

/// Read the Part name out of what the ancla's twenty reads answered. A read that
/// timed out leaves a blank rather than a wrong name.
pub fn anchor_name(replies: &[Option<Vec<u8>>]) -> String {
    let bytes: Vec<u8> = replies
        .iter()
        .map(|reply| match reply.as_deref() {
            Some([byte, ..]) => *byte & 0x7F,
            _ => b' ',
        })
        .collect();
    String::from_utf8_lossy(&bytes).trim_end().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sysex;
    use std::collections::BTreeSet;

    /// The spike's map, address by address, with the length the keyboard answered
    /// with. Every one of these has to be in the table as `medido`: the map file is
    /// a transcription source, and this test is the transcription's only net.
    fn spike_map() -> Vec<(Address, u8)> {
        let mut map = Vec::new();
        // The 31 offsets of the operator block, all measured on Op3 of Part 1.
        for al in [
            0x01, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D,
            0x1E, 0x1F, 0x20,
        ] {
            map.push((Address::operator(3, 1, al), 1));
        }
        // The five-byte Controller Set block, read back as `00 00 03 7F 7F`.
        map.push((Address::operator(3, 1, 0x25), 5));
        // The Part block: the twenty bytes of the name and the twelve it named.
        for al in 0x00..=0x13 {
            map.push((Address::part(AH_PART, 1, al), 1));
        }
        for al in [
            0x18, 0x1C, 0x1D, 0x1E, 0x1F, 0x22, 0x23, 0x24, 0x25, 0x29, 0x2A, 0x2C,
        ] {
            map.push((Address::part(AH_PART, 1, al), 1));
        }
        // The four of the `0x48` block, and the Tempo.
        for al in [0x01, 0x02, 0x03, 0x4F] {
            map.push((Address::part(AH_PART_FMX, 1, al), 1));
        }
        map.push((Address::new(0x30, 0x40, 0x2C), 2));
        map
    }

    #[test]
    fn every_address_of_the_spike_map_is_in_the_table_as_medido() {
        for (address, length) in spike_map() {
            let entry = lookup(address).unwrap_or_else(|| panic!("{address} no está en la tabla"));
            assert_eq!(entry.al, address.al, "{address} cae dentro de otra entrada");
            assert_eq!(entry.length, length, "{address} ({})", entry.name);
            assert_eq!(
                entry.provenance,
                Provenance::Medido,
                "{address} ({}) lo contestó el teclado",
                entry.name
            );
        }
    }

    #[test]
    fn nothing_else_claims_to_have_been_measured() {
        let measured: BTreeSet<Address> = spike_map().into_iter().map(|(a, _)| a).collect();
        for block in BLOCKS {
            for entry in block.entries.iter() {
                if entry.provenance != Provenance::Medido {
                    continue;
                }
                // The map was built on Op3 of Part 1; the operator block is one
                // table for the eight, so that is the address to compare against.
                let address = block.address(entry.al, 1, 3);
                assert!(
                    measured.contains(&address),
                    "{address} ({}) se llama medido y no está en el mapa del spike",
                    entry.name
                );
            }
        }
    }

    #[test]
    fn covers_each_block_without_overlapping_or_losing_an_offset() {
        for block in BLOCKS {
            let mut owner: Vec<Option<&str>> = vec![None; 256];
            for entry in block.entries.iter() {
                for al in entry.al..entry.al + entry.length {
                    assert!(
                        owner[usize::from(al)].is_none(),
                        "{} {al:02X}: «{}» pisa a «{}»",
                        block.name,
                        entry.name,
                        owner[usize::from(al)].unwrap_or_default(),
                    );
                    owner[usize::from(al)] = Some(entry.name);
                }
            }

            let Some(size) = block.size else { continue };
            let holes: Vec<u8> = (0..size)
                .filter(|al| owner[usize::from(*al)].is_none())
                .collect();
            assert_eq!(
                holes, block.uncovered,
                "{}: los huecos declarados no son los que hay",
                block.name
            );
        }
    }

    #[test]
    fn the_operator_block_is_47_bytes_and_the_fmx_part_block_is_86() {
        let bytes = |block: &Block| -> u32 {
            block
                .entries
                .iter()
                .map(|entry| u32::from(entry.length))
                .sum()
        };

        assert_eq!(bytes(&OPERATOR), 47);
        assert_eq!(bytes(&PART_FMX) + PART_FMX.uncovered.len() as u32, 86);
        // The 72 offsets the fase 0c blind sweep found answering in `0x48`.
        assert_eq!(PART_FMX.entries.len(), 72);
    }

    #[test]
    fn no_reserved_address_is_writable() {
        // Seven bytes per operator (`00`, `02` and the five of `2A`), and the five
        // of `48 0p 51`-`55`.
        let reserved = reserved_addresses(1);
        assert_eq!(reserved.len(), 8 * 7 + 5);

        for address in reserved {
            assert!(is_reserved(address), "{address}");
        }

        // The measured one: writing `48 00 52` is what put `48 00 48` to zero.
        assert!(is_reserved(Address::new(0x48, 0x00, 0x52)));
        // Its neighbour is a parameter like any other.
        assert!(!is_reserved(Address::new(0x48, 0x00, 0x50)));
        // A byte swallowed by the five reserved bytes of `2A` is reserved too.
        assert!(is_reserved(Address::operator(3, 1, 0x2D)));
        // And an address the table does not know is unknown, not reserved: the
        // Super Knob is learned by measuring, not listed here.
        assert!(!is_reserved(Address::new(0x30, 0x4B, 0x00)));
    }

    #[test]
    fn multibyte_values_decode_as_b1_shifted_seven_over_b2() {
        for block in BLOCKS {
            for entry in block.entries.iter() {
                if let Some((_, high)) = entry.range {
                    let ceiling = (1u32 << (7 * u32::from(entry.length))) - 1;
                    assert!(
                        high <= ceiling,
                        "«{}» no cabe en {} bytes",
                        entry.name,
                        entry.length
                    );
                }
                if let Some(bytes) = entry.default_bytes() {
                    assert_eq!(bytes.len(), usize::from(entry.length));
                    assert_eq!(sysex::decode_value(&bytes), entry.default, "{}", entry.name);
                }
            }
        }

        // The Tempo, where the encoding was measured against the MODX's screen.
        let tempo = PERFORMANCE_COMMON.entry("Tempo").expect("el Tempo");
        assert_eq!(tempo.length, 2);
        assert_eq!(tempo.range, Some((5, 300)));
        assert_eq!(sysex::decode_value(&[0x02, 0x2C]), Some(300));
        assert_eq!(encode(300, 2), vec![0x02, 0x2C]);
        // And the five-byte bitmap, which round-trips to the printed default.
        let switch = OPERATOR
            .entry("Controller Set 1-16 Element Switch")
            .expect("el Controller Set");
        assert_eq!(
            switch.default_bytes(),
            Some(vec![0x00, 0x00, 0x03, 0x7F, 0x7F])
        );
    }

    #[test]
    fn every_default_sits_inside_its_range() {
        for block in BLOCKS {
            for entry in block.entries.iter() {
                let (Some((low, high)), Some(default)) = (entry.range, entry.default) else {
                    continue;
                };
                assert!(
                    (low..=high).contains(&default),
                    "«{}»: default {default} fuera de {low}-{high}",
                    entry.name
                );
            }
        }
    }

    #[test]
    fn names_a_parameter_once_per_block() {
        for block in BLOCKS {
            let mut seen = BTreeSet::new();
            for entry in block.entries.iter().filter(|entry| !entry.is_reserved()) {
                assert!(
                    seen.insert(entry.name),
                    "{}: «{}» dos veces",
                    block.name,
                    entry.name
                );
            }
        }
    }

    #[test]
    fn expresses_the_wide_ring_by_name() {
        let ring = wide_ring(1);
        assert_eq!(ring.len(), 42);

        // Five per operator, in polling order, starting with the Level of Op1.
        assert_eq!(ring[0].address, Address::new(0x49, 0x00, 0x1A));
        assert_eq!(ring[0].operator, Some(1));
        assert_eq!(ring[1].address, Address::new(0x49, 0x00, 0x04));
        // Op3 of Part 1 is `am = 0x20`, the operator the whole map was built on.
        assert_eq!(ring[10].address, Address::operator(3, 1, 0x1A));
        // The Part's two come last and belong to no operator.
        assert_eq!(ring[40].address, Address::new(0x48, 0x00, 0x4F));
        assert_eq!(ring[40].entry.name, "Algorithm Number");
        assert_eq!(ring[41].address, Address::new(0x48, 0x00, 0x50));
        assert_eq!(ring[41].operator, None);

        let distinct: BTreeSet<Address> = ring.iter().map(|polled| polled.address).collect();
        assert_eq!(distinct.len(), 42);
        // Nothing the ring polls may be an address the app must not touch.
        assert!(!ring.iter().any(|polled| polled.entry.is_reserved()));
    }

    #[test]
    fn takes_the_part_as_a_parameter_and_not_just_the_first() {
        // Part 2 is the read-only sweep of #16: same offsets, `am` one higher.
        assert_eq!(wide_ring(2)[0].address, Address::new(0x49, 0x01, 0x1A));
        assert_eq!(wide_ring(2)[40].address, Address::new(0x48, 0x01, 0x4F));
    }

    #[test]
    fn the_patch_is_the_fmx_block_and_the_eight_operators_and_says_how_many() {
        let patch = patch_addresses(1);

        // One read per parameter: 72 of `48 00`, then the eight `49 op`.
        assert_eq!(
            patch.len(),
            PART_FMX.entries.len() + 8 * OPERATOR.entries.len()
        );
        // 72 + 39 × 8 = 384, and the number is written out because the design's
        // sheet says 416. The 32 of the difference are `49 op 2B`-`2E`, which the
        // Data List swallows into the five reserved bytes of `2A` and the fase 0c
        // sweep counted as answering: the one unresolved contradiction of this
        // table (`docs/results`), closed by four reads with the keyboard in front
        // of you. The strip says what was actually asked for.
        assert_eq!(patch.len(), 384);
        assert_eq!(patch.first(), Some(&Address::new(0x48, 0x00, 0x00)));
        assert_eq!(patch[PART_FMX.entries.len()], Address::operator(1, 1, 0x00));
        assert_eq!(
            patch.last(),
            Some(&OPERATOR.address(OPERATOR.entries.last().unwrap().al, 1, 8))
        );

        // No address twice: the relectura's count would otherwise say the patch
        // is bigger than it is.
        let distinct: BTreeSet<Address> = patch.iter().copied().collect();
        assert_eq!(distinct.len(), patch.len());

        // The Part is a parameter, the way the ring's and the ancla's are.
        assert_eq!(
            patch_addresses(2).first(),
            Some(&Address::new(0x48, 0x01, 0x00))
        );
    }

    #[test]
    fn expresses_the_anchor_by_name() {
        let anchor_1 = anchor(1);
        assert_eq!(anchor_1.len(), usize::from(PART_NAME_BYTES));
        assert_eq!(anchor_1.first(), Some(&Address::new(0x31, 0x00, 0x00)));
        assert_eq!(anchor_1.last(), Some(&Address::new(0x31, 0x00, 0x13)));
        assert_eq!(anchor(2).first(), Some(&Address::new(0x31, 0x01, 0x00)));
    }

    #[test]
    fn reads_the_performance_name_out_of_the_anchor_replies() {
        let name = "Init Normal (FM-X)";
        let replies: Vec<Option<Vec<u8>>> = name
            .bytes()
            .map(|byte| Some(vec![byte]))
            .chain(std::iter::repeat_n(Some(vec![b' ']), 2))
            .collect();

        assert_eq!(anchor_name(&replies), name);
        // A read that timed out leaves a blank rather than a wrong name.
        assert_eq!(anchor_name(&[None, Some(vec![b'A'])]), " A");
    }
}

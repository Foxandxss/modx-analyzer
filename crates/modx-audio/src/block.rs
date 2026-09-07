//! The contract between Rust and the Web Worker.
//!
//! A bloque is three device callbacks of interleaved stereo f32 with a header in
//! front of it. It is a flat little-endian buffer and not JSON on purpose: it
//! crosses Tauri's IPC 33 times a second and is handed to the worker by transfer,
//! so it must arrive as one `ArrayBuffer` that nobody has to parse twice.
//!
//! ```text
//! offset  bytes  field
//!      0      4  u32  sequence          counted from the first bloque, never reused
//!      4      4  u32  frames            1 323 stereo frames
//!      8      8  u64  sent_at_micros    monotonic, from the start of the capture
//!     16      4  u32  callback_frames   frames the device handed over last time
//!     20      4  u32  flags             bit 0: no entra audio (see `silence`)
//!     24  8·f     f32  samples          interleaved L R L R …, `frames · 2` of them
//! ```
//!
//! The header is 24 bytes so the samples start on a multiple of 4 and a
//! `Float32Array` can be laid over the same buffer without copying it.

/// The only rate `Line (MODX)` offers (`44100..44100`, fase 0 §4).
pub const SAMPLE_RATE: u32 = 44_100;

/// `Line (MODX)` publishes one stereo pair and nothing else. Both channels are
/// sample-identical on the Main L/R and are sent anyway: the analysis reads
/// channel 0 and the second channel is what would show it if that ever stopped
/// being true.
pub const CHANNELS: u16 = 2;

/// Frames per device callback: 441, constant in the 2 996 callbacks of the fase 0
/// 30 s run, which is exactly 10.000 ms. Nothing here assumes it — the assembler
/// takes whatever length arrives — but the block size is chosen around it.
pub const CALLBACK_FRAMES: u32 = 441;

/// Three callbacks per bloque: 33.3 bloques a second, one hop of the vista viva
/// each (ADR-0001). The hop is an integer number of device callbacks so that a
/// trama never straddles a partial buffer.
pub const CALLBACKS_PER_BLOCK: u32 = 3;

/// 1 323 stereo frames, 30.0 ms of audio.
pub const BLOCK_FRAMES: u32 = CALLBACK_FRAMES * CALLBACKS_PER_BLOCK;

/// Size of the header in front of the samples.
pub const HEADER_BYTES: usize = 24;

/// Bit 0 of `flags`: the last second has been exact digital zeros.
pub const FLAG_SILENT: u32 = 1;

/// One bloque, before it is flattened into bytes.
#[derive(Clone, Debug, PartialEq)]
pub struct AudioBlock {
    pub sequence: u32,
    pub frames: u32,
    pub sent_at_micros: u64,
    pub callback_frames: u32,
    pub flags: u32,
    /// Interleaved stereo: `frames * CHANNELS` samples.
    pub samples: Vec<f32>,
}

impl AudioBlock {
    /// Flatten into the buffer the worker receives.
    pub fn encode(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(HEADER_BYTES + self.samples.len() * 4);
        bytes.extend_from_slice(&self.sequence.to_le_bytes());
        bytes.extend_from_slice(&self.frames.to_le_bytes());
        bytes.extend_from_slice(&self.sent_at_micros.to_le_bytes());
        bytes.extend_from_slice(&self.callback_frames.to_le_bytes());
        bytes.extend_from_slice(&self.flags.to_le_bytes());
        for sample in &self.samples {
            bytes.extend_from_slice(&sample.to_le_bytes());
        }
        bytes
    }

    /// Whether this bloque was flagged as «no entra audio».
    pub fn is_silent(&self) -> bool {
        self.flags & FLAG_SILENT != 0
    }
}

/// Cuts the stream of device callbacks into bloques of a fixed size.
///
/// It is the one piece of the capture that has a seam, so it has one: the device
/// callback is measured to be 441 frames and never to vary, but a sequence number
/// that skips or a bloque that is one frame short would be invisible on screen and
/// would poison every latency number this session takes.
#[derive(Debug, Default)]
pub struct BlockAssembler {
    pending: Vec<f32>,
    sequence: u32,
    callbacks: u64,
    min_callback_frames: u32,
    max_callback_frames: u32,
    last_callback_frames: u32,
}

impl BlockAssembler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feed one device callback of interleaved stereo, and hand every complete
    /// bloque to `emit`.
    ///
    /// `now_micros` is stamped on the bloques this callback completes, so the
    /// timestamp is when the audio thread had the samples, not when the forwarding
    /// thread got round to them.
    pub fn push(&mut self, interleaved: &[f32], now_micros: u64, mut emit: impl FnMut(AudioBlock)) {
        let frames = (interleaved.len() / CHANNELS as usize) as u32;
        self.callbacks += 1;
        self.last_callback_frames = frames;
        self.max_callback_frames = self.max_callback_frames.max(frames);
        self.min_callback_frames = if self.callbacks == 1 {
            frames
        } else {
            self.min_callback_frames.min(frames)
        };

        self.pending.extend_from_slice(interleaved);

        let block_samples = BLOCK_FRAMES as usize * CHANNELS as usize;
        while self.pending.len() >= block_samples {
            let rest = self.pending.split_off(block_samples);
            let samples = std::mem::replace(&mut self.pending, rest);
            let block = AudioBlock {
                sequence: self.sequence,
                frames: BLOCK_FRAMES,
                sent_at_micros: now_micros,
                callback_frames: frames,
                flags: 0,
                samples,
            };
            self.sequence += 1;
            emit(block);
        }
    }

    /// How many callbacks have arrived and how long they were. `min` and `max`
    /// are equal on a healthy WASAPI stream; that they are is the acceptance
    /// criterion, so they are counted rather than assumed.
    pub fn callback_stats(&self) -> CallbackStats {
        CallbackStats {
            callbacks: self.callbacks,
            min_frames: self.min_callback_frames,
            max_frames: self.max_callback_frames,
            last_frames: self.last_callback_frames,
        }
    }
}

/// What the device has actually been handing over.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct CallbackStats {
    pub callbacks: u64,
    pub min_frames: u32,
    pub max_frames: u32,
    pub last_frames: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn callback(frames: u32, first: f32) -> Vec<f32> {
        (0..frames * u32::from(CHANNELS))
            .map(|index| first + index as f32)
            .collect()
    }

    #[test]
    fn three_callbacks_make_one_bloque() {
        let mut assembler = BlockAssembler::new();
        let mut blocks = Vec::new();

        for index in 0..3 {
            assembler.push(
                &callback(CALLBACK_FRAMES, index as f32 * 1000.0),
                7,
                |block| blocks.push(block),
            );
        }

        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].sequence, 0);
        assert_eq!(blocks[0].frames, BLOCK_FRAMES);
        assert_eq!(blocks[0].sent_at_micros, 7);
        assert_eq!(
            blocks[0].samples.len(),
            BLOCK_FRAMES as usize * CHANNELS as usize
        );
    }

    #[test]
    fn two_callbacks_make_none() {
        let mut assembler = BlockAssembler::new();
        let mut blocks = 0;

        for _ in 0..2 {
            assembler.push(&callback(CALLBACK_FRAMES, 0.0), 0, |_| blocks += 1);
        }

        assert_eq!(blocks, 0);
    }

    #[test]
    fn sequence_counts_up_and_no_sample_is_lost_or_repeated() {
        let mut assembler = BlockAssembler::new();
        let mut seen: Vec<f32> = Vec::new();
        let mut sequences = Vec::new();

        // Deliberately not 441: the device is measured never to vary, but the
        // assembler must not be the thing that depends on it.
        let odd = 500;
        let total = 10;
        for index in 0..total {
            let first = (index * odd * u32::from(CHANNELS)) as f32;
            assembler.push(&callback(odd, first), 0, |block| {
                sequences.push(block.sequence);
                seen.extend_from_slice(&block.samples);
            });
        }

        assert_eq!(sequences, (0..sequences.len() as u32).collect::<Vec<_>>());
        let expected: Vec<f32> = (0..seen.len() as u32).map(|index| index as f32).collect();
        assert_eq!(seen, expected);
    }

    #[test]
    fn callback_stats_report_what_arrived() {
        let mut assembler = BlockAssembler::new();
        assembler.push(&callback(CALLBACK_FRAMES, 0.0), 0, |_| {});
        assembler.push(&callback(64, 0.0), 0, |_| {});

        let stats = assembler.callback_stats();
        assert_eq!(stats.callbacks, 2);
        assert_eq!(stats.min_frames, 64);
        assert_eq!(stats.max_frames, CALLBACK_FRAMES);
        assert_eq!(stats.last_frames, 64);
    }

    #[test]
    fn the_header_is_what_the_worker_reads() {
        let block = AudioBlock {
            sequence: 0x0102_0304,
            frames: 2,
            sent_at_micros: 0x0807_0605_0403_0201,
            callback_frames: CALLBACK_FRAMES,
            flags: FLAG_SILENT,
            samples: vec![0.0, 1.0, -1.0, 0.5],
        };

        let bytes = block.encode();

        assert_eq!(bytes.len(), HEADER_BYTES + 4 * 4);
        assert_eq!(&bytes[0..4], &0x0102_0304u32.to_le_bytes());
        assert_eq!(&bytes[4..8], &2u32.to_le_bytes());
        assert_eq!(&bytes[8..16], &0x0807_0605_0403_0201u64.to_le_bytes());
        assert_eq!(&bytes[16..20], &CALLBACK_FRAMES.to_le_bytes());
        assert_eq!(&bytes[20..24], &FLAG_SILENT.to_le_bytes());
        assert_eq!(&bytes[24..28], &0.0f32.to_le_bytes());
        assert_eq!(&bytes[36..40], &0.5f32.to_le_bytes());
        assert!(block.is_silent());
    }

    #[test]
    fn a_bloque_is_thirty_milliseconds() {
        assert_eq!(BLOCK_FRAMES, 1_323);
        let millis = f64::from(BLOCK_FRAMES) / f64::from(SAMPLE_RATE) * 1000.0;
        assert!((millis - 30.0).abs() < 0.01, "{millis} ms");
    }
}

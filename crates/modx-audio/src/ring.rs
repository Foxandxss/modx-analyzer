//! The last few seconds of channel 0, kept so a medida can look backwards.
//!
//! MEDIR is a shutter (#10): when it is pressed the 65 536 samples it wants are
//! already in the past, because the note was held before the finger moved. That is
//! the whole reason this exists — without it a medida would have to wait 1.5 s
//! after the press, and the sound the user was pointing at would be gone.
//!
//! Only channel 0 is kept: the two channels of `Line (MODX)` are sample-identical
//! on the Main L/R (fase 0 §6) and the analysis reads channel 0 (ADR-0001).

use crate::block::{CHANNELS, SAMPLE_RATE};

/// 131 072 samples, ≈ 2.97 s. A power of two so the wrap is a mask, and comfortably
/// more than the 65 536 one medida takes.
pub const RING_SAMPLES: usize = 1 << 17;

/// A fixed-size window on the recent past of channel 0.
#[derive(Debug)]
pub struct MonoRing {
    samples: Box<[f32]>,
    /// Where the next sample goes.
    write: usize,
    /// How many of the slots have ever been written, capped at the ring size.
    filled: usize,
}

impl Default for MonoRing {
    fn default() -> Self {
        Self::new()
    }
}

impl MonoRing {
    pub fn new() -> Self {
        Self {
            samples: vec![0.0; RING_SAMPLES].into_boxed_slice(),
            write: 0,
            filled: 0,
        }
    }

    /// How many seconds of channel 0 the ring holds when it is full.
    pub fn seconds() -> f64 {
        RING_SAMPLES as f64 / f64::from(SAMPLE_RATE)
    }

    /// Take channel 0 out of a bloque of interleaved stereo and keep it.
    pub fn push_interleaved(&mut self, interleaved: &[f32]) {
        for sample in interleaved.iter().step_by(CHANNELS as usize) {
            self.samples[self.write] = *sample;
            self.write = (self.write + 1) % RING_SAMPLES;
            self.filled = (self.filled + 1).min(RING_SAMPLES);
        }
    }

    /// How many real samples are available.
    pub fn len(&self) -> usize {
        self.filled
    }

    pub fn is_empty(&self) -> bool {
        self.filled == 0
    }

    /// The most recent `len` samples, oldest first.
    ///
    /// Answers `None` rather than a short window when there are not enough: a
    /// medida over a padded window is a medida of something that never happened.
    pub fn tail(&self, len: usize) -> Option<Vec<f32>> {
        if len > self.filled {
            return None;
        }
        let start = (self.write + RING_SAMPLES - len) % RING_SAMPLES;
        Some(
            (0..len)
                .map(|offset| self.samples[(start + offset) % RING_SAMPLES])
                .collect(),
        )
    }
}

/// Samples laid out as little-endian f32, the way the medida's window crosses to
/// the worker.
///
/// It is the bloque's payload without the bloque's header: no sequence, no
/// timestamp, no flags, because a window taken out of the ring is not something
/// that just happened — it is the past, and there is nothing about *when* worth
/// carrying. The length says everything the reader needs, and the reader checks
/// it (`ui/src/app/audio/bridge.ts`).
pub fn encode_mono(samples: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(samples.len() * 4);
    for sample in samples {
        bytes.extend_from_slice(&sample.to_le_bytes());
    }
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `frames` frames of interleaved stereo where channel 0 counts up from
    /// `first` and channel 1 is its negative, so a ring that takes the wrong
    /// channel cannot pass.
    fn interleaved(first: usize, frames: usize) -> Vec<f32> {
        (0..frames)
            .flat_map(|index| {
                let left = (first + index) as f32;
                [left, -left]
            })
            .collect()
    }

    #[test]
    fn it_keeps_channel_zero_only() {
        let mut ring = MonoRing::new();
        ring.push_interleaved(&interleaved(0, 4));

        assert_eq!(ring.len(), 4);
        assert_eq!(ring.tail(4), Some(vec![0.0, 1.0, 2.0, 3.0]));
    }

    #[test]
    fn it_answers_nothing_rather_than_a_short_window() {
        let ring = MonoRing::new();
        assert!(ring.is_empty());
        assert_eq!(ring.tail(1), None);
    }

    #[test]
    fn the_oldest_samples_fall_off_the_back() {
        let mut ring = MonoRing::new();
        ring.push_interleaved(&interleaved(0, RING_SAMPLES + 10));

        assert_eq!(ring.len(), RING_SAMPLES);
        let tail = ring.tail(3).expect("the ring is full");
        let last = (RING_SAMPLES + 9) as f32;
        assert_eq!(tail, vec![last - 2.0, last - 1.0, last]);
        assert_eq!(ring.tail(RING_SAMPLES + 1), None);
    }

    #[test]
    fn a_window_crosses_as_little_endian_f32_and_nothing_else() {
        let bytes = encode_mono(&[1.0, -0.5]);

        assert_eq!(bytes.len(), 8);
        assert_eq!(f32::from_le_bytes(bytes[0..4].try_into().unwrap()), 1.0);
        assert_eq!(f32::from_le_bytes(bytes[4..8].try_into().unwrap()), -0.5);
    }

    #[test]
    fn it_holds_more_than_one_medida() {
        const { assert!(RING_SAMPLES >= 65_536 * 2) };
        assert!(MonoRing::seconds() > 2.0);
    }
}

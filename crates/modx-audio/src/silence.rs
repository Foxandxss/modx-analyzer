//! «No entra audio», detected the only way that cannot be confused with music.
//!
//! The test is **every sample exactly `0.0` for one second**, not a level under a
//! threshold. A MODX with the volume down, a held note dying away and a patch that
//! ends in silence all produce very small numbers; only a device that is not
//! delivering produces exact zeros. The card that says so is #15 — what lives here
//! is the detection alone.

use crate::block::{CHANNELS, SAMPLE_RATE};

/// One second of frames. Below this, silence is just music.
pub const SILENCE_FRAMES: u64 = SAMPLE_RATE as u64;

/// Counts how long the run of exact zeros has been going.
#[derive(Debug, Default)]
pub struct SilenceDetector {
    zero_frames: u64,
}

impl SilenceDetector {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feed one bloque of interleaved samples; answer whether the last second has
    /// been exact digital zeros.
    ///
    /// `-0.0` counts as zero: it compares equal to `0.0` in IEEE 754 and it is
    /// just as digitally silent.
    pub fn observe(&mut self, interleaved: &[f32]) -> bool {
        let channels = CHANNELS as usize;
        match interleaved.iter().rposition(|sample| *sample != 0.0) {
            // Everything after the last sample that was not zero, in frames. The
            // partial frame a rposition can land in the middle of is rounded down,
            // which errs towards calling it audio.
            Some(index) => self.zero_frames = ((interleaved.len() - index - 1) / channels) as u64,
            None => self.zero_frames += (interleaved.len() / channels) as u64,
        }
        self.is_silent()
    }

    /// The current verdict, without feeding anything.
    pub fn is_silent(&self) -> bool {
        self.zero_frames >= SILENCE_FRAMES
    }

    /// How long the current run of exact zeros is, in frames.
    pub fn zero_frames(&self) -> u64 {
        self.zero_frames
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::BLOCK_FRAMES;

    fn zeros() -> Vec<f32> {
        vec![0.0; BLOCK_FRAMES as usize * CHANNELS as usize]
    }

    fn quiet_music() -> Vec<f32> {
        // −120 dBFS: far below anything the fase 0 floor saw (−104 dB rel. al
        // pico, which on those vectors is about −130 dBFS), and still not
        // silence. A threshold detector would call this a dead cable.
        vec![1e-6; BLOCK_FRAMES as usize * CHANNELS as usize]
    }

    #[test]
    fn one_second_of_exact_zeros_is_no_audio() {
        let mut detector = SilenceDetector::new();
        // 33.3 bloques a second, so the 34th is the one that crosses.
        for _ in 0..33 {
            assert!(!detector.observe(&zeros()));
        }
        assert!(detector.observe(&zeros()));
    }

    #[test]
    fn a_very_quiet_sound_is_never_no_audio() {
        let mut detector = SilenceDetector::new();
        for _ in 0..200 {
            assert!(!detector.observe(&quiet_music()));
        }
    }

    #[test]
    fn one_sample_of_audio_starts_the_second_again() {
        let mut detector = SilenceDetector::new();
        for _ in 0..40 {
            detector.observe(&zeros());
        }
        assert!(detector.is_silent());

        let mut interrupted = zeros();
        interrupted[0] = 0.1;
        assert!(!detector.observe(&interrupted));

        // And the count restarts from the samples after that one, not from zero
        // bloques: what came after it really was silent.
        assert_eq!(detector.zero_frames(), u64::from(BLOCK_FRAMES) - 1);
    }

    #[test]
    fn negative_zero_is_still_silence() {
        let mut detector = SilenceDetector::new();
        let block = vec![-0.0f32; BLOCK_FRAMES as usize * CHANNELS as usize];
        for _ in 0..34 {
            detector.observe(&block);
        }
        assert!(detector.is_silent());
    }
}

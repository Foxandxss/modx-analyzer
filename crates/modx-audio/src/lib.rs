//! Opening `Line (MODX)`, keeping the ring buffer, shipping raw f32 bloques.
//!
//! Per ADR-0001 this crate only captures: no analysis lives here. It cuts the
//! device callbacks into bloques of 1 323 stereo frames, stamps each with a
//! sequence number and a monotonic timestamp, keeps the last three seconds of
//! channel 0 so that MEDIR can look backwards, and says when the audio is exact
//! digital zeros. Everything past that is TypeScript in a Web Worker.
//!
//! [`capture`] is the piece that touches the sound card and it is verified by
//! measurement, not by test — ten minutes idle and ten minutes under dense notes,
//! written down in `docs/results`. What sits either side of it is pure and tested:
//! the framing ([`block`]), the silence rule ([`silence`]) and the ring
//! ([`ring`]). A bloque that is one frame short or a sequence that skips would be
//! invisible on screen and would poison every latency number of the session, so
//! those three have tests and the cable does not.
//!
//! ```no_run
//! use modx_audio::Capture;
//!
//! let (capture, blocks) = Capture::open()?;
//! println!("{} a {} Hz", capture.device().name, capture.device().sample_rate);
//! for block in blocks {
//!     // Straight out to the worker; nothing here looks at the samples.
//!     let _bytes = block.encode();
//! }
//! # Ok::<(), modx_audio::CaptureError>(())
//! ```
#![forbid(unsafe_code)]

pub mod block;
pub mod capture;
pub mod ring;
pub mod silence;

pub use block::{
    AudioBlock, BlockAssembler, CallbackStats, BLOCK_FRAMES, CALLBACKS_PER_BLOCK, CALLBACK_FRAMES,
    CHANNELS, FLAG_SILENT, HEADER_BYTES, SAMPLE_RATE,
};
pub use capture::{Capture, CaptureError, CaptureStats, DeviceInfo, DEVICE_NAME};
pub use ring::{MonoRing, RING_SAMPLES};
pub use silence::{SilenceDetector, SILENCE_FRAMES};

//! The only thing in this crate that touches the sound card.
//!
//! Like `modx-midi`'s `hardware`, it has no test seam and it is not faked: it is
//! one of the two places the project verifies by measurement instead of by test
//! (ADR-0001). What is here is deliberately thin — find `Line (MODX)` by name,
//! open it, cut what arrives into bloques and push them at whoever is listening —
//! so that everything worth testing lives in [`crate::block`], [`crate::silence`]
//! and [`crate::ring`].
//!
//! The stream lives on a thread of its own because `cpal::Stream` is `!Send`: it
//! cannot be handed to Tauri's managed state, and it must be dropped on the thread
//! that built it. That thread does nothing but hold the stream open and wait to be
//! told to stop.

use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{BufferSize, Device, SampleFormat, SampleRate, StreamConfig};

use crate::block::{AudioBlock, BlockAssembler, CHANNELS, FLAG_SILENT, SAMPLE_RATE};
use crate::ring::MonoRing;
use crate::silence::SilenceDetector;

/// The one device the MODX publishes over WASAPI. The assignable pairs do not
/// appear at all and the stereo pair that does is the Main L/R (fase 0 §1–§3).
pub const DEVICE_NAME: &str = "Line (MODX)";

/// How long the stream thread sleeps between checks that it should still be alive.
const PARK: Duration = Duration::from_millis(200);

#[derive(Debug, thiserror::Error)]
pub enum CaptureError {
    #[error("no hay ningún dispositivo de entrada llamado `{0}`")]
    NotFound(String),
    #[error("`{device}` no ofrece 2 canales a 44 100 Hz en f32")]
    Unsupported { device: String },
    #[error("no se pudo abrir `{device}`: {reason}")]
    Open { device: String, reason: String },
}

/// What the device says it is, once it is open. It reaches the header, which is
/// why it carries the name the device reported rather than the one asked for.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeviceInfo {
    pub name: String,
    pub sample_rate: u32,
    pub channels: u16,
}

/// What the bridge has done so far. Everything a test could assert on is asserted
/// on in [`crate::block`]; these are the numbers the dev readout shows while the
/// ten-minute runs happen.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct CaptureStats {
    pub callbacks: u64,
    pub min_callback_frames: u32,
    pub max_callback_frames: u32,
    pub blocks: u64,
    /// Exact digital zeros for a second. See [`crate::silence`].
    pub silent: bool,
}

/// The state the audio thread writes and everybody else reads.
#[derive(Debug, Default)]
struct Shared {
    ring: Mutex<MonoRing>,
    callbacks: AtomicU64,
    min_callback_frames: AtomicU32,
    max_callback_frames: AtomicU32,
    blocks: AtomicU64,
    silent: AtomicBool,
}

/// An open capture of `Line (MODX)`. Dropping it closes the stream.
pub struct Capture {
    device: DeviceInfo,
    shared: Arc<Shared>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl Capture {
    /// Open `Line (MODX)` and start delivering bloques.
    ///
    /// The receiver is unbounded on purpose: a bloque dropped inside the process
    /// would show up in the worker's gap counter as if the IPC had lost it, and
    /// then the go/no-go of ADR-0001 would be measuring the wrong thing.
    pub fn open() -> Result<(Self, Receiver<AudioBlock>), CaptureError> {
        let (blocks_sender, blocks) = mpsc::channel();
        let (ready_sender, ready) = mpsc::channel();
        let shared = Arc::new(Shared::default());
        let stop = Arc::new(AtomicBool::new(false));

        let thread_shared = Arc::clone(&shared);
        let thread_stop = Arc::clone(&stop);
        let thread = thread::Builder::new()
            .name("modx-audio".into())
            .spawn(move || hold_stream(thread_shared, thread_stop, blocks_sender, ready_sender))
            .map_err(|error| CaptureError::Open {
                device: DEVICE_NAME.into(),
                reason: error.to_string(),
            })?;

        let device = ready.recv().map_err(|_| CaptureError::Open {
            device: DEVICE_NAME.into(),
            reason: "el hilo del audio murió al abrir".into(),
        })??;

        Ok((
            Self {
                device,
                shared,
                stop,
                thread: Some(thread),
            },
            blocks,
        ))
    }

    pub fn device(&self) -> &DeviceInfo {
        &self.device
    }

    pub fn stats(&self) -> CaptureStats {
        CaptureStats {
            callbacks: self.shared.callbacks.load(Ordering::Relaxed),
            min_callback_frames: self.shared.min_callback_frames.load(Ordering::Relaxed),
            max_callback_frames: self.shared.max_callback_frames.load(Ordering::Relaxed),
            blocks: self.shared.blocks.load(Ordering::Relaxed),
            silent: self.shared.silent.load(Ordering::Relaxed),
        }
    }

    /// The most recent `len` samples of channel 0, oldest first, or `None` when
    /// the ring has not filled that far yet. This is what MEDIR will take its
    /// 65 536 from (#10).
    pub fn tail(&self, len: usize) -> Option<Vec<f32>> {
        self.shared.ring.lock().ok()?.tail(len)
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            thread.thread().unpark();
            let _ = thread.join();
        }
    }
}

/// The body of the audio thread: build the stream, say whether it worked, and then
/// exist only so that the stream is not dropped.
fn hold_stream(
    shared: Arc<Shared>,
    stop: Arc<AtomicBool>,
    blocks: Sender<AudioBlock>,
    ready: Sender<Result<DeviceInfo, CaptureError>>,
) {
    let stream = match build_stream(&shared, blocks) {
        Ok((stream, device)) => match stream.play() {
            Ok(()) => {
                let _ = ready.send(Ok(device));
                stream
            }
            Err(error) => {
                let _ = ready.send(Err(CaptureError::Open {
                    device: device.name,
                    reason: error.to_string(),
                }));
                return;
            }
        },
        Err(error) => {
            let _ = ready.send(Err(error));
            return;
        }
    };

    while !stop.load(Ordering::Relaxed) {
        thread::park_timeout(PARK);
    }

    drop(stream);
}

fn build_stream(
    shared: &Arc<Shared>,
    blocks: Sender<AudioBlock>,
) -> Result<(cpal::Stream, DeviceInfo), CaptureError> {
    let device = find_device()?;
    let name = device.name().unwrap_or_else(|_| DEVICE_NAME.to_owned());

    if !supports_the_only_format(&device) {
        return Err(CaptureError::Unsupported { device: name });
    }

    let config = StreamConfig {
        channels: CHANNELS,
        sample_rate: SampleRate(SAMPLE_RATE),
        // `Default` is what fase 0 measured: WASAPI shared mode handed over 441
        // frames every time, and asking for a size is how that stops being true.
        buffer_size: BufferSize::Default,
    };

    // The clock the whole bridge is timed against: monotonic, counted from before
    // the first callback, so `sent_at_micros` is a duration and never a wall clock.
    let started = Instant::now();
    let mut assembler = BlockAssembler::new();
    let mut silence = SilenceDetector::new();
    let callback_shared = Arc::clone(shared);

    let stream = device
        .build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let now = started.elapsed().as_micros() as u64;

                if let Ok(mut ring) = callback_shared.ring.lock() {
                    ring.push_interleaved(data);
                }

                assembler.push(data, now, |mut block| {
                    if silence.observe(&block.samples) {
                        block.flags |= FLAG_SILENT;
                    }
                    callback_shared
                        .silent
                        .store(block.is_silent(), Ordering::Relaxed);
                    callback_shared.blocks.fetch_add(1, Ordering::Relaxed);
                    let _ = blocks.send(block);
                });

                let stats = assembler.callback_stats();
                callback_shared
                    .callbacks
                    .store(stats.callbacks, Ordering::Relaxed);
                callback_shared
                    .min_callback_frames
                    .store(stats.min_frames, Ordering::Relaxed);
                callback_shared
                    .max_callback_frames
                    .store(stats.max_frames, Ordering::Relaxed);
            },
            |error| {
                // There is nowhere useful to send this from inside cpal's error
                // callback, and it must not panic the audio thread. The count of
                // bloques stopping is what shows up on screen.
                eprintln!("modx-audio: {error}");
            },
            None,
        )
        .map_err(|error| CaptureError::Open {
            device: name.clone(),
            reason: error.to_string(),
        })?;

    Ok((
        stream,
        DeviceInfo {
            name,
            sample_rate: SAMPLE_RATE,
            channels: CHANNELS,
        },
    ))
}

/// By name, never by «the default input device»: the default is whatever Windows
/// last decided, and a spectrum of the laptop's microphone looks plausible.
fn find_device() -> Result<Device, CaptureError> {
    let host = cpal::default_host();
    let devices = host.input_devices().map_err(|error| CaptureError::Open {
        device: DEVICE_NAME.into(),
        reason: error.to_string(),
    })?;

    devices
        .into_iter()
        .find(|device| device.name().is_ok_and(|name| name.contains(DEVICE_NAME)))
        .ok_or_else(|| CaptureError::NotFound(DEVICE_NAME.into()))
}

/// 2 ch, 44 100 Hz, f32 — the only thing `Line (MODX)` publishes, checked rather
/// than assumed so that a different device that answered to the name fails loudly.
fn supports_the_only_format(device: &Device) -> bool {
    let Ok(configs) = device.supported_input_configs() else {
        return false;
    };

    configs.into_iter().any(|config| {
        config.channels() == CHANNELS
            && config.sample_format() == SampleFormat::F32
            && config.min_sample_rate().0 <= SAMPLE_RATE
            && config.max_sample_rate().0 >= SAMPLE_RATE
    })
}

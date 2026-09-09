//! The seam. Everything above it is tested; below it there is exactly one
//! implementation that touches the cable, and it is verified by measurement.

use std::time::Duration;

use thiserror::Error;

/// 100 ms. Measured margin: the worst Parameter Request round trip under dense
/// notes was 22.6 ms over 27 000 requests with zero losses, so this is 4.4×. 50 ms
/// also worked; 100 ms costs the same and survives a worse spike (fase 0c).
pub const REPLY_TIMEOUT: Duration = Duration::from_millis(100);

/// The name of the port that both directions live on. `MODX-2` and `MODX-3`
/// received no bytes in 345 s of listening.
pub const PORT_NAME: &str = "MODX-1";

#[derive(Debug, Error)]
pub enum PortError {
    /// The port is gone from enumeration, which is one of the two roads to
    /// `DESCONECTADO` (the other is three ancla timeouts in a row).
    #[error("port {0} is not in the enumeration")]
    NotFound(String),
    #[error("could not open {port}: {reason}")]
    Open { port: String, reason: String },
    #[error("could not send: {0}")]
    Send(String),
    /// The owner thread died. Nothing recovers from this but a restart.
    #[error("the port owner is gone")]
    OwnerGone,
}

/// Both directions of one MIDI port, owned by one caller at a time.
///
/// Windows gives the input direction exclusively, which is the reason a single
/// task owns it (ADR-0004) and the reason this trait is `&mut self` throughout.
pub trait MidiPort {
    /// Put one message on the wire. The MODX never acknowledges: it applies and
    /// says nothing, so a successful send proves only that the driver took it.
    fn send(&mut self, message: &[u8]) -> Result<(), PortError>;

    /// The next message from the keyboard, or `None` when `timeout` ran out first.
    ///
    /// Everything arrives here, including the ~125 clock messages a second the
    /// MODX sends even in silence: it is the caller's job to hand what it did not
    /// ask for to the note tracker rather than drop it.
    fn recv(&mut self, timeout: Duration) -> Result<Option<Vec<u8>>, PortError>;
}

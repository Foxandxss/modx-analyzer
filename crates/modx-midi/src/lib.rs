//! Everything the app says to the MODX and everything it hears back.
//!
//! One task owns both directions of the `MODX-1` port and serves everybody else in
//! a fixed order — pánico, escritura-y-verificación, ancla, anillo ancho, anillo
//! estrecho (ADR-0004). Everything above [`port::MidiPort`] is tested against
//! [`fake::FakeModx`], which reproduces the quirks that were measured on the real
//! keyboard; the one thing not covered is [`hardware::HardwarePort`], which is
//! verified by measurement.
//!
//! ```no_run
//! use modx_midi::{hardware::HardwarePort, owner::OwnerHandle};
//!
//! let owner = OwnerHandle::spawn(HardwarePort::open()?, |live| println!("{live} vivas"));
//! let silenced = owner.panic()?;
//! # Ok::<(), modx_midi::port::PortError>(())
//! ```
#![forbid(unsafe_code)]

pub mod fake;
pub mod hardware;
pub mod notes;
pub mod owner;
pub mod panic;
pub mod port;
pub mod read;
pub mod sysex;
pub mod verify;

pub use notes::NoteTracker;
pub use owner::{OwnerHandle, PortOwner, Priority, Request, RequestQueue, Served};
pub use port::{MidiPort, PortError, PORT_NAME, REPLY_TIMEOUT};
pub use sysex::Address;
pub use verify::{VerifiedWrite, WriteState};

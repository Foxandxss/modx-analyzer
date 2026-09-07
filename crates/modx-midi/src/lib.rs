//! Everything the app says to the MODX and everything it hears back.
//!
//! One task owns both directions of the `MODX-1` port and serves everybody else in
//! a fixed order — pánico, escritura-y-verificación, ancla, anillo ancho, anillo
//! estrecho (ADR-0004). Everything above [`port::MidiPort`] is tested against
//! [`fake::FakeModx`], which reproduces the quirks that were measured on the real
//! keyboard; the one thing not covered is [`hardware::HardwarePort`], which is
//! verified by measurement. What the keyboard's addresses *are* is not measured at
//! all but transcribed, so [`table`] carries the procedencia of every entry and is
//! the only thing allowed to say that an address exists (ADR-0003).
//!
//! ```no_run
//! use modx_midi::{hardware::HardwarePort, owner::OwnerHandle};
//!
//! let owner = OwnerHandle::spawn(HardwarePort::open()?, |live| println!("{} vivas", live.count));
//! let silenced = owner.panic()?;
//! # Ok::<(), modx_midi::port::PortError>(())
//! ```
#![forbid(unsafe_code)]

pub mod algorithms;
pub mod anchor;
pub mod dump;
pub mod fake;
pub mod hardware;
pub mod link;
pub mod notes;
pub mod owner;
pub mod panic;
pub mod port;
pub mod read;
pub mod ring;
pub mod sysex;
pub mod table;
pub mod verify;

pub use algorithms::{Feedback, Role, Topology};
pub use anchor::{Anchor, Beat, Progress, Reread};
pub use dump::Dump;
pub use link::{Link, LinkWatch, Loss, INCOMPLETE_FOR_DISCONNECTION};
pub use notes::NoteTracker;
pub use owner::{LiveNotes, OwnerHandle, PortOwner, Priority, Request, RequestQueue, Served};
pub use port::{MidiPort, PortError, PORT_NAME, REPLY_TIMEOUT};
pub use ring::WideRing;
pub use sysex::Address;
pub use table::{Access, Entry, Provenance};
pub use verify::{VerifiedWrite, WriteState};

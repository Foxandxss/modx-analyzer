//! Everything the app says to the MODX and everything it hears back.
//!
//! The crate owns both directions of the `MODX-1` port behind a port trait, so the
//! fake MODX can stand in for the keyboard in every test (ADR-0004). Nothing here
//! yet: the port trait, the fake, the scheduler, the note tracker and the pánico
//! arrive with the pánico ticket. This file exists so the workspace has the shape
//! the session works in.
#![forbid(unsafe_code)]

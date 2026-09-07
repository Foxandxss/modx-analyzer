//! Opening `Line (MODX)`, keeping the ring buffer, shipping raw f32 bloques.
//!
//! Per ADR-0001 this crate only captures: no analysis lives here, and it has no
//! test seam — it is verified by measurement (ten minutes idle, ten minutes under
//! dense notes). Empty until the audio bridge ticket.
#![forbid(unsafe_code)]

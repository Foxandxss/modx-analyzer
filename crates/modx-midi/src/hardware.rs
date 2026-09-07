//! The only thing in this crate that touches the cable.
//!
//! It has no test seam and it is not faked: Tauri's IPC and `midir`'s connection
//! are the two places the project verifies by measurement instead of by test. What
//! is here is deliberately thin — enumerate, open both directions, push what
//! arrives into a queue — so that everything worth testing lives above it.
//!
//! `midir`'s default backend on Windows is WinMM, the same one the fase 0c
//! measurements were taken on (2.0 ms median round trip, 0 losses in 27 000
//! requests). Changing that backend invalidates those numbers.

use std::sync::mpsc::{channel, Receiver, RecvTimeoutError};
use std::time::Duration;

use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};

use crate::port::{MidiPort, PortError, PORT_NAME};

/// The name `midir` reports the app under.
const CLIENT: &str = "modx-analyzer";

/// Both directions of the real `MODX-1`.
pub struct HardwarePort {
    output: MidiOutputConnection,
    incoming: Receiver<Vec<u8>>,
    /// Held so the callback keeps running; dropping it closes the input.
    _input: MidiInputConnection<()>,
}

impl HardwarePort {
    /// Enumerate, find `MODX-1` and open it in both directions.
    ///
    /// `MODX-2` and `MODX-3` are not opened: in 345 s of listening they received
    /// no bytes, and what they are for was never investigated.
    pub fn open() -> Result<Self, PortError> {
        let mut input = MidiInput::new(CLIENT).map_err(|error| PortError::Open {
            port: PORT_NAME.into(),
            reason: error.to_string(),
        })?;
        // Without this `midir` drops SysEx on the floor, which is every reply the
        // app is waiting for.
        input.ignore(Ignore::None);

        let input_ports = input.ports();
        let input_port = input_ports
            .iter()
            .find(|port| {
                input
                    .port_name(port)
                    .is_ok_and(|name| name.contains(PORT_NAME))
            })
            .ok_or_else(|| PortError::NotFound(PORT_NAME.into()))?;

        let output = MidiOutput::new(CLIENT).map_err(|error| PortError::Open {
            port: PORT_NAME.into(),
            reason: error.to_string(),
        })?;
        let output_ports = output.ports();
        let output_port = output_ports
            .iter()
            .find(|port| {
                output
                    .port_name(port)
                    .is_ok_and(|name| name.contains(PORT_NAME))
            })
            .ok_or_else(|| PortError::NotFound(PORT_NAME.into()))?;

        let (sender, incoming) = channel();
        let input_connection = input
            .connect(
                input_port,
                "modx-in",
                move |_stamp, message, ()| {
                    // The timestamp is dropped on purpose: `midir` counts it from
                    // when the port was opened, which is what made fase 0b report
                    // 14-21 ms for a round trip that is really 2 ms.
                    let _ = sender.send(message.to_vec());
                },
                (),
            )
            .map_err(|error| PortError::Open {
                port: PORT_NAME.into(),
                reason: error.to_string(),
            })?;

        let output = output
            .connect(output_port, "modx-out")
            .map_err(|error| PortError::Open {
                port: PORT_NAME.into(),
                reason: error.to_string(),
            })?;

        Ok(Self {
            output,
            incoming,
            _input: input_connection,
        })
    }

    /// Whether `MODX-1` is in the enumeration at all. Its absence is one of the two
    /// roads to `DESCONECTADO`; the other is three ancla timeouts in a row.
    pub fn is_present() -> bool {
        MidiOutput::new(CLIENT).is_ok_and(|output| {
            output.ports().iter().any(|port| {
                output
                    .port_name(port)
                    .is_ok_and(|name| name.contains(PORT_NAME))
            })
        })
    }
}

impl MidiPort for HardwarePort {
    fn send(&mut self, message: &[u8]) -> Result<(), PortError> {
        self.output
            .send(message)
            .map_err(|error| PortError::Send(error.to_string()))
    }

    fn recv(&mut self, timeout: Duration) -> Result<Option<Vec<u8>>, PortError> {
        match self.incoming.recv_timeout(timeout) {
            Ok(message) => Ok(Some(message)),
            Err(RecvTimeoutError::Timeout) => Ok(None),
            Err(RecvTimeoutError::Disconnected) => Err(PortError::NotFound(PORT_NAME.into())),
        }
    }
}

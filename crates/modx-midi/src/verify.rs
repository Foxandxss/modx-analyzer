//! Escritura verificada: `pendiente → releída → confirmada | fallida`.
//!
//! The MODX applies a write and says nothing. Worse, a write of the wrong data
//! length changes nothing and *also* says nothing (aviso 3 of fase 0c), and one
//! address at least takes the write and keeps its value. So there is no such thing
//! here as a write that was sent: there are writes that were reread and writes that
//! are not to be drawn as good.
//!
//! Nothing in this session's UI reaches this primitive — phase 1 session 1 writes
//! no parameters. It exists, with its tests, because the tickets that do write
//! start from here and because the fake can only be trusted about the silent no-op
//! if something exercises it.

use std::time::Duration;

use crate::port::{MidiPort, PortError};
use crate::read::read_parameter;
use crate::sysex::{self, Address};

/// Where one write has got to.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum WriteState {
    /// Built, not yet on the wire.
    Pending,
    /// On the wire, waiting for the reread that will say whether it landed.
    Reread,
    /// Reread, and the keyboard holds what was asked for.
    Confirmed,
    /// Reread, and it does not. Both halves are kept: a failure that does not say
    /// what came back instead is a failure nobody can act on.
    Failed {
        expected: Vec<u8>,
        /// What the keyboard answered, or `None` when it answered nothing at all.
        found: Option<Vec<u8>>,
    },
}

impl WriteState {
    pub fn is_confirmed(&self) -> bool {
        matches!(self, WriteState::Confirmed)
    }
}

/// One write, from built to resolved.
#[derive(Clone, Debug)]
pub struct VerifiedWrite {
    address: Address,
    expected: Vec<u8>,
    state: WriteState,
}

impl VerifiedWrite {
    pub fn new(address: Address, expected: &[u8]) -> Self {
        Self {
            address,
            expected: expected.to_vec(),
            state: WriteState::Pending,
        }
    }

    pub fn address(&self) -> Address {
        self.address
    }

    pub fn state(&self) -> &WriteState {
        &self.state
    }

    /// Put the Parameter Change on the wire. `pendiente → releída`: the name says
    /// what is owed next, not what has happened.
    pub fn send(&mut self, port: &mut impl MidiPort) -> Result<(), PortError> {
        port.send(&sysex::parameter_change(self.address, &self.expected))?;
        self.state = WriteState::Reread;
        Ok(())
    }

    /// Read the address back and settle the write.
    ///
    /// `traffic` gets every message that was not the answer, so the note tracker
    /// keeps counting while a write resolves.
    pub fn resolve(
        &mut self,
        port: &mut impl MidiPort,
        timeout: Duration,
        traffic: &mut dyn FnMut(&[u8]),
    ) -> Result<&WriteState, PortError> {
        let found = read_parameter(port, self.address, timeout, traffic)?;
        self.state = if found.as_deref() == Some(self.expected.as_slice()) {
            WriteState::Confirmed
        } else {
            WriteState::Failed {
                expected: self.expected.clone(),
                found,
            }
        };
        Ok(&self.state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake::FakeModx;
    use crate::port::REPLY_TIMEOUT;

    const ALGORITHM: Address = Address::new(0x48, 0x00, 0x4F);
    const SUPER_KNOB: Address = Address::new(0x30, 0x4B, 0x00);

    fn run(fake: &mut FakeModx, write: &mut VerifiedWrite) -> WriteState {
        assert_eq!(write.state(), &WriteState::Pending);
        write.send(fake).expect("the fake takes anything");
        assert_eq!(write.state(), &WriteState::Reread);
        write
            .resolve(fake, REPLY_TIMEOUT, &mut |_| {})
            .expect("the fake answers")
            .clone()
    }

    #[test]
    fn confirms_a_write_that_landed() {
        let mut fake = FakeModx::init_normal_fmx();
        let mut write = VerifiedWrite::new(ALGORITHM, &[0x05]);

        assert_eq!(run(&mut fake, &mut write), WriteState::Confirmed);
        assert_eq!(fake.value(ALGORITHM), Some([0x05].as_slice()));
    }

    #[test]
    fn fails_on_the_silent_no_op_of_the_wrong_data_length() {
        let mut fake = FakeModx::init_normal_fmx();
        // Two bytes to a one-byte parameter: no error, no change, no complaint.
        let mut write = VerifiedWrite::new(ALGORITHM, &[0x00, 0x05]);

        assert_eq!(
            run(&mut fake, &mut write),
            WriteState::Failed {
                expected: vec![0x00, 0x05],
                found: Some(vec![0x01]),
            }
        );
    }

    #[test]
    fn fails_on_the_read_only_address() {
        let mut fake = FakeModx::init_normal_fmx();
        let mut write = VerifiedWrite::new(SUPER_KNOB, &[0x40]);

        assert_eq!(
            run(&mut fake, &mut write),
            WriteState::Failed {
                expected: vec![0x40],
                found: Some(vec![0x00]),
            }
        );
    }

    #[test]
    fn fails_when_the_keyboard_says_nothing_back() {
        let mut fake = FakeModx::init_normal_fmx();
        let mut write = VerifiedWrite::new(ALGORITHM, &[0x05]);

        write.send(&mut fake).unwrap();
        fake.swallow_next_requests(1);

        assert_eq!(
            write
                .resolve(&mut fake, Duration::from_millis(5), &mut |_| {})
                .unwrap(),
            &WriteState::Failed {
                expected: vec![0x05],
                found: None,
            }
        );
    }

    #[test]
    fn a_saturated_write_is_not_a_confirmed_write() {
        let mut fake = FakeModx::init_normal_fmx();
        // 88 algorithms, so `58` is the first invalid one and the keyboard clamps.
        let mut write = VerifiedWrite::new(ALGORITHM, &[0x58]);

        assert_eq!(
            run(&mut fake, &mut write),
            WriteState::Failed {
                expected: vec![0x58],
                found: Some(vec![0x57]),
            }
        );
    }
}

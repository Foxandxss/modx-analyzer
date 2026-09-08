//! El barrido: one operator block asked offset by offset, and nothing written.
//!
//! Two questions this answers and nothing else in the app can, both of them #16's:
//!
//! 1. **Does `am = (op << 4) | part` hold past Part 1?** The rule was measured in
//!    fase 0b on the Part 1 and on the Part 1 only. Everything the app draws is
//!    addressed with it, so «it also works for Part 2» is today an assumption
//!    sitting under the whole table. A sweep of the same operator on two Parts of
//!    a Performance that has both is what turns it into a reading.
//! 2. **Which offsets of `49 op` actually answer?** The Data List gives `2A` as
//!    five reserved bytes, leaving 39; the fase 0c blind sweep counted 43 and
//!    could not name four of them ([`crate::table::OPERATOR`]). The two cannot
//!    both be true and only the keyboard can say which is.
//!
//! So the sweep asks **every `al` of the block, one at a time**, rather than the
//! offsets the table names. Asking the table's own list would make the answer
//! agree with the table by construction, which is exactly the thing under
//! suspicion; and a two-byte parameter answering its whole field from its first
//! address means a request for its second byte is a request for something that is
//! not a parameter — whether the keyboard answers one is a fact worth having.
//!
//! **Nothing here can write.** The only way in is a closure that reads, so «the
//! sweep wrote nothing» is a property of the signature and not of a promise; the
//! ticket's «no parameter written during the sweep» is enforced by not having the
//! ability. It is read-only in the strong sense: it does not even ask the port
//! owner for a [`crate::owner::Request::Write`], so no lane, no timing and no
//! failure of it can turn into one.

use crate::port::PortError;
use crate::sysex::{self, Address};
use crate::table::{self, Entry};

/// One offset of the block, and what came back when it was asked for.
#[derive(Clone, Debug)]
pub struct Offset {
    /// The `al` byte, which is what the Data List's own table is indexed by.
    pub al: u8,
    /// The whole terna, so a line of the readout can be copied next to the
    /// keyboard's own documentation without doing arithmetic first.
    pub address: Address,
    /// The data field exactly as it came off the wire. `None` is a timeout: the
    /// offset did not answer, which is the interesting half of the result.
    pub data: Option<Vec<u8>>,
}

impl Offset {
    /// Whether the keyboard answered here at all.
    pub fn answered(&self) -> bool {
        self.data.is_some()
    }

    /// The decoded value, when there is one. Multibyte fields decode as
    /// `(b1 << 7) | b2`, the same rule as everywhere else.
    pub fn value(&self) -> Option<u32> {
        self.data.as_deref().and_then(sysex::decode_value)
    }

    /// The table entry that owns this offset — the one that starts here, or the
    /// multibyte one that swallowed it. `None` is an offset the table does not
    /// account for, and those are the four the contradiction is about.
    pub fn entry(&self) -> Option<&'static Entry> {
        table::OPERATOR.owner_of(self.al)
    }
}

/// One pass over one operator of one Part.
#[derive(Clone, Debug)]
pub struct Sweep {
    /// 1-based, as the keyboard's own screen numbers them.
    pub part: u8,
    pub operator: u8,
    /// Every offset of the block, in `al` order, whether or not it answered.
    pub offsets: Vec<Offset>,
}

impl Sweep {
    /// How many offsets answered. The number the contradiction turns on: the Data
    /// List says 39 and the fase 0c sweep says 43.
    pub fn answered(&self) -> usize {
        self.offsets
            .iter()
            .filter(|offset| offset.answered())
            .count()
    }

    /// How many were asked for — the block's documented size, and not a constant
    /// written down here.
    pub fn total(&self) -> usize {
        self.offsets.len()
    }

    /// The offsets whose bytes differ from an earlier sweep of the same operator.
    ///
    /// This is how «one panel change in Part 2 lands at the predicted address»
    /// gets answered without anybody comparing 47 numbers by eye: sweep, change
    /// one value on the MODX's own panel, sweep again, and read off which offset
    /// moved. An offset that stopped answering, or started, counts as a change —
    /// it is news either way.
    ///
    /// Sweeps of two different operators or Parts are not comparable and come back
    /// empty rather than pretending: the addresses are not the same addresses.
    pub fn changes_from(&self, previous: &Sweep) -> Vec<u8> {
        if previous.part != self.part || previous.operator != self.operator {
            return Vec::new();
        }
        self.offsets
            .iter()
            .filter(|offset| {
                previous
                    .offsets
                    .iter()
                    .find(|before| before.al == offset.al)
                    .is_some_and(|before| before.data != offset.data)
            })
            .map(|offset| offset.al)
            .collect()
    }
}

/// How many offsets one sweep asks for: the operator block's documented size.
///
/// It comes from the table rather than being written here, so the readout's `DE n`
/// is the size the Data List gives and not a number invented on screen.
pub fn offsets() -> usize {
    usize::from(table::OPERATOR.size.expect("the operator block has a size"))
}

/// Ask every offset of one operator of one Part, one at a time.
///
/// `ask` is the port, in whoever's lane the caller is asking from. `on_progress`
/// is called once per offset with how far it has got: a sweep of a Part that does
/// not exist is 47 timeouts, which is nearly five seconds of nothing, and a count
/// that climbs is the difference between that and a window that looks hung.
pub fn sweep_operator<F>(
    part: u8,
    operator: u8,
    ask: &mut F,
    on_progress: &mut dyn FnMut(Progress),
) -> Result<Sweep, PortError>
where
    F: FnMut(Address) -> Result<Option<Vec<u8>>, PortError>,
{
    let total = offsets();
    let mut swept = Vec::with_capacity(total);
    let mut answered = 0;

    for al in 0..total {
        let address = Address::operator(operator, part, al as u8);
        let data = ask(address)?;
        if data.is_some() {
            answered += 1;
        }
        swept.push(Offset {
            al: al as u8,
            address,
            data,
        });
        on_progress(Progress {
            done: swept.len(),
            total,
            answered,
        });
    }

    Ok(Sweep {
        part,
        operator,
        offsets: swept,
    })
}

/// How far a sweep has got, offset by offset, as it goes.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Progress {
    pub done: usize,
    pub total: usize,
    pub answered: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake::FakeModx;
    use crate::owner::{PortOwner, Request, Served};
    use crate::sysex::AH_OPERATOR;

    /// The port, as the sweep sees it: reads and nothing else.
    fn asking(
        owner: &mut PortOwner<FakeModx>,
    ) -> impl FnMut(Address) -> Result<Option<Vec<u8>>, PortError> + '_ {
        move |address| match owner.serve(Request::Read(address))? {
            Served::Read { data, .. } => Ok(data),
            other => unreachable!("a read answers with data, not {other:?}"),
        }
    }

    fn sweep(owner: &mut PortOwner<FakeModx>, part: u8, operator: u8) -> Sweep {
        sweep_operator(part, operator, &mut asking(owner), &mut |_| {}).unwrap()
    }

    /// A keyboard with the user's Part 2 Performance loaded: Part 1 as it comes,
    /// and an FM-X Part 2 built from the same Init Normal (FM-X).
    fn with_part_two() -> FakeModx {
        let mut fake = FakeModx::init_normal_fmx();
        fake.load_fmx_part(2);
        fake
    }

    #[test]
    fn every_offset_of_the_block_is_asked_for_at_the_predicted_address() {
        let mut owner = PortOwner::new(with_part_two());

        let swept = sweep(&mut owner, 2, 3);

        assert_eq!(swept.total(), 47, "the block's own documented size");
        for (al, offset) in swept.offsets.iter().enumerate() {
            assert_eq!(
                offset.al, al as u8,
                "the offsets go in order and none is skipped"
            );
            assert_eq!(offset.address.ah, AH_OPERATOR);
            // `(op << 4) | part`, both base zero: Op3 of Part 2 is `am = 0x21`.
            assert_eq!(offset.address.am, 0x21, "at {}", offset.address);
            assert_eq!(offset.address.al, al as u8);
        }
    }

    #[test]
    fn a_sweep_writes_nothing_at_all() {
        let mut owner = PortOwner::new(with_part_two());

        sweep(&mut owner, 2, 1);

        // Not «no writes went out» but «these bytes went out and no others»: the
        // 47 Parameter Requests of the block, in order, and nothing else on the
        // wire at all. A Parameter Change would differ in one nibble, which is
        // exactly the kind of thing a count of messages would not catch.
        let expected: Vec<Vec<u8>> = (0..offsets())
            .map(|al| sysex::parameter_request(Address::operator(1, 2, al as u8)))
            .collect();
        assert_eq!(owner.port_mut().sent(), expected);
    }

    #[test]
    fn the_same_operator_answers_on_both_parts_when_the_performance_has_two() {
        let mut owner = PortOwner::new(with_part_two());

        let one = sweep(&mut owner, 1, 5);
        let two = sweep(&mut owner, 2, 5);

        assert_eq!(one.answered(), two.answered());
        for (first, second) in one.offsets.iter().zip(&two.offsets) {
            assert_eq!(
                first.data, second.data,
                "the two Parts disagree at {}",
                first.al
            );
        }
    }

    /// The other outcome, and the one the ticket says to record rather than work
    /// around: a Performance whose Part 2 is not FM-X answers nowhere, and the
    /// sweep says so instead of coming back with a plausible-looking table.
    #[test]
    fn a_part_that_is_not_there_answers_nowhere() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());

        let swept = sweep(&mut owner, 2, 1);

        assert_eq!(swept.answered(), 0);
        assert_eq!(swept.total(), 47);
        assert!(swept.offsets.iter().all(|offset| offset.value().is_none()));
    }

    /// **43 of 47, and the four silent ones are the tail of a parameter.**
    ///
    /// Measured on the MODX8 on 2026-09-08 (#16) and pinned here, because it is
    /// the answer to contradiction 1 of #6 and the fake now has to behave like
    /// the keyboard rather than like the Data List's parameter count:
    ///
    /// - `26`-`29` are silent. They are bytes 2 to 5 of `25`, the five-byte
    ///   `Controller Set 1-16 Element Switch`, and a multibyte parameter answers
    ///   its whole field from its first address.
    /// - `2B`-`2E` answer, with zero. They are not the tail of anything: `2A` is
    ///   five reserved **bytes**, which the Data List prints as one row and the
    ///   keyboard treats as five holes.
    ///
    /// So the fase 0c blind sweep's count of 43 was right and its note that it
    /// saw `2B`-`2E` «silent and consumed by `2A`» was wrong — it had the right
    /// number and the wrong four offsets.
    #[test]
    fn the_block_answers_at_43_of_its_47_and_the_silent_four_are_a_parameters_tail() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());

        let swept = sweep(&mut owner, 1, 1);

        assert_eq!(swept.answered(), 43);

        for al in [0x26, 0x27, 0x28, 0x29] {
            assert!(
                !swept.offsets[al].answered(),
                "{al:02X} is the tail of the five-byte 25 and answers nowhere"
            );
        }
        for al in [0x2B, 0x2C, 0x2D, 0x2E] {
            assert!(
                swept.offsets[al].answered(),
                "{al:02X} is one of the five reserved bytes at 2A and answers on its own"
            );
        }
    }

    #[test]
    fn a_value_changed_on_the_panel_shows_up_as_the_offset_that_moved() {
        let mut owner = PortOwner::new(with_part_two());
        let before = sweep(&mut owner, 2, 4);

        // Somebody turns the Operator Level of Op4 on the MODX's own panel.
        owner.port_mut().set(Address::operator(4, 2, 0x1A), &[0x40]);
        let after = sweep(&mut owner, 2, 4);

        assert_eq!(after.changes_from(&before), vec![0x1A]);
        assert_eq!(after.offsets[0x1A].value(), Some(0x40));
    }

    #[test]
    fn two_sweeps_of_different_operators_are_not_compared() {
        let mut owner = PortOwner::new(with_part_two());

        let one = sweep(&mut owner, 2, 1);
        let two = sweep(&mut owner, 2, 2);

        assert!(two.changes_from(&one).is_empty());
    }

    #[test]
    fn the_count_climbs_once_per_offset() {
        let mut owner = PortOwner::new(with_part_two());
        let mut seen = Vec::new();

        let swept = sweep_operator(2, 6, &mut asking(&mut owner), &mut |progress| {
            seen.push(progress)
        })
        .unwrap();

        assert_eq!(seen.len(), swept.total());
        assert_eq!(seen.first().unwrap().done, 1);
        assert_eq!(seen.last().unwrap().done, swept.total());
        assert_eq!(seen.last().unwrap().answered, swept.answered());
    }
}

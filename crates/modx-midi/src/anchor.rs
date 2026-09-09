//! El ancla: the Part 1 name, and the only way to know the sound changed.
//!
//! Loading another Performance emits **zero bytes** — measured twice, in fase 0d
//! and 0e, in raw mode, with `Bank Select` and `Pgm Change` on and the Part name
//! verified before and after the window. There is no event to listen for, so the
//! app asks: twenty ASCII addresses (`31 0p 00`-`13`, ~40 ms) once a second.
//!
//! **A name with a hole in it is not a new name.** This is the whole reason this
//! type exists instead of a call to [`crate::owner::OwnerHandle::part_name`],
//! which fills a timed-out byte with a blank so a volcado can always be filed. A
//! blank in the ancla's mouth is a different sentence: `Init Normal (FM-X)` with
//! one letter missing reads as a different name, and a different name invalidates
//! every figure on the screen and throws away the medida. So an incomplete pass
//! is its own answer and is compared with nothing.
//!
//! The hole it cannot close is a real one and is documented rather than hidden:
//! two Performances whose Part 1 shares a name are, to the ancla, the same
//! Performance. Widening it would mean mapping the Performance name in the `0x30`
//! block, which is a task for a session with the keyboard in front of you.

use crate::port::PortError;
use crate::sysex::{self, Address};
use crate::table;

/// What one pass of the ancla found.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Beat {
    /// The same name as last time. The overwhelming majority of passes.
    Same,
    /// The first complete name of the session. Not a change: nothing preceded it,
    /// so nothing of a previous patch is on screen to invalidate.
    First(String),
    /// The Performance was changed underneath. Everything polled belongs to
    /// `previous` and has to lose its number.
    Changed { name: String, previous: String },
    /// At least one of the twenty did not answer. Compared with nothing, so it
    /// can neither confirm nor deny a change — the app keeps what it had.
    Incomplete,
}

/// The twenty addresses, the last complete name, and how many times it moved.
pub struct Anchor {
    addresses: Vec<Address>,
    name: Option<String>,
    changes: u32,
    /// Passes in a row that came back with a hole. Three of them is what
    /// `DESCONECTADO` is defined as; one is anomalous but is not news.
    incomplete_in_a_row: u32,
}

impl Anchor {
    pub fn new(part: u8) -> Self {
        Self {
            addresses: table::anchor(part),
            name: None,
            changes: 0,
            incomplete_in_a_row: 0,
        }
    }

    /// The twenty addresses, in reading order.
    pub fn addresses(&self) -> &[Address] {
        &self.addresses
    }

    /// The last complete name, or `None` before the first whole pass.
    pub fn name(&self) -> Option<&str> {
        self.name.as_deref()
    }

    /// How many times the Performance has changed underneath since launch. It is
    /// **not** the number of passes and it does not count the first name: the
    /// front watches it to know when to invalidate, and a launch invalidates
    /// nothing.
    pub fn changes(&self) -> u32 {
        self.changes
    }

    /// Passes in a row that came back with a hole in the name.
    ///
    /// Three of them is [`crate::link::INCOMPLETE_FOR_DISCONNECTION`]. The ancla
    /// counts them and does nothing with them: what a count means is the link's
    /// question, not the name's.
    pub fn incomplete_in_a_row(&self) -> u32 {
        self.incomplete_in_a_row
    }

    /// Forget the timeouts, keep the name.
    ///
    /// `REINTENTAR` threw the port away and opened another one, so the passes
    /// that did not come back belong to a connection that no longer exists;
    /// counting them against the new one would put the disconnected card straight
    /// back over a keyboard that is answering. The **name** is deliberately kept:
    /// reopening a port does not load another Performance, and forgetting it
    /// would make the next whole pass read as a change and take the whole screen
    /// to dashes for nothing.
    pub fn rearm(&mut self) {
        self.incomplete_in_a_row = 0;
    }

    /// Ask the twenty once and say what that means.
    ///
    /// `ask` is the port, in the ancla's own lane: the ancla keeps its slot ahead
    /// of both rings (ADR-0004), because the moment it loses it is the moment the
    /// app starts lying about which sound it is describing.
    pub fn beat<F>(&mut self, ask: &mut F) -> Result<Beat, PortError>
    where
        F: FnMut(Address) -> Result<Option<Vec<u8>>, PortError>,
    {
        let mut letters = Vec::with_capacity(self.addresses.len());
        for address in &self.addresses {
            letters.push(ask(*address)?);
        }

        if letters.iter().any(Option::is_none) {
            self.incomplete_in_a_row += 1;
            return Ok(Beat::Incomplete);
        }
        self.incomplete_in_a_row = 0;

        let read = table::anchor_name(&letters);
        match self.name.replace(read.clone()) {
            None => Ok(Beat::First(read)),
            Some(previous) if previous == read => Ok(Beat::Same),
            Some(previous) => {
                self.changes += 1;
                Ok(Beat::Changed {
                    name: read,
                    previous,
                })
            }
        }
    }
}

/// How long the app spends reading the whole patch, and what it got.
///
/// `answered` against `total` is the figure the fase 0c sweep put at 415 of 416:
/// it is reported rather than assumed, because an address that stops answering is
/// news and a relectura that silently read 380 of 384 would hide it.
#[derive(Clone, Debug)]
pub struct Reread {
    pub total: usize,
    pub answered: usize,
    /// Every address and what it said, in reading order. Nothing consumes it this
    /// session — the diagram is fed by the anillo ancho, which refills itself in
    /// ~84 ms — but a relectura that threw its answers away would have to be
    /// written again the day the snapshot exists.
    pub values: Vec<(Address, Option<u32>)>,
}

/// How far a relectura has got, address by address, as it goes.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Progress {
    pub done: usize,
    pub total: usize,
    pub answered: usize,
}

/// How many addresses a relectura of this Part goes through. What the strip
/// counts against, and it is asked for rather than written down anywhere else.
pub fn reread_total(part: u8) -> usize {
    table::patch_addresses(part).len()
}

/// Read the whole patch, one parameter at a time, saying how far it has got.
///
/// `on_progress` is called once per address; the caller decides how often that is
/// worth telling anybody about. Reporting every one and letting whoever is
/// listening thin it out is the way round that keeps the thinning where the cost
/// of an event is known — here it would be a constant invented in the wrong file.
pub fn reread<F>(
    part: u8,
    ask: &mut F,
    on_progress: &mut dyn FnMut(Progress),
) -> Result<Reread, PortError>
where
    F: FnMut(Address) -> Result<Option<Vec<u8>>, PortError>,
{
    let addresses = table::patch_addresses(part);
    let total = addresses.len();
    let mut values = Vec::with_capacity(total);
    let mut answered = 0;

    for (done, address) in addresses.into_iter().enumerate() {
        let value = ask(address)?.as_deref().and_then(sysex::decode_value);
        if value.is_some() {
            answered += 1;
        }
        values.push((address, value));
        on_progress(Progress {
            done: done + 1,
            total,
            answered,
        });
    }

    Ok(Reread {
        total,
        answered,
        values,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake::FakeModx;
    use crate::owner::{PortOwner, Request, Served};
    use crate::port::MidiPort;

    /// The port, as the ancla and the relectura see it.
    fn asking(
        owner: &mut PortOwner<FakeModx>,
    ) -> impl FnMut(Address) -> Result<Option<Vec<u8>>, PortError> + '_ {
        move |address| match owner.serve(Request::Read(address))? {
            Served::Read { data, .. } => Ok(data),
            other => unreachable!("a read answers with data, not {other:?}"),
        }
    }

    #[test]
    fn the_first_whole_name_is_not_a_change() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut anchor = Anchor::new(1);

        let first = anchor.beat(&mut asking(&mut owner)).unwrap();

        assert_eq!(first, Beat::First("Init Normal (FM-X)".into()));
        assert_eq!(anchor.changes(), 0, "a launch invalidated something");
        assert_eq!(anchor.beat(&mut asking(&mut owner)).unwrap(), Beat::Same);
    }

    #[test]
    fn a_performance_loaded_underneath_is_caught_without_a_single_byte_arriving() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut anchor = Anchor::new(1);
        anchor.beat(&mut asking(&mut owner)).unwrap();

        // Somebody loads another sound on the panel. The keyboard says nothing.
        let mark = owner.port_mut().mark();
        owner.port_mut().load_performance("Bright FM Keys");
        assert!(
            owner
                .port_mut()
                .recv(std::time::Duration::ZERO)
                .unwrap()
                .is_none(),
            "the fake announced a Performance change; the MODX does not",
        );
        let _ = mark;

        assert_eq!(
            anchor.beat(&mut asking(&mut owner)).unwrap(),
            Beat::Changed {
                name: "Bright FM Keys".into(),
                previous: "Init Normal (FM-X)".into(),
            },
        );
        assert_eq!(anchor.changes(), 1);
    }

    #[test]
    fn a_name_with_a_hole_in_it_is_not_a_new_name() {
        let mut fake = FakeModx::init_normal_fmx();
        // The two first letters go missing on the next pass.
        fake.swallow_next_requests(2);
        let mut owner = PortOwner::new(fake);
        let mut anchor = Anchor::new(1);

        let held = anchor.beat(&mut asking(&mut owner)).unwrap();

        // `part_name` would have called this «  it Normal (FM-X)» and the whole
        // screen would have gone to dashes over two lost bytes.
        assert_eq!(held, Beat::Incomplete);
        assert_eq!(anchor.changes(), 0);
        assert_eq!(anchor.name(), None);
        assert_eq!(anchor.incomplete_in_a_row(), 1);

        // And the next whole pass is the first name, not a change.
        assert_eq!(
            anchor.beat(&mut asking(&mut owner)).unwrap(),
            Beat::First("Init Normal (FM-X)".into()),
        );
        assert_eq!(anchor.incomplete_in_a_row(), 0);
    }

    /// The one condition the ancla has to survive: somebody is playing, so every
    /// read costs ~10 ms instead of ~2, and the anillo ancho is asking for
    /// forty-two addresses over and over at the same time. If the ancla loses its
    /// slot here it loses it exactly when the app is most likely to be lied to,
    /// because playing is when patches get changed.
    #[test]
    fn keeps_its_slot_with_the_wide_ring_hammering_under_notes() {
        use crate::fake::Latency;
        use crate::owner::{OwnerHandle, Priority};
        use crate::table;
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;

        let mut fake = FakeModx::init_normal_fmx();
        fake.set_latency(Latency::NotesPlaying);
        let owner = Arc::new(OwnerHandle::spawn(fake, |_| {}));

        // Two threads doing what the anillo ancho does: never stopping.
        let stop = Arc::new(AtomicBool::new(false));
        let ring: Vec<_> = (0..2)
            .map(|_| {
                let owner = Arc::clone(&owner);
                let stop = Arc::clone(&stop);
                std::thread::spawn(move || {
                    let mut served = 0usize;
                    while !stop.load(Ordering::Relaxed) {
                        for polled in table::wide_ring(1) {
                            if owner.read(Priority::WideRing, polled.address).is_ok() {
                                served += 1;
                            }
                            if stop.load(Ordering::Relaxed) {
                                break;
                            }
                        }
                    }
                    served
                })
            })
            .collect();

        let mut anchor = Anchor::new(1);
        let started = std::time::Instant::now();
        let beat = anchor
            .beat(&mut |address| owner.read(Priority::Anchor, address))
            .unwrap();
        let took = started.elapsed();

        stop.store(true, Ordering::Relaxed);
        let ring_reads: usize = ring.into_iter().map(|thread| thread.join().unwrap()).sum();

        assert_eq!(beat, Beat::First("Init Normal (FM-X)".into()));
        assert!(ring_reads > 0, "the ring was not actually competing");
        // Twenty reads at the fake's «notes playing» latency is ~200 ms with the
        // odd worst case on top. A whole second is the ancla's own period: taking
        // longer than that would mean the rings had pushed it off its cadence.
        assert!(
            took < std::time::Duration::from_secs(1),
            "the ancla lost its slot under notes: one pass took {took:?}",
        );
    }

    #[test]
    fn the_relectura_reads_the_whole_patch_and_says_how_far_it_got() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut seen = Vec::new();

        let read = reread(1, &mut asking(&mut owner), &mut |step| seen.push(step)).unwrap();

        // The count the strip draws: one per parameter of `48 0p` and the eight
        // `49 op`. The design sheet said 416 before session 2 — see
        // `table::patch_addresses`.
        assert_eq!(read.total, reread_total(1));
        assert_eq!(read.answered, read.total, "the fake answered everything");
        assert_eq!(seen.len(), read.total, "a step went unreported");
        assert_eq!(seen.first().map(|step| step.done), Some(1));
        assert_eq!(seen.last().map(|step| step.done), Some(read.total));
        assert_eq!(seen.last().map(|step| step.answered), Some(read.answered));

        // And the values are the patch: `Init Normal (FM-X)` is algorithm 2, so
        // the byte reads one less than the keyboard's own screen says.
        let algorithm = read
            .values
            .iter()
            .find(|(address, _)| *address == Address::new(0x48, 0x00, 0x4F))
            .expect("the algorithm is part of the patch");
        assert_eq!(algorithm.1, Some(1));
    }

    #[test]
    fn a_relectura_counts_what_did_not_answer_instead_of_pretending_it_did() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.swallow_next_requests(3);
        let mut owner = PortOwner::new(fake);

        let read = reread(1, &mut asking(&mut owner), &mut |_| {}).unwrap();

        assert_eq!(read.answered, read.total - 3);
        assert_eq!(
            read.values
                .iter()
                .filter(|(_, value)| value.is_none())
                .count(),
            3
        );
    }
}

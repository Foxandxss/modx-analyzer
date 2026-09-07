//! The one owner of the port, and the fixed order it serves people in.
//!
//! On Windows the input direction of a MIDI port is exclusive: there cannot be two
//! owners. So one task holds both directions and everything else asks it (ADR-0004).
//! Under contention the order is fixed and not round-robin, because round-robin
//! would let the narrow ring starve the ancla exactly while someone is playing —
//! which is when latency goes from 2 ms to 10 ms and the worst possible moment to
//! stop knowing whether the patch has been changed underneath.
//!
//! The note tracker lives here too. It is not a second listener: it is fed from the
//! messages this loop already has to step over to find its replies.
//!
//! One request is served to the end before the next is looked at, so the priority
//! order decides who goes *next* and not who gets interrupted. Every request but
//! one costs a round trip — 2 ms idle, 24 ms at its worst under notes. The one is
//! the volcado, which holds the port for as long as the keyboard takes to send
//! 7,7 KB, and is therefore also the longest a pánico can ever wait: `dump::DEADLINE`.

use std::sync::mpsc::{sync_channel, Receiver, RecvTimeoutError, SyncSender, TrySendError};
use std::thread::JoinHandle;
use std::time::Duration;

use crate::dump::{self, Dump};
use crate::notes::NoteTracker;
use crate::panic;
use crate::port::{MidiPort, PortError, REPLY_TIMEOUT};
use crate::read::read_parameter;
use crate::sysex::Address;
use crate::table;
use crate::verify::{VerifiedWrite, WriteState};

/// Who gets the channel when more than one wants it. Lower is served first, and
/// `derive(Ord)` follows declaration order, so the list *is* the priority.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum Priority {
    /// Always first, and it does not wait for a reply.
    Panic,
    /// A write is worth nothing until it is reread, so it keeps the channel.
    Write,
    /// The volcado de seguridad. It goes behind the write only because splitting a
    /// write from its relectura is worse; it goes in front of everything that
    /// polls because nothing that polls is a precondition of anything.
    Dump,
    /// 1 Hz, and it keeps its slot under notes: without it the app starts lying.
    Anchor,
    /// The 42 addresses behind the operator diagram.
    WideRing,
    /// The 43 of the open operator. It has no consumer this session.
    NarrowRing,
}

/// The number of lanes, one per [`Priority`].
const LANES: usize = 6;

/// One thing to do with the port.
#[derive(Clone, Debug)]
pub enum Request {
    /// All Sound Off, All Notes Off and 2 048 Note Offs. Touches no parameter.
    Panic,
    Read(Address),
    Write {
        address: Address,
        data: Vec<u8>,
    },
    /// A bulk dump of one address, normally [`dump::EDIT_BUFFER`]. It is the one
    /// request that can hold the port for seconds.
    Dump(Address),
}

/// What came of serving one request.
#[derive(Clone, Debug)]
pub enum Served {
    /// How many notas vivas the pánico silenced, counted before it went out.
    Silenced(usize),
    /// `None` is a timeout, which is anomalous but is not a disconnection.
    Read {
        address: Address,
        data: Option<Vec<u8>>,
    },
    Written {
        address: Address,
        state: WriteState,
    },
    /// The bytes the keyboard sent, however many that was. An empty one is a
    /// keyboard that said nothing; a short one is a keyboard that stopped early.
    Dumped(Dump),
}

/// Requests waiting for the port, kept in strict priority order.
#[derive(Debug, Default)]
pub struct RequestQueue {
    lanes: [Vec<Request>; LANES],
}

impl RequestQueue {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, priority: Priority, request: Request) {
        self.lanes[priority as usize].push(request);
    }

    /// The most urgent request waiting, and its lane. Within a lane, in order.
    pub fn pop(&mut self) -> Option<(Priority, Request)> {
        for (lane, priority) in [
            Priority::Panic,
            Priority::Write,
            Priority::Dump,
            Priority::Anchor,
            Priority::WideRing,
            Priority::NarrowRing,
        ]
        .into_iter()
        .enumerate()
        {
            if !self.lanes[lane].is_empty() {
                return Some((priority, self.lanes[lane].remove(0)));
            }
        }
        None
    }

    pub fn len(&self) -> usize {
        self.lanes.iter().map(Vec::len).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// The port, the note tracker and the rule about who goes first.
pub struct PortOwner<P: MidiPort> {
    port: P,
    tracker: NoteTracker,
    timeout: Duration,
}

impl<P: MidiPort> PortOwner<P> {
    pub fn new(port: P) -> Self {
        Self {
            port,
            tracker: NoteTracker::new(),
            timeout: REPLY_TIMEOUT,
        }
    }

    pub fn tracker(&self) -> &NoteTracker {
        &self.tracker
    }

    /// The keyboard underneath, for a test that needs to press a key on it.
    pub fn port_mut(&mut self) -> &mut P {
        &mut self.port
    }

    /// Serve the most urgent request waiting, or `None` when nothing is.
    pub fn serve_next(&mut self, queue: &mut RequestQueue) -> Option<Result<Served, PortError>> {
        let (_, request) = queue.pop()?;
        Some(self.serve(request))
    }

    /// Serve one request now, ignoring the queue. Used by the pánico's own path.
    pub fn serve(&mut self, request: Request) -> Result<Served, PortError> {
        match request {
            Request::Panic => self.panic().map(Served::Silenced),
            Request::Read(address) => {
                let tracker = &mut self.tracker;
                let data = read_parameter(&mut self.port, address, self.timeout, &mut |message| {
                    tracker.observe(message);
                })?;
                Ok(Served::Read { address, data })
            }
            Request::Write { address, data } => {
                let mut write = VerifiedWrite::new(address, &data);
                write.send(&mut self.port)?;
                let tracker = &mut self.tracker;
                let state = write
                    .resolve(&mut self.port, self.timeout, &mut |message| {
                        tracker.observe(message);
                    })?
                    .clone();
                Ok(Served::Written { address, state })
            }
            Request::Dump(address) => {
                let tracker = &mut self.tracker;
                let taken = dump::take(
                    &mut self.port,
                    address,
                    dump::QUIET,
                    dump::DEADLINE,
                    &mut |message| {
                        tracker.observe(message);
                    },
                )?;
                Ok(Served::Dumped(taken))
            }
        }
    }

    /// Silence the keyboard. Returns the notas vivas that were held when it went
    /// out, which is the number the notice says out loud.
    ///
    /// It waits for no reply — the MODX does not answer channel messages — so the
    /// 2 080 messages go out back to back, the way the 0-pause bulk restore of
    /// fase 0c did without losing a byte.
    pub fn panic(&mut self) -> Result<usize, PortError> {
        let silenced = self.tracker.silenced();
        for message in panic::messages() {
            self.port.send(&message)?;
        }
        Ok(silenced)
    }

    /// Listen for `patience` with nothing to ask, so the note tracker keeps
    /// counting while the app is idle. Returns whether the live count changed.
    pub fn drain(&mut self, patience: Duration) -> Result<bool, PortError> {
        let mut changed = false;
        while let Some(message) = self.port.recv(patience)? {
            changed |= self.tracker.observe(&message);
        }
        Ok(changed)
    }
}

/// What the owner thread is asked to do, and where the answer goes.
struct Job {
    request: Request,
    answer: SyncSender<Result<Served, PortError>>,
}

/// A running owner: the thread, and the only way to talk to it.
pub struct OwnerHandle {
    /// `None` only while the handle is being dropped: closing the channel is what
    /// tells the thread to stop.
    jobs: Option<SyncSender<Job>>,
    thread: Option<JoinHandle<()>>,
}

/// How long the loop listens to the keyboard when nobody has asked for anything.
/// Short enough that a pánico never waits behind it.
const IDLE_PATIENCE: Duration = Duration::from_millis(5);

impl OwnerHandle {
    /// Start the owner on its own thread. `on_live_notes` is called with the new
    /// count every time it changes — and only then, so the front is not woken by
    /// the clock 125 times a second.
    pub fn spawn<P, F>(port: P, mut on_live_notes: F) -> Self
    where
        P: MidiPort + Send + 'static,
        F: FnMut(usize) + Send + 'static,
    {
        // Capacity 1 per lane's worth of urgency: the sender blocks rather than
        // letting a backlog build up behind the port.
        let (jobs, incoming) = sync_channel::<Job>(LANES * 8);

        let thread = std::thread::Builder::new()
            .name("modx-port-owner".into())
            .spawn(move || run_owner(port, incoming, &mut on_live_notes))
            .expect("the owner thread is the app");

        Self {
            jobs: Some(jobs),
            thread: Some(thread),
        }
    }

    /// Ask the owner for something and wait for what came of it.
    pub fn request(&self, request: Request) -> Result<Served, PortError> {
        let jobs = self.jobs.as_ref().ok_or(PortError::OwnerGone)?;
        let (answer, reply) = sync_channel(1);
        match jobs.try_send(Job { request, answer }) {
            Ok(()) => {}
            Err(TrySendError::Full(job)) => jobs.send(job).map_err(|_| PortError::OwnerGone)?,
            Err(TrySendError::Disconnected(_)) => return Err(PortError::OwnerGone),
        }
        reply.recv().map_err(|_| PortError::OwnerGone)?
    }

    /// The pánico, from anywhere, including the error states.
    pub fn panic(&self) -> Result<usize, PortError> {
        match self.request(Request::Panic)? {
            Served::Silenced(notes) => Ok(notes),
            other => unreachable!("a pánico answers with what it silenced, not {other:?}"),
        }
    }

    /// The volcado de seguridad of the edit buffer.
    ///
    /// It holds the port for as long as the keyboard takes to send it, so a pánico
    /// asked for while it is running waits behind it — bounded by [`dump::DEADLINE`]
    /// and stated there.
    pub fn dump(&self, address: Address) -> Result<Dump, PortError> {
        match self.request(Request::Dump(address))? {
            Served::Dumped(taken) => Ok(taken),
            other => unreachable!("a volcado answers with bytes, not {other:?}"),
        }
    }

    /// The Part name, read one address at a time off the ancla's twenty.
    ///
    /// A read that timed out leaves a blank rather than a wrong letter, so the
    /// answer is always a name and never an error — which is what the volcado
    /// needs, because a dump that cannot be named still has to be saved.
    pub fn part_name(&self, part: u8) -> Result<String, PortError> {
        let mut replies = Vec::with_capacity(usize::from(table::PART_NAME_BYTES));
        for address in table::anchor(part) {
            match self.request(Request::Read(address))? {
                Served::Read { data, .. } => replies.push(data),
                other => unreachable!("a read answers with data, not {other:?}"),
            }
        }
        Ok(table::anchor_name(&replies))
    }
}

impl Drop for OwnerHandle {
    fn drop(&mut self) {
        // Dropping the sender ends the loop; the join keeps the port from being
        // closed underneath a send that is already on its way.
        self.jobs = None;
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn run_owner<P: MidiPort>(port: P, incoming: Receiver<Job>, on_live_notes: &mut dyn FnMut(usize)) {
    let mut owner = PortOwner::new(port);
    let mut reported = 0;

    loop {
        match incoming.recv_timeout(IDLE_PATIENCE) {
            Ok(job) => {
                let served = owner.serve(job.request);
                // The answer going nowhere is normal: the asker may have given up.
                let _ = job.answer.try_send(served);
            }
            Err(RecvTimeoutError::Timeout) => {
                // Nobody wants the port, so spend the time listening: this is where
                // the note tracker learns what the hands are doing.
                let _ = owner.drain(IDLE_PATIENCE);
            }
            Err(RecvTimeoutError::Disconnected) => return,
        }

        // Only when it moved: the clock alone would wake the front 125 times a
        // second with the same number.
        let live = owner.tracker().live_notes();
        if live != reported {
            reported = live;
            on_live_notes(live);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake::{FakeModx, Latency};
    use crate::sysex;

    const ALGORITHM: Address = Address::new(0x48, 0x00, 0x4F);

    fn wide_ring_addresses() -> Vec<Address> {
        (1..=8).map(|op| Address::operator(op, 1, 0x1A)).collect()
    }

    #[test]
    fn serves_a_pending_panico_before_any_queued_read() {
        let mut fake = FakeModx::init_normal_fmx();
        // The condition that matters: someone is playing, so every read is slow and
        // the queue is the longest it ever gets.
        fake.set_latency(Latency::NotesPlaying);
        let mut owner = PortOwner::new(fake);

        let mut queue = RequestQueue::new();
        for address in wide_ring_addresses() {
            queue.push(Priority::WideRing, Request::Read(address));
        }

        // Three of the ring's reads go out first, so the queue is genuinely mid-pass.
        for _ in 0..3 {
            owner
                .serve_next(&mut queue)
                .expect("the ring is queued")
                .unwrap();
        }
        assert_eq!(queue.len(), 5);

        let mark = owner.port_mut().mark();
        queue.push(Priority::Panic, Request::Panic);
        owner
            .serve_next(&mut queue)
            .expect("something is queued")
            .unwrap();

        // What left the app next was the pánico, and not one of the five reads
        // that were already waiting.
        let after = owner.port_mut().sent_since(mark);
        assert_eq!(after.len(), panic::MESSAGE_COUNT);
        assert_eq!(after[0], vec![0xB0, 120, 0]);
        assert!(
            after.iter().all(|message| message[0] < 0xF0),
            "a read slipped in front of the pánico",
        );
        assert_eq!(queue.len(), 5);
    }

    #[test]
    fn keeps_the_anchor_ahead_of_both_rings() {
        let mut queue = RequestQueue::new();
        queue.push(
            Priority::NarrowRing,
            Request::Read(Address::new(0x49, 0x20, 0x01)),
        );
        queue.push(
            Priority::WideRing,
            Request::Read(Address::new(0x49, 0x20, 0x1A)),
        );
        queue.push(
            Priority::Anchor,
            Request::Read(Address::part(sysex::AH_PART, 1, 0x00)),
        );
        queue.push(Priority::Dump, Request::Dump(dump::EDIT_BUFFER));
        queue.push(Priority::Panic, Request::Panic);

        let order: Vec<Priority> = std::iter::from_fn(|| queue.pop())
            .map(|(priority, _)| priority)
            .collect();

        assert_eq!(
            order,
            vec![
                Priority::Panic,
                Priority::Dump,
                Priority::Anchor,
                Priority::WideRing,
                Priority::NarrowRing
            ]
        );
    }

    #[test]
    fn the_thread_brings_back_the_volcado_and_the_name_to_file_it_under() {
        let owner = OwnerHandle::spawn(FakeModx::init_normal_fmx(), |_| {});

        let taken = owner.dump(dump::EDIT_BUFFER).unwrap();

        assert_eq!(taken.messages, dump::DOCUMENTED_MESSAGES);
        assert_eq!(taken.bytes.len(), dump::DOCUMENTED_BYTES);
        assert_eq!(owner.part_name(1).unwrap(), "Init Normal (FM-X)");
    }

    #[test]
    fn names_the_part_with_blanks_where_the_keyboard_did_not_answer() {
        let mut fake = FakeModx::init_normal_fmx();
        // The first two letters go missing. The volcado still has to be filed.
        fake.swallow_next_requests(2);
        let owner = OwnerHandle::spawn(fake, |_| {});

        assert_eq!(owner.part_name(1).unwrap(), "  it Normal (FM-X)");
    }

    #[test]
    fn counts_the_notes_it_silenced_and_forgets_them() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.set_parts(4);
        fake.press(60, 100);
        fake.press(64, 100);
        let mut owner = PortOwner::new(fake);

        // The notes reach the tracker through the traffic of an ordinary read.
        owner.serve(Request::Read(ALGORITHM)).unwrap();
        assert_eq!(owner.tracker().live_notes(), 2);

        let silenced = owner.panic().unwrap();

        assert_eq!(silenced, 2);
        assert_eq!(owner.tracker().live_notes(), 0);
    }

    #[test]
    fn a_write_goes_out_and_comes_back_verified() {
        let fake = FakeModx::init_normal_fmx();
        let mut owner = PortOwner::new(fake);

        let served = owner
            .serve(Request::Write {
                address: ALGORITHM,
                data: vec![0x05],
            })
            .unwrap();

        match served {
            Served::Written { state, .. } => assert!(state.is_confirmed()),
            other => panic!("expected a write, got {other:?}"),
        }
    }

    #[test]
    fn the_thread_silences_the_keyboard_and_says_how_many() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.press(60, 100);
        fake.press(64, 100);
        fake.press(67, 100);

        let (live_notes, seen) = std::sync::mpsc::channel();
        let owner = OwnerHandle::spawn(fake, move |count| {
            let _ = live_notes.send(count);
        });

        // The loop listens on its own while nobody is asking, so the chord reaches
        // the tracker without anything being read.
        let mut counted = 0;
        while let Ok(count) = seen.recv_timeout(Duration::from_secs(1)) {
            counted = count;
            if counted == 3 {
                break;
            }
        }
        assert_eq!(counted, 3);

        assert_eq!(owner.panic().unwrap(), 3);
    }

    #[test]
    fn a_read_through_the_thread_answers_with_the_data() {
        let owner = OwnerHandle::spawn(FakeModx::init_normal_fmx(), |_| {});

        match owner.request(Request::Read(ALGORITHM)).unwrap() {
            Served::Read { address, data } => {
                assert_eq!(address, ALGORITHM);
                assert_eq!(data, Some(vec![0x01]));
            }
            other => panic!("expected a read, got {other:?}"),
        }
    }

    #[test]
    fn steps_over_a_reply_that_is_not_the_one_it_asked_for() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.send(&sysex::parameter_request(Address::operator(3, 1, 0x1A)))
            .unwrap();
        let mut owner = PortOwner::new(fake);

        match owner.serve(Request::Read(ALGORITHM)).unwrap() {
            Served::Read { data, .. } => assert_eq!(data, Some(vec![0x01])),
            other => panic!("expected a read, got {other:?}"),
        }
    }
}

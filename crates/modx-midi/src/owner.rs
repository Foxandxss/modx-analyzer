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

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{
    sync_channel, Receiver, RecvTimeoutError, SyncSender, TryRecvError, TrySendError,
};
use std::sync::Arc;
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
    /// The note generator of the bridge measurement (#8), and nothing else.
    ///
    /// Last of everything, on purpose. It is a measuring instrument, so it must
    /// not change what it measures beyond the load itself: a generator served
    /// ahead of the ancla would be loading an app that never runs. Its own
    /// starvation is therefore a **result** and not a fault, which is why what it
    /// asked for and what actually went out are counted separately.
    Generator,
}

/// The number of lanes, one per [`Priority`].
const LANES: usize = 7;

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
    /// Channel messages, sent back to back with nothing to wait for.
    ///
    /// There are exactly **two** senders of channel messages in this session and
    /// both live in this crate: the pánico ([`Request::Panic`]) and the note
    /// generator. That sentence is in the results document, and it is what makes
    /// «the keyboard was sent these notes and nothing else» a fact rather than a
    /// hope — which is why the only public way in fixes the lane as well as the
    /// content (see [`OwnerHandle::send_notes`]).
    Channel(Vec<Vec<u8>>),
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
    /// How many channel messages the port took. Counted at the port and not at
    /// the caller: a load that is not counted is a load that was assumed.
    Sent(usize),
}

/// Things waiting for the port, kept in strict priority order.
///
/// It is generic over what is waiting because the queue is used twice with the
/// same rule: over bare [`Request`]s by a caller driving the owner itself, and
/// over the owner thread's jobs, which are a request plus the channel its answer
/// goes back down. One rule, one place.
#[derive(Debug)]
pub struct Lanes<T> {
    lanes: [Vec<T>; LANES],
}

/// The queue as a caller driving a [`PortOwner`] by hand sees it.
pub type RequestQueue = Lanes<Request>;

impl<T> Default for Lanes<T> {
    fn default() -> Self {
        Self {
            lanes: std::array::from_fn(|_| Vec::new()),
        }
    }
}

impl<T> Lanes<T> {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, priority: Priority, request: T) {
        self.lanes[priority as usize].push(request);
    }

    /// The most urgent thing waiting, and its lane. Within a lane, in order.
    pub fn pop(&mut self) -> Option<(Priority, T)> {
        for (lane, priority) in [
            Priority::Panic,
            Priority::Write,
            Priority::Dump,
            Priority::Anchor,
            Priority::WideRing,
            Priority::NarrowRing,
            Priority::Generator,
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
            // Nothing to wait for: the MODX does not answer channel messages, so
            // they go out back to back the way the pánico's 2 080 do.
            Request::Channel(messages) => {
                let mut sent = 0;
                for message in &messages {
                    self.port.send(message)?;
                    sent += 1;
                }
                Ok(Served::Sent(sent))
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
    priority: Priority,
    request: Request,
    answer: SyncSender<Result<Served, PortError>>,
}

/// The keyboard's hands, as the front needs them: how many pitches are down and
/// which is the lowest.
///
/// The lowest is what the `TEORÍA` frequency line of every operator is computed
/// from. Under a chord any choice is arbitrary; the lowest is the one that does
/// not move when a chord is built upwards over a held bass, which is what makes
/// the eight numbers stand still while somebody plays.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct LiveNotes {
    pub count: usize,
    pub lowest: Option<u8>,
}

/// A running owner: the thread, and the only way to talk to it.
pub struct OwnerHandle {
    /// `None` only while the handle is being dropped: closing the channel is what
    /// tells the thread to stop.
    jobs: Option<SyncSender<Job>>,
    thread: Option<JoinHandle<()>>,
    /// The note tracker's count of channel messages, as of the loop's last turn.
    ///
    /// It is an atomic rather than an answer to a request because reading it must
    /// not cost a place in the queue: the readout asks once a second while the
    /// bridge measurement is running, and a question that had to wait behind the
    /// anillo would be measuring the queue instead of the traffic.
    traffic: Arc<AtomicU64>,
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
        F: FnMut(LiveNotes) + Send + 'static,
    {
        // Capacity 1 per lane's worth of urgency: the sender blocks rather than
        // letting a backlog build up behind the port.
        let (jobs, incoming) = sync_channel::<Job>(LANES * 8);

        let traffic = Arc::new(AtomicU64::new(0));
        let counted = Arc::clone(&traffic);
        let thread = std::thread::Builder::new()
            .name("modx-port-owner".into())
            .spawn(move || run_owner(port, incoming, &counted, &mut on_live_notes))
            .expect("the owner thread is the app");

        Self {
            jobs: Some(jobs),
            thread: Some(thread),
            traffic,
        }
    }

    /// Every channel message the keyboard has sent since the port opened, clock
    /// included.
    ///
    /// It is what makes the bridge measurement self-verifying: under real hands
    /// this climbs with the playing, and under the note generator it says whether
    /// the MODX echoes what it is told back to its own output — which nobody has
    /// checked, and which is exactly the kind of thing that must be counted rather
    /// than assumed.
    pub fn traffic(&self) -> u64 {
        self.traffic.load(Ordering::Acquire)
    }

    /// Send channel messages: the note generator's lane, and no other.
    ///
    /// The lane is fixed here rather than taken as an argument because the two
    /// senders of channel messages this session are the pánico and the generator,
    /// and the pánico has its own way in. A caller that could pick its own
    /// priority could put a note in front of the ancla.
    ///
    /// The count that comes back is what the **port** took, not what was asked
    /// for: an error stops the batch, and a batch that stopped is a load that did
    /// not happen.
    pub fn send_notes(&self, messages: Vec<Vec<u8>>) -> Result<usize, PortError> {
        if messages.is_empty() {
            return Ok(0);
        }
        match self.request(Priority::Generator, Request::Channel(messages))? {
            Served::Sent(sent) => Ok(sent),
            other => unreachable!("channel messages answer with a count, not {other:?}"),
        }
    }

    /// Ask the owner for something and wait for what came of it.
    ///
    /// The priority decides who goes *next* when more than one caller is waiting,
    /// not who gets interrupted: one request is always served to the end. It stops
    /// being decoration the moment something polls continuously — the anillo ancho
    /// asks 12 times a second forever, and without the lanes a pánico would queue
    /// behind whatever the ring had already handed over.
    pub fn request(&self, priority: Priority, request: Request) -> Result<Served, PortError> {
        let jobs = self.jobs.as_ref().ok_or(PortError::OwnerGone)?;
        let (answer, reply) = sync_channel(1);
        match jobs.try_send(Job {
            priority,
            request,
            answer,
        }) {
            Ok(()) => {}
            Err(TrySendError::Full(job)) => jobs.send(job).map_err(|_| PortError::OwnerGone)?,
            Err(TrySendError::Disconnected(_)) => return Err(PortError::OwnerGone),
        }
        reply.recv().map_err(|_| PortError::OwnerGone)?
    }

    /// The pánico, from anywhere, including the error states.
    pub fn panic(&self) -> Result<usize, PortError> {
        match self.request(Priority::Panic, Request::Panic)? {
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
        match self.request(Priority::Dump, Request::Dump(address))? {
            Served::Dumped(taken) => Ok(taken),
            other => unreachable!("a volcado answers with bytes, not {other:?}"),
        }
    }

    /// One address, in the lane of whoever is asking. `Ok(None)` is a timeout.
    pub fn read(&self, priority: Priority, address: Address) -> Result<Option<Vec<u8>>, PortError> {
        match self.request(priority, Request::Read(address))? {
            Served::Read { data, .. } => Ok(data),
            other => unreachable!("a read answers with data, not {other:?}"),
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
            replies.push(self.read(Priority::Anchor, address)?);
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

fn run_owner<P: MidiPort>(
    port: P,
    incoming: Receiver<Job>,
    traffic: &AtomicU64,
    on_live_notes: &mut dyn FnMut(LiveNotes),
) {
    let mut owner = PortOwner::new(port);
    let mut waiting: Lanes<Job> = Lanes::new();
    let mut reported = LiveNotes::default();

    loop {
        // Everything that has arrived goes into its lane before anything is
        // served, so the order the requests were *sent* in never decides who goes
        // first — the lane does.
        loop {
            match incoming.try_recv() {
                Ok(job) => waiting.push(job.priority, job),
                Err(TryRecvError::Empty) => break,
                // Every handle is gone. What is already queued is dropped: nobody
                // is left to receive an answer.
                Err(TryRecvError::Disconnected) => return,
            }
        }

        match waiting.pop() {
            Some((_, job)) => {
                let served = owner.serve(job.request);
                // The answer going nowhere is normal: the asker may have given up.
                let _ = job.answer.try_send(served);
            }
            None => match incoming.recv_timeout(IDLE_PATIENCE) {
                Ok(job) => waiting.push(job.priority, job),
                Err(RecvTimeoutError::Timeout) => {
                    // Nobody wants the port, so spend the time listening: this is
                    // where the note tracker learns what the hands are doing.
                    let _ = owner.drain(IDLE_PATIENCE);
                }
                Err(RecvTimeoutError::Disconnected) => return,
            },
        }

        // The traffic count is published every turn: it is a number nobody is
        // woken by, read only while the bridge is being measured.
        traffic.store(owner.tracker().traffic(), Ordering::Release);

        // Only when they moved: the clock alone would wake the front 125 times a
        // second with the same pair.
        let live = LiveNotes {
            count: owner.tracker().live_notes(),
            lowest: owner.tracker().live_pitches().next(),
        };
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
    fn serves_the_generator_after_everything_else() {
        let mut queue = RequestQueue::new();
        // The generator asks first and is served last: it is an instrument, and an
        // instrument that pushed the ancla aside would be measuring another app.
        queue.push(
            Priority::Generator,
            Request::Channel(vec![vec![0x90, 60, 100]]),
        );
        queue.push(
            Priority::NarrowRing,
            Request::Read(Address::new(0x49, 0x20, 0x01)),
        );
        queue.push(
            Priority::Anchor,
            Request::Read(Address::part(sysex::AH_PART, 1, 0x00)),
        );

        let order: Vec<Priority> = std::iter::from_fn(|| queue.pop())
            .map(|(priority, _)| priority)
            .collect();

        assert_eq!(
            order,
            vec![Priority::Anchor, Priority::NarrowRing, Priority::Generator]
        );
    }

    #[test]
    fn the_generators_notes_reach_the_port_as_they_were_written() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut generator = crate::generator::NoteGenerator::new();
        let mut asked: Vec<Vec<u8>> = Vec::new();

        let mark = owner.port_mut().mark();
        for _ in 0..6 {
            let step = generator.step();
            asked.extend(step.iter().cloned());
            match owner.serve(Request::Channel(step.clone())).unwrap() {
                Served::Sent(sent) => assert_eq!(sent, step.len()),
                other => panic!("expected a count, got {other:?}"),
            }
        }
        let goodbye = generator.shutdown();
        asked.extend(goodbye.iter().cloned());
        owner.serve(Request::Channel(goodbye)).unwrap();

        // Byte for byte and in order: the keyboard was sent the load and nothing
        // else, which is the sentence the results document has to be able to make.
        assert_eq!(owner.port_mut().sent_since(mark), asked.as_slice());
    }

    #[test]
    fn the_thread_says_how_many_notes_the_port_took() {
        let owner = OwnerHandle::spawn(FakeModx::init_normal_fmx(), |_| {});

        let sent = owner
            .send_notes(vec![vec![0x90, 60, 100], vec![0x80, 60, 0]])
            .unwrap();

        assert_eq!(sent, 2);
        // Nothing came back: the fake does not echo what it is told, so the
        // tracker's traffic stays where it was. What the real MODX does with a
        // generated note is unknown and is why both numbers are on screen.
        assert_eq!(owner.traffic(), 0);
    }

    #[test]
    fn the_thread_counts_the_traffic_the_keyboard_sends() {
        let mut fake = FakeModx::init_normal_fmx();
        fake.press(60, 100);
        fake.press(64, 100);
        fake.release(60);
        let owner = OwnerHandle::spawn(fake, |_| {});

        // The loop listens while nobody asks, so the three messages land on their
        // own; the count is what the bridge measurement writes down beside the
        // generator's.
        let deadline = std::time::Instant::now() + Duration::from_secs(1);
        while owner.traffic() < 3 && std::time::Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(5));
        }
        assert_eq!(owner.traffic(), 3);
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
        let owner = OwnerHandle::spawn(fake, move |live| {
            let _ = live_notes.send(live);
        });

        // The loop listens on its own while nobody is asking, so the chord reaches
        // the tracker without anything being read.
        let mut counted = LiveNotes::default();
        while let Ok(live) = seen.recv_timeout(Duration::from_secs(1)) {
            counted = live;
            if counted.count == 3 {
                break;
            }
        }
        assert_eq!(counted.count, 3);
        // And the lowest of the three, which is what every node's TEORÍA line is
        // computed from.
        assert_eq!(counted.lowest, Some(60));

        assert_eq!(owner.panic().unwrap(), 3);
    }

    #[test]
    fn a_read_through_the_thread_answers_with_the_data() {
        let owner = OwnerHandle::spawn(FakeModx::init_normal_fmx(), |_| {});

        match owner
            .request(Priority::WideRing, Request::Read(ALGORITHM))
            .unwrap()
        {
            Served::Read { address, data } => {
                assert_eq!(address, ALGORITHM);
                assert_eq!(data, Some(vec![0x01]));
            }
            other => panic!("expected a read, got {other:?}"),
        }
    }

    #[test]
    fn the_thread_serves_a_panico_ahead_of_the_reads_already_queued() {
        // The lanes only start to matter when more than one caller is waiting at
        // once, which is what the rings make normal. Eight reads are handed over
        // before the pánico is asked for; under a plain FIFO the pánico would be
        // ninth, which at 10 ms a read is most of a tenth of a second of a note
        // that will not stop.
        let mut fake = FakeModx::init_normal_fmx();
        fake.set_latency(Latency::NotesPlaying);
        let owner = std::sync::Arc::new(OwnerHandle::spawn(fake, |_| {}));

        let (finished, order) = std::sync::mpsc::channel::<&'static str>();
        let readers: Vec<_> = wide_ring_addresses()
            .into_iter()
            .map(|address| {
                let owner = std::sync::Arc::clone(&owner);
                let finished = finished.clone();
                std::thread::spawn(move || {
                    let _ = owner.read(Priority::WideRing, address);
                    let _ = finished.send("read");
                })
            })
            .collect();

        // Long enough for all eight to be in their lane, short enough that at most
        // one of them can have been served.
        std::thread::sleep(Duration::from_millis(5));
        owner.panic().unwrap();
        let _ = finished.send("panico");
        drop(finished);
        for reader in readers {
            reader.join().unwrap();
        }

        let served: Vec<&str> = order.into_iter().collect();
        let after = served
            .iter()
            .skip_while(|what| **what != "panico")
            .filter(|what| **what == "read")
            .count();
        assert!(
            after >= 5,
            "the pánico waited behind the ring: only {after} of 8 reads came after it",
        );
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

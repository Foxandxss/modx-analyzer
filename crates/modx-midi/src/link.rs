//! When the keyboard counts as `DESCONECTADO`, and when it does not.
//!
//! There are exactly two roads, and they are not the same fact:
//!
//! - **The port is gone from the enumeration.** `MODX-1` is not there, or another
//!   app has it open exclusively — on Windows the input direction of a MIDI port
//!   has one owner and that is the whole reason ADR-0004 exists. There is nothing
//!   to wait for, so this counts the moment it is seen.
//! - **Three ancla passes in a row came back with a hole.** One is already
//!   anomalous — fase 0c lost **0 replies in 27 000 requests** — but one is not a
//!   disconnection: a single timeout is what a busy keyboard looks like, and
//!   drawing the disconnected card over a chord would be the app crying wolf at
//!   exactly the moment somebody is playing.
//!
//! The rule is here, away from the thread that beats and from the window that
//! draws, because it is the one thing about a disconnection that is decidable
//! without a cable: what the ancla counts ([`crate::anchor::Anchor`]) and whether
//! the port is in the list ([`crate::hardware::HardwarePort::is_present`]) are
//! both facts somebody else measures.

/// Three ancla passes in a row with a hole in them.
///
/// The ancla beats at 1 Hz, and a pass that times out on all twenty addresses
/// costs twenty [`crate::port::REPLY_TIMEOUT`]s, so this is between three and six
/// seconds of not being answered before the card appears. The design's own
/// `ÚLTIMO SONDEO 4 s` sits inside that.
pub const INCOMPLETE_FOR_DISCONNECTION: u32 = 3;

/// Why the keyboard counts as gone. The card says the same thing either way; what
/// differs is whether `REINTENTAR` has anything to reopen.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Loss {
    /// `MODX-1` is not in the enumeration, or somebody else holds it.
    Enumeration,
    /// The port is there and the ancla asked three times without a whole answer.
    Timeouts,
}

impl Loss {
    /// The word that crosses to the front. Spanish is for the screen; the wire
    /// carries the same two identifiers the `PortLoss` type in the gateway has.
    pub fn as_str(self) -> &'static str {
        match self {
            Loss::Enumeration => "enumeration",
            Loss::Timeouts => "timeouts",
        }
    }
}

/// The state of the link to `MODX-1`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Link {
    Connected,
    Disconnected(Loss),
}

impl Link {
    pub fn is_connected(self) -> bool {
        self == Link::Connected
    }
}

/// The rule, holding the last thing it said so it only says it again on a change.
///
/// It starts knowing **nothing**: the first observation always reports, whichever
/// way it went, so the header is never left drawing the state the app opened with
/// after the watchdog has looked.
#[derive(Default, Debug)]
pub struct LinkWatch {
    link: Option<Link>,
}

impl LinkWatch {
    pub fn new() -> Self {
        Self::default()
    }

    /// What it last decided, or `None` before it has looked once.
    pub fn link(&self) -> Option<Link> {
        self.link
    }

    /// Feed it the two facts; get back the state **only when it changed**.
    ///
    /// Enumeration wins over the count: with no port in the list the timeouts are
    /// a consequence and not a second piece of news, and the card that offers to
    /// reopen is the one worth drawing.
    pub fn observe(&mut self, present: bool, incomplete_in_a_row: u32) -> Option<Link> {
        let now = if !present {
            Link::Disconnected(Loss::Enumeration)
        } else if incomplete_in_a_row >= INCOMPLETE_FOR_DISCONNECTION {
            Link::Disconnected(Loss::Timeouts)
        } else {
            Link::Connected
        };

        if self.link == Some(now) {
            return None;
        }
        self.link = Some(now);
        Some(now)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::anchor::{Anchor, Beat};
    use crate::fake::FakeModx;
    use crate::owner::{PortOwner, Request, Served};
    use crate::port::PortError;
    use crate::sysex::Address;

    fn asking(
        owner: &mut PortOwner<FakeModx>,
    ) -> impl FnMut(Address) -> Result<Option<Vec<u8>>, PortError> + '_ {
        move |address| match owner.serve(Request::Read(address))? {
            Served::Read { data, .. } => Ok(data),
            other => unreachable!("a read answers with data, not {other:?}"),
        }
    }

    #[test]
    fn the_first_look_always_says_something() {
        let mut watch = LinkWatch::new();

        assert_eq!(watch.observe(true, 0), Some(Link::Connected));
        // And then only when it moves.
        assert_eq!(watch.observe(true, 0), None);
        assert_eq!(watch.observe(true, 1), None);
    }

    #[test]
    fn a_port_missing_from_the_enumeration_is_a_disconnection_at_once() {
        let mut watch = LinkWatch::new();
        watch.observe(true, 0);

        // No three strikes: there is nothing to be patient about.
        assert_eq!(
            watch.observe(false, 0),
            Some(Link::Disconnected(Loss::Enumeration)),
        );
    }

    #[test]
    fn a_port_that_came_back_clears_the_state_on_its_own() {
        let mut watch = LinkWatch::new();
        watch.observe(false, 0);

        assert_eq!(watch.observe(true, 0), Some(Link::Connected));
    }

    /// The condition the whole rule exists for, driven through the fake: the
    /// ancla asking twenty addresses that do not all answer. Two passes with a
    /// hole are a keyboard that is busy; the third is a keyboard that is gone.
    #[test]
    fn three_ancla_passes_with_a_hole_are_a_disconnection_and_two_are_not() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut anchor = Anchor::new(1);
        let mut watch = LinkWatch::new();
        assert_eq!(
            watch.observe(true, anchor.incomplete_in_a_row()),
            Some(Link::Connected)
        );

        for pass in 1..=2 {
            // One letter of the name goes missing on this pass.
            owner.port_mut().swallow_next_requests(1);
            assert_eq!(
                anchor.beat(&mut asking(&mut owner)).unwrap(),
                Beat::Incomplete
            );
            assert_eq!(anchor.incomplete_in_a_row(), pass);
            assert_eq!(
                watch.observe(true, anchor.incomplete_in_a_row()),
                None,
                "pass {pass} of the ancla cried wolf",
            );
        }

        owner.port_mut().swallow_next_requests(1);
        assert_eq!(
            anchor.beat(&mut asking(&mut owner)).unwrap(),
            Beat::Incomplete
        );

        assert_eq!(
            watch.observe(true, anchor.incomplete_in_a_row()),
            Some(Link::Disconnected(Loss::Timeouts)),
        );
    }

    /// And the way out: the keyboard answers a whole name again, which is what
    /// `REINTENTAR` is trying to bring about and what happens on its own when the
    /// keyboard was only busy.
    #[test]
    fn one_whole_answer_puts_the_link_back() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut anchor = Anchor::new(1);
        let mut watch = LinkWatch::new();
        for _ in 0..INCOMPLETE_FOR_DISCONNECTION {
            owner.port_mut().swallow_next_requests(1);
            anchor.beat(&mut asking(&mut owner)).unwrap();
        }
        assert_eq!(
            watch.observe(true, anchor.incomplete_in_a_row()),
            Some(Link::Disconnected(Loss::Timeouts)),
        );

        assert_eq!(
            anchor.beat(&mut asking(&mut owner)).unwrap(),
            Beat::First("Init Normal (FM-X)".into()),
        );

        assert_eq!(
            watch.observe(true, anchor.incomplete_in_a_row()),
            Some(Link::Connected)
        );
    }

    /// The counter belongs to a connection, not to a keyboard: after `REINTENTAR`
    /// has thrown the port away and opened another one, three timeouts of the old
    /// one would put the card straight back over a link that is answering.
    #[test]
    fn rearming_forgets_the_timeouts_of_the_connection_that_is_gone() {
        let mut owner = PortOwner::new(FakeModx::init_normal_fmx());
        let mut anchor = Anchor::new(1);
        anchor.beat(&mut asking(&mut owner)).unwrap();
        for _ in 0..INCOMPLETE_FOR_DISCONNECTION {
            owner.port_mut().swallow_next_requests(1);
            anchor.beat(&mut asking(&mut owner)).unwrap();
        }
        assert_eq!(anchor.incomplete_in_a_row(), INCOMPLETE_FOR_DISCONNECTION);

        anchor.rearm();

        assert_eq!(anchor.incomplete_in_a_row(), 0);
        let mut watch = LinkWatch::new();
        assert_eq!(
            watch.observe(true, anchor.incomplete_in_a_row()),
            Some(Link::Connected)
        );
        // What it does **not** forget is the name: the patch on screen was read
        // before the cable went, and reopening a port does not load another sound.
        // If it did, the next whole pass would read as a Performance change and
        // throw away a diagram that is perfectly good.
        assert_eq!(anchor.name(), Some("Init Normal (FM-X)"));
        assert_eq!(anchor.beat(&mut asking(&mut owner)).unwrap(), Beat::Same);
        assert_eq!(anchor.changes(), 0);
    }
}

//! The 88 FM-X topologies: who modulates whom, who reaches the output, and where
//! the feedback loop is.
//!
//! The algorithm **is** the topology — there is no routing matrix beside it — so
//! this file is the only thing that can say what the diagram of a patch looks
//! like. The keyboard answers the algorithm *number* (`48 0p 4F`, base zero) and
//! nothing else: it never says who modulates whom, and no amount of sondeo can
//! find out. Which makes this the one place in the project where a mistake is
//! silent: a wrong route draws a plausible diagram of a patch that does not exist.
//! The structural tests at the bottom are the only net, and they are structural on
//! purpose — they cannot check a route against the keyboard, only against itself.
//!
//! ## Where this comes from, and how it was read
//!
//! Transcribed from the Algorithm Chart of the MODX Data List (pages 182-185),
//! which is kept outside the repository (ADR-0003, and `*.pdf` in `.gitignore`).
//! The chart is a drawing, not a table: it has no text to extract, so every entry
//! here was read off the rendered page. The drawing convention, spelled out
//! because the transcription depends on it:
//!
//! - Each operator is a box. A vertical line from the bottom of one box to the top
//!   of another is a modulation route, downwards.
//! - A horizontal line joining several boxes and dropping into one is several
//!   modulators into one operator; a horizontal line under one box dropping into
//!   several is one modulator into several operators.
//! - The bus along the bottom is the output: every box that hangs off it is a
//!   portadora. Everything else only ever reaches `OUT L/R` through somebody else.
//! - The thin rectangle drawn around one or more boxes is the feedback loop, from
//!   the output of the last box it wraps back into the input of the first. Every
//!   one of the 88 has exactly one, which is why [`Feedback`] is not an `Option`.
//!
//! ## What is verified here and what is not
//!
//! Every entry is [`Provenance::Documentado`]. It is paper; promotion to `medido`
//! is per entry, by changing the algorithm on the panel and comparing the drawing
//! with the MODX's own screen (#12). Two entries are *cross-checked* against fase
//! 0c — which is not the same as measured, and does not promote them:
//!
//! - Algorithm 6 was the one loaded through the whole fase 0c session, and the
//!   keyboard's screen drew its feedback on Op1. The chart says the same. See
//!   [`the design's example patch`](#the-conflict-with-the-designs-example-patch).
//! - The spike saw Op3 connected to Op4 in algorithm 88 and not in 87. The chart
//!   says the same: in 88 the Op3 box drops into Op4, in 87 both hang off the
//!   output bus.
//!
//! ## The conflict with the design's example patch
//!
//! The design handoff describes its mock as «algoritmo 6, feedback 3 en Op5; Op1
//! portadora, Op3 modulador, Op4 portadora, Op8 portadora». The Data List's
//! algorithm 6 is not that patch: its feedback is on Op1, its modulators are Op1
//! and Op3, and its portadoras are Op2 and Op4-Op8. The measurement agrees with
//! the paper here, so the mock's numbers are decorative and this file follows the
//! chart. Written down in the results document rather than silently reconciled.

use crate::table::Provenance;

/// Operators in an FM-X Part. Not a configuration: the eight are the FM-X engine.
pub const OPERATORS: u8 = 8;

/// How many algorithms the MODX has. `48 0p 4F` runs `00`-`57`, base zero.
pub const COUNT: u8 = 88;

/// The loop the chart draws as a rectangle: the output of `from` re-enters the
/// input of `into`. Most are a single operator feeding itself (`from == into`); a
/// few wrap a chain, like algorithm 12, where Op5's output goes back into Op3.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub struct Feedback {
    pub from: u8,
    pub into: u8,
}

impl Feedback {
    /// Whether the loop passes through this operator — the ones the arc is drawn
    /// around, `from` and `into` and, for a chain, everything between them.
    pub fn wraps(&self, operator: u8) -> bool {
        let (low, high) = if self.into <= self.from {
            (self.into, self.from)
        } else {
            (self.from, self.into)
        };
        (low..=high).contains(&operator)
    }
}

/// What an operator is doing in this patch. Portadora and modulador come from the
/// topology; inactivo comes from the Level and overrides both, because an operator
/// at 0 contributes nothing wherever the algorithm put it (see `CONTEXT.md`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Role {
    Portadora,
    Modulador,
    Inactivo,
}

/// One algorithm, exactly as its box drawing reads.
#[derive(Debug)]
pub struct Topology {
    /// 1-88, as the keyboard's screen shows it.
    pub number: u8,
    /// `(from, into)`: `from` modulates `into`. In the chart's reading order, top
    /// to bottom and left to right, so a line here can be put next to its drawing.
    pub routes: &'static [(u8, u8)],
    /// The operators hanging off the output bus, ascending.
    pub carriers: &'static [u8],
    pub feedback: Feedback,
    pub provenance: Provenance,
}

impl Topology {
    /// Whether this operator reaches `OUT L/R` on its own.
    pub fn is_carrier(&self, operator: u8) -> bool {
        self.carriers.contains(&operator)
    }

    /// The operators this one modulates, ascending.
    pub fn modulates(&self, operator: u8) -> Vec<u8> {
        let mut into: Vec<u8> = self
            .routes
            .iter()
            .filter(|(from, _)| *from == operator)
            .map(|(_, into)| *into)
            .collect();
        into.sort_unstable();
        into
    }

    /// The operators that modulate this one, ascending. The feedback loop is not
    /// one of them: it is drawn apart and carries its own value.
    pub fn modulated_by(&self, operator: u8) -> Vec<u8> {
        let mut from: Vec<u8> = self
            .routes
            .iter()
            .filter(|(_, into)| *into == operator)
            .map(|(from, _)| *from)
            .collect();
        from.sort_unstable();
        from
    }

    /// The role the diagram draws, given what the ring read for this operator's
    /// Level. A `level` of 0 is inactivo whatever the topology says.
    pub fn role(&self, operator: u8, level: u8) -> Role {
        if level == 0 {
            Role::Inactivo
        } else if self.is_carrier(operator) {
            Role::Portadora
        } else {
            Role::Modulador
        }
    }

    /// How far each operator is from the output, indexed `operator - 1`: a
    /// portadora is 0, whatever modulates one is 1, and so on. Where an operator
    /// modulates two things at different depths it takes the deeper, so a route
    /// always runs from a higher number to a lower one and the diagram can lay out
    /// any of the 88 by column without a hand-made sheet.
    ///
    /// The feedback loop is not an edge here, which is what makes this terminate.
    pub fn chain_depth(&self) -> [u8; OPERATORS as usize] {
        let mut depth = [0u8; OPERATORS as usize];
        // Every route runs from a deeper operator to a shallower one, so a pass
        // over all of them can raise a depth by at most one step per operator:
        // eight passes is more than the longest chain (algorithm 66, seven).
        for _ in 0..OPERATORS {
            let mut settled = true;
            for (from, into) in self.routes {
                let candidate = depth[usize::from(into - 1)] + 1;
                let slot = &mut depth[usize::from(from - 1)];
                if candidate > *slot {
                    *slot = candidate;
                    settled = false;
                }
            }
            if settled {
                break;
            }
        }
        depth
    }
}

/// The algorithm the keyboard is on, from the byte `48 0p 4F` answered with.
/// Base zero — `00` is algorithm 1 — and out of range is `None` rather than a
/// guess, which is what draws `ALGORITMO SIN TABLA`.
pub fn from_read_value(value: u8) -> Option<&'static Topology> {
    topology(value.checked_add(1)?)
}

/// The algorithm by the number on the screen, 1-88.
pub fn topology(number: u8) -> Option<&'static Topology> {
    ALGORITHMS.get(usize::from(number.checked_sub(1)?))
}

const fn alg(
    number: u8,
    feedback: (u8, u8),
    routes: &'static [(u8, u8)],
    carriers: &'static [u8],
) -> Topology {
    Topology {
        number,
        routes,
        carriers,
        feedback: Feedback {
            from: feedback.0,
            into: feedback.1,
        },
        provenance: Provenance::Documentado,
    }
}

// ---------------------------------------------------------------------------
// The chart, page by page. Each line is one box drawing: the feedback rectangle,
// then the modulation lines top to bottom and left to right, then the boxes that
// hang off the output bus.
// ---------------------------------------------------------------------------

/// Page 182 of the Data List: algorithms 1-24.
/// Page 183: 25-48. Page 184: 49-72. Page 185: 73-88.
pub static ALGORITHMS: [Topology; COUNT as usize] = [
    alg(1, (1, 1), &[], &[1, 2, 3, 4, 5, 6, 7, 8]),
    alg(2, (1, 1), &[(1, 2), (2, 3), (3, 4)], &[4, 5, 6, 7, 8]),
    alg(3, (1, 1), &[(1, 3), (2, 3), (3, 4)], &[4, 5, 6, 7, 8]),
    alg(4, (1, 1), &[(2, 3), (1, 4), (3, 4)], &[4, 5, 6, 7, 8]),
    alg(5, (1, 1), &[(1, 2), (2, 4), (3, 4)], &[4, 5, 6, 7, 8]),
    alg(6, (1, 1), &[(1, 2), (3, 4)], &[2, 4, 5, 6, 7, 8]),
    alg(7, (1, 1), &[(1, 2), (1, 3), (1, 4)], &[2, 3, 4, 5, 6, 7, 8]),
    alg(8, (1, 1), &[(1, 2)], &[2, 3, 4, 5, 6, 7, 8]),
    alg(9, (3, 3), &[(3, 4), (4, 5), (5, 6), (7, 8)], &[1, 2, 6, 8]),
    alg(10, (7, 7), &[(3, 4), (4, 5), (5, 6), (7, 8)], &[1, 2, 6, 8]),
    alg(11, (3, 3), &[(3, 4), (4, 5), (6, 7), (7, 8)], &[1, 2, 5, 8]),
    // The loop wraps the whole 3-4-5 chain: Op5's output back into Op3.
    alg(12, (5, 3), &[(3, 4), (4, 5), (6, 7), (7, 8)], &[1, 2, 5, 8]),
    alg(13, (3, 3), &[(3, 4), (5, 6), (7, 8)], &[1, 2, 4, 6, 8]),
    alg(14, (4, 3), &[(3, 4), (5, 6), (7, 8)], &[1, 2, 4, 6, 8]),
    alg(15, (3, 3), &[(3, 4), (4, 6), (5, 6), (7, 8)], &[1, 2, 6, 8]),
    alg(16, (5, 5), &[(3, 4), (4, 6), (5, 6), (7, 8)], &[1, 2, 6, 8]),
    alg(17, (7, 7), &[(3, 4), (4, 6), (5, 6), (7, 8)], &[1, 2, 6, 8]),
    alg(18, (3, 3), &[(3, 4), (4, 5), (6, 8), (7, 8)], &[1, 2, 5, 8]),
    alg(19, (7, 7), &[(3, 4), (4, 5), (6, 8), (7, 8)], &[1, 2, 5, 8]),
    alg(20, (3, 3), &[(3, 4), (5, 8), (6, 8), (7, 8)], &[1, 2, 4, 8]),
    alg(21, (5, 5), &[(3, 4), (5, 8), (6, 8), (7, 8)], &[1, 2, 4, 8]),
    alg(22, (3, 3), &[(3, 5), (4, 5), (5, 6), (7, 8)], &[1, 2, 6, 8]),
    alg(23, (7, 7), &[(3, 5), (4, 5), (5, 6), (7, 8)], &[1, 2, 6, 8]),
    alg(
        24,
        (3, 3),
        &[(3, 4), (5, 6), (4, 8), (6, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        25,
        (7, 7),
        &[(3, 4), (5, 6), (4, 8), (6, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        26,
        (6, 6),
        &[(3, 4), (4, 5), (5, 8), (6, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        27,
        (3, 3),
        &[(3, 4), (3, 5), (6, 7), (7, 8)],
        &[1, 2, 4, 5, 8],
    ),
    alg(
        28,
        (6, 6),
        &[(3, 5), (4, 5), (6, 7), (6, 8)],
        &[1, 2, 5, 7, 8],
    ),
    alg(
        29,
        (6, 6),
        &[(3, 4), (3, 5), (6, 7), (6, 8)],
        &[1, 2, 4, 5, 7, 8],
    ),
    alg(
        30,
        (3, 3),
        &[(3, 4), (3, 5), (3, 6), (7, 8)],
        &[1, 2, 4, 5, 6, 8],
    ),
    alg(31, (1, 1), &[(1, 2), (1, 3), (4, 5)], &[2, 3, 5, 6, 7, 8]),
    alg(32, (1, 1), &[(1, 2), (1, 3)], &[2, 3, 4, 5, 6, 7, 8]),
    alg(33, (1, 1), &[(1, 3), (2, 3), (4, 5)], &[3, 5, 6, 7, 8]),
    alg(34, (4, 4), &[(1, 3), (2, 3), (4, 5)], &[3, 5, 6, 7, 8]),
    alg(35, (1, 1), &[(1, 2), (2, 3), (4, 5)], &[3, 5, 6, 7, 8]),
    alg(36, (1, 1), &[(1, 2), (2, 3)], &[3, 4, 5, 6, 7, 8]),
    alg(
        37,
        (3, 3),
        &[(3, 4), (4, 5), (5, 6), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        38,
        (3, 3),
        &[(3, 5), (4, 5), (5, 6), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        39,
        (3, 3),
        &[(4, 5), (3, 6), (5, 6), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        40,
        (3, 3),
        &[(4, 5), (5, 6), (3, 7), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        41,
        (3, 3),
        &[(4, 5), (5, 6), (6, 7), (3, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        42,
        (3, 3),
        &[(3, 6), (4, 6), (5, 6), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        43,
        (3, 3),
        &[(3, 4), (5, 6), (4, 7), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        44,
        (3, 3),
        &[(5, 6), (3, 7), (4, 7), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        45,
        (6, 6),
        &[(3, 5), (4, 5), (5, 7), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        46,
        (3, 3),
        &[(3, 4), (5, 6), (6, 7), (4, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        47,
        (7, 7),
        &[(3, 5), (4, 5), (5, 6), (6, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        48,
        (7, 7),
        &[(4, 5), (3, 6), (5, 6), (6, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        49,
        (3, 3),
        &[(3, 7), (4, 7), (5, 7), (6, 7), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        50,
        (7, 7),
        &[(3, 6), (4, 6), (5, 6), (6, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        51,
        (6, 6),
        &[(3, 5), (4, 5), (6, 7), (5, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        52,
        (3, 3),
        &[(6, 7), (3, 8), (4, 8), (5, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        53,
        (7, 7),
        &[(3, 5), (4, 5), (5, 8), (6, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(
        54,
        (3, 3),
        &[(3, 8), (4, 8), (5, 8), (6, 8), (7, 8)],
        &[1, 2, 8],
    ),
    alg(55, (1, 1), &[(4, 5), (5, 6), (6, 7), (7, 8)], &[1, 2, 3, 8]),
    alg(56, (4, 4), &[(4, 6), (5, 6), (6, 7), (7, 8)], &[1, 2, 3, 8]),
    alg(57, (4, 4), &[(5, 6), (4, 7), (6, 7), (7, 8)], &[1, 2, 3, 8]),
    alg(58, (4, 4), &[(5, 6), (6, 7), (4, 8), (7, 8)], &[1, 2, 3, 8]),
    alg(59, (4, 4), &[(4, 7), (5, 7), (6, 7), (7, 8)], &[1, 2, 3, 8]),
    alg(60, (4, 4), &[(4, 5), (6, 7), (5, 8), (7, 8)], &[1, 2, 3, 8]),
    alg(61, (4, 4), &[(6, 7), (4, 8), (5, 8), (7, 8)], &[1, 2, 3, 8]),
    alg(62, (7, 7), &[(4, 6), (5, 6), (6, 8), (7, 8)], &[1, 2, 3, 8]),
    alg(63, (4, 4), &[(4, 8), (5, 8), (6, 8), (7, 8)], &[1, 2, 3, 8]),
    alg(64, (3, 3), &[(3, 5), (4, 5), (6, 8), (7, 8)], &[1, 2, 5, 8]),
    // One horizontal line under Op3 and Op4 feeding every box of the bottom row.
    alg(
        65,
        (3, 3),
        &[
            (3, 5),
            (3, 6),
            (3, 7),
            (3, 8),
            (4, 5),
            (4, 6),
            (4, 7),
            (4, 8),
        ],
        &[1, 2, 5, 6, 7, 8],
    ),
    // The single chain of eight, and the only algorithm with one portadora and a
    // depth of seven.
    alg(
        66,
        (1, 1),
        &[(1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 8)],
        &[8],
    ),
    alg(67, (1, 1), &[(1, 2), (3, 4), (5, 6), (7, 8)], &[2, 4, 6, 8]),
    alg(
        68,
        (1, 1),
        &[(1, 8), (2, 8), (3, 8), (4, 8), (5, 8), (6, 8), (7, 8)],
        &[8],
    ),
    alg(
        69,
        (1, 1),
        &[(1, 2), (2, 3), (3, 4), (5, 6), (6, 7), (7, 8)],
        &[4, 8],
    ),
    alg(
        70,
        (1, 1),
        &[(1, 3), (2, 3), (3, 4), (5, 7), (6, 7), (7, 8)],
        &[4, 8],
    ),
    alg(
        71,
        (1, 1),
        &[(2, 3), (1, 4), (3, 4), (6, 7), (5, 8), (7, 8)],
        &[4, 8],
    ),
    alg(
        72,
        (1, 1),
        &[(1, 2), (2, 4), (3, 4), (5, 6), (6, 8), (7, 8)],
        &[4, 8],
    ),
    alg(
        73,
        (2, 2),
        &[(2, 3), (4, 5), (4, 6), (4, 7), (4, 8)],
        &[1, 3, 5, 6, 7, 8],
    ),
    alg(
        74,
        (1, 1),
        &[(1, 2), (3, 4), (5, 6), (6, 8), (7, 8)],
        &[2, 4, 8],
    ),
    alg(
        75,
        (1, 1),
        &[(1, 2), (1, 3), (4, 5), (6, 7), (5, 8), (7, 8)],
        &[2, 3, 8],
    ),
    alg(
        76,
        (1, 1),
        &[(1, 2), (2, 3), (4, 5), (4, 6), (4, 7), (4, 8)],
        &[3, 5, 6, 7, 8],
    ),
    alg(
        77,
        (1, 1),
        &[(1, 4), (2, 4), (3, 4), (5, 8), (6, 8), (7, 8)],
        &[4, 8],
    ),
    alg(78, (1, 1), &[(1, 3), (2, 3), (4, 5), (6, 7)], &[3, 5, 7, 8]),
    alg(
        79,
        (1, 1),
        &[(1, 3), (2, 3), (3, 4), (5, 6), (6, 7), (7, 8)],
        &[4, 8],
    ),
    alg(
        80,
        (1, 1),
        &[
            (1, 3),
            (1, 4),
            (1, 5),
            (1, 6),
            (1, 7),
            (1, 8),
            (2, 3),
            (2, 4),
            (2, 5),
            (2, 6),
            (2, 7),
            (2, 8),
        ],
        &[3, 4, 5, 6, 7, 8],
    ),
    alg(
        81,
        (1, 1),
        &[(1, 2), (3, 4), (4, 5), (6, 7), (7, 8)],
        &[2, 5, 8],
    ),
    alg(
        82,
        (1, 1),
        &[(1, 2), (2, 3), (2, 4), (5, 6), (6, 7), (6, 8)],
        &[3, 4, 7, 8],
    ),
    alg(
        83,
        (1, 1),
        &[(1, 2), (3, 5), (4, 5), (6, 8), (7, 8)],
        &[2, 5, 8],
    ),
    alg(
        84,
        (6, 6),
        &[(1, 2), (1, 3), (1, 4), (1, 5), (6, 7), (6, 8)],
        &[2, 3, 4, 5, 7, 8],
    ),
    alg(
        85,
        (1, 1),
        &[(1, 2), (4, 5), (6, 7), (3, 8), (5, 8), (7, 8)],
        &[2, 8],
    ),
    alg(
        86,
        (1, 1),
        &[(1, 2), (2, 3), (3, 4), (3, 5), (3, 6), (3, 7), (3, 8)],
        &[4, 5, 6, 7, 8],
    ),
    // 87 and 88 are the pair the fase 0c spike looked at: Op3 hangs off the output
    // bus here and drops into Op4 in 88.
    alg(
        87,
        (1, 1),
        &[(1, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8)],
        &[3, 4, 5, 6, 7, 8],
    ),
    alg(
        88,
        (1, 1),
        &[(1, 3), (2, 3), (3, 4), (3, 5), (3, 6), (3, 7), (3, 8)],
        &[4, 5, 6, 7, 8],
    ),
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    /// Every operator, 1-8.
    fn operators() -> impl Iterator<Item = u8> {
        1..=OPERATORS
    }

    #[test]
    fn has_the_eighty_eight_the_keyboard_numbers() {
        assert_eq!(ALGORITHMS.len(), usize::from(COUNT));
        for (index, topology) in ALGORITHMS.iter().enumerate() {
            assert_eq!(topology.number, index as u8 + 1);
        }

        assert_eq!(topology(1).map(|t| t.number), Some(1));
        assert_eq!(topology(88).map(|t| t.number), Some(88));
        assert!(topology(0).is_none());
        assert!(topology(89).is_none());

        // `48 0p 4F` is base zero: the fase 0c session read `05` and the screen
        // said algorithm 6.
        assert_eq!(from_read_value(0x05).map(|t| t.number), Some(6));
        assert_eq!(from_read_value(0x00).map(|t| t.number), Some(1));
        assert_eq!(from_read_value(0x57).map(|t| t.number), Some(88));
        // Above the documented range there is no drawing, and no guess either:
        // that is what puts `ALGORITMO SIN TABLA` on the screen.
        assert!(from_read_value(0x58).is_none());
        assert!(from_read_value(0x7F).is_none());
    }

    #[test]
    fn every_entry_carries_its_procedencia_and_it_is_paper() {
        for topology in &ALGORITHMS {
            assert_eq!(
                topology.provenance,
                Provenance::Documentado,
                "algoritmo {}",
                topology.number
            );
        }
    }

    #[test]
    fn names_no_operator_outside_the_eight() {
        for topology in &ALGORITHMS {
            let mentioned = topology
                .routes
                .iter()
                .flat_map(|(from, into)| [*from, *into])
                .chain(topology.carriers.iter().copied())
                .chain([topology.feedback.from, topology.feedback.into]);

            for operator in mentioned {
                assert!(
                    (1..=OPERATORS).contains(&operator),
                    "algoritmo {}: Op{operator} no existe",
                    topology.number
                );
            }
        }
    }

    #[test]
    fn draws_each_route_once_and_never_into_itself() {
        for topology in &ALGORITHMS {
            let mut seen = BTreeSet::new();
            for route in topology.routes {
                assert!(
                    seen.insert(*route),
                    "algoritmo {}: {route:?} dos veces",
                    topology.number
                );
                assert_ne!(
                    route.0, route.1,
                    "algoritmo {}: Op{} se modula a sí mismo fuera del feedback",
                    topology.number, route.0
                );
            }

            let carriers: Vec<u8> = topology.carriers.to_vec();
            let mut ascending = carriers.clone();
            ascending.sort_unstable();
            ascending.dedup();
            assert_eq!(carriers, ascending, "algoritmo {}", topology.number);
        }
    }

    #[test]
    fn every_algorithm_reaches_the_output_from_every_operator() {
        for topology in &ALGORITHMS {
            assert!(
                !topology.carriers.is_empty(),
                "algoritmo {}: ninguna portadora",
                topology.number
            );

            // Follow the routes from each operator; with no cycles and every
            // non-portadora modulating something, this has to land on the bus.
            for operator in operators() {
                let mut frontier = vec![operator];
                let mut visited = BTreeSet::new();
                let mut reaches = false;
                while let Some(current) = frontier.pop() {
                    if !visited.insert(current) {
                        continue;
                    }
                    if topology.is_carrier(current) {
                        reaches = true;
                        break;
                    }
                    frontier.extend(topology.modulates(current));
                }
                assert!(
                    reaches,
                    "algoritmo {}: Op{operator} no llega a la salida",
                    topology.number
                );
            }
        }
    }

    #[test]
    fn has_no_cycle_other_than_the_one_feedback_loop() {
        for topology in &ALGORITHMS {
            // A Kahn peel: if every operator comes off, the routes are acyclic.
            let mut remaining: BTreeSet<u8> = operators().collect();
            loop {
                let leaf = remaining.iter().copied().find(|operator| {
                    topology
                        .modulates(*operator)
                        .iter()
                        .all(|into| !remaining.contains(into))
                });
                match leaf {
                    Some(operator) => {
                        remaining.remove(&operator);
                    }
                    None => break,
                }
            }
            assert!(
                remaining.is_empty(),
                "algoritmo {}: ciclo entre {remaining:?}",
                topology.number
            );

            // And the one loop that is allowed is the drawn one, which always
            // closes backwards: the output of a deeper operator into a shallower
            // one, or an operator into itself.
            let feedback = topology.feedback;
            assert!(
                feedback.from >= feedback.into,
                "algoritmo {}: feedback de Op{} a Op{} va hacia abajo",
                topology.number,
                feedback.from,
                feedback.into
            );
            if feedback.from != feedback.into {
                let depth = topology.chain_depth();
                assert!(
                    depth[usize::from(feedback.from - 1)] < depth[usize::from(feedback.into - 1)],
                    "algoritmo {}: el lazo Op{}→Op{} no abraza una cadena",
                    topology.number,
                    feedback.from,
                    feedback.into
                );
            }
        }
    }

    #[test]
    fn wraps_the_operators_the_arc_is_drawn_around() {
        let single = topology(11).expect("el 11");
        assert!(single.feedback.wraps(3));
        assert!(!single.feedback.wraps(4));

        // The 12 is the 11 with the loop taken around the whole 3-4-5 chain.
        let chain = topology(12).expect("el 12");
        assert_eq!(chain.feedback, Feedback { from: 5, into: 3 });
        for operator in [3, 4, 5] {
            assert!(chain.feedback.wraps(operator));
        }
        assert!(!chain.feedback.wraps(6));
        assert_eq!(chain.routes, topology(11).expect("el 11").routes);
    }

    #[test]
    fn chain_depth_lays_out_a_column_per_operator() {
        // The single chain: seven deep, and the only portadora at the bottom.
        assert_eq!(
            topology(66).expect("el 66").chain_depth(),
            [7, 6, 5, 4, 3, 2, 1, 0]
        );
        // Eight portadoras, no routes: one column.
        assert_eq!(topology(1).expect("el 1").chain_depth(), [0; 8]);
        // The one the fase 0c session had loaded: two moduladores at depth 1.
        assert_eq!(
            topology(6).expect("el 6").chain_depth(),
            [1, 0, 1, 0, 0, 0, 0, 0]
        );
        // Where an operator modulates two things at different depths it takes the
        // deeper: in the 4, Op1 goes straight into Op4 and Op3 goes there too, so
        // Op2 sits one column further out than either.
        assert_eq!(
            topology(4).expect("el 4").chain_depth(),
            [1, 2, 1, 0, 0, 0, 0, 0]
        );

        // And in general: a route always runs from a deeper column to a shallower
        // one, and a portadora is always at zero.
        for topology in &ALGORITHMS {
            let depth = topology.chain_depth();
            for (from, into) in topology.routes {
                assert!(
                    depth[usize::from(from - 1)] > depth[usize::from(into - 1)],
                    "algoritmo {}: Op{from} no está por encima de Op{into}",
                    topology.number
                );
            }
            for operator in operators() {
                assert_eq!(
                    topology.is_carrier(operator),
                    depth[usize::from(operator - 1)] == 0,
                    "algoritmo {}: Op{operator}",
                    topology.number
                );
            }
        }
    }

    #[test]
    fn the_role_comes_from_the_topology_and_the_level_overrides_it() {
        let six = topology(6).expect("el 6");
        assert_eq!(six.role(2, 99), Role::Portadora);
        assert_eq!(six.role(1, 99), Role::Modulador);
        // Level 0 is inactivo wherever the algorithm put the operator.
        assert_eq!(six.role(2, 0), Role::Inactivo);
        assert_eq!(six.role(1, 0), Role::Inactivo);
    }

    #[test]
    fn reads_the_routes_in_both_directions() {
        let eighty_eight = topology(88).expect("el 88");
        assert_eq!(eighty_eight.modulates(3), vec![4, 5, 6, 7, 8]);
        assert_eq!(eighty_eight.modulated_by(3), vec![1, 2]);
        assert_eq!(eighty_eight.modulates(8), Vec::<u8>::new());
        // The feedback is drawn apart and is not a modulador of anybody.
        assert_eq!(eighty_eight.modulated_by(1), Vec::<u8>::new());
    }

    #[test]
    fn matches_what_fase_0c_saw_on_the_keyboards_own_screen() {
        // Algorithm 6 was loaded through the whole fase 0c session and the MODX
        // drew its feedback on Op1. The chart says the same.
        //
        // The design handoff's mock describes «algoritmo 6, feedback 3 en Op5,
        // Op1 portadora, Op3 modulador»; the Data List and the keyboard both
        // disagree, so the mock's numbers are decorative. Recorded in the results
        // document rather than reconciled here.
        let six = topology(6).expect("el 6");
        assert_eq!(six.feedback, Feedback { from: 1, into: 1 });
        assert!(!six.is_carrier(1));
        assert!(six.is_carrier(2));

        // And the pair the spike compared: Op3 into Op4 in the 88, not in the 87.
        let eighty_seven = topology(87).expect("el 87");
        let eighty_eight = topology(88).expect("el 88");
        assert!(!eighty_seven.modulates(3).contains(&4));
        assert!(eighty_seven.is_carrier(3) && eighty_seven.is_carrier(4));
        assert!(eighty_eight.modulates(3).contains(&4));
        assert!(!eighty_eight.is_carrier(3));
    }

    #[test]
    fn no_two_algorithms_draw_the_same_thing() {
        let mut seen = BTreeSet::new();
        for topology in &ALGORITHMS {
            let shape = (topology.routes, topology.carriers, topology.feedback);
            assert!(
                seen.insert(shape),
                "algoritmo {}: mismo dibujo que otro",
                topology.number
            );
        }
    }

    /// The counted shape of the transcription, so that the figures in the results
    /// document are checked by something rather than remembered.
    #[test]
    fn weighs_what_the_results_document_says_it_weighs() {
        let routes: usize = ALGORITHMS.iter().map(|t| t.routes.len()).sum();
        assert_eq!(routes, 402);

        // Every algorithm has exactly one loop, and only two of them wrap a chain
        // rather than a single operator: the 12 (Op5 back into Op3) and the 14.
        let chains: Vec<u8> = ALGORITHMS
            .iter()
            .filter(|t| t.feedback.from != t.feedback.into)
            .map(|t| t.number)
            .collect();
        assert_eq!(chains, vec![12, 14]);

        // The loop lands on seven of the eight operators. Never on Op8, which is
        // the last of every long chain and — in all 88 — a portadora.
        let loops: BTreeSet<u8> = ALGORITHMS.iter().map(|t| t.feedback.into).collect();
        assert_eq!(loops, BTreeSet::from([1, 2, 3, 4, 5, 6, 7]));
        let op8_carries = ALGORITHMS.iter().filter(|t| t.is_carrier(8)).count();
        assert_eq!(op8_carries, usize::from(COUNT));

        // The 1 is eight portadoras in parallel and the 66 is the single chain of
        // eight; nothing else goes past five columns.
        let deepest = |number: u8| {
            *topology(number)
                .expect("el algoritmo")
                .chain_depth()
                .iter()
                .max()
                .expect("ocho operadores")
        };
        assert_eq!(deepest(1), 0);
        assert_eq!(deepest(66), 7);
        assert_eq!(deepest(37), 5);
        for topology in &ALGORITHMS {
            if !matches!(topology.number, 66) {
                assert!(
                    deepest(topology.number) <= 5,
                    "algoritmo {}",
                    topology.number
                );
            }
        }
    }
}

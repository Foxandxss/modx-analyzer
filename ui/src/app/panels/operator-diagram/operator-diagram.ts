import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  BACKEND_GATEWAY,
  OperatorRole,
  OperatorView,
  PolledValue,
  Provenance,
  invalidated,
} from '../../backend/backend-gateway';
import { Figure } from '../../provenance/figure';
import { RingFreshness } from '../../provenance/freshness';
import { Composition } from '../../shell/composition';
import { DEAD_MARK, PROVENANCE_LABEL } from '../../provenance/provenance';
import { equalTemperamentHz } from '../../provenance/theory';
import { LEGEND } from './legend';
import { DrawnBus, DrawnRoute, DrawnStub, Slot, layout } from './layout';
import { spectralGlyph } from './spectral-glyph';
import { wideLayout } from './wide-layout';

/** What the role is called on the node, per `GLOSSARY.md` §6: three of a kind. */
const ROLE_LABEL: Readonly<Record<OperatorRole, string>> = {
  carrier: 'CARR',
  modulator: 'MOD',
  inert: 'ZERO',
};

/** ADR-0003's two grades of a table entry, in the words the table uses. */
const TABLE_LABEL = { measured: 'MEASURED', documented: 'DOCUMENTED' } as const;

/** One node, with every figure already stamped and already formatted. */
interface NodeView {
  readonly operator: number;
  readonly role: OperatorRole | null;
  readonly roleLabel: PolledValue<string>;
  readonly level: PolledValue<number>;
  /** Height of the luminous fill, 0-100. The Level **is** this height. */
  readonly fill: number;
  readonly ratio: PolledValue<string>;
  /**
   * The spectral form's drawing, or `null` for a form nobody read. Never a word:
   * writing `Sine` / `Odd 1` beside the ratio is what ellipsised the pair to
   * `×0.50 ...`, and `spectral-glyph.ts` is what replaces it.
   */
  readonly glyph: string | null;
  /**
   * The real frequency of this operator for the live note: `PREDICTED` whenever
   * there is one, and `invalidated` — dash, no stamp — when there is not.
   */
  readonly hz: PolledValue<string>;
  /** The node's one stamp, taken from the weakest figure in it. */
  readonly stamp: Provenance;
  /** Where the node sits in the canvas, as a share of it: see `layout.ts`. */
  readonly box: Box;
}

/** A box in percentages of the canvas, so the whole drawing stretches together. */
interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A line of the drawing, plus whether the operator it leaves has been cut. */
interface LineView {
  readonly key: string;
  readonly path: string;
  readonly inert: boolean;
}

/**
 * The hero column: who is a portadora, who is a modulador, how loud each one is,
 * and who modulates whom.
 *
 * ## The node holds exactly five facts
 *
 * Label and role, Level, ratio, spectral form, and the operator's Hz. There was
 * a sixth once and it is what broke the box: six things in 118 × 108 ellipsised
 * the ratio and the form together into `×0.50 ...`. So the form stops being a
 * word and becomes a **glyph** (`spectral-glyph.ts`), and nothing in the node is
 * allowed to trim a figure — a word that ellipsises is worse than no word.
 *
 * Four things are deliberate here. The role is a **shape** before it is a colour
 * — total curve for a portadora, live corner for a modulador, dashed outline for
 * an operator at zero — so it reads without a legend and without colour vision.
 * The Level is the **height of the fill**, the number under it only confirms what
 * the height already said, and one **ceiling datum** at the patch's highest Level
 * crosses all eight so the eye reads the gaps rather than eight private
 * baselines. That fill measures its Level against a **track** and not against the
 * card: the scale's top used to be the card's own border, which left a ceiling of
 * 99 nowhere to be drawn (#67, `node-geometry.ts`). The claim is unchanged —
 * linear, zero-anchored, the same scale on all eight — and what moved was the
 * accident that a border was doubling as the top of a measurement.
 * The routes come from the algorithm the ring read
 * and are laid out by chain depth, so any of the 88 draws without a hand-made
 * sheet (`layout.ts`). And nothing is guessed: until the algorithm has been read
 * there is no topology, so there is no role and there are no lines, and an
 * algorithm with no entry in the table draws `ALGORITHM n · NO TABLE` rather than a
 * plausible diagram of a patch that does not exist.
 *
 * ## Two compositions, two layouts, one node
 *
 * At 700 px the node carries its own role, because there is no room for the
 * layout to carry it: the eight stand in a depth-sorted 3 × 3 grid (`layout.ts`)
 * and the shape is what says who is a portadora. With the width the algorithm
 * takes when nothing is measured, **position says it instead** — the bottom row
 * is the output bus, every arrow points down, and an operator at zero is parked
 * to the right on a stub that ends nowhere (`wide-layout.ts`). The shape survives
 * underneath as confirmation, so there is nothing new to learn, and the swap is
 * a different drawing of the same eight nodes rather than a different panel.
 *
 * ## The corner is drawn and does nothing
 *
 * Every node carries the open corner, the mark for *there is more behind this*,
 * because the path from a node to its editor was invisible. The operator editor
 * is not built, so the mark is **inert** and the node body opens nothing either;
 * the legend line that names it (`5 of 43 facts shown · the corner opens the
 * other 38`) joins in the same commit as the editor. A caption pointing at a
 * path that does not exist is the same lie as a disabled button for a mode with
 * no code behind it.
 */
@Component({
  selector: 'app-operator-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Figure],
  templateUrl: './operator-diagram.html',
  styleUrl: './operator-diagram.scss',
})
export class OperatorDiagram {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly freshness = inject(RingFreshness);
  private readonly composition = inject(Composition);

  protected readonly labels = PROVENANCE_LABEL;
  /** Where the glyph goes when nobody has read the form: the dash, never a Sine. */
  protected readonly deadMark = DEAD_MARK;
  /**
   * The legend's words and their rows, from the module that also measures them.
   * The template renders this list and `legend.ts` sums this list, so a width
   * check cannot stay green about copy the screen no longer shows (#65).
   */
  protected readonly legend = LEGEND;

  /**
   * `KEEP IT BIG`, drawn here because this is the panel it is about.
   *
   * It is a **pin and not a mode**: with it up the composition is decided by the
   * two Ranuras, and pressing it holds the wide drawing without touching the
   * pair the pianist chose. Emptying and refilling two ranuras is four presses;
   * this is one, and letting it up gives the pair back exactly.
   */
  protected readonly pinned = this.composition.pinned;

  protected togglePin(): void {
    this.composition.togglePin();
  }

  /** `ALL EIGHT · 10.2 Hz`, measured, never the documented figure. */
  protected readonly cadence = computed<PolledValue<number>>(() => {
    const hz = this.freshness.cadenceHz();
    return hz === null ? invalidated<number>() : { value: hz, provenance: 'polled', readAt: null };
  });

  /**
   * Which operators the ring read a Level of 0 for, as a bitmask.
   *
   * A number and not a list on purpose. The wide composition parks these off the
   * branches, so the drawing depends on them; the ring answers the same eight
   * roles a dozen times a second, and a mask compares by value, so the layout is
   * rebuilt when an operator actually crosses zero and not once per pass.
   */
  private readonly cut = computed(() =>
    this.backend
      .operators()
      .operators.reduce(
        (mask, node) =>
          this.freshness.stamp(node.role).value === 'inert'
            ? mask | (1 << (node.operator - 1))
            : mask,
        0,
      ),
  );

  /**
   * The drawing, rebuilt only when the algorithm, the composition or the set of
   * operators at zero changes: the gateway holds the topology behind an equality
   * on its number, so the dozen events a second the ring emits do not relay out
   * the diagram a dozen times a second.
   */
  private readonly drawing = computed(() => {
    const topology = this.backend.topology();
    return this.composition.wide() ? wideLayout(topology, parked(this.cut())) : layout(topology);
  });

  /** The node lays its five facts in a row: the depth left it no height to stack. */
  protected readonly squat = computed(() => this.drawing().squat);

  protected readonly viewBox = computed(() => {
    const drawn = this.drawing();
    return `0 0 ${drawn.width} ${drawn.height}`;
  });

  /**
   * The algorithm was read and there is no entry for it. Not the same silence as
   * a diagram nobody has read yet, which draws no message at all.
   */
  protected readonly missingTable = computed(() => {
    const number = this.backend.patch().algorithm.value;
    return number !== null && this.backend.topology() === null ? number : null;
  });

  /** Where the routes come from, said out loud: they are paper until checked. */
  protected readonly tableProvenance = computed(() => {
    const topology = this.backend.topology();
    return topology === null ? null : TABLE_LABEL[topology.provenance];
  });

  protected readonly nodes = computed<NodeView[]>(() => {
    const slots = this.drawing().slots;
    return this.backend
      .operators()
      .operators.map((node) => this.draw(node, slots[node.operator - 1]));
  });

  /**
   * The ceiling datum: the highest Level in the patch, drawn as one dashed line
   * across all eight nodes.
   *
   * Real patches cluster their operators near the top — the running build's own
   * reads `90 · 90 · 71 · 90 · 90 · 85 · 90 · 99`, six of the eight identical to
   * the eye — so eight fills each with their own private baseline are eight
   * absolute heights nobody can compare. One shared line turns them into seven
   * **gaps**, which is what the eye is good at. It is the patch's own highest
   * Level and never a constant: a fixed 99 would be a baseline the patch does not
   * have.
   *
   * This is the **measurement**, and it answers `0` for a patch whose eight
   * operators have all been read at zero. That is not the same fact as a patch
   * nobody has read, and the two are kept apart here for the reason `FB 0` is
   * kept apart from a feedback nobody polled: a configured zero is something the
   * ring went and found out, and collapsing it into "unknown" erases a reading.
   * Nothing on screen needs the distinction today. The next thing to ask this
   * signal a question would have got a wrong answer with no way to tell.
   *
   * What gets drawn is {@link ceilingLine}, which is a different question.
   */
  protected readonly ceiling = computed<number | null>(() => {
    const levels = this.nodes()
      .map((node) => node.level.value)
      .filter((level): level is number => level !== null);
    return levels.length === 0 ? null : Math.max(...levels);
  });

  /**
   * The ceiling **as a line**: the Level to hang the datum at, or nothing.
   *
   * There are two suppressions here and they suppress for different reasons.
   * They used to be one, and they were not written at all — `@if (ceiling())`
   * tested truthiness, so a patch read at eight zeros took the same branch as a
   * patch nobody had read, and the prose above named only the second. Behaviour
   * nobody decided, riding under a sentence about the neighbouring case. The same
   * shape turned up in `wide-layout.ts`'s route filter the same morning (#70), so
   * it is worth naming rather than fixing twice in silence.
   *
   * - **Nothing read.** There is no ceiling, because there is no Level to be the
   *   highest of. A line here would be a baseline invented out of eight dashes.
   * - **Read, and everything silent.** There is a ceiling and it is `0`. The line
   *   is still not drawn, and not because the figure is missing: the datum's
   *   whole job is to turn eight absolute heights into seven gaps, and against a
   *   flat floor there are no gaps to make. `THE LOUDEST OPERATOR IN THIS PATCH`
   *   naming a silent one is a legend entry pointing at no content — the defect
   *   #67 was opened about, one layer in.
   */
  protected readonly ceilingLine = computed<number | null>(() => {
    const ceiling = this.ceiling();
    return ceiling === null || ceiling === 0 ? null : ceiling;
  });

  /** The modulation lines, dashed when they leave an operator that is cut. */
  protected readonly routes = computed<LineView[]>(() =>
    this.drawing().routes.map((route: DrawnRoute) => ({
      key: `${route.from}:${route.into}`,
      path: route.path,
      inert: this.isInert(route.from),
    })),
  );

  /** The drops onto the output bus, one per portadora, and the bus itself. */
  protected readonly bus = computed<LineView[]>(() =>
    this.drawing().bus.map((drop: DrawnBus) => ({
      key: `bus:${drop.carrier}`,
      path: drop.path,
      inert: this.isInert(drop.carrier),
    })),
  );

  protected readonly busLine = computed(() => this.drawing().busLine);

  /** The dead ends of the operators parked at zero. Only the wide drawing has any. */
  protected readonly stubs = computed(() =>
    this.drawing().stubs.map((dead: DrawnStub) => ({
      key: `stub:${dead.operator}`,
      path: dead.path,
    })),
  );

  /**
   * The loop, with `FB n` beside it — the value the ring read, or the dash.
   *
   * At `FB 0` the arc joins the vocabulary the operators at zero already speak:
   * dashed and inert, drawn and never deleted (`wide-layout.ts`). Only a **read**
   * zero does it — a feedback nobody has polled has no amount, which is not the
   * same statement as an amount of none, exactly as an operator that has not
   * answered is not one that answered 0.
   */
  protected readonly feedback = computed(() => {
    const arc = this.drawing().feedback;
    if (arc === null) {
      return null;
    }
    const value = this.freshness.stamp(this.backend.patch().feedback);
    return {
      ...arc,
      label: `FB ${value.value ?? DEAD_MARK}`,
      inert: value.value === 0,
      labelLeft: this.share(arc.labelX, this.drawing().width),
      labelTop: this.share(arc.labelY, this.drawing().height),
    };
  });

  /** Where `OUT L/R` is written: at the right end of the bus, under it. */
  protected readonly outLabel = computed(() => {
    const drawn = this.drawing();
    return { top: this.share(drawn.height - 20, drawn.height) };
  });

  private isInert(operator: number): boolean {
    return this.nodes()[operator - 1]?.role === 'inert';
  }

  private draw(node: OperatorView, slot: Slot): NodeView {
    const role = this.freshness.stamp(node.role);
    const level = this.freshness.stamp(node.level);
    const ratio = this.freshness.stamp(node.ratio);
    const spectralForm = this.freshness.stamp(node.spectralForm);
    const drawn = this.drawing();

    return {
      operator: node.operator,
      role: role.value,
      roleLabel: text(role, (held) => ROLE_LABEL[held]),
      level,
      // An operator that has not answered has no fill at all, which is not the
      // same drawing as one that answered 0: that one is dashed and cut.
      fill: level.value ?? 0,
      ratio: text(ratio, (held) => `×${held.toFixed(2)}`),
      glyph: spectralGlyph(spectralForm.value),
      hz: this.theoryHz(ratio.value),
      stamp: weakest([role, level, ratio, spectralForm]),
      box: {
        left: this.share(slot.x, drawn.width),
        top: this.share(slot.y, drawn.height),
        // The box is the slot's own and not a constant: the wide composition
        // sizes the node by how many rows the algorithm's depth asked for.
        width: this.share(slot.w, drawn.width),
        height: this.share(slot.h, drawn.height),
      },
    };
  }

  /** A canvas coordinate as a percentage of it, which is how the nodes ride the SVG. */
  private share(value: number, of: number): number {
    return (value / of) * 100;
  }

  /**
   * The operator's real frequency: its ratio times the note being held, at equal
   * temperament. No note or no ratio, no number — the dash, never a zero, because
   * an operator nobody is playing does not have a frequency.
   *
   * It is `PREDICTED` however fresh the ratio behind it is: the reading was polled,
   * the multiplication was not, and one stamp per figure means the number that is
   * on screen has to say which of the two it is.
   */
  private theoryHz(ratio: number | null): PolledValue<string> {
    const pitch = this.backend.lowestLivePitch();
    if (pitch === null || ratio === null) {
      return invalidated<string>();
    }
    const hz = equalTemperamentHz(pitch) * ratio;
    // Fewer decimals the higher it goes, and none at all past ten thousand: a
    // tenth of a hertz on a 133 kHz prediction is not a figure, it is the two
    // characters that would push `PREDICTED` off the 118 px node.
    return { value: hz.toFixed(decimals(hz)), provenance: 'theory', readAt: null };
  }
}

/** The operators of a cut mask, in operator order. */
function parked(mask: number): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8].filter((operator) => (mask & (1 << (operator - 1))) !== 0);
}

/**
 * How many decimals the operator's Hz keeps: two under a kilohertz, one up to
 * ten, none above. The node is 118 px wide and the figure shares its line with
 * `PREDICTED`; a word that ellipsises is worse than no word (`DESIGN.md` §9), so
 * the precision is what gives way, and it gives way where it means least.
 */
function decimals(hz: number): number {
  if (hz < 1000) {
    return 2;
  }
  return hz < 10_000 ? 1 : 0;
}

/** The same stamp and age, with the number turned into what the node prints. */
function text<T>(value: PolledValue<T>, format: (held: T) => string): PolledValue<string> {
  return value.value === null ? invalidated<string>() : { ...value, value: format(value.value) };
}

/**
 * The node wears one stamp, and it is the worst of what is in it: a node whose
 * Level is fresh and whose ratio is half a second old is not a fresh node.
 */
function weakest(values: readonly PolledValue<unknown>[]): Provenance {
  if (values.every((value) => value.value === null)) {
    return 'invalidated';
  }
  return values.some((value) => value.provenance === 'stale') ? 'stale' : 'polled';
}

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
import { DEAD_MARK, PROVENANCE_LABEL } from '../../provenance/provenance';
import { equalTemperamentHz } from '../../provenance/theory';
import { DrawnBus, DrawnRoute, NODE_H, NODE_W, Slot, layout } from './layout';

/** What the role is called on the node. UI copy is Spanish; identifiers are not. */
const ROLE_LABEL: Readonly<Record<OperatorRole, string>> = {
  carrier: 'PORT',
  modulator: 'MOD',
  inert: 'INACTIVO',
};

/** ADR-0003's two grades of a table entry, in the words the table uses. */
const TABLE_LABEL = { measured: 'MEDIDO', documented: 'DOCUMENTADO' } as const;

/** One node, with every figure already stamped and already formatted. */
interface NodeView {
  readonly operator: number;
  readonly role: OperatorRole | null;
  readonly roleLabel: PolledValue<string>;
  readonly level: PolledValue<number>;
  /** Height of the luminous fill, 0-100. The Level **is** this height. */
  readonly fill: number;
  readonly ratio: PolledValue<string>;
  readonly spectralForm: PolledValue<string>;
  /** The real frequency of this operator for the live note. `TEORÍA`, always. */
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
 * Four things are deliberate here. The role is a **shape** before it is a colour
 * — total curve for a portadora, live corner for a modulador, dashed outline for
 * an operator at zero — so it reads without a legend and without colour vision.
 * The Level is the **height of the fill**, and the number under it only confirms
 * what the height already said. The routes come from the algorithm the ring read
 * and are laid out by chain depth, so any of the 88 draws without a hand-made
 * sheet (`layout.ts`). And nothing is guessed: until the algorithm has been read
 * there is no topology, so there is no role and there are no lines, and an
 * algorithm with no entry in the table draws `ALGORITMO SIN TABLA` rather than a
 * plausible diagram of a patch that does not exist.
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

  protected readonly labels = PROVENANCE_LABEL;

  /** `LOS OCHO · 12.2 Hz`, measured, never the documented figure. */
  protected readonly cadence = computed<PolledValue<number>>(() => {
    const hz = this.freshness.cadenceHz();
    return hz === null ? invalidated<number>() : { value: hz, provenance: 'polled', readAt: null };
  });

  /**
   * The drawing, rebuilt only when the algorithm changes: the gateway holds the
   * topology behind an equality on its number, so the dozen events a second the
   * ring emits do not relay out the diagram a dozen times a second.
   */
  private readonly drawing = computed(() => layout(this.backend.topology()));

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

  /** The loop, with `FB n` beside it — the value the ring read, or the dash. */
  protected readonly feedback = computed(() => {
    const arc = this.drawing().feedback;
    if (arc === null) {
      return null;
    }
    const value = this.freshness.stamp(this.backend.patch().feedback);
    return {
      ...arc,
      label: `FB ${value.value ?? DEAD_MARK}`,
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
      spectralForm,
      hz: this.theoryHz(ratio.value),
      stamp: weakest([role, level, ratio, spectralForm]),
      box: {
        left: this.share(slot.x, drawn.width),
        top: this.share(slot.y, drawn.height),
        width: this.share(NODE_W, drawn.width),
        height: this.share(NODE_H, drawn.height),
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
   * It is `TEORÍA` however fresh the ratio behind it is: the reading was polled,
   * the multiplication was not, and one stamp per figure means the number that is
   * on screen has to say which of the two it is.
   */
  private theoryHz(ratio: number | null): PolledValue<string> {
    const pitch = this.backend.lowestLivePitch();
    if (pitch === null || ratio === null) {
      return invalidated<string>();
    }
    const hz = equalTemperamentHz(pitch) * ratio;
    return { value: hz.toFixed(hz < 1000 ? 2 : 1), provenance: 'theory', readAt: null };
  }
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

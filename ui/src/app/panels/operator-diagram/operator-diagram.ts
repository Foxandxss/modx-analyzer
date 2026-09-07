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
import { PROVENANCE_LABEL } from '../../provenance/provenance';
import { equalTemperamentHz } from './theory';

/** What the role is called on the node. UI copy is Spanish; identifiers are not. */
const ROLE_LABEL: Readonly<Record<OperatorRole, string>> = {
  carrier: 'PORT',
  modulator: 'MOD',
  inert: 'INACTIVO',
};

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
}

/**
 * The hero column: who is a portadora, who is a modulador, and how loud each one
 * is, drawn from what the anillo ancho read a moment ago.
 *
 * Three things are deliberate here. The role is a **shape** before it is a colour
 * — total curve for a portadora, live corner for a modulador, dashed outline for
 * an operator at zero — so it reads without a legend and without colour vision.
 * The Level is the **height of the fill**, and the number under it only confirms
 * what the height already said. And nothing is guessed: until the algorithm has
 * been read there is no topology, so there is no role, and the eight nodes keep
 * their shape as neutral outlines with a dash in every slot.
 *
 * The routes between the nodes are #12.
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

  protected readonly nodes = computed<NodeView[]>(() =>
    this.backend.operators().operators.map((node) => this.draw(node)),
  );

  private draw(node: OperatorView): NodeView {
    const role = this.freshness.stamp(node.role);
    const level = this.freshness.stamp(node.level);
    const ratio = this.freshness.stamp(node.ratio);
    const spectralForm = this.freshness.stamp(node.spectralForm);

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
    };
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

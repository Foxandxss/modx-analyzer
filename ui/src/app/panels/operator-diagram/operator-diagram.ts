import { ChangeDetectionStrategy, Component } from '@angular/core';
import { invalidated } from '../../backend/backend-gateway';
import { Figure } from '../../provenance/figure';

/** The eight operators, in the order the diagram lays them out. */
const OPERATORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * The hero column: who modulates whom, drawn from what the keyboard says.
 *
 * Until the wide ring reads an algorithm there is no topology and no roles, so
 * the eight nodes keep their shape as neutral outlines and every figure inside
 * them is a dash. No role is guessed and no route is drawn.
 */
@Component({
  selector: 'app-operator-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Figure],
  templateUrl: './operator-diagram.html',
  styleUrl: './operator-diagram.scss',
})
export class OperatorDiagram {
  protected readonly operators = OPERATORS;
  protected readonly dead = invalidated<string>();
  protected readonly deadHz = invalidated<number>();
}

import { OperatorsView, PatchHeaderView, noOperators, noPatch } from '../backend/backend-gateway';
import { lastPollAt } from './last-poll';

function polledAt(readAt: number): PatchHeaderView {
  return {
    ...noPatch(),
    performanceName: { value: 'Init Normal (FM-X)', provenance: 'polled', readAt },
  };
}

function operatorsAt(readAt: number): OperatorsView {
  const view = noOperators();
  return {
    ...view,
    operators: view.operators.map((node, index) =>
      index === 2 ? { ...node, level: { value: 75, provenance: 'polled', readAt } } : node,
    ),
  };
}

describe('lastPollAt', () => {
  it('is nothing at all before the keyboard has answered once', () => {
    expect(lastPollAt(noPatch(), noOperators())).toBeNull();
  });

  it('takes the newest figure of the whole screen, header or diagram', () => {
    expect(lastPollAt(polledAt(1000), operatorsAt(4000))).toBe(4000);
    expect(lastPollAt(polledAt(9000), operatorsAt(4000))).toBe(9000);
  });

  /**
   * The shape the screen has right after an ancla change: the diagram is
   * `INVALIDADO` and carries no stamp at all, and the only thing that has been
   * read is the new name. An invalidated figure counted as a zero would put the
   * last poll at the epoch and the card would say the keyboard answered hours
   * ago while it is answering.
   */
  it('ignores the figures an ancla change took the numbers out of', () => {
    expect(lastPollAt(polledAt(7000), noOperators())).toBe(7000);
  });
});

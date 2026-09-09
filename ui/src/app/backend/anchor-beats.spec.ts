import { ANCHOR_BEAT_HISTORY, AnchorBeat, keepBeat } from './backend-gateway';
import { FakeBackendGateway } from './fake-backend-gateway';

/** A pass that cost what an idle one costs, ending where it is told to. */
function idleBeat(endedAt: number): { startedAt: number; endedAt: number } {
  return { startedAt: endedAt - 40, endedAt };
}

describe('the ancla’s beats, as the front sees them', () => {
  it('has none before the ancla has beaten', () => {
    const backend = new FakeBackendGateway();

    // The app's own first second: the ancla is asking and nothing has answered.
    expect(backend.anchorBeats()).toEqual([]);
  });

  it('carries when the pass started, when it ended, what it answered and the name it read', () => {
    const backend = new FakeBackendGateway();
    backend.anchorReads('Init Normal (FM-X)');

    const beat = backend.anchorBeat({ ...idleBeat(1_000), answer: 'same' });

    expect(backend.anchorBeats()).toEqual([beat]);
    // The two instants are two facts and not one. A pass is not a moment: what it
    // vouches for is everything before `startedAt`, and `endedAt` is only when the
    // answer became known — 40 ms later idle, 200 ms later under notes.
    expect(beat.startedAt).toBe(960);
    expect(beat.endedAt).toBe(1_000);
    expect(beat.answer).toBe('same');
    expect(beat.name).toBe('Init Normal (FM-X)');
  });

  it('numbers the passes in the order they were taken, so a lost one shows as a gap', () => {
    const backend = new FakeBackendGateway();

    const first = backend.anchorBeat({ ...idleBeat(1_000), answer: 'first' });
    const second = backend.anchorBeat({ ...idleBeat(2_000), answer: 'same' });

    expect([first.beat, second.beat]).toEqual([1, 2]);
  });

  it('reports no name at all for a pass with a hole in it', () => {
    const backend = new FakeBackendGateway();
    backend.anchorReads('Init Normal (FM-X)');

    // Two of the twenty letters did not answer. `Init Normal (FM-X)` missing a
    // letter reads as a different name, so the pass is compared with nothing —
    // and reporting the last known name here would be the app claiming a reading
    // it did not take.
    const beat = backend.anchorBeat({ ...idleBeat(2_000), answer: 'incomplete' });

    expect(beat.name).toBeNull();
    expect(beat.answer).toBe('incomplete');
  });

  it('says a change with the name that is loaded now, not the one that was', () => {
    const backend = new FakeBackendGateway();
    backend.anchorReads('Init Normal (FM-X)');

    // The native side's order: the name crosses on the patch event, the pass that
    // read it crosses on its own.
    backend.loadPerformance('Bright FM Keys');
    const beat = backend.anchorBeat({ ...idleBeat(2_000), answer: 'changed' });

    expect(beat.answer).toBe('changed');
    expect(beat.name).toBe('Bright FM Keys');
  });

  it('keeps the last sixteen passes, oldest first, and forgets what is older', () => {
    const backend = new FakeBackendGateway();

    // Twenty beats at the aval floor of 250 ms: four seconds of history, which is
    // more than the medida's 1,5 s window plus the beat that closed before it.
    for (let beat = 1; beat <= ANCHOR_BEAT_HISTORY + 4; beat += 1) {
      backend.anchorBeat({ ...idleBeat(beat * 250), answer: 'same' });
    }

    const kept = backend.anchorBeats();
    expect(kept.length).toBe(ANCHOR_BEAT_HISTORY);
    expect(kept.map((beat) => beat.beat)).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    // Oldest first, so the medida can walk back from the newest.
    expect(kept[0].startedAt).toBeLessThan(kept[kept.length - 1].startedAt);
  });

  it('files the out-of-turn request without inventing the beat that answers it', () => {
    const backend = new FakeBackendGateway();

    void backend.requestAnchorBeat();

    expect(backend.beatRequests).toBe(1);
    // The ancla owns its cadence (ADR-0004): asking is a hint, and under notes the
    // answer is «at the usual second». A gateway that beat here would let a test
    // pass on a beat the keyboard never gave.
    expect(backend.anchorBeats()).toEqual([]);
  });
});

describe('keepBeat', () => {
  const beat = (n: number): AnchorBeat => ({
    beat: n,
    startedAt: n * 1_000,
    endedAt: n * 1_000 + 40,
    answer: 'same',
    name: 'Init Normal (FM-X)',
  });

  it('leaves a history under the bound alone', () => {
    const two = keepBeat([beat(1)], beat(2));

    expect(two).toEqual([beat(1), beat(2)]);
  });

  it('drops exactly the oldest, one per beat, once it is at the bound', () => {
    let history: readonly AnchorBeat[] = [];
    for (let n = 1; n <= ANCHOR_BEAT_HISTORY; n += 1) {
      history = keepBeat(history, beat(n));
    }
    expect(history.length).toBe(ANCHOR_BEAT_HISTORY);

    const rolled = keepBeat(history, beat(ANCHOR_BEAT_HISTORY + 1));

    expect(rolled.length).toBe(ANCHOR_BEAT_HISTORY);
    expect(rolled[0]).toEqual(beat(2));
    expect(rolled[rolled.length - 1]).toEqual(beat(ANCHOR_BEAT_HISTORY + 1));
  });
});

import { MEASURE_WINDOW_MS } from 'modx-dsp';
import { AnchorBeat, BeatAnswer } from './backend-gateway';
import { FakeBackendGateway } from './fake-backend-gateway';

/** What a pass of the ancla costs with nobody playing: fase 0c's ~40 ms. */
const IDLE_PASS_MS = 40;

/**
 * The ancla having watched for a while, so a capture pressed **now** has a pass
 * that closed before its window began.
 *
 * The two beats are the launch and the second after it, put a whole second
 * further back than {@link MEASURE_WINDOW_MS} so the arithmetic is not the thing
 * under test. It is a driver and not a convenience: the times are stated here,
 * where a reader can check them against the window, rather than being chosen by
 * the gateway from what the test seems to want.
 */
export function anchorWatching(backend: FakeBackendGateway, name = 'Init Normal (FM-X)'): void {
  const now = performance.now();
  const before = now - MEASURE_WINDOW_MS - 1_000;
  backend.anchorReads(name);
  backend.anchorBeat({ startedAt: before - IDLE_PASS_MS, endedAt: before, answer: 'first' });
  backend.anchorBeat({ startedAt: now - 2_040, endedAt: now - 2_000, answer: 'same' });
}

/**
 * The out-of-turn pass a capture asked for: it started **after** the press, so it
 * can speak for every sample the window holds.
 *
 * Called straight after the press, before anything is awaited — which is one of
 * the two orders the app has to survive, the beat arriving before the worker's
 * table.
 */
export function anchorAnswers(
  backend: FakeBackendGateway,
  answer: BeatAnswer = 'same',
  name?: string,
): AnchorBeat {
  const now = performance.now();
  return backend.anchorBeat({
    startedAt: now + 1,
    endedAt: now + 1 + IDLE_PASS_MS,
    answer,
    name,
  });
}

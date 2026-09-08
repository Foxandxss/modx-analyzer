import { TestBed } from '@angular/core/testing';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { FakeBackendGateway } from '../backend/fake-backend-gateway';
import { ANCHOR_FLASH_MS, Anchor } from './anchor';
import { Clock } from './clock';

function setUp() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
  });
  return { backend, anchor: TestBed.inject(Anchor), clock: TestBed.inject(Clock) };
}

describe('Anchor', () => {
  it('does not call the first name of the session a change', () => {
    const { backend, anchor } = setUp();

    backend.anchorReads('Init Normal (FM-X)');
    TestBed.tick();

    expect(anchor.changes()).toBe(0);
    expect(anchor.everChanged()).toBe(false);
    expect(anchor.justChanged()).toBe(false);
    expect(anchor.changedAt()).toBeNull();
  });

  it('flashes for 2 200 ms after the Performance changes underneath', () => {
    const { backend, anchor, clock } = setUp();
    backend.anchorReads('Init Normal (FM-X)');
    TestBed.tick();

    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();
    const at = anchor.changedAt();

    expect(at).not.toBeNull();
    expect(anchor.justChanged()).toBe(true);
    expect(anchor.previousName()).toBe('Init Normal (FM-X)');

    // The flash ends because time passed and nothing arrived, which is why the
    // clock has to tick: no event is ever coming to end it.
    clock.now.set(at! + ANCHOR_FLASH_MS - 1);
    expect(anchor.justChanged()).toBe(true);
    // A millisecond past the end and not exactly on it: `at` is a fractional
    // `performance.now()`, so `(at + 2200) - at` is 2200 only when the float
    // rounding happens to come out that way — which is where this test used to
    // flake. Half a nanosecond either side of the boundary is not a state.
    clock.now.set(at! + ANCHOR_FLASH_MS + 1);
    expect(anchor.justChanged()).toBe(false);

    // But the header does not go back to rest: it has changed, and it stays
    // changed for the rest of the session.
    expect(anchor.everChanged()).toBe(true);
  });

  it('counts two changes in a row as two, even back into the same name', () => {
    const { backend, anchor, clock } = setUp();
    backend.anchorReads('Init Normal (FM-X)');
    TestBed.tick();

    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();
    const first = anchor.changedAt();
    clock.now.set(first! + ANCHOR_FLASH_MS + 1);
    expect(anchor.justChanged()).toBe(false);

    // Back to the sound it started on. The name is the one it already had, and
    // it is still a change: what is watched is the counter, not the name.
    backend.loadPerformance('Init Normal (FM-X)');
    TestBed.tick();

    expect(anchor.changes()).toBe(2);
    // The flash is read against the **second** stamp and not against the clock
    // the first one was jumped past: the two stamps come off `performance.now()`
    // milliseconds apart, so anything measured from the first one is measuring
    // how long this test took to run.
    const second = anchor.changedAt();
    expect(second).not.toBe(first);
    clock.now.set(second! + ANCHOR_FLASH_MS - 1);
    expect(anchor.justChanged()).toBe(true);
  });
});

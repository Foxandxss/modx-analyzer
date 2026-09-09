import { MEASURE_WINDOW_MS } from 'modx-dsp';
import { AnchorBeat, BeatAnswer } from '../backend/backend-gateway';
import { CaptureWindow, aval } from './aval';

/**
 * The press at ten seconds, and the window it took: 1 486 ms of already recorded
 * sound ending there.
 */
const PRESS = 10_000;
const WINDOW: CaptureWindow = { from: PRESS - MEASURE_WINDOW_MS, to: PRESS };

/** A pass that cost what an idle one costs, ending where it is told to. */
function beat(
  endedAt: number,
  answer: BeatAnswer,
  name: string | null = 'Init Normal (FM-X)',
): AnchorBeat {
  return {
    beat: Math.round(endedAt),
    startedAt: endedAt - 40,
    endedAt,
    answer,
    name: answer === 'incomplete' ? null : name,
  };
}

/** The ancla at its usual second, watching well before the window began. */
const WATCHING = [beat(6_000, 'first'), beat(7_000, 'same'), beat(8_000, 'same')];

describe('the medida’s aval', () => {
  it('waits while no beat has started after the window’s last sample', () => {
    // The beat at 10 000 ms started at 9 960, which is *inside* the window: it
    // can speak for everything before it began and that is not the whole window.
    expect(aval([...WATCHING, beat(PRESS, 'same')], WINDOW)).toBe('pending');
  });

  it('draws a window bracketed by two passes that read the same name', () => {
    expect(aval([...WATCHING, beat(PRESS + 300, 'same')], WINDOW)).toBe('vouched');
  });

  it('throws the window away when the pass after it says the sound changed', () => {
    // The one failure this whole application exists to prevent: 1,5 s of the old
    // patch, pressed a moment after somebody turned the dial, drawn as MEASURED
    // under the new patch's name.
    const changed = beat(PRESS + 300, 'changed', 'Bright FM Keys');

    expect(aval([...WATCHING, changed], WINDOW)).toBe('discarded');
  });

  it('throws it away when the first whole name of the session arrives after it', () => {
    // `first` invalidates nothing and vouches for nothing: it has no previous
    // name to have found unchanged, so it cannot say the sound stood still.
    expect(aval([beat(PRESS + 300, 'first')], WINDOW)).toBe('discarded');
  });

  it('throws it away when nothing closed before the window began', () => {
    // The launch: the ring filled before the ancla had looked twice. The app was
    // not watching when these samples entered, so it has nothing to say about
    // what was sounding then — which is a refusal, not a pass.
    const late = [beat(PRESS - 200, 'same'), beat(PRESS + 300, 'same')];

    expect(aval(late, WINDOW)).toBe('discarded');
  });

  it('throws it away when the pass before the window read another name', () => {
    // Changed and changed back inside 1,5 s: every beat after it answers `same`
    // and the name at the far end is not the name at this one.
    const before = beat(8_000, 'same', 'Bright FM Keys');

    expect(aval([before, beat(PRESS + 300, 'same')], WINDOW)).toBe('discarded');
  });

  it('skips a pass with a hole in it and waits for the next whole one', () => {
    const holed = [...WATCHING, beat(PRESS + 300, 'incomplete')];

    // A name missing two letters reads as a different name, so the pass is
    // compared with nothing at all: it neither confirms nor denies.
    expect(aval(holed, WINDOW)).toBe('pending');
    expect(aval([...holed, beat(PRESS + 600, 'same')], WINDOW)).toBe('vouched');
  });

  it('skips a holed pass at the near end too, and reads the whole one before it', () => {
    const holed = [beat(7_000, 'same'), beat(8_000, 'incomplete'), beat(PRESS + 300, 'same')];

    expect(aval(holed, WINDOW)).toBe('vouched');
  });

  it('reads the first pass after the window, not the last', () => {
    // The sound changed **after** the capture. That is a change the medida dies
    // of on its own (it is of a patch that is gone), and it is not a reason to
    // call the window itself unvouched.
    const later = [...WATCHING, beat(PRESS + 300, 'same'), beat(PRESS + 1_300, 'changed', 'Other')];

    expect(aval(later, WINDOW)).toBe('vouched');
  });

  it('has nothing to say before the ancla has beaten at all', () => {
    expect(aval([], WINDOW)).toBe('pending');
  });
});

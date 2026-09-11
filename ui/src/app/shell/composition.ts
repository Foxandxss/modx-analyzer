import { Injectable, computed, signal } from '@angular/core';
import { ColumnShape, columnShape } from '../panels/glass-column/column-geometry';

/**
 * The four Vistas vivas, which are exactly what a Ranura can hold.
 *
 * `CONTEXT.md` is explicit that there are four and not three — the armónicos
 * panel was folded into the espectro by habit — and the chooser offers the same
 * four plus empty in both ranuras, always. The strings are the screen's own
 * words, so a stored pair is readable in a devtools inspector.
 */
export type LiveView = 'SPECTRUM' | 'HARMONICS' | 'SCOPE' | 'WATERFALL';

/** In the order the chooser offers them. */
export const LIVE_VIEWS: readonly LiveView[] = ['SPECTRUM', 'HARMONICS', 'SCOPE', 'WATERFALL'];

/** What one Ranura holds: one of the four, or nothing. */
export type Ranura = LiveView | null;

/** The pair. Index 0 is the top half of the column and 1 the bottom, always. */
export type Pair = readonly [Ranura, Ranura];

/** Which of the two ranuras a chooser is speaking for. */
export type RanuraIndex = 0 | 1;

/**
 * `SCOPE` and empty.
 *
 * The scope is the one Vista viva that reads with a held note and no Medida at
 * all, so it is the one panel that has something to say the first time the app
 * opens. The app therefore opens in the **narrow** composición, which is the
 * inversion ADR-0007 exists to record.
 */
export const FACTORY_PAIR: Pair = ['SCOPE', null];

/**
 * What each rail handle gives back before that ranura has held anything.
 *
 * The top gives back the factory pair's own panel and the bottom the first of
 * the four, so the one press that brings a panel back never lands on the panel
 * the other handle would bring: a rail pressed twice fills the column rather
 * than swapping one panel between its two halves.
 */
export const FACTORY_HANDLES: readonly [LiveView, LiveView] = ['SCOPE', 'SPECTRUM'];

/**
 * Where the pin is kept. `localStorage` and no store plugin: it is a preference
 * about how this screen is laid out, not data, so it does not deserve a file, a
 * schema or a migration — and it has to survive a relaunch, which is all
 * «persists» means here.
 */
export const KEEP_IT_BIG_KEY = 'modx.keep-it-big';

/** The pair, on the same path and for the same reason. */
export const RANURAS_KEY = 'modx.ranuras';

/** `SPECTRUM,HARMONICS`, `SCOPE,`, `,`: two fields, empty for an empty ranura. */
const RANURA_SEPARATOR = ',';

/**
 * Which of the two compositions the main screen is in, and what is in the glass
 * column that decides it.
 *
 * The screen is **two compositions of the same elements**, and what chooses
 * between them is **the state of the two Ranuras**: wide when both are empty or
 * when the pin is down, narrow otherwise. That is a change of cause and not of
 * mechanism — it used to be «is there a Medida» — and it is the whole point of
 * the change: *nothing on this screen moves any more that the pianist did not
 * move*. A capture landing changes nothing here, which is why there is a test
 * that says so.
 *
 * Four rules, and the last two are the ones that are not obvious:
 *
 * - **`KEEP IT BIG` is a pin, not a mode.** It forces the wide composición
 *   without touching the stored pair, and letting it up restores the pair
 *   exactly. Emptying and refilling two ranuras is four presses; the pin is one.
 * - **Choosing a panel the other ranura holds swaps the two.** The chooser never
 *   refuses and never offers a different list depending on which ranura it was
 *   opened from, and «no panel is in both» then holds by construction rather
 *   than by a check.
 * - **The waterfall is in one place at a time, and never in none.** The bottom
 *   strip holds it unless a ranura *that is on screen* holds it. So putting
 *   `WATERFALL` in a ranura empties the strip, and pressing `KEEP IT BIG` —
 *   which takes the whole column off screen without touching the pair — hands it
 *   back to the strip rather than leaving the signal undrawn.
 * - **Emptying both leaves a handle behind, and the pin does not.** With both
 *   ranuras empty the column collapses to a rail carrying the two handles, so
 *   one press brings a panel back; with the pin down the column is not there at
 *   all, because `KEEP IT BIG` is itself the handle and it is one press away in
 *   the header of the panel it is about. The three shapes are
 *   {@link columnShape}'s, which is where the boxes for them are.
 * - **The pair is a preference and not data.** Same guarded `localStorage` path
 *   as the pin: no plugin, no schema, no migration. Storage that cannot be read
 *   or that holds something this build does not recognise costs the pair and
 *   nothing else — the app opens on {@link FACTORY_PAIR}.
 */
@Injectable({ providedIn: 'root' })
export class Composition {
  private readonly pin = signal(readPin());

  /** Whether `KEEP IT BIG` is down. It survives a relaunch. */
  readonly pinned = this.pin.asReadonly();

  private readonly pair = signal<Pair>(readPair());

  /** What each of the two ranuras holds. It survives a relaunch. */
  readonly slots = this.pair.asReadonly();

  /**
   * Which of the three shapes the column is in, from the one rule that decides
   * it: {@link columnShape}. The geometry module owns the rule because it is the
   * module that says what each shape's boxes are.
   */
  readonly shape = computed<ColumnShape>(() => {
    const [top, bottom] = this.pair();
    return columnShape([top !== null, bottom !== null], this.pin());
  });

  /** Nothing in the column, or the pin down: the algorithm has the room. */
  readonly wide = computed(() => this.shape() !== 'ranuras');

  /** Whether the two ranuras are on screen with their glass. */
  readonly panels = computed(() => this.shape() === 'ranuras');

  /** Whether what is left of the column is the two handles. */
  readonly rail = computed(() => this.shape() === 'rail');

  /**
   * What the bottom strip holds: the waterfall, or nothing and it collapses.
   *
   * Read {@link panels} and not the pair alone. A ranura that is off screen is
   * not drawing anything, so a pinned wide composición with `WATERFALL` stored
   * in a ranura is a screen with no waterfall on it — and «one place at a time»
   * was never an argument for none.
   */
  readonly strip = computed<LiveView | null>(() =>
    this.panels() && this.pair().includes('WATERFALL') ? null : 'WATERFALL',
  );

  private readonly held = signal<readonly [LiveView, LiveView]>(FACTORY_HANDLES);

  /**
   * What each rail handle would put back, top first.
   *
   * The handle is labelled with it, so the one press the rail promises is a
   * press whose result is written on it. **Not persisted**: it is the memory of
   * a gesture — «I emptied this, put it back» — and a relaunch is not that
   * gesture. What survives a relaunch is the pair, which is the state.
   */
  readonly handles = this.held.asReadonly();

  private readonly scrolled = signal(0);

  /**
   * How far the body has been scrolled to the right, in CSS pixels: `0` at rest
   * and at every width above the floor, because above it there is nothing to
   * scroll.
   *
   * It is here and not in the drawing because the box that scrolls is the body's
   * — `app.ts` owns the scroll container and reports it — and what reads it is
   * the one composición whose bars measure from an origin the scroll can take
   * off screen (`node-geometry.ts`, `originGone()`). Not persisted, and not a
   * preference: it is where a hand left a scrollbar, and the browser puts it back
   * to zero itself the moment the body is wide enough again.
   */
  readonly scrollLeft = this.scrolled.asReadonly();

  /** The body reports where its horizontal scroll is; nothing else sets it. */
  scrollBody(left: number): void {
    this.scrolled.set(left);
  }

  /** Press `KEEP IT BIG`, or let it up. Written through to the next launch. */
  togglePin(): void {
    const next = !this.pin();
    this.pin.set(next);
    write(KEEP_IT_BIG_KEY, next ? 'on' : 'off');
  }

  /**
   * Put `view` in a ranura, or empty it with `null`.
   *
   * When the other ranura already holds `view` the two exchange contents, which
   * is also the only way to reorder the pair.
   */
  choose(ranura: RanuraIndex, view: Ranura): void {
    const pair = this.pair();
    const other: RanuraIndex = ranura === 0 ? 1 : 0;
    const next: Ranura[] = [pair[0], pair[1]];
    next[ranura] = view;
    if (view !== null && pair[other] === view) {
      next[other] = pair[ranura];
    }
    const chosen: Pair = [next[0], next[1]];
    this.pair.set(chosen);
    // Each half remembers the last panel it held, and an emptied one keeps the
    // name it just lost: that is what the rail's handle is labelled with.
    const held = this.held();
    this.held.set([chosen[0] ?? held[0], chosen[1] ?? held[1]]);
    write(RANURAS_KEY, `${chosen[0] ?? ''}${RANURA_SEPARATOR}${chosen[1] ?? ''}`);
  }

  /**
   * Bring a panel back into `ranura` from the rail, in one press.
   *
   * It goes through {@link choose}, so a handle that would restore the panel the
   * other half already holds swaps them instead of drawing it twice — the same
   * rule the chooser obeys, and there is only one of it.
   */
  restore(ranura: RanuraIndex): void {
    this.choose(ranura, this.held()[ranura]);
  }
}

/**
 * A preference is not data: a browser that refuses storage — private mode, a
 * webview started without it — costs the pin and nothing else, so it is read
 * behind a `try` and the app opens in the composition the state asks for.
 */
function readPin(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEEP_IT_BIG_KEY) === 'on';
  } catch {
    return false;
  }
}

function readPair(): Pair {
  try {
    return parsePair(globalThis.localStorage?.getItem(RANURAS_KEY) ?? null) ?? FACTORY_PAIR;
  } catch {
    return FACTORY_PAIR;
  }
}

/**
 * The stored pair, or `null` for anything this build does not recognise — a
 * hand-edited value, a field count from another version, a panel that no longer
 * exists. Every one of those falls back to the factory pair, and the fallback is
 * the same one line as «nothing stored yet».
 */
function parsePair(stored: string | null): Pair | null {
  if (stored === null) {
    return null;
  }
  const fields = stored.split(RANURA_SEPARATOR);
  if (fields.length !== 2) {
    return null;
  }
  const top = parseRanura(fields[0]);
  const bottom = parseRanura(fields[1]);
  return top === undefined || bottom === undefined ? null : [top, bottom];
}

/** `undefined` is «not a word this build knows»; `null` is the empty ranura. */
function parseRanura(field: string): Ranura | undefined {
  if (field === '') {
    return null;
  }
  return LIVE_VIEWS.includes(field as LiveView) ? (field as LiveView) : undefined;
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Nothing to say: the preference holds for this session and is forgotten by
    // the next.
  }
}

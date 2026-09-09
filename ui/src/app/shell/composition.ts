import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AudioService } from '../audio/audio-service';
import { BACKEND_GATEWAY, rereadRunning } from '../backend/backend-gateway';
import { Anchor } from '../provenance/anchor';

/**
 * Where the pin is kept. `localStorage` and no store plugin: it is a preference
 * about how this screen is laid out, not data, so it does not deserve a file, a
 * schema or a migration — and it has to survive a relaunch, which is all
 * «persists» means here.
 */
export const KEEP_IT_BIG_KEY = 'modx.keep-it-big';

/**
 * Which of the two compositions the main screen is in.
 *
 * The screen is **two compositions of the same elements**, and what chooses
 * between them is the most important state in the app: whether there is a
 * capture. With nothing measured, the spectrum and harmonics panels are two
 * empty frames holding the room of the one panel that is legible the moment a
 * patch loads, so the algorithm takes their slack; a capture buys the room back.
 *
 * **A vouched capture and no other kind.** {@link AudioService.medida} is
 * non-null only for a table the ancla spoke for at both ends of its window
 * (#38), so a capture the aval threw away never brings the panels back — not by
 * a second check here, but because there is nothing to check.
 *
 * Three rules, and the third is the one that is not obvious:
 *
 * - **Shrinking is immediate.** The panels come back the moment the capture
 *   lands, because that is the consequence of the press and it should read as
 *   one.
 * - **`KEEP IT BIG` wins over both.** It is a pin, not a mode: it holds the big
 *   composition and nothing else about the app changes.
 * - **Growing back waits for the change to finish being announced.** When a
 *   Performance change voids the capture, the algorithm does *not* grow into the
 *   2 200 ms flash and the relectura strip. Those two are the screen saying what
 *   just happened; a panel resizing underneath them would be a third thing
 *   moving at the same time and the reader would have to guess which of the
 *   three was about which. The flash ends on the clock and the strip ends when
 *   the pass carries how long it took, so the wait always ends.
 */
@Injectable({ providedIn: 'root' })
export class Composition {
  private readonly audio = inject(AudioService);
  private readonly anchor = inject(Anchor);
  private readonly backend = inject(BACKEND_GATEWAY);

  private readonly pin = signal(readPin());

  /** Whether `KEEP IT BIG` is down. It survives a relaunch. */
  readonly pinned = this.pin.asReadonly();

  /**
   * Starts wide, because at launch nothing has been measured and there is
   * nothing for the two live panels to be beside. Everything below moves it.
   */
  private readonly big = signal(true);

  /** The algorithm has the room: the wide composition. */
  readonly wide = this.big.asReadonly();

  /** Whether the spectrum and harmonics panels are on screen at all. */
  readonly panels = computed(() => !this.big());

  /** The relectura is running, which is the same fact the strip draws. */
  private readonly rereading = computed(() => rereadRunning(this.backend.reread()) !== null);

  constructor() {
    effect(() => {
      const room = this.pin() || this.audio.medida() === null;
      const announcing = this.anchor.justChanged() || this.rereading();
      untracked(() => {
        if (!room) {
          // A capture exists and nothing is pinning the big composition: the
          // panels are owed the room back, and they are owed it now.
          this.big.set(false);
          return;
        }
        if (!announcing) {
          this.big.set(true);
        }
      });
    });
  }

  /** Press `KEEP IT BIG`, or let it up. Written through to the next launch. */
  togglePin(): void {
    const next = !this.pin();
    this.pin.set(next);
    writePin(next);
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

function writePin(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(KEEP_IT_BIG_KEY, on ? 'on' : 'off');
  } catch {
    // Nothing to say: the pin holds for this session and is forgotten by the next.
  }
}

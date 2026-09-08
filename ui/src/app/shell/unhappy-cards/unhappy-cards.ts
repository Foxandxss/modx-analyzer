import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AudioService } from '../../audio/audio-service';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { Clock } from '../../provenance/clock';
import { DEAD_MARK } from '../../provenance/provenance';
import { lastPollAt, pollAgeSeconds } from '../../provenance/last-poll';

/**
 * Los estados que no son felices: the two cards this session draws.
 *
 * Both draw **under** the header, like the pánico's notice and the alert strip,
 * so the octagon is reachable in every state the app can be in — which is the
 * one thing that must never depend on which of these is up.
 *
 * They are the two of the design's four that need no write:
 *
 * 1. **Teclado no conectado.** The port is gone from the enumeration or the ancla
 *    has timed out three passes in a row. The audio keeps arriving, so the point
 *    of the card is what is *not* affected: you can look, you cannot read the
 *    patch. `REINTENTAR` enumerates again and reopens.
 * 2. **Sin audio entrando.** Exact digital zeros for one second, decided in Rust
 *    (`crates/modx-audio/src/silence.rs`). Not a level under a threshold: a MODX
 *    with the volume down and a note dying away both make very small numbers, and
 *    only a device that is not delivering makes zeros.
 *
 * Cards 3 (la escritura no se aplicó) and 4 (voy a pisar tu patch) are the two
 * that belong to a write, and this session writes nothing.
 */
@Component({
  selector: 'app-unhappy-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unhappy-cards.html',
  styleUrl: './unhappy-cards.scss',
})
export class UnhappyCards {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly audio = inject(AudioService);
  private readonly clock = inject(Clock);

  /**
   * Which of the two roads it was, or nothing when the link is not lost.
   *
   * It changes one sentence and nothing else: the card is the same card, because
   * to somebody playing they are the same problem.
   */
  protected readonly loss = computed(() => this.backend.connection().loss);

  /**
   * The card hangs off the **reason** and not off `port === 'disconnected'`.
   *
   * The app opens disconnected with no reason — nothing has looked yet — and the
   * port is opened on a thread before the window has run a line of JavaScript.
   * Drawing off the state alone would put the card on screen for the frames
   * between the window appearing and the first `modx://connection` arriving, and
   * a card that says the keyboard is not there before the app has tried to find
   * it is the app guessing.
   */
  protected readonly disconnected = computed(() => this.loss() !== null);

  protected readonly noAudio = this.audio.noAudio;

  /**
   * `DIAGRAMA CONGELADO · ÚLTIMO SONDEO N s`, counted from the newest polled
   * figure on screen and ticked by the clock. With nothing ever read it is the
   * dash: a keyboard that never answered has no last poll, and `0 s` would say
   * it answered just now.
   */
  protected readonly lastPoll = computed(() => {
    const at = lastPollAt(this.backend.patch(), this.backend.operators());
    if (at === null) {
      return DEAD_MARK;
    }
    return `${Math.round(pollAgeSeconds(at, this.clock.now()))} s`;
  });

  /** True between the press of `REINTENTAR` and the port answering one way or the other. */
  protected readonly retrying = signal(false);

  protected async onRetry(): Promise<void> {
    if (this.retrying()) {
      return;
    }
    this.retrying.set(true);
    try {
      await this.backend.retry();
    } catch (reason) {
      // Nothing on screen changes: the card is already saying the keyboard is
      // not there, and it is still true. What the failure adds is a line in the
      // log for whoever is looking at why.
      console.warn('modx: REINTENTAR no encontró el puerto', reason);
    } finally {
      this.retrying.set(false);
    }
  }
}

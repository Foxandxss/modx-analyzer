import { Injectable, inject, signal } from '@angular/core';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';

/**
 * `--panic-ack`. The design token carries both jobs: the button says `HUSHED` for
 * this long, and the notice leaves on its own after it. Nothing asks for a second
 * touch to close.
 */
export const PANIC_ACK_MS = 1500;

/** What the app says after the pánico, and whether it is good news. */
export interface PanicNotice {
  readonly text: string;
  readonly failed: boolean;
}

/**
 * The pánico, as state.
 *
 * The button lives in the header and the notice draws under it, so what they share
 * lives here rather than in either of them. Deliberately not a queue and not a
 * dialog: an emergency is one gesture, so a second press while the first is still
 * acknowledged simply sends again.
 */
@Injectable({ providedIn: 'root' })
export class PanicService {
  private readonly backend = inject(BACKEND_GATEWAY);

  private readonly acknowledged = signal(false);
  private readonly said = signal<PanicNotice | null>(null);
  private clearing: ReturnType<typeof setTimeout> | null = null;

  /** `HUSHED` on the button, for `--panic-ack` after the messages went out. */
  readonly done = this.acknowledged.asReadonly();

  /** The notice under the header, or `null` when there is nothing to say. */
  readonly notice = this.said.asReadonly();

  /**
   * Send it. No confirmation: a «¿seguro?» turns an emergency into two steps.
   *
   * A failure is said out loud instead of swallowed — the pánico is the last thing
   * that stops working, so when it does the owner has to know it did.
   */
  async press(): Promise<void> {
    try {
      const { silenced } = await this.backend.panic();
      const notes = silenced === 1 ? 'Hushed 1 note' : `Hushed ${silenced} notes`;
      this.say({ text: `${notes} · your patch is untouched`, failed: false });
    } catch {
      this.say({ text: 'THE KEYBOARD IS NOT ANSWERING · YOUR PATCH IS UNTOUCHED', failed: true });
    }
  }

  private say(notice: PanicNotice): void {
    if (this.clearing !== null) {
      clearTimeout(this.clearing);
    }
    this.acknowledged.set(true);
    this.said.set(notice);
    this.clearing = setTimeout(() => {
      this.acknowledged.set(false);
      this.said.set(null);
      this.clearing = null;
    }, PANIC_ACK_MS);
  }
}

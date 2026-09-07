import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BACKEND_GATEWAY, invalidated } from '../../backend/backend-gateway';
import { Figure } from '../../provenance/figure';
import { RingFreshness } from '../../provenance/freshness';
import { PanicService } from '../panic/panic-service';

/** The three modes of the app. Only `CREAR` is reachable this session. */
export type Mode = 'CREAR' | 'A/B' | 'APRENDER';

export const MODES: readonly Mode[] = ['CREAR', 'A/B', 'APRENDER'];

/**
 * The bar that never lies and never leaves.
 *
 * It carries the facts of the patch and, at its far right, the pánico — isolated
 * by a rule and 16 px of nothing actionable, and the last thing before the window
 * edge. The unhappy-state cards draw *under* this bar, never over it, so the
 * pánico stays reachable in every state.
 */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Figure],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly panic = inject(PanicService);
  private readonly freshness = inject(RingFreshness);

  /** The pointer that went down on the pánico, until it comes up again. */
  private pressing: number | null = null;

  protected readonly modes = MODES;

  /** Nothing has been read yet, so the transport and the audio line show the dash. */
  protected readonly dead = invalidated<string>();
  protected readonly deadFps = invalidated<number>();

  /** Only CREAR is selectable; the other two are drawn so the layout is final. */
  protected readonly selectedMode: Mode = 'CREAR';

  protected readonly connection = this.backend.connection;
  protected readonly patch = this.backend.patch;
  protected readonly liveNotes = this.backend.liveNotes;

  /**
   * The algorithm and the feedback come off the anillo ancho like everything else
   * in the diagram, so they go `CADUCO` on the same threshold. The header is not
   * allowed to be the one place on screen where a number never gets old.
   */
  protected readonly algorithm = computed(() => this.freshness.stamp(this.patch().algorithm));
  protected readonly feedback = computed(() => this.freshness.stamp(this.patch().feedback));
  protected readonly feedbackOperator = computed(() =>
    this.freshness.stamp(this.patch().feedbackOperator),
  );

  protected readonly portName = computed(() => this.connection().portName);
  protected readonly connected = computed(() => this.connection().port === 'connected');

  /** The pánico fills and glows while any note is live. */
  protected readonly panicLive = computed(() => this.liveNotes() > 0);

  /** The third state: `HECHO` for `--panic-ack` after the messages went out. */
  protected readonly panicDone = this.panic.done;

  /**
   * Nothing happens on the way down. The pánico acts on the way up, so a touch
   * landed by accident and dragged off the octagon costs nothing.
   */
  protected onPanicDown(event: PointerEvent): void {
    this.pressing = event.pointerId;
  }

  protected onPanicUp(event: PointerEvent): void {
    if (this.pressing !== event.pointerId) {
      return;
    }
    this.pressing = null;

    // Touch capture keeps sending us the pointerup even when the finger has left
    // the button, so where it came up has to be checked rather than assumed.
    const target = event.currentTarget as HTMLElement;
    const box = target.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;

    if (inside) {
      void this.panic.press();
    }
  }

  protected onPanicCancel(): void {
    this.pressing = null;
  }

  /**
   * Enter and Space on the focused button. A keyboard `click` carries `detail = 0`,
   * which is how it is told apart from the one the mouse already handled on
   * pointer-up — the alternative is the pánico going out twice per press.
   */
  protected onPanicClick(event: MouseEvent): void {
    if (event.detail === 0) {
      void this.panic.press();
    }
  }

  protected readonly audioLine = computed(() => {
    const { audioDevice, sampleRate } = this.connection();
    if (audioDevice === null || sampleRate === null) {
      return null;
    }
    return `${audioDevice} · ${sampleRate} Hz`;
  });
}

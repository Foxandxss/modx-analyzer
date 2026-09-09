import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { BACKEND_GATEWAY, invalidated } from '../../backend/backend-gateway';
import { Anchor } from '../../provenance/anchor';
import { Figure } from '../../provenance/figure';
import { RingFreshness } from '../../provenance/freshness';
import { AudioService } from '../../audio/audio-service';
import { PanicService } from '../panic/panic-service';
import { CaptureButton } from '../capture/capture-button';

/** The three modes of the app. Only `BUILD` is reachable this session. */
export type Mode = 'BUILD' | 'A/B' | 'LEARN';

export const MODES: readonly Mode[] = ['BUILD', 'A/B', 'LEARN'];

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
  imports: [Figure, CaptureButton],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly panic = inject(PanicService);
  private readonly audio = inject(AudioService);
  private readonly freshness = inject(RingFreshness);
  private readonly anchor = inject(Anchor);

  /** The pointer that went down on the pánico, until it comes up again. */
  private pressing: number | null = null;

  protected readonly modes = MODES;

  /** Nothing has been read yet, so the audio line shows the dash. */
  protected readonly dead = invalidated<string>();

  /**
   * Mirar is continuous and says its own rate, measured. The pastille beats
   * while bloques are arriving and is dead before the first one: a heartbeat on
   * a bridge that is not delivering would be the one lie this bar cannot tell.
   */
  protected readonly fps = this.audio.fps;
  protected readonly looking = computed(() => this.audio.fps() !== null);

  /**
   * Medir is a shutter, and the shutter is its own component: the header draws
   * one, the foot of the measured column draws the other, and both arm off
   * {@link AudioService.canMeasure}. What it never does is disappear — the
   * shutter is half of the transport and the layout is final from the first
   * frame. The header keeps only the keyboard shortcut, which is the header's.
   */
  private readonly canMeasure = this.audio.canMeasure;

  /** Only BUILD is selectable; the other two are drawn so the layout is final. */
  protected readonly selectedMode: Mode = 'BUILD';

  constructor() {
    // The keyboard shortcut of the design's own table — «MEDIR: tocar / atajo de
    // teclado». It is an **extra**: the 56 px button does everything it does, and
    // taking the keyboard away takes no function with it. `M` for medir, with no
    // modifier, and never while somebody is typing in a field.
    const shortcut = (event: KeyboardEvent) => {
      const editing = (event.target as HTMLElement | null)?.isContentEditable === true;
      if (event.key.toLowerCase() !== 'm' || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (!editing && this.canMeasure()) {
        void this.audio.measure();
      }
    };
    document.addEventListener('keydown', shortcut);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', shortcut));
  }

  protected readonly connection = this.backend.connection;
  protected readonly patch = this.backend.patch;
  protected readonly liveNotes = this.backend.liveNotes;

  /** The 2 200 ms after the Performance was changed underneath. */
  protected readonly justChanged = this.anchor.justChanged;

  /**
   * The ancla's third state. After a change the header **does not go back to
   * rest**: it stays saying that this sound has not been measured, because the
   * medida it had was of another one and nothing is going to press MEDIR on the
   * owner's behalf. It is not shown before the first change — at launch nothing
   * has ever been measured and saying so would be noise, not news.
   */
  protected readonly unmeasured = computed(
    () => this.anchor.everChanged() && this.audio.medida() === null,
  );

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

  /** The third state: `HUSHED` for `--panic-ack` after the messages went out. */
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

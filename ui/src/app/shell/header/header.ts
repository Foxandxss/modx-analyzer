import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BACKEND_GATEWAY, invalidated } from '../../backend/backend-gateway';
import { Figure } from '../../provenance/figure';

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

  protected readonly modes = MODES;

  /** Nothing has been read yet, so the transport and the audio line show the dash. */
  protected readonly dead = invalidated<string>();
  protected readonly deadFps = invalidated<number>();

  /** Only CREAR is selectable; the other two are drawn so the layout is final. */
  protected readonly selectedMode: Mode = 'CREAR';

  protected readonly connection = this.backend.connection;
  protected readonly patch = this.backend.patch;
  protected readonly liveNotes = this.backend.liveNotes;

  protected readonly portName = computed(() => this.connection().portName);
  protected readonly connected = computed(() => this.connection().port === 'connected');

  /** The pánico fills and glows while any note is live. */
  protected readonly panicLive = computed(() => this.liveNotes() > 0);

  protected readonly audioLine = computed(() => {
    const { audioDevice, sampleRate } = this.connection();
    if (audioDevice === null || sampleRate === null) {
      return null;
    }
    return `${audioDevice} · ${sampleRate} Hz`;
  });
}

import { BLOCK_FRAMES, CURVE_POINTS, HARMONIC_BARS, MEASURE_WINDOW, SAMPLE_RATE } from 'modx-dsp';
import {
  AudioBridge,
  BlockMeter,
  WARMUP_BLOCKS,
  channelZero,
  decodeBlock,
  decodeMeasureWindow,
} from './bridge';
import { fakeBlock, heldNote, withComb } from './fake-block';

describe('decodeBlock', () => {
  it('reads the header Rust wrote', () => {
    const buffer = fakeBlock({
      sequence: 41,
      sentAtMicros: 1_234_567,
      queuedAtMicros: 1_235_567,
      silent: true,
    });

    const block = decodeBlock(buffer);

    expect(block.sequence).toBe(41);
    expect(block.frames).toBe(BLOCK_FRAMES);
    expect(block.sentAtMicros).toBe(1_234_567);
    expect(block.queuedAtMicros).toBe(1_235_567);
    expect(block.callbackFrames).toBe(441);
    expect(block.silent).toBe(true);
  });

  it('refuses a bloque that is not the length its header claims', () => {
    const short = fakeBlock().slice(0, 100);

    expect(() => decodeBlock(short)).toThrow(/se esperaban/);
  });

  it('takes channel 0 and not channel 1', () => {
    const mono = heldNote(440);
    const block = decodeBlock(fakeBlock({ mono }));

    expect(Array.from(channelZero(block).slice(0, 8))).toEqual(Array.from(mono.slice(0, 8)));
  });
});

describe('BlockMeter', () => {
  it('counts nothing lost when the sequence is unbroken', () => {
    const meter = new BlockMeter();
    for (let sequence = 0; sequence < 10; sequence += 1) {
      meter.observe(decodeBlock(fakeBlock({ sequence })), sequence * 30);
    }

    const stats = meter.stats();
    expect(stats.blocks).toBe(10);
    expect(stats.gaps).toBe(0);
    expect(stats.outOfOrder).toBe(0);
  });

  it('counts every sequence number that never arrived', () => {
    const meter = new BlockMeter();
    for (const sequence of [0, 1, 5, 6]) {
      meter.observe(decodeBlock(fakeBlock({ sequence })), 0);
    }

    expect(meter.stats().gaps).toBe(3);
  });

  it('calls a bloque that came late out of order, not lost', () => {
    const meter = new BlockMeter();
    for (const sequence of [0, 2, 1, 3]) {
      meter.observe(decodeBlock(fakeBlock({ sequence })), 0);
    }

    const stats = meter.stats();
    expect(stats.gaps).toBe(0);
    expect(stats.outOfOrder).toBe(1);
  });

  /**
   * The two clocks start 100 s apart, and every bloque is 30 ms of audio. A run
   * of {@link WARMUP_BLOCKS} on time, then ten more of which one is 12 ms late.
   *
   * `delays` are how late the **worker** got to each bloque; nothing waits in
   * the queue or the IPC, so the lateness is all in one leg and the totals are
   * the delays themselves.
   */
  function run(meter: BlockMeter, delays: readonly number[], offsetMs = 100_000): void {
    delays.forEach((delay, sequence) => {
      const sentAtMicros = sequence * 30_000;
      const postedAt = offsetMs + sentAtMicros / 1000;
      meter.observe(decodeBlock(fakeBlock({ sequence, sentAtMicros })), postedAt + delay, postedAt);
    });
  }

  it('measures the spread of the delivery and not an epoch it cannot see', () => {
    const meter = new BlockMeter();
    const late = Array.from({ length: WARMUP_BLOCKS + 10 }, (_, index) =>
      index === WARMUP_BLOCKS + 2 ? 12 : 0,
    );

    run(meter, late);

    const stats = meter.stats();
    // The unknown 100 s offset is gone: the fastest bloque of the run is zero.
    expect(stats.p50Ms).toBeCloseTo(0, 6);
    expect(stats.maxMs).toBeCloseTo(12, 6);
    expect(stats.measuredBlocks).toBe(10);
  });

  /**
   * #23: every launch delivers its first bloques hundreds of milliseconds late
   * and loses none of them. A percentile taken over a window that still holds
   * that burst is a figure about the launch wearing the name of the bridge, and
   * at 132 bloques `p99` really did read 167,9 ms.
   */
  it('keeps the launch out of the percentiles and reports it on its own', () => {
    const meter = new BlockMeter();
    const delays = Array.from({ length: WARMUP_BLOCKS + 10 }, (_, index) =>
      index === 3 ? 379 : 0,
    );

    run(meter, delays);

    const stats = meter.stats();
    expect(stats.blocks).toBe(WARMUP_BLOCKS + 10);
    expect(stats.warmupBlocks).toBe(WARMUP_BLOCKS);
    expect(stats.measuredBlocks).toBe(10);
    // The burst is nowhere near the figures the go/no-go is read off …
    expect(stats.p99Ms).toBeCloseTo(0, 6);
    expect(stats.maxMs).toBeCloseTo(0, 6);
    // … and it is not hidden either.
    expect(stats.worstWarmup!.totalMs).toBeCloseTo(379, 6);
  });

  it('claims no run at all while the launch is still going on', () => {
    const meter = new BlockMeter();

    run(meter, new Array<number>(WARMUP_BLOCKS).fill(0));

    const stats = meter.stats();
    expect(stats.blocks).toBe(WARMUP_BLOCKS);
    expect(stats.measuredBlocks).toBe(0);
    expect(stats.p99Ms).toBeNull();
    expect(stats.worstMeasured).toBeNull();
  });

  /**
   * The whole point of the second stamp: a bloque that was 200 ms late says
   * **where** it was late. Two of the three legs are exact durations on one
   * clock; only the crossing carries the epoch, and it is the one the floor comes
   * out of, so the three still add up to the total.
   */
  it('says which leg of the path the lateness was spent in', () => {
    const meter = new BlockMeter();
    const offsetMs = 100_000;

    for (let sequence = 0; sequence < WARMUP_BLOCKS + 4; sequence += 1) {
      const sentAtMicros = sequence * 30_000;
      // The fourth bloque waits 200 ms in the queue between the audio thread and
      // the IPC; every bloque waits 5 ms in the worker, and none in the crossing.
      const queued = sentAtMicros + (sequence === 3 ? 200_000 : 0);
      const postedAt = offsetMs + queued / 1000;
      meter.observe(
        decodeBlock(fakeBlock({ sequence, sentAtMicros, queuedAtMicros: queued })),
        postedAt + 5,
        postedAt,
      );
    }

    const burst = meter.stats().worstWarmup!;
    expect(burst.queueMs).toBeCloseTo(200, 6);
    expect(burst.ipcMs).toBeCloseTo(0, 6);
    expect(burst.workerMs).toBeCloseTo(5, 6);
    expect(burst.totalMs).toBeCloseTo(burst.queueMs + burst.ipcMs + burst.workerMs, 9);
    // And where in the capture it was: the fourth bloque, 90 ms in.
    expect(burst.atSeconds).toBeCloseTo(0.09, 6);
  });

  it('reports the device callback size it was told about', () => {
    const meter = new BlockMeter();
    meter.observe(decodeBlock(fakeBlock({ sequence: 0, callbackFrames: 441 })), 0);
    meter.observe(decodeBlock(fakeBlock({ sequence: 1, callbackFrames: 441 })), 0);

    const stats = meter.stats();
    expect(stats.minCallbackFrames).toBe(441);
    expect(stats.maxCallbackFrames).toBe(441);
  });

  /**
   * The number that tells a stall from a slow bloque. The front stops receiving
   * for 230 ms and then takes the backlog at once; the worst of those looks like
   * a delivery 200 ms late, and it is not — it is the front having been away.
   */
  it('reports the longest the front went without a bloque, and when', () => {
    const meter = new BlockMeter();
    const offsetMs = 100_000;

    for (let sequence = 0; sequence < 10; sequence += 1) {
      const sentAtMicros = sequence * 30_000;
      // Nothing arrives between the third bloque and the fourth for 230 ms.
      const stalled = sequence >= 3 ? 200 : 0;
      const postedAt = offsetMs + sentAtMicros / 1000 + stalled;
      meter.observe(decodeBlock(fakeBlock({ sequence, sentAtMicros })), postedAt, postedAt);
    }

    const stats = meter.stats();
    expect(stats.worstGapMs).toBeCloseTo(230, 6);
    // Placed by the bloque that ended the silence: the fourth, 90 ms in.
    expect(stats.worstGapAtSeconds).toBeCloseTo(0.09, 6);
  });

  it('claims nothing before the first bloque', () => {
    const stats = new BlockMeter().stats();

    expect(stats.blocks).toBe(0);
    expect(stats.p99Ms).toBeNull();
    expect(stats.worstWarmup).toBeNull();
    expect(stats.worstGapMs).toBeNull();
    expect(stats.worstMeasured).toBeNull();
  });
});

describe('AudioBridge · el enganche', () => {
  /** Bloques of one continuous note, enough to fill the scope's history. */
  function play(bridge: AudioBridge, note: number, blocks = 8) {
    let frame = bridge.receive(fakeBlock({ mono: heldNote(note, 0) }), 0);
    for (let sequence = 1; sequence < blocks; sequence += 1) {
      frame = bridge.receive(
        fakeBlock({ sequence, mono: heldNote(note, sequence * BLOCK_FRAMES) }),
        sequence * 30,
      );
    }
    return frame;
  }

  it('locks to the note the keyboard says it is holding, and cuts four cycles', () => {
    const bridge = new AudioBridge();
    bridge.setNote(261.626);

    const frame = play(bridge, 261.626);

    expect(frame.scope.kind).toBe('locked');
    expect(frame.scope.kind === 'locked' && frame.scope.frequencyHz).toBe(261.626);
    expect(frame.trace!.length).toBeCloseTo((4 * SAMPLE_RATE) / 261.626, 0);
  });

  it('refuses with no held note, whatever is coming down the cable', () => {
    // Audio with the MIDI port gone: the espectro still has an axis to draw
    // against, and the scope still has nothing it is entitled to lock to.
    const frame = play(new AudioBridge(), 261.626);

    expect(frame.scope.kind === 'noLock' && frame.scope.reason).toBe('noHeldNote');
    expect(frame.drawnHz).toBeCloseTo(261.626, 0);
  });

  it('refuses under a chord: two pitches have no fundamental', () => {
    const bridge = new AudioBridge();
    bridge.setNote(261.626, 3);

    const frame = play(bridge, 261.626);

    expect(frame.scope.kind === 'noLock' && frame.scope.reason).toBe('moreThanOneNote');
  });

  it('draws nothing at all when the audio is digital zeros', () => {
    const bridge = new AudioBridge();

    const frame = bridge.receive(fakeBlock({ silent: true }), 0);

    expect(frame.trace).toBeNull();
    expect(frame.scope.kind).toBe('belowFloor');
    expect(frame.drawnHz).toBeNull();
    expect(bridge.stats().silent).toBe(true);
  });

  it('takes fc from the last capture ahead of the note the keyboard says', () => {
    // The branch waits for the fit: nothing in the build calls this setter.
    const bridge = new AudioBridge();
    bridge.setNote(261.626);
    bridge.setCapturedFc(130.813);

    const frame = play(bridge, 130.813);

    expect(frame.scope.kind === 'locked' && frame.scope.frequencyHz).toBe(130.813);
  });

  it('keeps the trace still while the bloques are cut at arbitrary phases', () => {
    const bridge = new AudioBridge();
    const note = 261.626;
    bridge.setNote(note);
    let last: Float32Array | null = null;

    for (let sequence = 0; sequence < 12; sequence += 1) {
      const frame = bridge.receive(
        fakeBlock({ sequence, mono: heldNote(note, sequence * BLOCK_FRAMES) }),
        sequence * 30,
      );
      if (sequence >= 8 && frame.trace !== null) {
        if (last !== null) {
          expect(frame.trace.length).toBe(last.length);
          for (let index = 0; index < frame.trace.length; index += 13) {
            expect(Math.abs(frame.trace[index] - last[index])).toBeLessThan(0.02);
          }
        }
        last = frame.trace;
      }
    }

    expect(last).not.toBeNull();
  });
});

describe('AudioBridge · la vista viva', () => {
  /** Enough bloques for the 4 096 window to be full of the note and nothing else. */
  function hold(bridge: AudioBridge, frequency: number, blocks = 5) {
    let frame = bridge.receive(fakeBlock({ mono: heldNote(frequency, 0) }), 0);
    for (let sequence = 1; sequence < blocks; sequence += 1) {
      frame = bridge.receive(
        fakeBlock({ sequence, mono: heldNote(frequency, sequence * BLOCK_FRAMES) }),
        sequence * 30,
      );
    }
    return frame;
  }

  it('trae la curva, las barras y la nota contra la que están dibujadas', () => {
    const frame = hold(new AudioBridge(), 261.626);

    expect(frame.trama.curve).toHaveLength(CURVE_POINTS);
    expect(frame.trama.harmonics).toHaveLength(HARMONIC_BARS);
    expect(frame.trama.fundamentalHz).toBeCloseTo(261.626, 0);
    // A pure tone: the first bar is the peak and the second is far under it.
    expect(frame.trama.harmonics![0]).toBeCloseTo(0, 0);
    expect(frame.trama.harmonics![1]).toBeLessThan(-60);
  });

  it('dibuja el eje contra la nota pulsada y no contra el periodo que midió', () => {
    // The keyboard says C3 while the audio is a C4. The axis follows the
    // keyboard: it is the note somebody is playing, and the strongest line of an
    // FM timbre is not the note.
    const bridge = new AudioBridge();
    bridge.setNote(130.813);

    const frame = hold(bridge, 261.626);

    expect(frame.trama.fundamentalHz).toBe(130.813);
    expect(frame.drawnHz).toBe(130.813);
  });

  it('marca el comb del generador con su frecuencia y no lo cuenta como armónico', () => {
    const bridge = new AudioBridge();
    let frame = bridge.receive(fakeBlock({ mono: withComb(heldNote(261.626, 0), 0) }), 0);
    for (let sequence = 1; sequence < 5; sequence += 1) {
      frame = bridge.receive(
        fakeBlock({
          sequence,
          mono: withComb(heldNote(261.626, sequence * BLOCK_FRAMES), sequence * BLOCK_FRAMES),
        }),
        sequence * 30,
      );
    }

    expect(frame.trama.artefactHz).toBeCloseTo(2756.25, 2);
    const comb = frame.trama.partials.filter((partial) => partial.kind === 'artefact');
    expect(comb.length).toBeGreaterThan(0);
    for (const line of comb) {
      expect(line.harmonic).toBeNull();
    }
  });

  it('no dibuja nada cuando no entra nada, ni una línea plana', () => {
    const frame = new AudioBridge().receive(fakeBlock({ silent: true }), 0);

    expect(frame.trama.curve).toBeNull();
    expect(frame.trama.harmonics).toBeNull();
    expect(frame.trama.partials).toEqual([]);
  });

  it('mide lo que cuesta cada trama en vez de suponerlo', () => {
    const bridge = new AudioBridge();
    const frame = hold(bridge, 261.626);

    expect(frame.tramaMs).toBeGreaterThanOrEqual(0);
    const stats = bridge.stats();
    expect(stats.tramaP50Ms).not.toBeNull();
    expect(stats.tramaMaxMs).toBeGreaterThanOrEqual(stats.tramaP50Ms!);
  });
});

describe('AudioBridge · la medida', () => {
  /** A window of a held note, the way `measure_window` hands it over. */
  function window(frequency: number | null, samples = MEASURE_WINDOW): ArrayBuffer {
    const mono = new Float32Array(samples);
    if (frequency !== null) {
      for (let index = 0; index < samples; index += 1) {
        mono[index] = 0.5 * Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE);
      }
    }
    return mono.buffer as ArrayBuffer;
  }

  it('lee la ventana cruda: f32 little-endian y ni un byte de cabecera', () => {
    const samples = decodeMeasureWindow(window(261.626));

    expect(samples).toHaveLength(MEASURE_WINDOW);
    expect(samples[0]).toBeCloseTo(0, 6);
  });

  it('rechaza una ventana que no mide lo que va a analizar', () => {
    // Una muestra de menos sería un espectro medido en silencio sobre otra
    // duración: no falla, miente.
    expect(() => decodeMeasureWindow(window(440, MEASURE_WINDOW - 1))).toThrow(/se esperaban/);
  });

  it('analiza 65 536 muestras contra la nota que el teclado está sujetando', () => {
    const bridge = new AudioBridge();
    bridge.setNote(261.626);

    const { medida } = bridge.measure(window(261.626));

    expect(medida).not.toBeNull();
    expect(medida!.window).toBe(MEASURE_WINDOW);
    expect(medida!.fundamentalHz).toBe(261.626);
    expect(medida!.partials[0]!.harmonic).toBe(1);
    expect(medida!.partials[0]!.hz).toBeCloseTo(261.6, 0);
  });

  it('no inventa una tabla cuando el obturador se abre sobre el silencio', () => {
    const { medida } = new AudioBridge().measure(window(null));

    expect(medida).toBeNull();
  });

  it('mide lo que le cuesta, que no es el presupuesto de una trama', () => {
    const { costMs } = new AudioBridge().measure(window(440));

    expect(costMs).toBeGreaterThanOrEqual(0);
  });
});

describe('AudioBridge · la nota que mide', () => {
  it('mide contra el eje que el espectro está dibujando, no contra nada', () => {
    // Sin puerto MIDI el espectro sigue dibujando su eje sobre el periodo que
    // midió el scope. Una tabla que se negara a numerar las mismas líneas que el
    // eje está numerando serían las dos mitades de la pantalla discrepando sobre
    // qué nota suena.
    const bridge = new AudioBridge();
    for (let sequence = 0; sequence < 6; sequence += 1) {
      bridge.receive(
        fakeBlock({ sequence, mono: heldNote(440, sequence * BLOCK_FRAMES) }),
        sequence * 30,
      );
    }

    const window = new Float32Array(MEASURE_WINDOW);
    for (let index = 0; index < window.length; index += 1) {
      window[index] = 0.5 * Math.sin((2 * Math.PI * 440 * index) / SAMPLE_RATE);
    }
    const { medida } = bridge.measure(window.buffer as ArrayBuffer);

    expect(medida!.fundamentalHz).toBeCloseTo(440, 0);
    expect(medida!.partials[0]!.harmonic).toBe(1);
  });
});

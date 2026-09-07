import { BLOCK_FRAMES, CURVE_POINTS, HARMONIC_BARS } from 'modx-dsp';
import { AudioBridge, BlockMeter, channelZero, decodeBlock } from './bridge';
import { fakeBlock, heldNote, withComb } from './fake-block';

describe('decodeBlock', () => {
  it('reads the header Rust wrote', () => {
    const buffer = fakeBlock({ sequence: 41, sentAtMicros: 1_234_567, silent: true });

    const block = decodeBlock(buffer);

    expect(block.sequence).toBe(41);
    expect(block.frames).toBe(BLOCK_FRAMES);
    expect(block.sentAtMicros).toBe(1_234_567);
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

  it('measures the spread of the delivery and not an epoch it cannot see', () => {
    // The two clocks start 100 s apart. Every bloque is 30 ms of audio; the third
    // one arrives 12 ms late and the rest are on time.
    const meter = new BlockMeter();
    const offsetMs = 100_000;
    const late = [0, 0, 12, 0, 0, 0, 0, 0, 0, 0];
    late.forEach((delay, sequence) => {
      const sentAtMicros = sequence * 30_000;
      meter.observe(
        decodeBlock(fakeBlock({ sequence, sentAtMicros })),
        offsetMs + sentAtMicros / 1000 + delay,
      );
    });

    const stats = meter.stats();
    // The unknown 100 s offset is gone: the fastest bloque of the run is zero.
    expect(stats.p50Ms).toBeCloseTo(0, 6);
    expect(stats.maxMs).toBeCloseTo(12, 6);
  });

  it('reports the device callback size it was told about', () => {
    const meter = new BlockMeter();
    meter.observe(decodeBlock(fakeBlock({ sequence: 0, callbackFrames: 441 })), 0);
    meter.observe(decodeBlock(fakeBlock({ sequence: 1, callbackFrames: 441 })), 0);

    const stats = meter.stats();
    expect(stats.minCallbackFrames).toBe(441);
    expect(stats.maxCallbackFrames).toBe(441);
  });

  it('claims nothing before the first bloque', () => {
    const stats = new BlockMeter().stats();

    expect(stats.blocks).toBe(0);
    expect(stats.p99Ms).toBeNull();
  });
});

describe('AudioBridge', () => {
  it('hands back a trace of two cycles of the note that is playing', () => {
    const bridge = new AudioBridge();
    // Three bloques of a continuous 261.626 Hz, so the history is full.
    for (let sequence = 0; sequence < 3; sequence += 1) {
      bridge.receive(
        fakeBlock({ sequence, mono: heldNote(261.626, sequence * BLOCK_FRAMES) }),
        sequence * 30,
      );
    }

    const frame = bridge.receive(
      fakeBlock({ sequence: 3, mono: heldNote(261.626, 3 * BLOCK_FRAMES) }),
      90,
    );

    expect(frame.frequencyHz).toBeCloseTo(261.626, 0);
    expect(frame.trace!.length).toBeCloseTo((2 * 44100) / 261.626, 0);
  });

  it('draws nothing at all when the audio is digital zeros', () => {
    const bridge = new AudioBridge();

    const frame = bridge.receive(fakeBlock({ silent: true }), 0);

    expect(frame.trace).toBeNull();
    expect(frame.frequencyHz).toBeNull();
    expect(bridge.stats().silent).toBe(true);
  });

  it('keeps the trace still while the bloques are cut at arbitrary phases', () => {
    const bridge = new AudioBridge();
    const note = 261.626;
    let last: Float32Array | null = null;

    for (let sequence = 0; sequence < 8; sequence += 1) {
      const frame = bridge.receive(
        fakeBlock({ sequence, mono: heldNote(note, sequence * BLOCK_FRAMES) }),
        sequence * 30,
      );
      if (sequence >= 4 && frame.trace !== null) {
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
    expect(frame.frequencyHz).toBeCloseTo(261.626, 0);
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

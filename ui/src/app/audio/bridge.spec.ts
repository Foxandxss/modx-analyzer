import { BLOCK_FRAMES } from 'modx-dsp';
import { AudioBridge, BlockMeter, channelZero, decodeBlock } from './bridge';
import { fakeBlock, heldNote } from './fake-block';

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

// Cuts the four fase 0 WAVs down to the vector this package tests against.
//
//   node golden/trim.mjs <carpeta wav de modx-spike-fase0>
//
// Three things happen and each one is a decision:
//
// - **Channel 0 only.** The two channels of the fase 0 captures are identical
//   sample to sample (mono source, centred) and the analysis reads channel 0
//   anyway, so the second one is 875 KB of a copy.
// - **131 072 frames from second 1.0.** That is 2.97 s — the same span the ring
//   buffer holds — and it starts after the attack of the latest of the four (the
//   sine does not begin until 0.844 s), so every vector is steady state from its
//   first sample. It leaves room for the 65 536 window of the medida with a whole
//   window to spare.
// - **float32 is kept.** These vectors have a noise floor at −105 dB; 16 bit has
//   its own at −96 dB and would replace the number under test.
//
// The originals stay in the spike, untouched. What this writes is what the tests
// read, and it is reproducible from one command.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILES = ['fmx-1op-sine', 'fmx-ratio2-modlow', 'fmx-ratio2-modhigh', 'fmx-ratio1414'];
const SKIP_FRAMES = 44100;
const FRAMES = 131072;

const source = process.argv[2];
if (source === undefined) {
  console.error('uso: node golden/trim.mjs <carpeta wav de modx-spike-fase0>');
  process.exit(1);
}

for (const name of FILES) {
  const wav = readWav(readFileSync(join(source, `${name}.wav`)));
  if (wav.channels !== 2 || wav.sampleRate !== 44100) {
    throw new Error(`${name}: se esperaban 2 canales a 44100 Hz`);
  }

  const mono = new Float32Array(FRAMES);
  let worstChannelGap = 0;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const index = (SKIP_FRAMES + frame) * wav.channels;
    mono[frame] = wav.samples[index];
    worstChannelGap = Math.max(
      worstChannelGap,
      Math.abs(wav.samples[index] - wav.samples[index + 1]),
    );
  }

  writeFileSync(join(import.meta.dirname, `${name}.wav`), writeMonoWav(mono, wav.sampleRate));
  console.log(`${name}: ${FRAMES} frames, mayor diferencia entre canales ${worstChannelGap}`);
}

function readWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('no es un WAV');
  }
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bits = buffer.readUInt16LE(offset + 22);
    }
    if (id === 'data') {
      if (bits !== 32) {
        throw new Error(`se esperaba float32, hay ${bits} bits`);
      }
      const samples = new Float32Array(size / 4);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = buffer.readFloatLE(offset + 8 + index * 4);
      }
      return { channels, sampleRate, samples };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('sin trozo data');
}

function writeMonoWav(samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 4);
  for (let index = 0; index < samples.length; index += 1) {
    data.writeFloatLE(samples[index], index * 4);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(32, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

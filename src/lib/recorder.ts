/**
 * Web Audio PCM capture -> complete 16 kHz mono WAV files.
 * Recorder fragments (MediaRecorder timeslices) are not decodable server-side,
 * so every upload here is a whole WAV file.
 */
export type Recording = { blob: Blob; seconds: number };

type Handle = {
  stop: () => Promise<Recording>;
  cancel: () => void;
};

export async function startRecording(): Promise<Handle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];

  node.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(node);
  node.connect(ctx.destination);

  const teardown = async () => {
    stream.getTracks().forEach((t) => t.stop());
    node.disconnect();
    source.disconnect();
    const rate = ctx.sampleRate;
    await ctx.close();
    return rate;
  };

  return {
    cancel: () => void teardown(),
    stop: async () => {
      const rate = await teardown();
      const flat = concat(chunks);
      const down = downsample(flat, rate, 16000);
      return { blob: encodeWav(down, 16000), seconds: flat.length / rate };
    },
  };
}

function concat(chunks: Float32Array[]) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let i = 0;
  for (const c of chunks) {
    out.set(c, i);
    i += c.length;
  }
  return out;
}

function downsample(input: Float32Array, from: number, to: number) {
  if (to >= from) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j] ?? 0;
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Rough loudness/pace signals the browser can see — context, not a biomarker. */
export function basicAcoustics(recording: Recording, words: number) {
  const wordsPerMinute = recording.seconds > 0 ? (words / recording.seconds) * 60 : 0;
  return {
    seconds: Math.round(recording.seconds),
    wordsPerMinute: Math.round(wordsPerMinute),
  };
}

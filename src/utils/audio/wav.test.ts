/**
 * Tests for the shared 16-bit PCM WAV helpers (utils/audio/wav.ts) —
 * the save's canonical audio shape, encoded by every platform's skin
 * picker. A local buildWav builder constructs fixtures the same way the
 * encoder does (independent of pcmToWavDataUri's header layout, so the
 * parse/encode pair is cross-checked, not tautological).
 */
import { parseWav, pcmToWavDataUri, bytesToBase64 } from "./wav";

/** Build a raw 16-bit PCM WAV (RIFF) byte string for parser fixtures. */
function buildWav(
  samplesI16: Int16Array,
  sampleRate: number,
  channels: number = 1,
): Uint8Array {
  const frame = channels * 2;
  const nBytes = samplesI16.length * frame;
  const buf = new ArrayBuffer(44 + nBytes);
  const view = new DataView(buf);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + nBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * frame, true);
  view.setUint16(32, frame, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, nBytes, true);
  for (let i = 0; i < samplesI16.length * channels; i++) {
    view.setInt16(44 + i * 2, samplesI16[i % samplesI16.length], true);
  }
  return new Uint8Array(buf);
}

function sine(count: number, rate: number, freq: number): Int16Array {
  const out = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 0x4000);
  }
  return out;
}

describe("bytesToBase64", () => {
  it("matches the reference alphabet for known vectors", () => {
    expect(bytesToBase64(new Uint8Array([65]))).toBe("QQ==");
    expect(bytesToBase64(new Uint8Array([65, 66]))).toBe("QUI=");
    expect(bytesToBase64(new Uint8Array([65, 66, 67]))).toBe("QUJD");
    expect(bytesToBase64(new Uint8Array([0, 0xff, 0xfe, 1]))).toBe("AP/+AQ==");
  });

  it("round-trips arbitrary payloads", () => {
    const bytes = new Uint8Array(1000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) & 0xff;
    const b64 = bytesToBase64(bytes);
    // Global base64 decode (Node/jest env) as the independent oracle.
    const back = Uint8Array.from(
      atob(b64).split("").map((c) => c.charCodeAt(0)),
    );
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });
});

describe("parseWav", () => {
  it("decodes 16-bit PCM mono to normalized floats", () => {
    const pcm = new Int16Array([0, 0x7fff, -0x8000, 100, -100]);
    const parsed = parseWav(buildWav(pcm, 22050));
    expect(parsed).not.toBeNull();
    expect(parsed!.sampleRate).toBe(22050);
    expect(parsed!.samples.length).toBe(5);
    expect(parsed!.samples[0]).toBe(0);
    expect(parsed!.samples[1]).toBeCloseTo(0x7fff / 32768, 6);
    expect(parsed!.samples[2]).toBeCloseTo(-1, 6);
    expect(parsed!.samples[3]).toBeCloseTo(100 / 32768, 6);
    expect(parsed!.samples[4]).toBeCloseTo(-100 / 32768, 6);
  });

  it("averages stereo channels to mono", () => {
    // Per-frame channel values: frame k is (L_k, R_k), averaged to mono.
    const pcm = new Int16Array([1000, 2000]);
    const parsed = parseWav(buildWav(pcm, 8000, 2));
    expect(parsed).not.toBeNull();
    expect(parsed!.samples.length).toBe(2);
    expect(parsed!.samples[0]).toBeCloseTo(1500 / 32768, 6);
    expect(parsed!.samples[1]).toBeCloseTo(1500 / 32768, 6);
  });

  it("rejects non-RIFF, non-PCM, 8-bit, 32-bit, and truncated input", () => {
    const good = buildWav(sine(100, 8000, 440), 8000);
    expect(parseWav(new Uint8Array(44))).toBeNull(); // too short
    expect(parseWav(new Uint8Array(good.slice(0, 30)))).toBeNull(); // truncated
    const notRiff = new Uint8Array(good);
    notRiff[0] = 0x00;
    expect(parseWav(notRiff)).toBeNull();
    const notWave = new Uint8Array(good);
    notWave[8] = 0x00;
    expect(parseWav(notWave)).toBeNull();
    // 8-bit and 32-bit depth are not real skin-sound sources.
    const eightBit = buildWav(new Int16Array([100, -100]), 8000);
    const view8 = eightBit;
    const v8 = new DataView(view8.buffer);
    v8.setUint16(34, 8, true);
    expect(parseWav(new Uint8Array(v8.buffer))).toBeNull();
    const v32 = new DataView(eightBit.buffer);
    v32.setUint16(34, 32, true);
    expect(parseWav(new Uint8Array(v32.buffer))).toBeNull();
  });

  it("rejects a missing data chunk", () => {
    const fmtOnly = new Uint8Array(12 + 8 + 16);
    const view = new DataView(fmtOnly.buffer);
    view.setUint32(0, 0x52494646, true); // RIFF
    view.setUint32(4, 4 + fmtOnly.length - 8, true);
    view.setUint32(8, 0x57415645, true); // WAVE
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true);
    expect(parseWav(fmtOnly)).toBeNull();
  });
});

describe("pcmToWavDataUri / parseWav round-trip", () => {
  it("round-trips a sine clip through the save shape", () => {
    const rate = 22050;
    const count = rate; // exactly 1 s — well inside the 3 s swing cap
    const floats = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      floats[i] = Math.sin((2 * Math.PI * 440 * i) / rate) * 0.5;
    }
    const uri = pcmToWavDataUri(floats, rate);
    expect(uri.startsWith("data:audio/wav;base64,")).toBe(true);
    const bytes = Uint8Array.from(
      atob(uri.slice("data:audio/wav;base64,".length))
        .split("")
        .map((c) => c.charCodeAt(0)),
    );
    const parsed = parseWav(bytes);
    expect(parsed).not.toBeNull();
    expect(parsed!.sampleRate).toBe(rate);
    expect(parsed!.samples.length).toBe(count);
    // 16-bit quantization: sample accuracy is 1/32768.
    for (let i = 0; i < count; i += 977) {
      expect(Math.abs(parsed!.samples[i] - floats[i])).toBeLessThan(1 / 32768);
    }
  });
});

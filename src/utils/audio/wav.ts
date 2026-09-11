/**
 * Minimal 16-bit PCM WAV helpers shared by the custom-skin audio pickers
 * (docs/todo.md custom-skinning line).
 *
 * The swing sound is stored in the save as a size-capped WAV data URI, so
 * every platform funnels into ONE encoder here:
 *  - **web**: AudioContext.decodeAudioData produces the Float32 samples;
 *  - **native**: `parseWav` decodes the picked file (16-bit PCM WAV only —
 *    mobile audio decoders are a native dependency; anything else is
 *    rejected and the caller toasts "use a plain .wav").
 *
 * Everything is pure JS (no btoa — native has no base64 builtin), so it
 * runs identically on Hermes, JSC, and Node (tests).
 */

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encode bytes as base64 (no padding-stripping — data URIs keep the
 * standard `=` padding). Chunked so the intermediate string never exceeds
 * V8/Hermes comfortable lengths.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const n = bytes.length;
  const out: string[] = [];
  let i = 0;
  for (; i + 3 <= n; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out.push(
      B64_ALPHABET.charAt(v >> 18),
      B64_ALPHABET.charAt((v >> 12) & 63),
      B64_ALPHABET.charAt((v >> 6) & 63),
      B64_ALPHABET.charAt(v & 63),
    );
  }
  const rem = n - i;
  if (rem === 1) {
    const v = bytes[i] << 16;
    out.push(
      B64_ALPHABET.charAt(v >> 18),
      B64_ALPHABET.charAt((v >> 12) & 63),
      "=",
      "=",
    );
  } else if (rem === 2) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out.push(
      B64_ALPHABET.charAt(v >> 18),
      B64_ALPHABET.charAt((v >> 12) & 63),
      B64_ALPHABET.charAt((v >> 6) & 63),
      "=",
    );
  }
  return out.join("");
}

/**
 * Mono Float32 samples in [-1, 1] → 16-bit PCM mono WAV →
 * `data:audio/wav;base64,…` URI. The save's canonical audio shape.
 */
export function pcmToWavDataUri(
  samples: Float32Array,
  sampleRate: number,
): string {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits
  writeStr(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
}

export interface WavPcm {
  /** The file's sample rate (Hz). */
  sampleRate: number;
  /** Mono samples in [-1, 1] (a stereo file is averaged to one channel). */
  samples: Float32Array;
}

/**
 * Decode a 16-bit PCM WAV file into mono Float32 samples. Returns null
 * (never throws) for anything that is not exactly that: not a RIFF/WAVE
 * container, non-PCM format, non-16-bit depth, or a missing/too-short
 * fmt/data chunk — the caller toasts "use a plain .wav" and keeps going.
 */
export function parseWav(bytes: Uint8Array): WavPcm | null {
  if (bytes.length < 44) return null;
  const str = (off: number, n: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(off, off + n)));
  if (str(0, 4) !== "RIFF" || str(8, 4) !== "WAVE") return null;
  let sampleRate = 0;
  let channels = 0;
  let fmtSeen = false;
  let off = 12;
  while (off + 8 <= bytes.length) {
    const type = str(off, 4);
    const len =
      bytes[off + 4] |
      (bytes[off + 5] << 8) |
      (bytes[off + 6] << 16) |
      (bytes[off + 7] << 24);
    const dataStart = off + 8;
    if (dataStart + len > bytes.length) return null; // truncated chunk
    if (type === "fmt ") {
      if (len < 16 || fmtSeen) return null;
      fmtSeen = true;
      const audioFormat = bytes[dataStart] | (bytes[dataStart + 1] << 8);
      channels = bytes[dataStart + 2] | (bytes[dataStart + 3] << 8);
      sampleRate =
        bytes[dataStart + 4] |
        (bytes[dataStart + 5] << 8) |
        (bytes[dataStart + 6] << 16) |
        (bytes[dataStart + 7] << 24);
      const bitDepth = bytes[dataStart + 14] | (bytes[dataStart + 15] << 8);
      // Only plain 16-bit PCM mono/stereo is a real skin-sound source —
      // float IEEE (3) and compressed formats (mp3-in-RIFF is not a thing,
      // but 8-bit/24-bit/32-bit PCM are) are rejected like the PNG path
      // rejects 16-bit images.
      if (
        audioFormat !== 1 ||
        bitDepth !== 16 ||
        (channels !== 1 && channels !== 2) ||
        sampleRate <= 0
      ) {
        return null;
      }
    } else if (type === "data") {
      if (len < 2) return null;
      const frameBytes = 2 * channels;
      const frameCount = Math.floor(len / frameBytes);
      if (frameCount <= 0) return null;
      const samples = new Float32Array(frameCount);
      for (let i = 0; i < frameCount; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) {
          const o = dataStart + i * frameBytes + c * 2;
          let v = bytes[o] | (bytes[o + 1] << 8); // int16 LE
          if (v > 32767) v -= 65536; // sign-extend (0x8000 = -32768)
          sum += v;
        }
        samples[i] = sum / channels / 32768;
      }
      return { sampleRate, samples };
    }
    off = dataStart + len + (len & 1); // chunks are word-aligned
  }
  return null;
}

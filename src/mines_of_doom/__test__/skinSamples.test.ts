/**
 * Samples for the custom-skin line (docs/todo.md "add a few sample
 * sprites and sounds to custom skin iap and test uploading"): every
 * sample must be safe to hand to the SAME save-slot code an upload goes
 * through — setPickaxeGrid / setAudio re-normalize and reject anything
 * that would not survive a save round-trip, so a sample that fails these
 * nets would silently no-op in the shop (or worse, break the slot). This
 * suite pins that the generated data is slot-valid, uniquely id'd, and
 * carries previews the shop can render.
 */
import {
  CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH,
  CUSTOM_SKIN_GRID_SIZE,
  activePickaxeArt,
  defaultCustomSkin,
  hasCustomSkinPixels,
  normalizeCustomSkinAudio,
  normalizeCustomSkinGrid,
  normalizeCustomSkinSave,
} from "../customSkin";
import {
  SKIN_SAMPLE_PICKAXES,
  SKIN_SAMPLE_SOUNDS,
  skinSamplePickaxeById,
  skinSampleSoundById,
} from "../skinSamples";

describe("sample pickup set (the data module)", () => {
  it("offers a few of each kind (the todo's 'a few sample sprites and sounds')", () => {
    expect(SKIN_SAMPLE_PICKAXES.length).toBeGreaterThanOrEqual(1);
    expect(SKIN_SAMPLE_SOUNDS.length).toBeGreaterThanOrEqual(1);
  });

  it("ids are unique within each list (and across: one 'skinSample' i18n namespace)", () => {
    const all = [...SKIN_SAMPLE_PICKAXES, ...SKIN_SAMPLE_SOUNDS].map(
      (s) => s.id,
    );
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("sample pickaxe sprites", () => {
  it.each(SKIN_SAMPLE_PICKAXES)(
    "$name: a 16×16 visible grid the pickaxe slot accepts",
    (s) => {
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(s.uri.startsWith("data:image/png;base64,")).toBe(true);
      expect(s.uri.length).toBeGreaterThan(0);
      // The exact funnel an upload's grid must pass before the save
      // keeps it (setPickaxeGrid → normalizeCustomSkinGrid).
      const normalized = normalizeCustomSkinGrid(s.grid);
      expect(normalized).not.toBeNull();
      expect(normalized).toHaveLength(CUSTOM_SKIN_GRID_SIZE);
      expect(hasCustomSkinPixels(normalized)).toBe(true);
      for (const row of normalized as (string | null)[][]) {
        expect(row).toHaveLength(CUSTOM_SKIN_GRID_SIZE);
      }
    },
  );

  it("equipping a sample is the same operation as storing an upload", () => {
    const sample = SKIN_SAMPLE_PICKAXES[0];
    const skin = {
      ...defaultCustomSkin(),
      unlocked: true,
      equipped: true,
      pickaxeGrid: normalizeCustomSkinGrid(sample.grid),
    };
    // The player miner's override resolves to the sample's grid…
    expect(activePickaxeArt(skin)).toEqual(
      normalizeCustomSkinGrid(sample.grid),
    );
    // …and the slot survives a full save round-trip (like any upload).
    expect(normalizeCustomSkinSave(skin).pickaxeGrid).toEqual(
      normalizeCustomSkinGrid(sample.grid),
    );
  });
});

describe("sample swing sounds", () => {
  it.each(SKIN_SAMPLE_SOUNDS)(
    "$name: a short WAV data URI the audio slot accepts",
    (s) => {
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(s.glyph.length).toBeGreaterThan(0);
      // The exact funnel an upload's URI must pass before the save
      // keeps it (setAudio → normalizeCustomSkinAudio).
      expect(normalizeCustomSkinAudio(s.uri)).toBe(s.uri);
      expect(s.uri.length).toBeLessThanOrEqual(
        CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH,
      );
    },
  );

  it("equipping a sample is the same operation as storing an upload", () => {
    const sample = SKIN_SAMPLE_SOUNDS[0];
    const skin = {
      ...defaultCustomSkin(),
      unlocked: true,
      audio: normalizeCustomSkinAudio(sample.uri),
    };
    expect(normalizeCustomSkinSave(skin).audio).toBe(sample.uri);
  });
});

describe("lookup helpers", () => {
  it("resolve known ids and return null for unknown ones (future library changes)", () => {
    expect(skinSamplePickaxeById(SKIN_SAMPLE_PICKAXES[0].id)).toBe(
      SKIN_SAMPLE_PICKAXES[0],
    );
    expect(skinSampleSoundById(SKIN_SAMPLE_SOUNDS[0].id)).toBe(
      SKIN_SAMPLE_SOUNDS[0],
    );
    expect(skinSamplePickaxeById("no-such-pickaxe")).toBeNull();
    expect(skinSampleSoundById("no-such-sound")).toBeNull();
  });
});

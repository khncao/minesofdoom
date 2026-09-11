/**
 * Regression nets for the bundled sprite library (bundledSprites.ts —
 * the CC0 2D art the custom-skin line offers). The generated module ships
 * data URIs, so the nets decode them for real: a broken base64 or a
 * truncated PNG must fail here, not in the player's sprite.
 */
import {
  BUNDLED_SPRITES,
  BUNDLED_SPRITE_IDS,
  bundledSpriteById,
} from "../bundledSprites";
import { pngBytesToRgba } from "src/utils/graphics/customSprite";

describe("bundled sprite library", () => {
  it("has a non-trivial, stable id set", () => {
    expect(BUNDLED_SPRITE_IDS.length).toBeGreaterThanOrEqual(4);
    // ids are unique and kebab-case (they live in the save)
    const ids = BUNDLED_SPRITES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("every entry is CC0-licensed with a source page (transparency)", () => {
    for (const s of BUNDLED_SPRITES) {
      expect(s.license).toBe("CC0-1.0");
      expect(s.sourceUrl).toMatch(/^https:\/\/freegamesprites\.com\//);
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it("every uri decodes to a real PNG of the declared size", () => {
    for (const s of BUNDLED_SPRITES) {
      expect(s.uri).toMatch(/^data:image\/png;base64,/);
      const bytes = Buffer.from(s.uri.split(",")[1], "base64");
      const rgba = pngBytesToRgba(bytes);
      expect(rgba).not.toBeNull();
      if (rgba === null) continue;
      // declared IHDR dimensions must match the metadata
      expect(rgba.width).toBe(s.width);
      expect(rgba.height).toBe(s.height);
      // the art is not blank: at least one opaque pixel
      expect(rgba.data.some((a) => a > 0)).toBe(true);
    }
  });

  it("bundledSpriteById resolves known ids and rejects unknown ones", () => {
    expect(bundledSpriteById(BUNDLED_SPRITES[0].id)?.uri).toBe(
      BUNDLED_SPRITES[0].uri,
    );
    expect(bundledSpriteById("no-such-sprite")).toBeNull();
  });
});

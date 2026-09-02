import fs from "node:fs";
import path from "node:path";
import {
  CAVE_THEMES,
  DEFAULT_OWNED,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  DEFAULT_CAVE_THEME,
  DEFAULT_OWNED_CAVE_THEMES,
  OUTFITS,
  PICKAXES,
  getCaveTheme,
  getCaveThemeCost,
  getCostGems,
  getOutfit,
  getPickaxe,
  getPickaxeFeel,
  getThemeTint,
  isCaveThemeId,
  isOutfitId,
  isPickaxeId,
  rosterSeed,
  rollMinerLook,
} from "../cosmetics";

const HEX6 = /^#[0-9a-f]{6}$/i;

describe("catalog", () => {
  test("ids are unique across outfits and pickaxes", () => {
    const ids = [...OUTFITS.map((o) => o.id), ...PICKAXES.map((p) => p.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every color is 6-digit hex (the PNG encoder requires it)", () => {
    for (const o of OUTFITS) {
      for (const c of [...o.shirts, ...o.pants, ...o.boots, ...o.hats]) {
        expect(c).toMatch(HEX6);
      }
      expect(o.hatStyles.length).toBeGreaterThan(0);
    }
    for (const p of PICKAXES) {
      for (const c of [p.theme.head, p.theme.glow, p.theme.handle]) {
        expect(c).toMatch(HEX6);
      }
    }
  });

  test("defaults exist, are free, and are in DEFAULT_OWNED", () => {
    expect(DEFAULT_OWNED).toEqual([DEFAULT_OUTFIT, DEFAULT_PICKAXE]);
    expect(getOutfit(DEFAULT_OUTFIT).costGems).toBe(0);
    expect(getPickaxe(DEFAULT_PICKAXE).costGems).toBe(0);
  });

  test("unknown ids fall back to the defaults", () => {
    expect(getOutfit("nope").id).toBe(DEFAULT_OUTFIT);
    expect(getPickaxe("nope").id).toBe(DEFAULT_PICKAXE);
    expect(isOutfitId("nope")).toBe(false);
    expect(isPickaxeId("nope")).toBe(false);
    expect(getCostGems("nope")).toBeUndefined();
    expect(getCostGems(DEFAULT_PICKAXE)).toBe(0);
  });
});

describe("pickaxe feel + unique sounds (plan §5.2)", () => {
  test("every feel is a positive, renderable animation value", () => {
    for (const p of PICKAXES) {
      expect(p.feel.swingMs).toBeGreaterThan(0);
      expect(p.feel.bounceDepth).toBeGreaterThan(0);
      // Bounce depth stays inside a body-sized range (sprites are 20–44px).
      expect(p.feel.bounceDepth).toBeLessThanOrEqual(12);
    }
  });

  test("the catalog has distinct swing speeds (unique animations)", () => {
    const swings = new Set(PICKAXES.map((p) => p.feel.swingMs));
    expect(swings.size).toBe(PICKAXES.length);
  });

  test("each pickaxe names a sound file that exists in public/assets", () => {
    for (const p of PICKAXES) {
      expect(p.soundFile).toBe(`audio/pickaxe-${p.id}.wav`);
      const file = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "public",
        "assets",
        p.soundFile,
      );
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(100);
    }
  });

  test("getPickaxeFeel falls back to the default pickaxe", () => {
    expect(getPickaxeFeel("nope")).toEqual(getPickaxeFeel(DEFAULT_PICKAXE));
  });
});

describe("cave themes", () => {
  test("ids are unique and disjoint from outfits/pickaxes", () => {
    const ids = [
      ...OUTFITS.map((o) => o.id),
      ...PICKAXES.map((p) => p.id),
      ...CAVE_THEMES.map((t) => t.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every theme has exactly 5 valid hex tints (one per depth tier)", () => {
    for (const t of CAVE_THEMES) {
      expect(t.tints).toHaveLength(5);
      for (const c of t.tints) {
        expect(c).toMatch(HEX6);
      }
    }
  });

  test("default theme is free and is the only owned-by-default id", () => {
    expect(DEFAULT_OWNED_CAVE_THEMES).toEqual([DEFAULT_CAVE_THEME]);
    expect(getCaveTheme(DEFAULT_CAVE_THEME).costGems).toBe(0);
  });

  test("unknown ids fall back to the default theme", () => {
    expect(getCaveTheme("nope").id).toBe(DEFAULT_CAVE_THEME);
    expect(isCaveThemeId("nope")).toBe(false);
    expect(getCaveThemeCost("nope")).toBeUndefined();
    expect(getCaveThemeCost(DEFAULT_CAVE_THEME)).toBe(0);
  });

  test("getThemeTint indexes by depth tier and clamps bad indices", () => {
    const theme = getCaveTheme("amethyst");
    for (let i = 0; i < 5; i++) {
      expect(getThemeTint(theme, i)).toBe(theme.tints[i]);
    }
    expect(getThemeTint(theme, -1)).toBe(theme.tints[0]);
    expect(getThemeTint(theme, 99)).toBe(theme.tints[4]);
  });
});

describe("rollMinerLook", () => {
  test("is deterministic per (seed, outfit)", () => {
    expect(rollMinerLook(7, "classic")).toEqual(rollMinerLook(7, "classic"));
  });

  test("stays within the outfit's palette", () => {
    const outfit = getOutfit("crystal");
    for (let seed = 0; seed < 20; seed++) {
      const look = rollMinerLook(seed, "crystal");
      expect(outfit.shirts).toContain(look.shirt);
      expect(outfit.pants).toContain(look.pants);
      expect(outfit.boots).toContain(look.boots);
      expect(outfit.hats).toContain(look.hat);
      expect(outfit.hatStyles).toContain(look.hatStyle);
      expect(look.skin).toMatch(HEX6);
    }
  });

  test("different seeds produce different looks", () => {
    const looks = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(rollMinerLook(i, "classic")),
      ),
    );
    expect(looks.size).toBeGreaterThan(1);
  });

  test("different outfits draw from different palettes", () => {
    const a = rollMinerLook(1, "classic");
    const b = rollMinerLook(1, "magma");
    // Same seed, different pool: at least one field should differ.
    expect(a).not.toEqual(b);
  });
});

describe("rosterSeed", () => {
  test("deterministic and collision-free across the visible roster", () => {
    const seeds = Array.from({ length: 50 }, (_, i) => rosterSeed(99, i));
    expect(seeds).toEqual(
      Array.from({ length: 50 }, (_, i) => rosterSeed(99, i)),
    );
    expect(new Set(seeds).size).toBe(50);
  });

  test("follows the player seed (reroll reshuffles the crew)", () => {
    expect(rosterSeed(1, 3)).not.toBe(rosterSeed(2, 3));
  });
});

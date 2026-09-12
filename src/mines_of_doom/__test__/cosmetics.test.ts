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
  rosterDisplay,
  ROSTER_MAX_PER_TYPE,
  ROSTER_ASSIGNABLE_SLOTS,
} from "../cosmetics";

const HEX6 = /^#[0-9a-f]{6}$/i;

describe("catalog", () => {
  test("ids are unique across outfits and pickaxes", () => {
    const ids = [...OUTFITS.map((o) => o.id), ...PICKAXES.map((p) => p.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every color is 6-digit hex (the PNG encoder requires it)", () => {
    for (const o of OUTFITS) {
      for (const c of [
        ...o.shirts,
        ...o.pants,
        ...o.boots,
        ...o.hats,
        ...(o.fur ?? []),
      ]) {
        expect(c).toMatch(HEX6);
      }
      expect(o.hatStyles.length).toBeGreaterThan(0);
      // An animal body has no fur color of its own: the outfit MUST supply
      // a pool (rollMinerLook only falls back to SKIN_TONES as a guard).
      if (o.species === "animal") {
        expect(o.fur?.length ?? 0).toBeGreaterThan(0);
      }
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

describe("homage line (plan §4.5 / art todo)", () => {
  test("homage outfits exist, are paid, and carry a blurb credit", () => {
    const homage = OUTFITS.filter((o) => o.blurb);
    expect(homage.length).toBeGreaterThanOrEqual(5);
    for (const o of homage) {
      expect(o.costGems).toBeGreaterThan(0);
      expect(o.id).not.toBe(DEFAULT_OUTFIT);
    }
  });

  test("homage themes exist, are the premium tier, and carry a blurb credit", () => {
    const paid = CAVE_THEMES.filter((t) => t.id !== DEFAULT_CAVE_THEME);
    const homage = paid.filter((t) => t.blurb);
    expect(homage.length).toBeGreaterThanOrEqual(5);
    const maxBaseCost = Math.max(...paid.filter((t) => !t.blurb).map((t) => t.costGems));
    for (const t of homage) {
      // Homage themes sit strictly above the base line in price.
      expect(t.costGems).toBeGreaterThan(maxBaseCost);
    }
  });

  test("homage names are original (no game trademarks in names or blurbs)", () => {
    const brands = [
      "minecraft",
      "terraria",
      "dark souls",
      "bloodborne",
      "sekiro",
      "mojang",
      "fromsoftware",
    ];
    const strings = [
      ...OUTFITS.flatMap((o) => [o.name, o.blurb ?? ""]),
      ...CAVE_THEMES.flatMap((t) => [t.name, t.blurb ?? ""]),
    ];
    for (const s of strings) {
      for (const b of brands) {
        expect(s.toLowerCase()).not.toContain(b);
      }
    }
  });
});

describe("critter + hair line (mineral skins: animals & long hair)", () => {
  test("the animal line exists: paid critter outfits with fur pools", () => {
    const critters = OUTFITS.filter((o) => o.species === "animal");
    expect(critters.length).toBeGreaterThanOrEqual(3);
    for (const o of critters) {
      expect(o.costGems).toBeGreaterThan(0);
      expect(o.id).not.toBe(DEFAULT_OUTFIT);
      expect(o.fur?.length ?? 0).toBeGreaterThan(0);
      expect(o.blurb).toBeDefined();
    }
    // The critters cover distinct fur palettes (not one recolor).
    const palettes = new Set(critters.map((o) => (o.fur ?? []).sort().join(",")));
    expect(palettes.size).toBe(critters.length);
  });

  test("the hair line exists: a paid outfit wearing long hair", () => {
    const haired = OUTFITS.filter((o) => o.hatStyles.includes("longhair"));
    expect(haired.length).toBeGreaterThanOrEqual(1);
    for (const o of haired) {
      expect(o.costGems).toBeGreaterThan(0);
      expect(o.species ?? "human").toBe("human");
    }
  });

  test("rollMinerLook honors species: animal fur from the outfit pool", () => {
    for (const o of OUTFITS) {
      const species = o.species ?? "human";
      for (let seed = 0; seed < 10; seed++) {
        const look = rollMinerLook(seed, o.id);
        expect(look.species).toBe(species);
        if (species === "animal") {
          expect(o.fur).toContain(look.skin);
        } else {
          expect(look.skin).toMatch(HEX6);
        }
        expect(o.hatStyles).toContain(look.hatStyle);
      }
    }
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

describe("rosterDisplay", () => {
  test("empty crew renders nothing", () => {
    expect(rosterDisplay(0, 0, 0)).toEqual([]);
  });

  test("a small crew lines up nearest-first: normal, fast, legendary", () => {
    const items = rosterDisplay(2, 1, 1);
    expect(items.map((i) => i.kind)).toEqual([
      "normal",
      "normal",
      "fast",
      "legendary",
    ]);
    expect(items.map((i) => i.index)).toEqual([0, 1, 0, 0]);
  });

  test("each following row of a type shrinks (depth perspective), never grows", () => {
    const items = rosterDisplay(4, 2, 1);
    // Monotonic WITHIN each type (legendary's bigger base is deliberate —
    // the premium crew stays imposing even far up the shaft).
    for (const kind of ["normal", "fast", "legendary"] as const) {
      const scales = items
        .filter((i) => i.kind === kind)
        .map((i) => i.scale);
      for (let i = 1; i < scales.length; i++) {
        expect(scales[i]).toBeLessThan(scales[i - 1]);
      }
    }
    // The nearest normal hire is always the biggest crew row.
    expect(items[0].scale).toBeGreaterThan(items[items.length - 1].scale);
  });

  test("types are capped per ROSTER_MAX_PER_TYPE and stay in hire order", () => {
    const items = rosterDisplay(50, 10, 5);
    expect(items.filter((i) => i.kind === "normal")).toHaveLength(
      ROSTER_MAX_PER_TYPE.normal,
    );
    expect(items.filter((i) => i.kind === "fast")).toHaveLength(
      ROSTER_MAX_PER_TYPE.fast,
    );
    expect(items.filter((i) => i.kind === "legendary")).toHaveLength(
      ROSTER_MAX_PER_TYPE.legendary,
    );
    // Slots 0..cap-1 only — the shop's assignable slots map 1:1 to these.
    const normalSlots = items
      .filter((i) => i.kind === "normal")
      .map((i) => i.index);
    expect(normalSlots).toEqual(
      Array.from({ length: ROSTER_MAX_PER_TYPE.normal }, (_, i) => i),
    );
    // The nearest row renders first (first hire at the front).
    expect(items[0]).toMatchObject({ kind: "normal", index: 0 });
  });

  test("the assignable-slot cap matches the visible normal crew", () => {
    expect(ROSTER_ASSIGNABLE_SLOTS).toBe(ROSTER_MAX_PER_TYPE.normal);
    const items = rosterDisplay(ROSTER_ASSIGNABLE_SLOTS, 0, 0);
    // Every offered slot has exactly one visible miner.
    expect(items).toHaveLength(ROSTER_ASSIGNABLE_SLOTS);
    expect(items.map((i) => i.index)).toEqual(
      Array.from({ length: ROSTER_ASSIGNABLE_SLOTS }, (_, i) => i),
    );
  });

  test("junk (negative / fractional / NaN) counts are clamped to zero", () => {
    expect(rosterDisplay(Number.NaN, -3, 2.9).map((i) => i.kind)).toEqual([
      "legendary",
    ]);
  });
});

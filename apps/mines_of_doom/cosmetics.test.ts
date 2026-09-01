import {
  DEFAULT_OWNED,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  OUTFITS,
  PICKAXES,
  getCostGems,
  getOutfit,
  getPickaxe,
  isOutfitId,
  isPickaxeId,
  rosterSeed,
  rollMinerLook,
} from "./cosmetics";

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

import fs from "node:fs";
import path from "node:path";
import {
  DIRECTION_GRID_SIZE,
  TOOLS,
  buildDirectionGrid,
  minerLabels,
  pickaxeLabels,
  shapeForLook,
} from "src/utils/graphics/characterArt";
import type { MaterialId } from "src/utils/graphics/characterArt";
import {
  CAVE_THEMES,
  DEFAULT_OWNED,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  DEFAULT_CAVE_THEME,
  DEFAULT_OWNED_CAVE_THEMES,
  OUTFITS,
  PICKAXES,
  REROLL_COST_GEMS,
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
import { DAILY_QUEST_GEMS } from "../dailyQuests";
import { WEEKLY_GEM_BONUS } from "../weeklyChallenge";

const HEX6 = /^#[0-9a-f]{6}$/i;

/** Materials a label map actually used (nulls dropped). */
const labelsUsed = (g: (string | null)[][]): Set<MaterialId> =>
  new Set(g.flat().filter((m): m is MaterialId => m != null));

describe("reroll price (todo: \"add a 1 gem cost for rerolling outfit\")", () => {
  test("is one gem — a rounding error, not a wall", () => {
    expect(REROLL_COST_GEMS).toBe(1);
  });

  test("is far below the cheapest paid cosmetic, and covers itself free", () => {
    const cheapestPaid = Math.min(
      ...OUTFITS.filter((o) => o.costGems > 0).map((o) => o.costGems),
      ...PICKAXES.filter((p) => p.costGems > 0).map((p) => p.costGems),
    );
    expect(REROLL_COST_GEMS).toBeLessThan(cheapestPaid);
    // Free-path viability (guardrail 1): the daily quests alone pay ~31
    // gems a month, so a player never has to buy one.
    expect(DAILY_QUEST_GEMS * 30 + WEEKLY_GEM_BONUS * 4).toBeGreaterThan(
      REROLL_COST_GEMS * 30,
    );
  });
});

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

describe("the pickaxe line is eight TOOLS, not eight colors", () => {
  test("every pickaxe owns a distinct, real tool", () => {
    const tools = PICKAXES.map((p) => p.tool);
    // One tool per cosmetic — a shared tool is a recolor, which is exactly
    // what this axis exists to stop.
    expect(new Set(tools).size).toBe(PICKAXES.length);
    for (const tool of tools) {
      expect(TOOLS.map((t) => t.id)).toContain(tool);
    }
    // …and the tool table has no member the catalog does not use.
    expect([...TOOLS.map((t) => t.id)].sort()).toEqual([...tools].sort());
  });

  test("each tool has its own silhouette (and a name worth showing)", () => {
    const grids = PICKAXES.map((p) =>
      buildDirectionGrid("papercut", "pickaxe", { pickaxe: p.theme, tool: p.tool }),
    );
    const names = PICKAXES.map((p) => p.toolName);
    for (const name of names) expect(name.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    for (let i = 0; i < grids.length; i++) {
      for (let j = i + 1; j < grids.length; j++) {
        let same = 0;
        for (let y = 0; y < grids[i].length; y++) {
          for (let x = 0; x < grids[i][y].length; x++) {
            if (grids[i][y][x] === grids[j][y][x]) same++;
          }
        }
        // The same three-color theme on two tools would be a recolor: the
        // geometry has to differ, not just the palette.
        expect(same / DIRECTION_GRID_SIZE ** 2).toBeLessThan(0.93);
      }
    }
  });

  test("a tool draws nothing but head, shine and handle", () => {
    // The pickaxe palette only maps those three, so a tool that reaches for
    // another material would render it as an unrelated base color.
    for (const p of PICKAXES) {
      const used = new Set(
        pickaxeLabels(p.tool)
          .flat()
          .filter((m): m is NonNullable<typeof m> => m != null),
      );
      expect([...used].sort()).toEqual(["blade", "bladeShine", "handle"]);
    }
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
    const maxBaseCost = Math.max(
      ...paid.filter((t) => !t.blurb).map((t) => t.costGems),
    );
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
    const palettes = new Set(
      critters.map((o) => (o.fur ?? []).sort().join(",")),
    );
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
        // An authored character wears its own hat; the rest roll theirs out
        // of the pool. Either way the style has to be one the outfit ships.
        if (o.shape?.hatStyle) {
          expect(look.hatStyle).toBe(o.shape.hatStyle);
          expect(o.hatStyles).toContain(look.hatStyle);
        } else {
          expect(o.hatStyles).toContain(look.hatStyle);
        }
        // The hat's COLOR still comes from the outfit's pool.
        expect(o.hats).toContain(look.hat);
      }
    }
  });
});

describe("every PAID outfit is a character, not a recolor", () => {
  // The line's rule, and the regression for what it used to be: every outfit
  // was a palette, so buying one bought the default miner in new colors.
  // Asserted on the drawn LABEL MAP (the body), because a silhouette is not
  // a color question.
  const outline = (outfitId: string, seed = 3): string =>
    minerLabels(shapeForLook(rollMinerLook(seed, outfitId)))
      .map((row) => row.map((c) => (c == null ? "." : c[0])).join(""))
      .join("\n");
  const paid = OUTFITS.filter((o) => o.costGems > 0);

  test("every paid outfit ships a shape; the free starter does not", () => {
    for (const o of paid) expect(o.shape).toBeDefined();
    // The starter is deliberately the plain default miner — it is what a
    // player has before buying anything.
    expect(getOutfit(DEFAULT_OUTFIT).shape).toBeUndefined();
  });

  test("no two paid outfits draw the same body", () => {
    const byShape = new Map<string, string[]>();
    for (const o of paid) {
      const key = outline(o.id);
      byShape.set(key, [...(byShape.get(key) ?? []), o.id]);
    }
    // The failure names the outfits that collided.
    expect([...byShape.values()].filter((ids) => ids.length > 1)).toEqual([]);
  });

  test("no paid outfit is the default miner", () => {
    const plain = outline(DEFAULT_OUTFIT);
    const sameAsDefault = paid
      .filter((o) => outline(o.id) === plain)
      .map((o) => o.id);
    expect(sameAsDefault).toEqual([]);
  });

  test("an outfit is a fixed character: the seed rerolls colors, not the body", () => {
    for (const o of paid) {
      const bodies = new Set(
        Array.from({ length: 8 }, (_, i) => outline(o.id, i)),
      );
      expect([...bodies]).toHaveLength(1);
      // …while the colors still vary, so two players wearing it differ.
      const colors = new Set(
        Array.from({ length: 8 }, (_, i) => {
          const l = rollMinerLook(i, o.id);
          return `${l.shirt}${l.pants}${l.hat}`;
        }),
      );
      expect(colors.size).toBeGreaterThan(1);
    }
  });

  test("the critter outfits stay critters and the damsel reads as one", () => {    for (const o of paid) {
      const labels = minerLabels(shapeForLook(rollMinerLook(3, o.id)));
      const used = new Set(labels.flat().filter((m) => m != null));
      // A critter outfit has no skin-coloured cheeks: its muzzle and ears are
      // the tell, and the human arms must not be there.
      if ((o.species ?? "human") === "animal") {
        expect(used.has("boots")).toBe(true); // feet, not boots
      }
    }
    const damsel = paid.find((o) => o.shape?.gown === true);
    expect(damsel).toBeDefined();
    const labels = minerLabels(shapeForLook(rollMinerLook(3, damsel!.id)));
    const used = new Set(labels.flat().filter((m) => m != null));
    // The gown reaches the floor and hides the boots — the one read that
    // says "not a miner in a costume".
    expect(used.has("boots")).toBe(false);
    expect(used.has("shirt")).toBe(true);
    // …and her silhouette is her own.
    expect(outline(damsel!.id)).not.toBe(outline(DEFAULT_OUTFIT));
  });
});

describe("an outfit has to look like its NAME", () => {
  // The complaint that produced this block: the Crimson Oni was a guy in a
  // bone-white headband. A namesake that the sprite does not evoke is a
  // mislabeled recolor, so the mark and the palette are part of the contract,
  // not decoration.
  const paid = OUTFITS.filter((o) => o.costGems > 0);
  const get = (id: string) => getOutfit(id);
  const MARKS = ["horns", "plume", "hood", "crystal", "goggles"] as const;
  const NO_MARK = "none" as const;

  test("the crimson oni is crimson and has horns", () => {
    const oni = get("oni");
    expect(oni.shape?.crown).toBe("horns");
    // Every colour in every pool is RED-dominant: an oni in teal is as wrong
    // as an oni in white, and dark desaturated shadows are fine, so the test
    // is "red wins" rather than "is saturated".
    const red = (hex: string): boolean => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return r > g && r > b;
    };
    for (const pool of [oni.hats, oni.shirts, oni.pants, oni.boots]) {
      for (const hex of pool) expect(`${hex} ${red(hex)}`).toBe(`${hex} true`);
    }
    // The headband specifically has to be VIVID crimson — the bone-white hat
    // this replaces was the visible bug.
    const vivid = oni.hats.some((hex) => {
      const [r, g] = [1, 3].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return r - g > 80;
    });
    expect(vivid).toBe(true);
  });

  test("the themed tributes wear a mark, so the name reads at player size", () => {
    // Each of these names a THING (a creature, a fantasy, a job) — a mark
    // over the headwear is what makes it that thing instead of a palette.
    const expected: Record<string, string> = {
      oni: "horns",
      knight: "plume",
      night: "hood",
      crystal: "crystal",
      blocky: "goggles",
    };
    for (const [id, crown] of Object.entries(expected)) {
      expect(get(id).shape?.crown).toBe(crown);
    }
    // Every mark is a real mark (a typo would silently draw nothing).
    const marks = new Set(paid.map((o) => o.shape?.crown).filter(Boolean));
    for (const crown of marks) {
      const used = labelsUsed(minerLabels({ ...get("oni").shape, crown: crown as never }));
      expect(used.has("aura") || used.has("brim")).toBe(true);
    }
  });

  test("a mark that claims the silhouette extends it", () => {
    // Two kinds of mark, and the test has to know which is which: horns, a
    // hood and wings reach OUT past the head, so they change the outline and
    // the character reads at player size.
    const silhouette = (g: ReturnType<typeof minerLabels>): string =>
      g
        .map((row) => row.map((c) => (c == null ? "." : "x")).join(""))
        .join("\n");
    const base = { hatStyle: "beanie", build: "sturdy" } as const;
    const plain = silhouette(minerLabels(base));
    for (const crown of ["horns", "hood", "crystal", "wings", "antlers"] as const) {
      expect(`${crown}:${silhouette(minerLabels({ ...base, crown })) === plain}`)
        .toBe(`${crown}:false`);
    }
  });

  test("a mark that lives on the head still repaints it", () => {
    // Plume, goggles and a circlet sit INSIDE the head outline on purpose (a
    // plume over a helmet must not make the miner look like it is wearing a
    // hat-and-a-halo), so they cannot change the silhouette — but they must
    // still put a different mark on the head, not the same pixels in another
    // color.
    const painted = (crown: (typeof MARKS)[number] | typeof NO_MARK): string =>
      minerLabels({ hatStyle: "beanie", crown })
        .map((row) => row.map((c) => (c == null ? "." : c)).join(""))
        .join("\n");
    const plain = painted(NO_MARK);
    for (const crown of MARKS) {
      expect(`${crown}:${painted(crown) === plain}`).toBe(`${crown}:false`);
    }
  });
});

describe("rollMinerLook", () => {
  test("is deterministic per (seed, outfit)", () => {
    expect(rollMinerLook(7, "classic")).toEqual(rollMinerLook(7, "classic"));
  });

  test("carries papercut shape hints (rolled on the unshaped, authored on the rest)", () => {
    const HAIRS = ["bob", "long", "ponytail", "twin", "bun"];
    let dresses = 0;
    let beards = 0;
    let cuties = 0;
    for (const o of OUTFITS) {
      for (let seed = 0; seed < 12; seed++) {
        const look = rollMinerLook(seed, o.id);
        expect(["trousers", "dress"]).toContain(look.outfit);
        expect(typeof look.beard).toBe("boolean");
        expect(typeof look.cute).toBe("boolean");
        if (o.shape != null) {
          // An authored character: the same person on every seed.
          expect(look.outfit).toBe(o.shape.outfit ?? "trousers");
          expect(look.beard).toBe(o.shape.beard ?? false);
          expect(look.cute).toBe(o.shape.cute ?? false);
          expect(look.build).toBe(o.shape.build);
          expect(look.prop).toBe(o.shape.prop);
          continue;
        }
        if (look.hatStyle === "longhair") {
          expect(HAIRS).toContain(look.hair);
        } else {
          // Hair only draws on a bare head, so it is rolled only there.
          expect(look.hair).toBeUndefined();
        }
        if (look.outfit === "dress") dresses++;
        if (look.beard) beards++;
        if (look.cute) cuties++;
      }
    }
    // The free starter (the only unshaped outfit) must actually see a mix of
    // silhouettes, not one body.
    expect(OUTFITS.filter((o) => o.shape == null)).toHaveLength(1);
    expect(dresses).toBeGreaterThan(0);
    expect(beards).toBeGreaterThan(0);
    expect(cuties).toBeGreaterThan(0);
  });

  test("shape hints do not disturb the colors an existing save sees", () => {
    // The hints are appended AFTER the color picks on purpose. Roll the same
    // (seed, outfit) and compare only the pre-existing fields: every color
    // must match, or every player's miner would have changed the day the
    // papercut art shipped.
    const COLOR_SLOTS = [
      "skin",
      "shirt",
      "pants",
      "boots",
      "hat",
      "hatStyle",
      "species",
    ] as const;
    for (const o of OUTFITS) {
      for (let seed = 0; seed < 8; seed++) {
        const look = rollMinerLook(seed, o.id);
        const again = rollMinerLook(seed, o.id);
        for (const slot of COLOR_SLOTS) {
          expect(again[slot]).toBe(look[slot]);
        }
        // And the roll itself is still a pure function of (seed, outfit).
        expect(again).toEqual(look);
      }
    }
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
      const scales = items.filter((i) => i.kind === kind).map((i) => i.scale);
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

/**
 * The SKIN line (the player's own slot — cosmetics.SKINS): the contracts that
 * keep it a LINE — unique ids, names and blurbs, complete colorways and
 * prices, a distinct silhouette per character, every skin rendering real
 * content deterministically, and the cute/pretty group being what it says it
 * is.
 *
 * This catalog used to be an art-direction draft
 * (`utils/graphics/papercutSkins.ts`, "not wired into the app yet"); it is
 * now the shipped cosmetic line, so these contracts are also the shop's
 * contract: an id the catalog doesn't have can never be bought or equipped.
 */
import {
  SKINS,
  getCostGems,
  getSkin,
  isOutfitId,
  isPickaxeId,
  isSkinId,
  skinGroup,
} from "src/mines_of_doom/cosmetics";
import {
  DIRECTION_GRID_SIZE,
  buildPalette,
  minerLabels,
  renderDirection,
} from "src/utils/graphics/characterArt";
import type { SkinCosmetic } from "src/mines_of_doom/cosmetics";

const GRID = DIRECTION_GRID_SIZE;

function filled(grid: (string | null)[][]): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c != null) n++;
  return n;
}

/** The sprite the papercut pack draws for a skin. */
function skinGrid(skin: SkinCosmetic) {
  return renderDirection(
    "papercut",
    minerLabels({ ...skin.shape, tool: false }),
    buildPalette("papercut", "miner", { miner: skin.look }),
  );
}

describe("the line", () => {
  it("has a full cast of characters", () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(10);
    for (const skin of SKINS) {
      expect(skin.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("has unique ids, names and blurbs", () => {
    for (const key of ["id", "name", "blurb"] as const) {
      const seen = new Set<string>();
      for (const skin of SKINS) {
        expect(seen.has(skin[key])).toBe(false);
        seen.add(skin[key]);
      }
    }
  });

  it("gives every skin a complete six-color look", () => {
    for (const skin of SKINS) {
      for (const slot of [
        "skin",
        "shirt",
        "pants",
        "boots",
        "hat",
      ] as const) {
        expect(skin.look[slot]).toMatch(/^#[0-9a-f]{6}$/);
      }
      // The look's hatStyle is what the shop preview and the pixel pack
      // draw; `shape` is the papercut silhouette switch.
      expect(skin.shape.hatStyle ?? "helmet").toBe(skin.look.hatStyle);
    }
  });

  it("is priced like the other cosmetic lines, with no free member", () => {
    // "No skin" is the player's own rolled look (selectedSkin ""), not an
    // item — so unlike outfits/pickaxes there is no costGems: 0 member, and
    // every price is a real gem tier the shop can sell.
    for (const skin of SKINS) {
      expect(skin.costGems).toBeGreaterThan(0);
      expect(getCostGems(skin.id)).toBe(skin.costGems);
    }
    expect(new Set(SKINS.map((s) => s.costGems)).size).toBeGreaterThanOrEqual(4);
  });

  it("never collides an id with the outfit or pickaxe lines", () => {
    // Ids share one owned-cosmetics list and one store-id namespace, so an
    // overlap would silently sell the wrong item.
    for (const skin of SKINS) {
      expect(isOutfitId(skin.id)).toBe(false);
      expect(isPickaxeId(skin.id)).toBe(false);
      expect(isSkinId(skin.id)).toBe(true);
    }
    expect(getSkin("classic")).toBeUndefined();
    expect(getSkin("nope")).toBeUndefined();
    expect(isSkinId("classic")).toBe(false);
    expect(isSkinId("steel")).toBe(false);
  });

  it("covers the shape axes a crew needs (every hat, both forms, hair, a beard)", () => {
    const hats = new Set(SKINS.map((s) => s.shape.hatStyle));
    expect(hats).toEqual(
      new Set(["helmet", "beanie", "cap", "bandana", "longhair"]),
    );
    const forms = new Set(SKINS.map((s) => s.shape.form));
    expect(forms).toEqual(new Set(["human", "critter"]));
    const hairs = new Set(SKINS.filter((s) => s.shape.hair).map((s) => s.shape.hair));
    expect(hairs.size).toBeGreaterThanOrEqual(4);
    expect(SKINS.filter((s) => s.shape.beard).length).toBeGreaterThanOrEqual(1);
    expect(SKINS.filter((s) => s.shape.outfit === "dress").length)
      .toBeGreaterThanOrEqual(4);
  });

  it("splits into a crew half and a cute/pretty half", () => {
    const groups = new Set(SKINS.map(skinGroup));
    expect(groups).toEqual(new Set(["crew", "pretty"]));
    const pretty = SKINS.filter((s) => skinGroup(s) === "pretty");
    const crew = SKINS.filter((s) => skinGroup(s) === "crew");
    expect(pretty.length).toBeGreaterThanOrEqual(4);
    expect(crew.length).toBeGreaterThanOrEqual(3);
    // The cute half is where the dresses and the big eyes live.
    for (const skin of pretty) {
      expect(skin.shape.outfit === "dress" || skin.shape.cute === true).toBe(true);
    }
    // The crew half keeps the plain face and the trousers.
    for (const skin of crew) {
      expect(skin.shape.cute ?? false).toBe(false);
      expect(skin.shape.outfit ?? "trousers").toBe("trousers");
    }
  });

  it("looks a skin up by id", () => {
    expect(getSkin(SKINS[0].id)?.id).toBe(SKINS[0].id);
  });
});

describe("a skin's sprite", () => {
  it("renders every skin at 32×32 with real content", () => {
    for (const skin of SKINS) {
      const g = skinGrid(skin);
      expect(g).toHaveLength(GRID);
      for (const row of g) {
        expect(row).toHaveLength(GRID);
        for (const c of row) {
          expect(c === null || /^#[0-9a-f]{6}$/.test(c as string)).toBe(true);
        }
      }
      const n = filled(g);
      expect(n).toBeGreaterThan(200);
      expect(n).toBeLessThan(GRID ** 2 - 80);
    }
  });

  it("is deterministic and does not mutate the catalog entry", () => {
    for (const skin of SKINS) {
      const before = JSON.stringify(skin);
      const a = skinGrid(skin);
      const b = skinGrid(skin);
      expect(b).toEqual(a);
      expect(b).not.toBe(a);
      expect(JSON.stringify(skin)).toBe(before);
    }
  });

  it("gives every skin its own silhouette — no two read the same", () => {
    const grids = SKINS.map(skinGrid);
    for (let i = 0; i < grids.length; i++) {
      for (let j = i + 1; j < grids.length; j++) {
        let same = 0;
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            if (grids[i][y][x] === grids[j][y][x]) same++;
          }
        }
        // A same-outfit pair may share a lot of pixels; a whole identical
        // sprite would mean a copy-paste skin.
        expect(same / GRID ** 2).toBeLessThan(0.93);
      }
    }
  });

  it("carries no pickaxe (the player draws their own as a sprite)", () => {
    for (const skin of SKINS) {
      const labels = minerLabels({ ...skin.shape, tool: false });
      const used = new Set(
        labels.flat().filter((m): m is NonNullable<typeof m> => m != null),
      );
      expect(used.has("blade")).toBe(false);
      expect(used.has("handle")).toBe(false);
    }
  });

  it("keeps the pretty half pretty: a wider hem than the crew", () => {
    const pretty = SKINS.filter((s) => skinGroup(s) === "pretty")[0];
    const crew = SKINS.filter((s) => skinGroup(s) === "crew")[0];
    // The dress silhouette is wider at the hem than the trouser legs.
    const hem = (g: (string | null)[][]): number => {
      let n = 0;
      for (let x = 0; x < GRID; x++) if (g[28][x] != null) n++;
      return n;
    };
    expect(hem(skinGrid(pretty))).toBeGreaterThan(hem(skinGrid(crew)));
  });
});
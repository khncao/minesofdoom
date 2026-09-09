import { createEmptySaveData, SaveData } from "../game";
import { getCollection, CollectionEntry } from "../collection";
import { OUTFITS, PICKAXES, CAVE_THEMES } from "../cosmetics";
import { ACHIEVEMENTS } from "../achievements";

/** True for owned cosmetics / completed achievements (union helper). */
const done = (e: CollectionEntry): boolean =>
  e.kind === "achievement" ? e.completed : e.owned;

describe("getCollection (features.md §7 compendium, iteration 23)", () => {
  const save = () => createEmptySaveData();

  it("reports the four groups in display order, one per catalog line", () => {
    const c = getCollection(save());
    expect(c.groups.map((g) => g.kind)).toEqual([
      "pickaxe",
      "outfit",
      "caveTheme",
      "achievement",
    ]);
    expect(c.groups.map((g) => g.total)).toEqual([
      PICKAXES.length,
      OUTFITS.length,
      CAVE_THEMES.length,
      ACHIEVEMENTS.length,
    ]);
    // Every entry id matches its catalog, in catalog order.
    expect(c.groups[0].entries.map((e) => e.id)).toEqual(
      PICKAXES.map((p) => p.id),
    );
    expect(c.groups[1].entries.map((e) => e.id)).toEqual(
      OUTFITS.map((o) => o.id),
    );
    expect(c.groups[2].entries.map((e) => e.id)).toEqual(
      CAVE_THEMES.map((t) => t.id),
    );
    expect(c.groups[3].entries.map((e) => e.id)).toEqual(
      ACHIEVEMENTS.map((a) => a.id),
    );
  });

  it("a fresh save owns only the free defaults and has completed no achievements", () => {
    const c = getCollection(save());
    const entry = (g: number, id: string) =>
      c.groups[g].entries.find((e) => e.id === id)!;
    expect(done(entry(1, "classic"))).toBe(true);
    expect(done(entry(0, "steel"))).toBe(true);
    expect(done(entry(0, "gold"))).toBe(false);
    expect(done(entry(2, "natural"))).toBe(true);
    expect(done(entry(2, "amethyst"))).toBe(false);
    expect(c.groups[3].owned).toBe(0);
    expect(c.groups[3].entries.every((e) => !done(e))).toBe(true);
    // totalOwned = the three free defaults only.
    expect(c.totalOwned).toBe(3);
    expect(c.totalItems).toBe(
      PICKAXES.length +
        OUTFITS.length +
        CAVE_THEMES.length +
        ACHIEVEMENTS.length,
    );
  });

  it("marks the equipped item per line", () => {
    const s = save();
    s.ownedCosmetics = ["classic", "steel", "night", "gold"];
    s.selectedOutfit = "night";
    s.selectedPickaxe = "gold";
    s.ownedCaveThemes = ["natural", "amethyst"];
    s.selectedCaveTheme = "amethyst";
    const c = getCollection(s);
    const group = (kind: string) => c.groups.find((g) => g.kind === kind)!;
    const equipped = (kind: string, id: string) =>
      (
        group(kind).entries.find((e) => e.id === id) as {
          equipped?: boolean;
        }
      ).equipped;
    expect(equipped("outfit", "night")).toBe(true);
    expect(equipped("outfit", "classic")).toBe(false);
    expect(equipped("pickaxe", "gold")).toBe(true);
    expect(equipped("caveTheme", "amethyst")).toBe(true);
    // group.owned now counts the owned extras.
    expect(group("outfit").owned).toBe(2);
    expect(group("pickaxe").owned).toBe(2);
    expect(group("caveTheme").owned).toBe(2);
    expect(c.totalOwned).toBe(6);
  });

  it("achievement completion is derived from lifetime stats, not stored flags", () => {
    const s = save();
    // miner-1 targets minersOwnedEver >= 1.
    s.minersOwnedEver = 5;
    let c = getCollection(s);
    let badges = c.groups.find((g) => g.kind === "achievement")!;
    expect(badges.entries.find((e) => e.id === "miner-1")).toMatchObject({
      id: "miner-1",
      completed: true,
    });
    expect(badges.entries.find((e) => e.id === "miner-5")).toMatchObject({
      id: "miner-5",
      completed: true,
    });
    expect(badges.entries.find((e) => e.id === "miner-10")).toMatchObject({
      id: "miner-10",
      completed: false,
    });
    // Only miner-1 and miner-5 complete at 5 miners (the other lines' stats
    // are still zero on a fresh save).
    expect(badges.owned).toBe(2);
    // Resetting the stat re-derives completion back to false even though
    // the one-time bonus already fired (the stored flag is for the bonus,
    // not for completion).
    s.minersOwnedEver = 0;
    c = getCollection(s);
    badges = c.groups.find((g) => g.kind === "achievement")!;
    expect(badges.entries.find((e) => e.id === "miner-1")).toMatchObject({
      completed: false,
    });
    expect(badges.owned).toBe(0);
  });

  it("entries come from the catalogs — foreign ids in the save can't appear", () => {
    const s: SaveData = {
      ...save(),
      ownedCosmetics: ["classic", "steel", "not-a-real-cosmetic"],
    };
    const c = getCollection(s);
    const allIds = c.groups.flatMap((g) => g.entries.map((e) => e.id));
    expect(allIds).not.toContain("not-a-real-cosmetic");
    expect(c.groups[0].owned).toBe(1);
  });
});

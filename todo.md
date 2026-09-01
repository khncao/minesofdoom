# Iteration 5 — Tier-4 cave themes (Crystal Kingdom)

Continues phase 7. Iteration 4 finished tier 3 (Magma Frontier) with the
gem upgrade lines (click ×2, combo resistance); this is the next unlock in
the §4.6 chain — **tier 4 "Crystal Kingdom": the cosmetic lines, starting
with cave themes**. Cave themes are a *cosmetic* line (a pure recolor of
the cave background, no gameplay effect), gem-priced, and — like every §4.6
unlock — gated: visible but locked (🔒 Crystal Kingdom) until tier 4
completes. They are *meta* cosmetics: like outfits/pickaxes they survive a
sunk shaft (`sinkNewShaft` leaves them intact).

## Design

- **Cave theme** (`cosmetics.ts`): a named recolor of the cave background.
  Each theme is a `tints: string[5]` palette — one tint per depth tier
  (Surface Caverns → Crystal Kingdom), index-aligned with `DEPTH_TIERS`
  (`game.ts`). The cave still varies with depth; a theme just shifts the
  whole palette, so a theme stays alive as you descend.
  - **Default theme** `natural` (free, owned from the start): its palette is
    exactly `DEPTH_TIERS`' tints (`DEFAULT_CAVE_TINTS`), i.e. today's look —
    a fresh save (or a player who never opens the section) sees no change.
    A unit test pins `DEFAULT_CAVE_TINTS === DEPTH_TIERS' tints`.
  - **4 paid themes** (gem-priced): `amethyst` 5💎, `verdant` 8💎,
    `solar` 12💎, `void` 20💎 — distinct palettes.
  - Resolution: `getThemeTint(theme, tierId) = theme.tints[tierId]`
    (clamped). The on-screen tint is
    `getThemeTint(getCaveTheme(selectedCaveTheme), getDepthTier(depth).id)`,
    so the background always matches the save.
- **Save v8**: `ownedCaveThemes: string[]` (defaults to `["natural"]`) +
  `selectedCaveTheme: string` (defaults to `natural`). 7→8 migration keeps
  valid owned ids (drops junk) and a valid selection (else `natural`),
  always keeping the free `natural` owned; clamped loader;
  `createEmptySaveData` defaults.
- **Engine actions** `buyCaveTheme(id)` / `selectCaveTheme(id)`:
  unknown-id and unaffordable no-ops (same pattern as `buyCosmetic`), a buy
  auto-selects, and the gem spend counts toward `totalGemsSpent`.
  `sinkNewShaft` leaves both fields intact (cosmetics survive, like
  outfits/pickaxes).
- **UI**: new "Cave themes" block in the settings CosmeticsSection — a row
  per theme with a 5-swatch palette thumbnail; buy / owned / selected
  states, gem price; the whole block renders locked (🔒 Crystal Kingdom)
  until tier 4 completes, per the §4.6 visible-but-locked rule.
- **`goals.ts`**: tier-4 unlock text drops "(coming soon)" → "Cave themes";
  new `CAVE_THEME_UNLOCK_TIER = "t4"` constant (matches the other gates).

## Tasks

- [x] `cosmetics.ts`: `CaveTheme` + `CAVE_THEMES` catalog (natural + 4 paid),
      `DEFAULT_CAVE_THEME` / `DEFAULT_OWNED_CAVE_THEMES` /
      `DEFAULT_CAVE_TINTS`, `getCaveTheme` / `isCaveThemeId` /
      `getCaveThemeCost` / `getThemeTint`
- [x] Save v8: `ownedCaveThemes` + `selectedCaveTheme`, 7→8 migration +
      clamped loader + `createEmptySaveData`
- [x] Engine: `buyCaveTheme` / `selectCaveTheme` actions (unknown-id /
      affordability guarded, buy auto-selects, count toward
      `totalGemsSpent`); both fields survive `sinkNewShaft`
- [x] `goals.ts`: `CAVE_THEME_UNLOCK_TIER` + tier-4 unlock text
      "Cave themes"
- [x] UI: CosmeticsSection "Cave themes" block (palette swatches, buy /
      owned / selected, locked until Crystal Kingdom); tint wired through
      MinesOfDoom → MiningCanvas from the selected theme
- [x] Unit tests: catalog invariants (unique ids, 5 hex tints, free
      default), `getThemeTint` clamping, `natural` palette == `DEPTH_TIERS`,
      v7→v8 migration, new-save defaults
- [x] Verify: `npm run typecheck` / `lint` / `test` / `npx expo export -p web`
- [x] Update `docs/todo.md` (phase 7 section + log)

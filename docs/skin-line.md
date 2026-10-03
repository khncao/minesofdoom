# The skin line — a whole character for your own slot

The **skin line** is the one cosmetic that dresses *you* rather than your
hires: twelve named characters, each with its own colorway **and** its own
silhouette. They live in `src/mines_of_doom/cosmetics.ts` (`SKINS`, with
`getSkin` / `isSkinId` / `skinGroup`), they render through the art-pack seam
(`artPack.skinSpriteUri`), and the shop sells them as cards like every other
line. Tested in `src/mines_of_doom/__test__/skins.test.ts`.

![the skin line](skin-line/samples/skin-line.png)

## What a skin is (and is not)

An **outfit** is a palette: the player rerolls their look against a pool of
shirts, pants and hats, so the outfit's colors vary every time you wear it.
A **skin** is a fixed character — one authored `MinerLook` plus a fixed
`SkinShape` (headwear, hair, dress, critter form, cute face) — so a skin
always looks exactly like its sheet. That is why the line is a set of
characters and not a set of colorways.

Where each skin shows up:

- **In the shaft**: the player's own miner slot. Equipping a skin replaces the
  rolled look; the equipped pickaxe still swings as its own sprite.
- **In the shop** (`iap.groupSkins`): one card per skin with the character
  rendered as authored, the gem price, and the cash button when a pack exists
  (see *Cash packs* below).
- **In the compendium** (`collection.groupSkins`): owned / total, with the
  "✓ Equipped" marker — the line is the only one with **no free member**:
  "no skin" is the rolled look (`selectedSkin: ""`), not an item.

## The cast (shop order: crew half, then pretty half)

Every row is its own **silhouette**, not a recolor: the rule the line is
built on, and the one `skins.test.ts` pins (no two skins share a drawn
outline, and no skin is drawn as the default miner).

| # | skin | gems | silhouette | blurb |
| --- | --- | --- | --- | --- |
| 1 | **Lantern Crew** | 25 | wiry, hard hat | the shift's hard-hat standard |
| 2 | **Frost Bit** | 25 | broad, red beanie | red beanie, green wool, still swinging the pick |
| 3 | **Deep Survey** | 40 | slim, visor cap + beard + **satchel** | has mapped every gallery twice |
| 4 | **Shift Foreman** | 40 | broad, hard hat + beard | white hard hat, red shirt, runs the whole seam |
| 5 | **Fox Crew** | 60 | **critter**, bandana | red bandana, always the first down the ladder |
| 6 | **Marmot Crew** | 60 | **critter**, beanie | green beanie, permanently unbothered |
| 7 | **Rose Lantern** | 75 | slim, long hair, **floor-length gown**, **lamp basket** | carries the lamp basket — the line's damsel |
| 8 | **Mint Comet** | 75 | slim, **braid**, short dress | names every equation before it lands |
| 9 | **Sky Bob** | 85 | slim, **bob under a beanie**, dress | a little orange beanie over a sky-blue bob |
| 10 | **Twin Bells** | 85 | **broad** shoulders, twin tails, dress | loudest lamp on the crew |
| 11 | **Blossom Bun** | 100 | slim, top knot, **trousers** | runs the gem counters |
| 12 | **Ember Sunrise** | 100 | **broad**, big **waves**, dress | first up the ladder |

`skinGroup(skin)` splits them: a gown, or the pretty / cute face, puts a skin
in the **pretty** group; everything else is **crew**. It is deliberately not
"wears a dress" and not "is slim" — Deep Survey is a wiry surveyor in
trousers, and he is crew, not a heroine.

### The damsel

**Rose Lantern** is the archetype the rest of the line is measured against,
and she is the only character that spends three axes at once: a slim build,
the pretty face (flicked lashes, brows, 2×2 blush) and a **gown** — the one
outfit that reaches the floor and hides the boots, so she is unmistakably not
a miner in a costume. The lamp basket in her other hand is the prop that
says what she is doing down here.

### The silhouette axes (`characterArt.ts`)

| axis | values | what it moves |
| --- | --- | --- |
| `form` | `human`, `critter` | the whole body plan |
| `hatStyle` | `helmet`, `beanie`, `cap`, `bandana`, `longhair` | headwear |
| `hair` | `bob`, `long`, `ponytail`, `twin`, `bun`, `braid`, `waves` | the fall, and the volume under a hat |
| `build` | `sturdy`, `slim` | shoulders, torso, arms — the clearest gender read at 32px |
| `outfit` | `trousers`, `dress` | legs vs. skirt |
| `gown` | — | floor-length hem, bare shoulders, **no boots** |
| `pretty` | — | slim build + long flicked lashes + brows + heavier blush, in one switch |
| `cute` | — | the softer face (bigger eyes, lash ticks, blush) |
| `beard` | — | beard / moustache |
| `prop` | `basket`, `satchel` | what the character carries |

`pretty` is the catalog's one-word "this one is a heroine", so the rule lives
in the geometry instead of being re-drawn per skin; `build` and `cute` can
still be set on their own to override either half.

None of these are game-data fields. They are authored per skin (and per crew
character), so the player's rolled look, the `MinerLook` type and the save
format are untouched — and a crew character's hair, which does travel back
through a `MinerLook`, is narrowed to the styles the classic 16×16 pipeline
knows.


## Precedence on the player's slot

Only one body can be drawn, so the rules are explicit and tested:

1. the **custom-skin slot** (an uploaded body image, a bundled CC0 sprite or a
   sample) — the player authored it, so it wins;
2. an **equipped skin**;
3. nothing — the rolled outfit look (the baseline).

`MinesOfDoom.tsx` resolves this once (`customSkinBodyUri ?? equippedSkinUri`)
and hands the result to the same `playerBodyUri` prop the upload already used,
so neither feature can break the other.

## Sheets

| sheet | what it is |
| --- | --- |
| ![line](skin-line/samples/skin-line.png) | the line in shop order, 6×2, on the dark slate of the other art sheets |
| ![on paper](skin-line/samples/skin-line-paper.png) | the same grid on the cream stock papercut is cut from — the direction has to be judged on its own ground |
| ![player size](skin-line/samples/skin-line-player-size.png) | the same twelve at **44px**, the size the player's own slot actually renders at. This is the read that matters: if a skin can't be told apart at 44px, it's a recolour |
| ![zoom](skin-line/samples/skin-line-zoom.png) | four of the pretty half at 8× — the face detail (glint, lash, blush) is the part that dies first at 32px |

Regenerate with `node scripts/generate-skin-line-samples.mjs`.

## Buying a skin

Every skin is a normal paid cosmetic: **gems in game, real money in the
stores**, like every other line (guardrail 1 — buying is convenience, never
access). The cash price is the character's **depth tier**
(`cosmetics.CASH_PRICE_USD`, the ladder in
`docs/store-integration.md` §2.1c), which tracks how much hand-drawn art the
character is rather than what it costs in gems:

| tier | price | skins |
| --- | --- | --- |
| 1 | $0.99 | Lantern Crew, Frost Bit |
| 2 | $1.99 | Deep Survey, Shift Foreman |
| 3 | $2.99 | Fox Crew, Marmot Crew (critter forms), Rose Lantern, Mint Comet, Sky Bob |
| 4 | $3.99 | Twin Bells, Blossom Bun, Ember Sunrise |

The two critter skins sit at tier 3 because a round animal body is a new
shape, not a palette; the top three are the most hand-drawn characters in
the line (twin tails, top knot, waist-length hair).

> **Store listing text (2026-10-03):** re-authoring the cast changed four
> skin blurbs (Rose Lantern, Mint Comet, Blossom Bun, Ember Sunrise), because
> the old ones described silhouettes that no longer exist ("lilac dress" for
> the gown). `scripts/stripe/catalog.json` is resynced and both stores have
> been pushed through the CLI (Play `sync-products` for those four, Stripe
> `descriptions` in the test account) — see docs/store-integration.md §2.1e.
> **Still owner-only:** the LIVE Stripe account (this machine holds only the
> `sk_test_` key), so run
> `node scripts/stripe/syncStripe.mjs descriptions --live` with the live key.
> That same run also fixes nine product NAMES that drifted when cosmetics were
> renamed (`--titles-only` on Play already did the Android side).

## Notes

- **Paper-cut only.** The papercut pack draws each skin's authored
  silhouette; the classic `pixel` pack draws the skin's colorway (it has no
  shape axes). Swapping art packs can't crash or blank the line.
- **Ownership rides the existing plumbing.** Skins are ids in
  `ownedCosmetics`, so `getCostGems`, the gem buy, and a future store grant
  are the same code paths outfits and pickaxes use. Only `selectedSkin` is
  new — `saveVersion` 14, with the `13 → 14` migration writing `""`.
- **The line has no per-crew assignment.** Skins are the player's slot only
  (that is what the line has always been); the crew wear their own cast
  (`docs/crew-characters.md`) and can be given outfits per slot.
- **The custom-skin upload slot is unchanged** and still lives under the same
  shop line: the cards are the skins, the row below them is the upload /
  bundled-sprite / sample controls.
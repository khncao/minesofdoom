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

| # | skin | gems | silhouette | blurb |
| --- | --- | --- | --- | --- |
| 1 | **Lantern Crew** | 25 | helmet, lamp on the brim | the shift's hard-hat standard |
| 2 | **Frost Bit** | 25 | beanie | red beanie, green wool, still swinging the pick |
| 3 | **Deep Survey** | 40 | cap + beard | has mapped every gallery twice |
| 4 | **Shift Foreman** | 40 | helmet + beard | white hard hat, red shirt, runs the whole seam |
| 5 | **Fox Crew** | 60 | **critter**, bandana | red bandana, always the first down the ladder |
| 6 | **Marmot Crew** | 60 | **critter**, beanie | green beanie, permanently unbothered |
| 7 | **Rose Lantern** | 75 | long pink hair, dress | carries the lamp basket |
| 8 | **Mint Comet** | 75 | ponytail, dress | names every equation before it lands |
| 9 | **Sky Bob** | 85 | bob, beanie, dress | a little orange beanie over a sky-blue bob |
| 10 | **Twin Bells** | 85 | twin tails, dress | loudest lamp on the crew |
| 11 | **Blossom Bun** | 100 | top knot, dress | runs the gem counters |
| 12 | **Ember Sunrise** | 100 | waist-length hair, dress | first up the ladder |

`skinGroup(skin)` splits them: a dress or a cute face puts a skin in the
**pretty** group, everything else is **crew**.

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

## Cash packs: gem-only for now

Skins are bought with **gems** today. They are ordinary paid cosmetics, so
the store catalog's rule is one cash pack per paid cosmetic — but a pack
needs a real Stripe price plus Play Billing SKU and App Store product id
created in those accounts (`node scripts/stripe/syncStripe.mjs products`, the
runbook in `docs/store-integration.md` §2), and none exist for these twelve.
A cash button pointing at a made-up price id would simply error at checkout,
so the line ships gem-only and the catalog says so in `iaps.ts`:

```
// The skin line (cosmetics.SKINS) is GEM-ONLY for now. A cash pack needs a
// real Stripe price plus Play/App Store SKU … When the SKUs land, add one
// pack per paid skin here (in SKINS order) + the Stripe price ids in
// storeConfig.ts + the mirrored entry in pb_hooks/logic.js PRODUCTS, and
// drop the "skin" exception from `exactly one pack per PAID cosmetic` in
// iaps.test.ts.
```

Nothing about the game code needs to change when they do: `buyCosmetic` /
`selectCosmetic` already treat a skin like any other owned cosmetic, the
panel already renders a card per skin-line product, and
`getIapProductPreview` already resolves a skin grant to the character as
authored.

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
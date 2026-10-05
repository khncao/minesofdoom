# Mines of Idle Doomath — Feature Reference

Living catalog of what the game does, maintained as a continuous task
(`docs/todo.md`). Update it when adding features; keep entries short and
file-anchored so they stay verifiable. Open feature **gaps** —
explored, ranked, not planned — live in `docs/gap-ranking.md` (impact
ranking + every gap layer; formerly this file's section 7).

## 1. Core gameplay

- **Tap mining** — hold the cave canvas (300 ms — a quick tap
deliberately does nothing; the fat-finger filter the a11y label states as
"Hold to mine") to mine; gains
scale with click power, depth-tier click bonus, gem-upgrade tap/answer
multipliers, combo and prestige (`components/MiningCanvas.tsx: MINE_HOLD_MS`,
`hooks/useMineTaps.ts` — the web canvas uses a plain-View responder instead
of Pressable so rapid tapping doesn't double-render). The persistent
"hold to mine" caption under the crew column is GONE: it re-read the
accessibility label on every press, and the onboarding tutorial already teaches
the gesture. The accessible name stays — dropping a visible hint must never
cost a non-sighted player the instruction (`a11y.holdToMine`,
`components/MiningCanvas.tsx`).
- **Equations** — the main active loop: solve arithmetic to earn minerals ×
  click power × combo multiplier. **Sixteen toggleable types** in three
  settings groups, all soft-mode-only except the classic four:
  - *Operators* (7) — multiply, add, subtract, division, percent, square,
    "missing"-operand.
  - *Drills* (3) — missing divisor (`24 ÷ ? = 6`), balance the equation
    (`6 + ? = 4 + 9`), next-in-sequence (`3, 6, 9, 12, ?`, four families).
  - *Real-world math* (6) — tip (`45 + 15% tip` → the total you hand over),
    discount (`45 - 15% off` → what you actually pay), change from a note,
    elapsed time (`9:40 → 10:25` → minutes), split the bill (`90 ÷ 4` → the
    per-person share, always exact) and unit price in both directions
    (`4 each × 12` → the total, `30 ÷ 12` → the price of one, always exact).

  The answer field is rendered **inside** the equation plate, in the
  blank the player fills: `7 * 2 = [__]`, one line, one sentence. It was
  stacked below the question, so reading a question meant dropping a line
  to type into it, and its 150px box was the widest thing in the HUD — a
  field sized for the longest answer, sitting in a column sized for it.
  It is now **content-sized**: one caret when empty, growing with the
  digits (capped at MAX_ANSWER_LENGTH so a pasted answer cannot stretch the
  plate off a 360px screen), which is derived from the value rather than a
  font metric so it also stays right under the app's own text scale.
  Putting it IN the blank also fixes where the blank is: for the
  missing-operand and balance drills the number being asked for is the "?"
  **between** the operands, so those render `7 + [__] = 12` — the field
  lands there and the redundant trailing "?" those prompts used to end with
  (`7 + ? = 12?`) simply stops being drawn (`equationAnswerSlot`,
  `utils/math/equations.ts`; rendered by `components/EquationDisplay.tsx's
  `answerSlot`). The row is not `accessible`, so the field stays reachable to
  a screen reader and the runs read in order.
  The nine added types stay out of the first-run tour's row list on purpose
  — that card is absolutely positioned and does not scroll — so they get a
  labelled group in Settings plus matching mental-math tips instead.
  **Every number the game displays is a whole number**, for all fifteen
  types; only an ANSWER may carry cents, which is what makes 15% tips
  (15% of 45 is $6.75, impossible on a whole bill) and an 8-way split
  (90 ÷ 8 = 11.25) possible without a decimal ever appearing in the
  equation. Configurable number range (multiplicative operands floor at 1
  even when the player-set minimum is 0, so the default range never rolls
  trivial 0·n / 0² equations —
  `utils/math/equations.ts: generateTermsEquation`; the money drills scale
  that range into a dollar window rather than bounding it, because a 0–12
  dial has no $45 in it; unit price covers both shopping questions —
multiply for the total, divide for the price of one — since the multiply
half on its own is just `multiply` with a story attached),
  **hard mode** (3-term equations, 2× payout), and a display-symbol
  preference (`*`/`×`, `/`/`÷`). A decimal answer is always a whole number
  of cents — generated in integer cents and compared in integer cents
  (`utils/math/money.ts`), replacing an epsilon comparator that accepted
  answers wrong by a cent. The paid value is rounded half-up at the reward
  boundary because `BigInt()` throws on a fraction
  (`hooks/useEquations.ts`).
- **Contextual hint** — a **separate "?" button** at the end of the
  equation row opens a **modal** with the technique for whatever shape is
  on screen
  ("read a ÷ b as b × what = a", "15% is 10% + 5%", "split the awkward
  part second"). The player dismisses it deliberately (backdrop, ✕/"GOT
  IT", or the Android back gesture), and a new equation retires it — the
  hint belongs to the question it was opened for. It is a modal rather
  than a bubble because it shares the question's screen: as a bubble the
  technique re-flowed the equation plate and self-dismissed after 6 s,
  which is wrong for a reference being actively worked through. The same
  text is the placeholder's `accessibilityHint`, so a screen reader gets it
  without opening anything. Hints are **methods only, never the current
  operands**: interpolating the numbers would hand over the arithmetic,
  and for several shapes the answer outright. Free of charge — the same
  content is already in Settings ▸ tips, just a tap away from the
  question that needs it (`components/QuestionHint.tsx: getHintKey`,
  `components/QuestionDisplay`). It is a separate control rather than
  something the FIELD does: as the field's "?" placeholder it meant
  aiming at a ~30 px box for help, and it vanished the moment a digit
  landed — so a half-answered question could not be helped at all. It sits
  LAST in the row, so it never moves when the field grows.
  The display shows the **exact pending
  gain**, answer value included (`components/EquationDisplay.tsx` —
  `getPendingAnswerGain`, mirroring the engine's integer core so it
  agrees with the floating "+N" on solve). Answer via the **on-screen
  keypad** (default on native — a 3-column digit strip beside the
  upgrades list: 56 px keys that flex-shrink to a 44 px floor on short
  screens so a bottom row is never clipped off the edge, ⌫ held clears
  the answer, 12-character cap, every keypress fires the light cave-tap
  haptic tick, and the input boundaries — `=` with nothing typed, and a
  key that cannot apply (a second `.`, or a character past the cap) —
  shake the answer box visually only (no
  sound, haptic, or penalty); the input is deliberately un-focusable while
  the onboarding overlay is up, an e2e-discovered fix) or the OS
  keyboard (default on web — autofocused numeric field, Enter submits,
  `KeyboardAvoidingView` on native, a plain read-only box on web where the
  keyboard never shifts layout); the two are settings-toggled, and the
  per-platform default (`MinesOfDoom.tsx`: `Platform.OS !== "web"`) only
  shapes first launch — a stored preference wins on every platform
  (`utils/math/equations.ts`,
  `hooks/useEquations.ts`, `components/AnswerInput.tsx`,
  `components/NumericKeypad.tsx`).
- **Combo** — streak multiplier in tier steps; wrong answer/mine tap zeroes
  it unless **combo resistance** is upgraded (each level keeps 10%);
  **combo-save** rewarded ad can bank a combo across a miss
  (`game.ts: getComboMultiplier`, `hooks/useCombo.ts`,
  `components/ComboIndicator.tsx`, `components/ComboSaveIndicator.tsx`).
- **Gems** — second currency, rolled on correct answers (base chance +
  upgradeable +1%/level, capped); feeds gem upgrade lines and the cosmetic
  shop (`game.ts: rollGem, getGemChance*`).
- **Miners** — three idle worker types with separate cost curves: miners,
  **fast miners** (tier-2 unlock), **legendary miners** (tier-5 endgame
  sink), plus a shared miner-power upgrade; total minerals/sec shown
  (`game.ts: getMineralsPerSec`).
- **Depth** — depth (meters) is derived from lifetime minerals; five
  **depth tiers** (Surface Caverns → Crystal Kingdom) each tint the cave and
  add a click bonus; the depth bar announces tier changes
  (`game.ts: DEPTH_TIERS, getDepthTierProgress`,
  `components/DepthBanner.tsx`). That bar is the game's single status
  strip, and the **⛏ upgrades button** is its far-right cell. Depth + tier
  is all it carries: the wallet got its own boxed line under it (see
  below), because three more figures in here were what forced the tier
  name to wrap to three lines on a 360px phone.
  - **The wallet** (`DepthWallet`, `components/DepthBanner.tsx`) — minerals,
    income rate and gems as a right-aligned **vertical column** directly
    under the upgrades button, with the same translucent backing as the
    depth bar so it reads over the cave art on every theme. `mineral-count`
    keeps its testID and its parse contract (the bare number, nothing else
    in that node) because the Maestro flows and `e2e/web/helpers.ts` read
    it. It started as two rows drawn INSIDE the cave canvas above the crew
    column, which put the two most-read numbers on top of the sprites
    (`components/MiningCanvas.tsx`).
  - **Landscape** — the bar, wallet and question all live in ONE
    absolutely-positioned `hudTopStackShort` strip pinned to the top of
    the stage. They used to be separate absolute siblings on that edge,
    which meant the question had to be told how far down to start (a
    measured bar height, or a guessed constant) and could land ON the bar
    — on the first frame especially, before any measurement came back. In
    the strip the overlap is structurally impossible at any height
    (`styles.hudTopStackShort`). Under the bar, the wallet and the
    question sit in `hudBody` as a **row** in landscape (`hudBodyRow`):
    the equation plate hugs the bar's left edge, DIRECTLY under it, and
    the wallet keeps its top-right corner. The row is `row-reverse` —
    React Native has no flexbox `order` — so the wallet, which renders
    FIRST in the tree (portrait wants it on top of the question), lands
    at the right end; `justifyContent: space-between` pins the equation
    plate to the bar's LEFT edge (todo: "Show equations on top left when
    in landscape mode"), and both boxes share the row's top edge — the
    wallet's own `alignSelf: flex-end` (portrait: hug the right edge)
    would bottom it out in the row, so landscape wraps it in
    `walletRowAlign` (todo: "have equation box and resources box
    aligned"). The question stack sizes to its content there
    (`hudStackRow`) instead of spanning the stage and shoving the wallet
    off.
- **Cave descent** — the cave background descends PROPORTIONAL to absolute
  depth (rework: "feel as if digging deeper"): every meter mined pushes the
  rock strip down 6 px (one full row per 4 m), so the cave keeps sliding
  while the player mines — faster as they earn faster — and the next tier's
  rock is already sliding in from the bottom of the window before the tint
  changes. The strip covers the whole canvas (row count follows the
  measured height), rows are addressed by absolute cave depth, and the
  re-index at each full row is compensated in the same commit so the
  descent reads as one continuous sink (`utils/graphics/caveTiles.ts:
  caveRowStartForDepth, caveTranslateForDepth, CAVE_PX_PER_METER`,
  `components/CaveBackground.tsx`).
- **Prestige ("sink a new shaft")** — resets the run (miners, upgrades,
  minerals) for a **banked permanent multiplier** (6 levels, ×1 → ×5 on
  lifetime-mineral thresholds) (`game.ts: PRESTIGE_LEVELS,
  getPrestigeMultiplier`, `hooks/useGameEngine.ts: sinkNewShaft`).
- **Offline progression** — offline earnings capped at 8h on launch
  (`game.ts: maxOfflineTicks`); rewarded ads can **double** the last
  offline gain or **top up** the cap to 10h.

## 2. Progression & retention

- **Goal tiers** — sequential 5-tier contract chain (t1–t5) whose
  completion (derived from lifetime stats, never a mutable flag) unlocks
  new purchaseable content; tiers gate all content (`goals.ts`,
  `components/GoalsPanel.tsx`).
- **Achievements** — independent one-off badges with a small one-time
  mineral bonus; completion derived from lifetime stats
  (`achievements.ts` — 19 of them).
- **Daily bonus / streak** — 10k base × streak through day 6, then a
  250k day-7 milestone (worth more than days 1–6 combined) for streaks
  7+; stored separately from the save so a lost streak never costs
  progress (`dailyBonus.ts`, `components/DailyBonusButton.tsx`). The idle
  reward pops up by itself: with the "Auto daily bonus" setting on
  (default) a claimable bonus claims itself once per local day — same
  grant path, same claim toast, no header icon; turning the setting off
  brings the 🎁 header button back as the manual entry point (todo:
  "remove the icon, pop it up automatically").
- **Quest log (daily quests + the weekly contract)** — the 📜 header
  button opens ONE sheet with both cadences. **Today's quests**: three
  tasks drawn from a six-entry pool, each paying **1 gem**, claimed one row
  at a time, reset at local midnight. **Weekly contract**: 3 goals that are
  DELTAS on the save's monotonic lifetime metrics (answer 75 equations /
  mine 500k minerals / own 2 more miners this week), paying 150k minerals
  **plus 10 gems**, claimable once per week when all three are met.
  **Both cadences state their reward up front** — a "Pays +1 💎" note on
  every daily row, and one section-level line for the weekly contract (which
  pays ONCE for all three tasks, so three quoted payouts would read as 3×
  the reward). Previously the amount appeared only on the claim button, i.e.
  once the task was already finished: a reward the player learns about after
  earning it.
  Progress on both is derived state in the goals.ts pattern: the
  window's opening metric values are snapshotted as baselines, progress is
  current − baseline (clamped at 0), so only that window's gains count and
  nothing is a mutable flag. The daily rotation is DETERMINISTIC from the
  day key (FNV-1a), which is what lets the persisted state be nothing but
  the baselines and the claimed ids — a per-render draw would reshuffle the
  rows and break an id-keyed claim list. Real windows only (no fake
  scarcity) and the rewards are earnable free, per the guardrails: ~31
  gems a month covers a reroll several times over. State lives in its own
  AsyncStorage keys, like the daily bonus (`dailyQuests.ts`,
  `weeklyChallenge.ts`, `hooks/useDailyQuests.ts`,
  `hooks/useWeeklyChallenge.ts`, `components/QuestLogButton.tsx`). The
  daily half deliberately did NOT get its own header button: the icon row
  is padding-bound and already at its 360px budget with seven glyphs
  (`BottomModal.NAV_ICON_SIZE`).
- **Equation of the day** — one fixed equation per local day, the SAME
  equation for every player/device (FNV-1a day-key seed → mulberry32 →
  `getSeededEquation`, always-soft classic+percent+missing shape); a 📅
  equation; with the "Auto equation of the day" setting on (default) it
  starts itself — at most once per local day — while unsolved, so the 📅
  header icon stays out of the top row; turning the setting off brings
  the icon back as the manual entry point. In mode, wrong answers are
  penalty-free and a solve pays a flat 25k bonus once per day. Solved-day
  lives in its own AsyncStorage key, like the daily bonus
  (`dailyEquation.ts`, `hooks/useDailyEquation.ts`,
  `components/DailyEquationButton.tsx`).
- **Local records** — personal-best panel (depth, combo, minerals/sec, …)
  over the same lifetime stats a live leaderboard would use (`records.ts`,
  `components/RecordsPanel.tsx`). Since the statistics-detail todo it also
  has a lifetime “Time in the mine” row (`SaveData.playSeconds`, save
  v11) and a “This session” block — minerals/answers/time since the app
  was last opened, derived by `session.ts` (baseline snapshot at launch,
  current − baseline clamped at zero) with `formatDuration` in
  `utils/format.ts`.
- **Share badges** — sharing a completed achievement renders a 320x180
  PNG badge (game name, "BADGE EARNED", the achievement name, the
  player's deepest depth) instead of plain text. The badge is pure TS —
  a 5x7 pixel font laid out onto an RGBA buffer and encoded by a pako-
  based PNG encoder (`shareBadge.ts`, `utils/png.ts`) so it renders
  identically everywhere with no canvas dependency; the platform hand-off
  splits like the iap/ad providers: native writes the PNG to the cache
  and hands it to expo-sharing (`shareImage.ts`), web draws the pixels
  onto an offscreen canvas and shares a File via the Web Share API
  (`shareImage.web.ts`). Every failure degrades to the pre-baseline
  plain-text share, so a share tap always does something honest; a
  user-closed sheet is a no-op, not a re-opened sheet (`shareImage.ts`,
  `shareImage.web.ts`, wired in `components/GoalsPanel.tsx`).
- **Mineral pocket (random in-cave bonus)** — a rare bonus node that
  forms in the cave while the game is open (per-1s-check 1/120 odds once
  a 5-min post-pocket cooldown has elapsed; the pocket itself lives a
  real 30 s). Tapping it (a quick tap, no hold) pays ~8× the current
  effective click power (floored at 20 early, capped for Number safety)
  through the normal tap-gain path so lifetime stats stay exact; left
  alone it simply fades, ungained — pure upside, no penalty. The spawn
  is pure logic with an injectable rng (`gemPocket.ts`), the 1 s check
  loop + collect-once ref guard live in the hook (`hooks/useGemPocket.ts`),
  and the node renders in `components/MiningCanvas.tsx` with its own
  responder (a tap on it never falls through to hold-to-mine), a
  reduce-motion-respecting pulse, seeded position in a HUD-safe zone,
  and the mineral sprite / emoji fallback. Not persisted (a reload never
  resurrects or forfeits one) and no spawns or toasts under the
  onboarding overlay. Guardrails held: the window is real, missing it
  costs nothing, odds are identical for every player (`docs/gap-ranking.md`
  "Random in-game events" layer, in-repo half).
- **Idle reminder** — after a minute without a cave tap or an answer
  (while the app is open), a one-per-session toast reminds the player the
  mine keeps collecting and progress autosaves. Settings toggle, on by
  default; no reward, no fake timer — plain information per the no-dark-
  patterns guardrail; the in-app half of the `docs/gap-ranking.md`
  "Idle reminder" candidate — the home-screen widget half stays open)
  (`idleReminder.ts`, `hooks/useIdleReminder.ts`).
- **Free-path benchmark** — a deterministic free-casual persona simulating
  the full economy in CI; fails if a balance change makes first prestige
  slower than the target (`freePath.ts`).

## 3. Cosmetics & presentation

- **Programmatic art** — player, roster miners, currency icons, debris,
  cave strips are generated sprites (seeded per player); **emoji fallback**
  setting for low-end devices (`utils/graphics/*`,
  `game.ts: SettingsData.emojiArt`). Characters and cosmetics ship in the
  **paper-cut** direction (32×32 label-map geometry + a value-plane
  renderer), chosen from five drafted art directions
  (`utils/graphics/characterArt.ts`, `docs/art-directions.md`); the cave and
  the debris shards stay classic.
  All sprite drawing goes through the **art-pack seam**
  (`utils/graphics/artPack.ts`), which keeps the classic 16×16 art
  registered as the `pixel` pack — `setActiveArtPack("pixel")` restores it
  in one line. Earlier drafts (four `PixelGrid -> PixelGrid` style passes,
  a detail bevel, a high-res anime character) remain as the comparison set
  in `docs/art-styles.md` / `docs/art-detail.md` / `docs/art-anime.md`.
- **Crew characters** — every purchasable miner type is a *named character*,
  not a recolour of the player (`utils/graphics/crewChars.ts`,
  `docs/crew-characters.md`). Cast order is hire order, and each line is
  dressed to its tier: the ordinary mineral hires are four named faces only
  (Cog, Pebble, Tally, Bramble — no aura, and the outfits a player assigns
  them override their clothes while they keep their face); the Deep Shaft
  fast crew get working marks (goggles / kerchief / crest / wings), motion
  motes (dust / streaks / sparks / swirl) and a rim light (Flint, Gale,
  Cinder, Bolt); the Motherlode legendary line gets grand marks (circlet /
  halo / hood / antlers / plume / crystal), static motes, a rim light and a
  ground glow (Ember, Rime, Vesper, Gilded, Marrow, Quartz).
- **Cave background** — one pixel-domain procedural cave (`caveTiles.ts`):
  the rock/gap silhouette and the rock body are both sampled at global
  pixels through domain-warped value noise, so masses cross tile and row
  boundaries instead of stepping along them, and the foreground walls scroll
  as unique bands rather than one strip repeating every 144px. No texture
  cycle anywhere (rows are addressed by absolute depth; the wall by band).
- **Cosmetic shop** (gem prices; earnable, F2P-viable) — outfits, pickaxes
  (eight distinct *tools*: shape + swing feel + strike sound each,
  `utils/graphics/characterArt.ts` `TOOLS`, `docs/tool-line.md`), skins
  (each with a unique swing sound), and **cave themes** (background
  recolors); the IAP cosmetic pack sells the *same* items. The shop is the
  🛍️ `IapPanel` (the menu sheet has no shop tab): pickaxe/outfit/theme rows
  are GRID CARDS with 2–3× previews, plus a "worn by" wearer selector on the
  Outfits group (see per-crew customization below); the custom-skin line
  keeps row controls. Gem buy always; the one-time cash pack is gated on
  the store provider's availability (`cosmetics.ts`, `iaps.ts`,
  `components/IapPanel.tsx`, `components/Miner.tsx`,
  `components/CaveBackground.tsx`). The panel's **reroll costs 1 gem**
  (`REROLL_COST_GEMS`): a reroll reshuffles the palette of a look the
  player already owns, so one gem is a rounding error against the 15–250 gem
  line, it is covered several times over by a month of quest rewards, and
  the button states the price and disables while the player is short —
  never a silent no-op, never a free reroll. The spend flows through the
  same `totalGemsSpent` accounting as every gem purchase.
- **Upgrades panel** — the ⛏ button (the depth bar's far-right cell) opens
  the purchase list: hidden by default, and when open it covers the WHOLE
  **stage** — cave, keypad, equation and answer box alike — with its
  column CENTERED and width-capped, rather than the 280px right-hand
  drawer it used to be (a dead margin on a tablet, and its left edge
  tucked under the keypad strip's on a 360px phone). It sits at the
  `hudRow` level, above every sibling (`styles.upgradesBackdrop` z 8 /
  `styles.upgradesDrawer` z 9, clearing the HUD's z 4 and the floating
  keypads' z 6): rendered inside the play area it could only ever cover
  the cave and the keypad strip, so the equation and the answer box
  stayed live on top of a modal the player had already opened.
- **Landscape layout** — a rotated device is NOT a narrower portrait: the
  cave goes full-bleed and slightly zoomed out and the top strip floats over
  it (bar, then a row: the question directly under the bar's left edge and
  the wallet in the top-right corner, all in one
  column). The menu becomes a vertical rail down the left edge — a
  rotated phone has ~410 dp of height and ~910 of width, so a horizontal
  header row spends the scarce axis to save nothing — and the numpad(s)
  float over the bottom. `app.config.ts` deliberately has no
  `orientation` key: Play's large-screen requirement forbids a fixed
  `screenOrientation` (`styles.hudRowShort`, `styles.hudTopStackShort`,
  `styles.hudStackShort`, `styles.headerRowShort`).
- **The crew column** — hired miners line up DOWN THE MIDDLE of the shaft
  in one centered vertical column: the player at the front (bottom), the
  roster receding above them, each row smaller (depth perspective). The
  pure layout is `rosterDisplay` (`cosmetics.ts`): per-type caps
  (`ROSTER_MAX_PER_TYPE`, NORMAL = `ROSTER_ASSIGNABLE_SLOTS`) + a shrink
  factor; `MiningCanvas` renders it far-first.
- **Per-crew customization** — owned outfits can be assigned to individual
  hired miners: `SaveData.minerOutfits` (slot index → owned outfit id, v13+
  of the save), sanitized on every load path; the shop's wearer selector
  (👤 You + the visible crew slots) drives `assignMinerOutfit` /
  `clearMinerOutfit` (free, idempotent, survive prestige); the canvas
  renders each slot's override (owned-filtered).
- **Collection view** — the menu sheet's read-only compendium (between
  Records and About): every catalog line — pickaxes (sprite thumbs), outfits
  (the shop's fixed-seed previews), cave themes (tint swatches), achievement
  badges (icon + bonus) — shown owned vs. not-yet, with per-group and total
  progress. `getCollection` (`collection.ts`) derives everything from the
  save in the `records.ts` spirit (the IAP entitlement record stays a
  purchase record, not an ownership source; achievement "ownership" is the
  same derived-from-lifetime-stats completion the Goals panel uses), and
  `components/CollectionPanel.tsx` is a dumb renderer — no buys, no
  equipping, the shop keeps its single-surface contract. No migration
  (nothing new is stored); "Cosmetic compendium", DONE iteration 23 in
  `docs/gap-ranking.md`.
  `collection.ts`, `components/CollectionPanel.tsx`).
- **Custom skinning** — the player's own avatar: a one-time unlock
  (250 gems OR the `packSkin` IAP — the 26th catalog row, the priciest
  "skin" feature-tier line) opens an upload UI where the player sets
  their own 16×16 body sprite (PNG → the ONE shared pure-JS decoder
  `pngBytesToGrid` → box-averaged downscale) and/or their own
  pickaxe-swing sound (a ≤ 3 s, ≤ 300 KB WAV data URI; `useSounds`
  swaps the player's swing clip to it). Equipped, the grid overrides
  the outfit miner's body sprite (`Miner.tsx: bodyOverrideUri` — the
  pickaxe and the emoji fallback are unaffected); uploads are stored
  DEVICE-LOCAL in their own AsyncStorage key (like IAP entitlements,
  never in `SaveData`, so save codes / cloud restores never carry
  user-uploaded files), normalized on read with corrupt-slot
  degradation to "locked look" (`customSkin.ts`,
  `hooks/useCustomSkin.ts`); the IAP grant rides the entitlement path
  (`IAP_PACK_GRANTS.customSkin`). Upload works on **both platforms**
  (`IapPanel.tsx` skin row): web picks via a hidden file input (any
  image format the canvas can draw, audio via AudioContext) in
  `customSkinPicker.web.ts`; native picks via expo-file-system's
  document picker (`File.pickFileAsync` — no new dependency, no runtime
  permissions) in `customSkinPicker.ts`, decoding the same pure-JS
  funnels (images filtered to `image/png`, audio to plain 16-bit PCM
  `.wav` via `utils/audio/wav.ts` — the formats decodable without a
  native decoder; anything else toasts a plain-language reason).
- **Wide-screen layout** — portrait-only (`orientation: "portrait"`),
  but the game column caps at 640 px and centers on wider surfaces, and
  on web the cave breaks OUT of the cap to span the full viewport
  (`styles.contentColumn` + `styles.canvasFullBleed` — a `100vw` string
  RN web passes through to the DOM, applied web-only since phones never
  hit the 640 cap); full-bleed overlays (toasts, onboarding backdrops)
  deliberately stay outside the capped column so their dim backdrops
  still cover the whole screen (`MinesOfDoom.tsx`).
- **Juice** — debris bursts, pickaxe swings, floating "+N" text, screen
  shake on errors; magnitude log-scales with the mined amount
  (`juice.ts`, `hooks/useJuiceWaves.ts`, `components/FloatingTextLayer.tsx`,
  `components/DebrisParticles.tsx`, `hooks/useShakeInput.ts`).
- **Haptics** — settings toggle (on by default) driving the same juice
  scaling through `Vibration`: a per-tap tick that buzzes a little longer
  as gains grow, a beat on correct answers, a thud on wrong ones, and a
  double-tap on tier/achievement completions and purchases
  (`haptics.ts`, `hooks/useHaptics.ts`, wired in `MinesOfDoom.tsx`);
  iOS-leading-zero patterns, 50 ms global throttle, no-op on haptics-less
  hardware (desktop web).
- **Sound** — expo-audio SFX incl. per-pickaxe swings; mute toggle
  (`hooks/useSounds.ts`, `components/MuteToggle.tsx`) plus a
  **sound-volume** setting (0–100%, default 100%, stepped in 10% units in
  the settings panel; `clampSoundVolume` keeps parsed/hand-edited values in
  range, the menu mute toggle still wins — a muted player never hears
  anything regardless of the volume) plus an **independent
  music-volume** setting (0–100%, default 50% — the former half-level
  law's default experience — same 10% step pattern; `clampMusicVolume`
  in `game.ts`). Plus a **cave-ambience** music bed (on by default,
  settings toggle): a 20 s exactly-periodic looping WAV synthesized in-repo
  (`scripts/generate-ambient-loop.mjs` →
  `public/assets/audio/cave-ambient.wav`) played by `hooks/useSounds.ts`
  with the player's loop flag, at the independent
  `musicLevel(settings.musicVolume)` level, paused while muted, music-off,
  or backgrounded (AppState); asset nets in
  `scripts/__test__/ambientLoop.test.ts`.
- **Accessibility & UX** — accessibility labels/roles throughout,
  reduce-motion preference respected (web, via the OS preference) **plus a
  manual "reduce effects" settings toggle** (`settings.reduceEffects`,
  off by default — effects stay on for everyone, the toggle is a kill
  switch; the two signals OR together in
  `hooks/useAccessibilityReduceMotion.ts`, pass-3 accessibility),
  keyboard-avoiding modal sheets, onboarding overlay with skip
  (`components/OnboardingOverlay.tsx`).

## 4. Economy & monetization

- **One-time IAP catalogue** (26 products — one pack per paid cosmetic
  catalog line, plus the custom-skinning feature pack `packSkin` (the
  26th row, "skin" line — the only non-cosmetic line; unlocks the
  upload feature, see §3), no gem/currency packs, by design —
  pass 16 rejection (1)),
  one shared provider abstraction with per-platform backends — Play Billing /
  App Store (expo-iap) on native, **hosted Stripe Checkout** on web, a
  dev-sim provider in dev builds, and clean no-ops until configured
  (`iaps.ts`, `iapProvider.ts`, `iapProvider.web.ts`). Purchases verify
  server-side (Pocketbase → sidecar store round-trip), restore re-derives
  entitlements from the **store record** (`reconcileStore`), and a local
  re-verify queue means a flaky network never loses a completed purchase.
- **Rewarded ads** — four opt-in kinds on BOTH platforms: gem rolls,
  offline double, offline top-up, combo save; hard per-day reward caps
  enforced in pure code as the fraud cap (`ads.ts`,
  `hooks/useAdRewards.ts`, `components/AdRewardsPanel.tsx`). Native runs
  the Unity Ads SDK via the local Expo module `modules/unity-ads`
  (`unityAdProvider.ts` — swapped from AdMob on 2026-10-01 because Play's
  Families rules require a rewarded ad closeable within 5 seconds); web
  runs the AdSense "Ad Placement
  API" (H5 Games Ads) as parity (2026-09-07, replacing the removed
  shop-sheet banner) — a two-phase flow where `primeReward` pushes a
  `type: "reward"` placement onto `window.adsbygoogle` (panel open /
  combo-save pill mount / after every settled ad) and the "watch" tap
  invokes the stashed show function SYNCHRONOUSLY; only `adViewed`
  entitles the reward, early dismiss → `closed`, no fill / 60 s
  watchdog → `error` (`adSenseProvider.web.ts`, loader script in
  `app/+html.tsx`, gated on the `storeConfig.adsense` client;
  `EXPO_PUBLIC_ADSENSE_TEST=1` at export adds Google's `data-adbreak-test`
  mock-ad mode for live-domain validation). The
  Unity Ads module never enters the web bundle (`unityAdProvider.web.ts`
  is the no-op swap).
- **Web site content (AdSense approval)** — the game is a single
  client-rendered route, so the exported HTML used to carry no readable
  text at all, which is the AdSense "insufficient content" rejection. The
  export now server-renders a real landing page below the game canvas:
  intro, how-to-play, economy, prestige, free-to-play and platform
  sections, an FAQ and a footer nav to every published page, all in the
  HTML source (`src/mines_of_doom/siteContent.ts` → `app/+html.tsx`,
  styled so the game keeps exactly one viewport and the copy is a normal
  scrolling document). The published pages under `public/`
  (about / how-to-play / faq + the generated legal pages) carry the same
  site nav and cross-links, `public/sitemap.xml` lists every one of them,
  and `__test__/siteContent.test.ts` pins the copy, the link targets and
  the sitemap so a rename or a dead link fails the suite. The
  content-page banner `<ins>` placeholder that had shipped in
  `about.html` was removed — rewarded-only (guardrail 2) applies to the
  whole site, and the Ad Placement API needs no slot.
- **Guardrails enforced by design** — rewarded-only on both platforms,
  no interstitials/banners, cosmetics earnable, free-path CI floor
  (AGENTS.md; `freePath.ts`, `docs/security-audit.md`).

## 5. Account & cloud (Pocketbase backend)

- **Optional login** (anonymous device-scope is the default) — three
  mechanisms sharing one provider-agnostic account: email/password,
  **Google** (native + web via Google Identity Services), **Apple**
  (native; web pending a domain-verified service id)
  (`auth.ts`, `signinSdks.ts`, `components/AccountTab.tsx`).
- **Session security** — token in OS keychain (native) / localStorage
  (web), never AsyncStorage; server-side CSPRNG tokens + iterated-SHA-256
  password KDF (`secureToken.ts`, `pb_hooks/`, `docs/security-audit.md`).
- **Cloud save** — device-scoped LWW backup of the serialized save with a
  durable 30-writes/hour budget and launch recovery
  (`cloudSave.ts`, `hooks/useCloudSave.ts`).
- **Leaderboard** — top-10 max-depth scoreboard, monotonic-only upsert
  (client's lifetime stats + sanity caps; honest-casual anti-cheat,
  nothing is gated on it) (`leaderboard.ts`,
  `components/LeaderboardPanel.tsx`).
- **Save codes** — whole save as a `MOD1…` base64 string for backup /
  transfer without an account (`saveCode.ts`).
- **Account GDPR** — delete-my-data for the device row and (signed in) the
  account; entitlements survive account deletion by design
  (`pb_hooks/`, `components/AccountTab.tsx`).
- **Legal** — privacy policy + terms, in-app and published as generated
  HTML from the same module (`legal.ts`).

## 6. Platform & engineering

- **Platforms** — Android (Play live, 1.0.x), web (static export on
  Cloudflare Pages; Caddy → Pocketbase sidecar for the server legs), iOS
  (code complete; console-side items in `docs/backlog.md`).
- **i18n** — English-only **live**: the live locale store is pinned to
  `"en"` (commit `62ff419`), the settings language picker is gone, and no
  preference persists — but the full machinery is intact in `utils/i18n/`
  (en source-of-truth table + es tables held to key-parity and
  placeholder-parity in CI, `navigator.language` detection, the data-driven
  content namespace, a11y coverage). Re-enablement is a checklist, not a
  rebuild: the four landmines and the `i18n:*` candidates live in pass 14
  of `docs/gap-ranking.md`.
- **Observability** — local lightweight analytics record (guardrail 5;
  per-device only, readable and clearable in Settings → About “Local
  stats (debug)”), on-device crash ring + session-trail context behind two
  capture nets (render error boundary + global handler) with two readouts;
  all local, no network, no PII (`analytics.ts`, `crashLog.ts`,
  `crashContext.ts`, `crashLogging.ts`, `components/ErrorBoundary.tsx`,
  `components/AboutTab.tsx`). Pass 26 (F26.1–F26.6) audits the layer and
  names the missing opt-in cohort channel.
- **Settings** — autosave cadence, show-all-purchases, emoji-art fallback,
  haptics, reduce effects (manual kill switch, pass-3 accessibility),
  cave-ambience music, sound volume, music volume, mute,
  number notation (compact / plain, live-sample settings row),
  idle reminder,
  on-screen keypad, equation types / range / hard mode / symbols
  (`hooks/useSettings.ts`,
  `components/SettingsPanel.tsx`, `components/SaveTab.tsx`,
  `components/MenuPanel.tsx`). The **second keypad** switch is a real
  preference in both orientations: it was landscape-only, which made it a
  dead control in the app's default orientation, and MenuPanel's memo for
  the Settings view omitted it from its dep array — so the value it
  rendered was frozen and the switch sprang back on every tap. Both are
  fixed; the AsyncStorage key keeps its original `secondKeypadLandscape`
  name so nobody's stored preference resets (`components/DraggableKeypad.tsx`).
- **Save affordance** — the save pill on the **menu sheet's close row**,
  far LEFT opposite the ✕: saves immediately on tap, its status dot pulses
  amber while state is dirty since the last successful write and goes green
  when clean; autosave still runs in the background — the pill makes saving
  a first-class visible action rather than a menu dig. It has moved twice:
  out of the top icon row (a third wider than an icon button, which pushed
  the row over its 360px budget) and out of the floating bottom-right
  cave dock (which went away with the upgrades button moving into the
  depth bar). `BottomModal` grew a `headerLeft` slot for it, which is what
  turned the lone right-aligned ✕ into a two-slot row
  (`components/SavePill.tsx`, `components/MenuPanel.tsx`,
  `src/components/BottomModal.tsx`).
- **Quality** — Jest suites over the pure modules (1722 tests), Maestro
  e2e flows, **hermetic Playwright web e2e** (`pnpm run test:e2e:web`:
  boot / rewarded-ads / IAP / Google-sign-in specs against stubbed ad +
  Stripe/Pocketbase backends from `e2e/web/` — the boot spec doubles as the zero-backend
  offline-resilience check, ads run in Google's documented
  `data-adbreak-test` test mode, and a guard route fails the suite on any
  request that would become a live impression or sidecar call; pass 12 of
  `docs/gap-ranking.md` is the design context, `docs/store-integration.md`
  §2.7 the spec-by-spec contract), Play Console CLI helper (`pnpm run play`), static-export-safe
  routing (AGENTS.md).
- **Support** — in-app mailto inquiries button (`components/InquiriesButton.tsx`).

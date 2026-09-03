/**
 * English translation table — the source of truth for every UI string.
 * `TranslationKey` is derived from HERE, so any other locale (es.ts, ...)
 * is type-checked against this key set: a missing or extra key is a
 * compile error, and `__test__`-free parity of the `{placeholder}` sets
 * is additionally pinned in i18n.test.ts.
 *
 * Conventions:
 *  - Keys are flat and grouped by prefix ("purchase.*", "toast.*", ...).
 *  - Interpolation placeholders are {camelCase} names, substituted by
 *    `format` (i18n.ts) — e.g. "UPGRADE POWER (-{cost} 🪨) ({power})".
 *  - Display strings keep the game's ALL-CAPS button style in English;
 *    each locale follows the same casing convention.
 *  - Emoji glyphs are inlined in the table (same glyphs in every locale)
 *    so a translation never depends on the component.
 *
 * Data-driven names (depth-tier names, goal/achievement/record labels,
 * cosmetic names, IAP product labels, legal doc titles & section headings)
 * are NOT here — they live in their data modules (game.ts, goals.ts,
 * cosmetics.ts, achievements.ts, records.ts, iaps.ts, legal.ts), which are
 * the English source of truth, and get their per-locale shape from
 * content.ts / content-es.ts (same dir). Legal document section BODIES
 * are still English-only (docs/todo.md).
 */
export const en = {
  // --- Loading & errors -------------------------------------------------
  "loading.mine": "loading the mine…",
  "error.title": "⛏️ Something went wrong",
  "error.body":
    "The game hit an unexpected error and stopped rendering. Your save " +
    "is safe — it is written to local storage automatically and will be " +
    "there when the game runs again.",
  "error.contextHeading": "what was happening:",
  "error.tryAgain": "Try again",
  "error.reloadPage": "Reload page",
  "error.hint":
    "Long-press the error text above to copy it. Recent crashes also " +
    "stay in menu → Settings → “Recent errors (debug)” after a restart.",

  // --- Main screen ------------------------------------------------------
  "main.upgrades": "UPGRADES",
  "main.a11yShowUpgrades": "Show upgrades",
  "main.a11yHideUpgrades": "Hide upgrades",
  "main.a11yMenu": "Menu",
  "main.a11yLeaderboard": "Leaderboard — the top diggers",

  // --- Toasts / messages --------------------------------------------------
  "toast.depth": "Depth {depth}m — deeper into the cave!",
  "toast.enteredTier": "Entered {tier}! Click power ×{bonus}",
  "toast.tierComplete":
    "🏆 {tier} complete! +{bonus} 🪨 — unlocks: {unlock}",
  "toast.achievement": "🏅 {label}! +{bonus} 🪨",
  "toast.vein": "You struck a vein! +1 💎",
  "toast.comboUp": "Combo x{mult}!",
  "toast.streakIgnited": "🔥 Streak ignited — ×2 per answer!",
  "toast.comboDropped": "Combo dropped to {combo}!",
  "toast.comboLost": "Combo lost!",
  "toast.saved": "Game saved",
  "toast.settingsSaved": "Saved",
  "toast.invalidSaveCode": "Invalid save code.",
  "toast.saveImported": "Save imported!",
  "toast.cloudRestored": "Save recovered from the cloud backup",
  "toast.cloudNoBackup": "No cloud backup found yet",
  "toast.cloudRestoreFailed": "The cloud backup couldn't be read",
  "toast.dataDeleted": "Your data has been deleted from the server",
  "toast.dataDeleteFailed": "Couldn't reach the server — nothing was deleted",
  "toast.welcomeBack":
    "Welcome back! Your miners collected {count} 🪨 while you were away.",
  "toast.saveFailed": "Warning: failed to save your game.",
  "toast.dailyBonus": "Daily bonus: +{bonus} minerals",
  "toast.dailyBonusStreak":
    "Daily bonus: +{bonus} minerals (day {streak} streak!)",
  "toast.iapRemoveAds": "Ads removed — thanks for supporting the game!",
  "toast.iapPackUnlocked": "Unlocked {name} — find it in Cosmetics!",
  "toast.iapComplete": "Purchase complete!",
  "toast.adFinishedGems": "Ad finished: +{count} 💎",
  "toast.adFinishedDouble":
    "Ad finished: offline haul doubled (+{count} 🪨)",
  "toast.adFinishedTopUp":
    "Ad finished: +2h offline top-up (+{count} 🪨)",
  "toast.adFinishedCombo": "Ad finished: combo restored to {combo}",
  "toast.adClosedEarly": "Ad closed early — no reward this time.",

  // --- Combo indicator ----------------------------------------------------
  "combo.active": "🔥 {combo}x combo",
  "combo.untilNext": "{count} more → ×{mult}",

  // --- Equation area ------------------------------------------------------
  "equation.pending": "correct: +{gain} 🪨",
  "equation.detail": " (×{mult}{suffix})",
  "equation.tagHard": "hard",
  "equation.tagTimed": "timed",
  "equation.tagStreak": "streak",
  "equation.streakProgress": "🔥 streak {n}/{threshold}",
  "equation.streakIgnited": "🔥 streak ×2",
  "equation.a11yTimed": "Timed mode: {seconds} seconds left",

  // --- Purchase buttons ---------------------------------------------------
  "purchase.groupMinerals": "SPEND 🪨 MINERALS",
  "purchase.groupGems": "SPEND 💎 GEMS",
  "purchase.groupPrestige": "PRESTIGE",
  "purchase.nextCost": ", next {cost}",
  "purchase.upgradePower": "UPGRADE POWER (-{cost} 🪨) ({power})",
  "purchase.upgradeMiners": "UPGRADE MINERS (-{cost} 🪨) ({power})",
  "purchase.upgradeMinersLocked": "🔒 UPGRADE MINERS (Prospector's License)",
  "purchase.buyGem": "BUY A GEM (-{cost} 🪨)",
  "purchase.buyMiner":
    "BUY A MINER (-{cost} 💎) ({count}{next})",
  "purchase.buyFastMiner":
    "BUY A FAST MINER (-{cost} 💎) ({count}, {output}/s each{next})",
  "purchase.buyFastMinerLocked": "🔒 BUY FAST MINER (Deep Shaft)",
  "purchase.buyLegendaryMiner":
    "BUY A LEGENDARY MINER (-{cost} 💎) ({count}, {output}/s each{next})",
  "purchase.buyLegendaryMinerLocked": "🔒 BUY LEGENDARY MINER (Motherlode)",
  "purchase.gemChanceLocked": "🔒 GEM CHANCE +1% (Deep Shaft)",
  "purchase.gemChanceMaxed": "GEM CHANCE {pct}% (MAX)",
  "purchase.gemChance": "GEM CHANCE +1% (-{cost} 💎) (now {pct}%)",
  "purchase.clickBoostLocked": "🔒 CLICK ×2 (Magma Frontier)",
  "purchase.clickBoostMaxed": "CLICK POWER ×{mult} (MAX)",
  "purchase.clickBoost": "CLICK ×2 (-{cost} 💎) (now ×{mult})",
  "purchase.comboResistLocked": "🔒 COMBO RESISTANCE (Magma Frontier)",
  "purchase.comboResistMaxed": "COMBO RESISTANCE (keep {pct}%) (MAX)",
  "purchase.comboResist":
    "COMBO RESISTANCE (-{cost} 💎) (keep {pct}%)",
  "purchase.sinkNewShaftLocked": "🔒 SINK NEW SHAFT (Magma Frontier)",
  "purchase.sinkNewShaftCanBank":
    "⛏️ SINK NEW SHAFT → ×{next} (now ×{banked})",
  "purchase.sinkNewShaftNeed":
    "⛏️ SINK NEW SHAFT ×{banked} — need {at} 🪨 total for ×{next}",
  "purchase.sinkNewShaftMax": "⛏️ SINK NEW SHAFT ×{banked} (MAX)",

  // --- Daily bonus --------------------------------------------------------
  "a11y.dailyClaimable": "Claim daily bonus: +{bonus} minerals",
  "a11y.dailyClaimableStreak":
    "Claim daily bonus: +{bonus} minerals, starts day {day} streak",
  "a11y.dailyClaimed":
    "Daily bonus claimed today. Come back tomorrow for the next bonus.",

  // --- Save pill ----------------------------------------------------------
  "save.pill": "Save",
  "a11y.save": "Save game",
  "a11y.saveDirty": "Save game (unsaved changes)",

  // --- Onboarding ---------------------------------------------------------
  "onboarding.1.title": "Mine the math",
  "onboarding.1.body":
    "Answer the equation at the top to earn minerals. Holding the cave " +
    "(press and hold) works too, but it's a slower way to dig.",
  "onboarding.2.title": "Keep the combo alive",
  "onboarding.2.body":
    "Every correct answer builds your combo — every 10 in a row " +
    "multiplies your gains by +1. Wrong answers and cave holds break it, " +
    "so answer fast and don't touch the cave while typing.",
  "onboarding.3.title": "Hire miners",
  "onboarding.3.body":
    "Spend minerals on upgrades and miners below. Miners dig for you " +
    "automatically — even while the game is closed. Check the 🎯 goals " +
    "for what's coming next.",
  "onboarding.skip": "Skip",
  "onboarding.next": "Next",
  "onboarding.start": "Start mining! ⛏️",
  "onboarding.a11ySkip": "Skip tutorial",
  "onboarding.a11yNext": "Next step",
  "onboarding.a11yStart": "Start mining",

  // --- Menu ----------------------------------------------------------------
  "menu.settings": "⚙️ Settings",
  "menu.goals": "🎯 Goals",
  "menu.records": "📊 Records",

  // --- Settings ------------------------------------------------------------
  "settings.language": "🌐 Language:",
  "lang.auto": "Auto",
  "settings.autosave": "Autosave interval (seconds): ",
  "settings.maxNumber": "Max constant value in equations: ",
  "settings.operatorHelp": "Long-press an operator to see how it pays",
  "settings.operatorEquations": "{name} equations",
  "settings.tooltipHard": "Hard mode equations",
  "settings.tooltipStreak": "Streak mode equations",
  "settings.tooltipTimed": "Timed mode equations",
  "settings.tooltipEmojiArt": "Emoji art (low-end mode)",
  "settings.tooltipShowAll": "Always show all upgrade buttons",
  "settings.gainFormula":
    "Minerals mined per correct answer = answer × click power × combo " +
    "multiplier, plus any operator bonus. Hard-mode equations pay ×2 on " +
    "top; timed-mode equations pay ×2 more when answered inside the " +
    "window; an ignited streak pays ×2 more on top of all of it.",
  "settings.op.multiply": "No operator bonus (×1).",
  "settings.op.add": "No operator bonus (×1).",
  "settings.op.subtract":
    "Operator bonus ×2. Answers are always whole & non-negative.",
  "settings.op.division":
    "Operator bonus ×10. Division is always exact.",
  "settings.op.percent":
    "Operator bonus ×3. Only 10/25/50% — always exact.",
  "settings.op.square":
    "Operator bonus ×4. The answer is a².",
  "settings.op.missing":
    'Operator bonus ×3. Find the number that goes in the "?".',
  "settings.opName.multiply": "multiplication",
  "settings.opName.add": "addition",
  "settings.opName.subtract": "subtraction",
  "settings.opName.division": "division",
  "settings.opName.percent": "percent",
  "settings.opName.square": "square",
  "settings.opName.missing": "missing number",
  "settings.multiplySymbol": "Multiply display: ",
  "settings.hardMode": "Hard mode (3-term ×2): ",
  "settings.hardModeLocked": "🔒 Hard mode (Motherlode): ",
  "settings.hardModeHelp":
    "3-term equations (a ○ b ○ c, left to right) that pay ×2 the normal " +
    "amount. The extra premium comes from the third term — more " +
    "arithmetic, bigger answers.",
  "settings.streakMode": "Streak mode (5 in a row for ×2): ",
  "settings.streakModeHelp":
    "Answer 5 equations correctly in a row and the streak ignites: every " +
    "correct answer after that pays ×2 on top of everything else (it " +
    "stacks with the operator, hard-mode, and timed-mode bonuses). One " +
    "wrong answer — or a timed-mode timeout — breaks the run and the " +
    "streak starts over at 0. Unlike your combo, holding the cave does " +
    "NOT break the streak: the rule is simply no wrong answers.",
  "settings.timedMode": "Timed mode (answer in 10s for ×2): ",
  "settings.timedModeHelp":
    "Every equation gets a 10-second window: answer in time and the " +
    "payout gets ×2 (it stacks with the operator and hard-mode bonuses). " +
    "When the window runs out the equation counts as a miss — your combo " +
    "drops exactly like a wrong answer (combo resistance still applies) " +
    "— and a new one rolls. Stacks with hard mode: a 3-term equation " +
    "answered in time pays ×4 on top of the operator bonus.",
  "settings.emojiArt": "Emoji art (low-end mode): ",
  "settings.emojiArtHelp":
    "Off (default): miners, currency icons, debris and the cave backdrop " +
    "are procedural pixel sprites. On: plain emoji instead — lighter on " +
    "low-end devices where PNG decode/render is the bottleneck. Purely " +
    "visual; gameplay is unchanged.",
  "settings.showAllPurchases": "Always show all upgrade buttons: ",
  "settings.showAllPurchasesHelp":
    "Off (default): each upgrade button appears only once you've ever " +
    "had enough minerals or gems to buy its first level — the screen stays " +
    "uncluttered as the shop grows. The three core buttons (upgrade " +
    "power, buy a miner, buy a gem) are always visible. On: every upgrade " +
    "button is shown at all times, locked or not.",
  "settings.saveCode": "Save code (backup / share)",
  "settings.export": "Export code",
  "settings.import": "Import code",
  "settings.importPlaceholder": "Paste a save code to import it",
  "settings.saveCodeHelp":
    "Export gives you a code to copy and share; importing a code " +
    "replaces your current save with the one in the code.",
  "settings.cloudSave": "Cloud backup",
  "settings.cloudSim": " (simulated)",
  "settings.cloudSaveHelp":
    "Backs up your save to a private, device-only cloud slot every few " +
    "minutes and after each prestige. The backup never appears in save " +
    "codes and only ever replaces your save when you restore it.",
  "settings.cloudRestore": "Restore from cloud",
  "settings.cloudRestoreDescription":
    "Replace your current save with the cloud backup? This can't be " +
    "undone.",
  "settings.cloudLastSyncOk": "Last sync: {when}",
  "settings.cloudLastSyncFailed": "Last sync failed — will retry automatically",
  "settings.cloudNeverSynced": "Not synced yet",
  "settings.deleteData": "Delete my data",
  "settings.deleteDataDescription":
    "Removes your cloud backup and leaderboard row from the server. " +
    "Purchases on this device are kept, so a restore still works. " +
    "This can't be undone.",
  "leaderboard.title": "🏆 Top {limit} — deepest shaft",
  "leaderboard.name": "Display name (shown on the leaderboard)",
  "leaderboard.refresh": "Refresh",
  "leaderboard.loading": "Loading the board…",
  "leaderboard.unavailable":
    "Unavailable right now — try again in a minute.",
  "leaderboard.youRow": "You — rank #{rank} · {depth}m",
  "leaderboard.notRanked": "Not in the top {limit} yet — keep digging!",
  "settings.saveButton": "Save",
  "settings.resetButton": "Reset",
  "settings.resetDescription":
    "Will delete current save data and reset to initial state.",
  "settings.a11ySaveCode": "Your save code — select to copy",
  "settings.analytics": "Local stats (debug)",
  "settings.clear": "Clear",
  "settings.analyticsNote":
    "Stored on this device only — no network, no PII. Clear deletes " +
    "it; a fresh record starts on the next open.",
  "settings.crash": "Recent errors (debug)",

  // --- Cosmetics ------------------------------------------------------------
  "cosmetics.header": "Cosmetics",
  "cosmetics.reroll": "🎲 Reroll look",
  "cosmetics.outfits": "Outfits (randomized colors per reroll)",
  "cosmetics.pickaxes": "Pickaxes",
  "cosmetics.themes": "Cave themes",
  "cosmetics.themesLocked": "🔒 Cave themes (Crystal Kingdom)",
  "cosmetics.themesUnlockedAt": "Unlocks at Crystal Kingdom",
  "cosmetics.owned": "Owned",
  "cosmetics.a11ySelected": "selected",
  "cosmetics.a11yOwned": "owned",
  "cosmetics.a11yGems": "{count} gems",
  "cosmetics.a11yTheme": "Cave theme {name}, {state}",

  // --- Goals ----------------------------------------------------------------
  "goals.unlocks": "Unlocks: {unlock} · Bonus: {bonus} 🪨",
  "goals.achievements": "🏅 Achievements",
  "goals.achievementsNote":
    "One-off bonuses — no unlocks, just confetti.",

  // --- Records ---------------------------------------------------------------
  "records.header":
    "Personal bests, kept on your save — they survive spending and " +
    "prestiges.",

  // --- Legal section -----------------------------------------------------------
  "legal.heading": "Legal & privacy",
  "legal.meta": "Version {version} · Effective {date}",

  // --- Rewarded ads panel -------------------------------------------------------
  "ads.a11y": "Rewarded ads",
  "ads.title":
    "🎬 Rewarded ads — watch a video, get a bonus. Optional, and closing " +
    "early just means no bonus.",
  "ads.devSim":
    "⚠️ Development build: ads are simulated and nothing is actually " +
    "played.",
  "ads.gemRolls": "💎 Gem rolls — +{count} 💎 per watch",
  "ads.leftToday": "{left} of {total} left today",
  "ads.backTomorrow": "Back tomorrow.",
  "ads.comboSave": "🔥 Save a lost combo",
  "ads.comboSaveDetail": "Restore a combo of {combo} — expires in {time}",
  "ads.comboSaveNone": "Available right after you lose a combo.",
  "ads.double": "🪨 Double offline earnings",
  "ads.doubleDetail": "Doubles your last haul: +{count} 🪨",
  "ads.doubleNone": "No offline haul to double yet.",
  "ads.topUp": "⏱️ Offline top-up (+{hours}h)",
  "ads.topUpDetail":
    "The 8h cap withheld your last haul — watch to earn the next {hours}h: " +
    "+{count} 🪨",
  "ads.topUpNone": "Available when an offline haul hits the 8h cap.",
  "ads.cap": "Up to {count} rewards a day, all of them.",
  "ads.watching": "Playing…",
  "ads.watch": "Watch",

  // --- IAP panel -------------------------------------------------------------------
  "iap.a11y": "Purchases",
  "iap.title":
    "🛍️ One-time purchases — all optional. The game is fully free and " +
    "completable without any of them.",
  "iap.devSim":
    "⚠️ Development build: purchases are simulated and no money is " +
    "involved.",
  "iap.alsoEarnable":
    "Also earnable in-game for {count} 💎 — buying is convenience, not " +
    "access.",
  "iap.groupPickaxes": "Pickaxes",
  "iap.groupOutfits": "Outfits",
  "iap.groupThemes": "Cave themes",
  "iap.owned": "Owned",
  "iap.buy": "Buy",
  "iap.restore": "📦 Restore purchases",
  "iap.restoreDetail":
    "Re-apply the past store purchases on this device.",
  "iap.restoreButton": "Restore",

  // --- Shared UI ---------------------------------------------------------------
  "ui.close": "Close",
  "ui.areYouSure": "Are you sure?",
  "ui.confirm": "Confirm",
  "ui.cancel": "Cancel",
  "a11y.backspace": "Backspace",
  "a11y.submitAnswer": "Submit answer",
  "a11y.holdToMine": "Hold to mine",
  "a11y.digit": "Digit {d}",
  "a11y.holdToClear": "Hold to clear the whole answer",
  "a11y.closeSettings": "Close settings",
  "a11y.settings": "Settings",

  // --- Footer misc -------------------------------------------------------------------
  "inquiries.subject": "Mines of Doom — feedback from a player",
  "a11y.inquiries":
    "Inquiries — opens your email app to contact the developer",
  "share.achievement": "I earned '{name}' in Mines of Idle Doomath!",
  "a11y.shareAchievement": "Share achievement {name}",
  "a11y.mute": "Mute sound",
  "a11y.unmute": "Unmute sound",
} as const;

/** Every UI string key — derived from the English table (source of truth). */
export type TranslationKey = keyof typeof en;

/** Interpolation variables for `format`/`translate` ({name} placeholders). */
export type Vars = Record<string, string | number>;

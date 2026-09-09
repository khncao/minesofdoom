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
  "main.a11yCloseUpgrades": "Close upgrades",
  "main.a11yAffordablePurchase": "An upgrade you can afford is available",
  "main.a11yMenu": "Menu",
  "main.a11yLeaderboard": "Leaderboard — the top diggers",

  // --- Toasts / messages --------------------------------------------------
  "toast.depth": "Depth {depth}m — deeper into the cave!",
  "toast.enteredTier": "Entered {tier}! Click power ×{bonus}",
  "toast.tierComplete": "🏆 {tier} complete! +{bonus} 🪨 — unlocks: {unlock}",
  "toast.achievement": "🏅 {label}! +{bonus} 🪨",
  "toast.vein": "You struck a vein! +1 💎",
  "toast.comboUp": "Combo x{mult}!",
  "toast.comboDropped": "Combo dropped to {combo}!",
  "toast.comboLost": "Combo lost!",
  "toast.idleReminder":
    "The mine keeps collecting while you're away, and your progress autosaves — " +
    "come back to check the haul!",
  "toast.gemPocket": "A gem pocket formed in the cave — tap it for a bonus!",
  "toast.gemPocketCollected": "Gem pocket: +{bonus} minerals",
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
  "toast.dailyEquation": "Equation of the Day solved: +{bonus} minerals!",
  "toast.dailyEquationStart":
    "Equation of the Day: solve it for +{bonus} minerals — wrong answers are free",
  "toast.weeklyContract": "Weekly contract complete: +{bonus} minerals",
  "toast.iapPackUnlocked": "Unlocked {name} — find it in Cosmetics!",
  "toast.adFinishedGems": "Ad finished: +{count} 💎",
  "toast.adFinishedDouble": "Ad finished: offline haul doubled (+{count} 🪨)",
  "toast.adFinishedTopUp": "Ad finished: +2h offline top-up (+{count} 🪨)",
  "toast.adFinishedCombo": "Ad finished: combo restored to {combo}",
  "toast.adClosedEarly": "Ad closed early — no reward this time.",

  // --- Combo indicator ----------------------------------------------------
  "combo.active": "🔥 {combo}x combo",
  "combo.untilNext": "{count} more → ×{mult}",
  // The main-screen combo-save pill (todo: "Allow saving combo with
  // rewarded-ad"): shown right after a multiplier-worthy combo is lost,
  // with the offer window's seconds left; the tap is the "watch" tap.
  "combo.saveOffer": "🔥 Combo {combo} lost — save it ({time}s)",
  "combo.saveOfferClaiming": "🔥 Saving combo {combo}…",

  // --- Equation area ------------------------------------------------------
  "equation.pending": "correct: +{gain} 🪨",
  "equation.detail": " (×{mult}{suffix})",
  "equation.tagHard": "hard",

  // --- Purchase buttons ---------------------------------------------------
  "purchase.groupMinerals": "SPEND 🪨 MINERALS",
  "purchase.groupGems": "SPEND 💎 GEMS",
  "purchase.groupPrestige": "PRESTIGE",
  // Buy-all buttons in the group headers (todo: buy-all buttons): the
  // greedy plan's total levels and total cost in the group's currency.
  "purchase.buyAllMinerals": "⚡ ALL +{count} (-{cost} 🪨)",
  "purchase.buyAllGems": "⚡ ALL +{count} (-{cost} 💎)",
  "purchase.a11yBuyAllMinerals": "Buy all mineral upgrades: +{count} levels",
  "purchase.a11yBuyAllGems": "Buy all gem upgrades: +{count} levels",
  "purchase.nextCost": ", next {cost}",
  "purchase.upgradePower": "UPGRADE POWER (-{cost} 🪨) ({power})",
  "purchase.upgradeMiners": "UPGRADE MINERS (-{cost} 🪨) ({power})",
  "purchase.upgradeMinersLocked": "🔒 UPGRADE MINERS (Prospector's License)",
  "purchase.buyGem": "BUY A GEM (-{cost} 🪨)",
  "purchase.buyMiner": "BUY A MINER (-{cost} 💎) ({count}{next})",
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
  "purchase.comboResist": "COMBO RESISTANCE (-{cost} 💎) (keep {pct}%)",
  "purchase.sinkNewShaftLocked": "🔒 SINK NEW SHAFT (Magma Frontier)",
  "purchase.sinkNewShaftCanBank": "⛏️ SINK NEW SHAFT → ×{next} (now ×{banked})",
  "purchase.sinkNewShaftNeed":
    "⛏️ SINK NEW SHAFT ×{banked} — need {at} 🪨 total for ×{next}",
  "purchase.sinkNewShaftMax": "⛏️ SINK NEW SHAFT ×{banked} (MAX)",

  // --- Daily bonus --------------------------------------------------------
  "a11y.dailyClaimable": "Claim daily bonus: +{bonus} minerals",
  "a11y.dailyClaimableStreak":
    "Claim daily bonus: +{bonus} minerals, starts day {day} streak",
  "a11y.dailyClaimed":
    "Daily bonus claimed today. Come back tomorrow for the next bonus.",
  "a11y.dailyEquationPending":
    "Equation of the Day: unsolved (+{bonus} minerals)",
  "a11y.dailyEquationSolved": "Equation of the Day: solved today",
  "a11y.weeklyClaimable": "Claim weekly contract: +{bonus} minerals",
  "a11y.weeklyProgress": "Weekly contract: {done} of {total} goals complete",
  "a11y.weeklyClaimed": "Weekly contract claimed for this week",

  // --- Save button ---------------------------------------------------------
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
  // First-time setup step (todo: "allow first time setup of operators and
  // other key settings"): the last onboarding step, before "Start".
  // Operator names, the symbol-display label, and the keypad label are
  // the SAME keys the settings panel uses (settings.opName.* /
  // settings.multiplySymbol / settings.onScreenKeypad), so a player who
  // set things up here recognizes them later in the menu.
  "onboarding.4.title": "Set up your math",
  "onboarding.4.body":
    "Pick the equation types you want to mine — and how you'll type the " +
    "answers. You can change any of this later in Settings.",
  "onboarding.setup.operators": "Equation types",
  "onboarding.skip": "Skip",
  "onboarding.next": "Next",
  "onboarding.start": "Start mining! ⛏️",
  "onboarding.a11ySkip": "Skip tutorial",
  "onboarding.a11yNext": "Next step",
  "onboarding.a11yStart": "Start mining",

  // --- Menu ----------------------------------------------------------------
  "menu.settings": "⚙️ Settings",
  "menu.save": "💾 Save",
  "menu.account": "👤 Account",
  "menu.goals": "🎯 Goals",
  "menu.records": "📊 Records",
  "menu.about": "ℹ️ About",

  // --- Settings ------------------------------------------------------------
  "settings.language": "🌐 Language:",
  "lang.auto": "Auto",
  "settings.autosave": "Autosave interval (seconds): ",
  "settings.maxNumber": "Max constant value in equations: ",
  "settings.operatorHelp": "Long-press an operator to see how it pays",
  "settings.operatorEquations": "{name} equations",
  "settings.tooltipHard": "Hard mode equations",
  "settings.tooltipEmojiArt": "Emoji art (low-end mode)",
  "settings.tooltipHaptics": "Haptic feedback",
  "settings.tooltipShowAll": "Always show all upgrade buttons",
  "settings.gainFormula":
    "Minerals mined per correct answer = answer × click power × combo " +
    "multiplier, plus any operator bonus. Hard-mode equations pay ×2 on " +
    "top.",
  "settings.op.multiply": "No operator bonus (×1).",
  "settings.op.add": "No operator bonus (×1).",
  "settings.op.subtract":
    "Operator bonus ×2. Answers are always whole & non-negative.",
  "settings.op.division": "Operator bonus ×10. Division is always exact.",
  "settings.op.percent": "Operator bonus ×3. Only 10/25/50% — always exact.",
  "settings.op.square": "Operator bonus ×4. The answer is a².",
  "settings.op.missing":
    'Operator bonus ×3. Find the number that goes in the "?".',
  "settings.opName.multiply": "multiplication",
  "settings.opName.add": "addition",
  "settings.opName.subtract": "subtraction",
  "settings.opName.division": "division",
  "settings.opName.percent": "percent",
  "settings.opName.square": "square",
  "settings.opName.missing": "missing number",
  "settings.multiplySymbol": "Symbol display: ",
  "settings.hardMode": "Hard mode (3-term ×2): ",
  "settings.hardModeLocked": "🔒 Hard mode (Motherlode): ",
  "settings.hardModeHelp":
    "3-term equations (a ○ b ○ c, left to right) that pay ×2 the normal " +
    "amount. The extra premium comes from the third term — more " +
    "arithmetic, bigger answers.",
  // --- Mental math tips (todo: "Add a tips section") ----------------------
  "settings.tips": "Mental math tips",
  "settings.tip.next": "Next tip",
  "settings.tip.add.title": "Add in chunks",
  "settings.tip.add.body":
    "Break the number up to make a round one: 47 + 28 = 47 + 30 − 2 = 75. " +
    "Rounding up and then subtracting the leftover is usually faster than " +
    "adding the last digit.",
  "settings.tip.five.title": "Multiplying by 5",
  "settings.tip.five.body":
    "×5 is ×10 then halve: 24 × 5 = 240 ÷ 2 = 120. It also works backwards " +
    "— halve first, then ×10.",
  "settings.tip.nine.title": "Multiplying by 9",
  "settings.tip.nine.body":
    "×9 is ×10 then subtract the number: 9 × 7 = 70 − 7 = 63.",
  "settings.tip.dblhalve.title": "Double and halve",
  "settings.tip.dblhalve.body":
    "×4 is double twice; ×8 is double three times. Halving is the other " +
    "half of the same trick: 36 ÷ 4 = 18 ÷ 2 = 9.",
  "settings.tip.percent.title": "Percent is just × then ÷100",
  "settings.tip.percent.body":
    "The two numbers swap freely: 8% of 50 = 50% of 8 = 25. Quick ones: " +
    "50% is halve, 25% is divide by 4, 10% is move the point one left.",
  "settings.tip.square.title": "Squares ending in 5",
  "settings.tip.square.body":
    "For a5: multiply a by a+1 and stick 25 on the end. 35² → 3 × 4 = 12, " +
    "so 1225. 65² → 6 × 7 = 42, so 4225.",
  "settings.tip.missing.title": "Missing number: work backwards",
  "settings.tip.missing.body":
    "The missing number undoes the other operation: in a + b = ? subtract, " +
    "in a × b = ? divide. Ask which operation the ? is hiding, then run it " +
    "in reverse.",
  "settings.tip.division.title": "Division is multiplication in reverse",
  "settings.tip.division.body":
    "Read a ÷ b as “b × what = a?”: 48 ÷ 6 → 6 × 8 = 48, so 8. If it " +
    "doesn't ring a bell, walk the multiples of b up from 1.",
  "settings.tooltipIdleReminder": "Idle reminder",
  "settings.idleReminder": "Idle reminder: ",
  "settings.idleReminderHelp":
    "On (default): after a minute without a cave tap or an answer, a one-time " +
    "message reminds you that the mine keeps collecting while you're away and " +
    "your progress autosaves. It shows at most once per session and pays " +
    "nothing — information, not a timer. Off: it stays quiet.",
  "settings.haptics": "Haptic feedback: ",
  "settings.hapticsHelp":
    "On (default): the device vibrates on the events that carry the game's " +
    "feedback — a short tick on each mine (bigger gains buzz a touch " +
    "longer), a beat on correct answers, a thud on wrong ones, and a " +
    "double-tap on achievements and purchases. Off: no vibration, sound " +
    "is unaffected. On devices without haptics hardware this does nothing " +
    "either way.",
  "settings.tooltipMusic": "Cave ambience",
  "settings.music": "Cave ambience: ",
  "settings.musicHelp":
    "A soft, looping cave drone under the sound effects (on by default). " +
    "Its level has its own Music volume setting, and the menu's mute " +
    "toggle still wins — while muted, nothing plays. Off: silence under " +
    "the SFX.",
  "settings.tooltipSoundVolume": "Sound volume",
  "settings.soundVolume": "Sound volume: ",
  "settings.soundVolumeHelp":
    "The level of all in-game sound effects (0–100%, default 100%). − and + " +
    "step in 10% increments and apply immediately. The menu's mute toggle " +
    "still wins — while muted, the volume sets nothing.",
  "a11y.decreaseSoundVolume": "Decrease sound volume",
  "a11y.increaseSoundVolume": "Increase sound volume",
  "settings.tooltipMusicVolume": "Music volume",
  "settings.musicVolume": "Music volume: ",
  "settings.musicVolumeHelp":
    "The level of the cave-ambience music (0–100%, default 50%). − and + " +
    "step in 10% increments and apply immediately. It is independent of " +
    "the sound-effects volume — the music can be heard with the SFX quiet " +
    "and vice versa. The menu's mute toggle still wins — while muted, " +
    "nothing plays.",
  "a11y.decreaseMusicVolume": "Decrease music volume",
  "a11y.increaseMusicVolume": "Increase music volume",
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
  "settings.onScreenKeypad": "On-screen keypad: ",
  "settings.onScreenKeypadHelp":
    "On: the answer box never opens the OS keyboard — a numpad-style " +
    "keypad appears as a tab next to the upgrades list below the cave, and " +
    "answers are typed there. Off: the answer is typed with the OS " +
    "keyboard. First-launch default: on in the app, off on the web; this " +
    "switch wins afterwards. Takes effect immediately, no Save tap needed.",
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
  // --- Optional account (docs/todo.md "Optional login") ------------
  "settings.account": "Account",
  "settings.accountDefault":
    "Continue without an account — your progress is saved on this " +
    "device only. An account is optional: it lets you move your save, " +
    "purchases and leaderboard row to a new device.",
  "settings.accountEmail": "Email",
  "settings.accountPassword": "Password (8–72 characters)",
  "settings.accountConfirmPassword":
    "Confirm the new password (only for a new account)",
  "settings.accountSignIn": "Sign in",
  "settings.accountRegister": "Create account",
  "settings.accountGoogle": "Continue with Google",
  "settings.accountLinkGoogle": "Link Google",
  "settings.accountLinkApple": "Link Apple",
  "settings.accountNewPassword": "New password",
  "settings.accountSetPassword": "Set a password for this account",
  "settings.accountApple": "Continue with Apple",
  "settings.accountEmailTaken":
    "That email already has an account — sign in instead.",
  "settings.accountBadCredentials":
    "That email and password don't match. Check both, or create a new " +
    "account.",
  "settings.accountError":
    "Couldn't reach the account service — check your connection and " +
    "try again.",
  "settings.accountProviderError": "Sign-in failed — try again.",
  "settings.accountLinked":
    "This device is linked to your account — save, purchases and " +
    "leaderboard follow it to a new device.",
  "settings.accountSignOut": "Sign out",
  "settings.deleteDataAccountDescription":
    "Removes your account and ALL data linked to it on every device — " +
    "saves, purchases and leaderboard — from the server. You'll be " +
    "signed out everywhere. This can't be undone.",
  "leaderboard.title": "🏆 Top {limit} — deepest shaft",
  "leaderboard.name": "Display name (shown on the leaderboard)",
  "leaderboard.refresh": "Refresh",
  "leaderboard.loading": "Loading the board…",
  "leaderboard.unavailable": "Unavailable right now — try again in a minute.",
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

  // --- Cosmetics (the unified shop — see the iap.* block) --------------
  "cosmetics.reroll": "🎲 Reroll look",
  "cosmetics.themesLocked": "🔒 Cave themes (Crystal Kingdom)",
  "cosmetics.themesUnlockedAt": "Unlocks at Crystal Kingdom",

  // --- Goals ----------------------------------------------------------------
  "goals.unlocks": "Unlocks: {unlock} · Bonus: {bonus} 🪨",
  "goals.achievements": "🏅 Achievements",
  "goals.achievementsNote": "One-off bonuses — no unlocks, just confetti.",

  // --- Records ---------------------------------------------------------------
  "records.header":
    "Personal bests, kept on your save — they survive spending and " +
    "prestiges.",
  "records.session": "This session — since the app was last opened.",
  "records.sessionMinerals": "Minerals mined",
  "records.sessionAnswers": "Equations answered",
  "records.sessionTime": "Time in the mine",

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

  // --- IAP panel (the unified shop: gem buys + one-time purchases) --------------
  "iap.a11y": "Shop",
  "iap.title":
    "🛍️ Shop — buy cosmetics with gems, or unlock them for good with a " +
    "one-time purchase. All optional: the game stays fully free and " +
    "completable without any of it.",
  "iap.devSim":
    "⚠️ Development build: purchases are simulated and no money is " +
    "involved.",
  "iap.devRealStoreActive":
    "⚠️ Development build with REAL store billing active: purchases hit " +
    "the real store on this device.",
  "iap.realStoreToggle":
    "Real store billing (debug APK: install the Play license key on this " +
    "device first — see docs/store-integration.md §2.4)",
  "iap.alsoEarnable":
    "Also earnable in-game for {count} 💎 — buying is convenience, not " +
    "access.",
  "iap.groupPickaxes": "Pickaxes",
  "iap.groupOutfits": "Outfits",
  "iap.groupThemes": "Cave themes",
  "iap.equip": "Equip",
  "iap.equipped": "✓ Equipped",

  // --- Shared UI ---------------------------------------------------------------
  "ui.close": "Close",
  "ui.areYouSure": "Are you sure?",
  "ui.confirm": "Confirm",
  "ui.cancel": "Cancel",
  "a11y.backspace": "Backspace",
  "a11y.clearAnswer": "Clear the whole answer",
  "a11y.submitAnswer": "Submit answer",
  "a11y.holdToMine": "Hold to mine",
  "a11y.gemPocket": "Gem pocket: tap to collect +{bonus} minerals",
  "a11y.digit": "Digit {d}",
  "a11y.holdToClear": "Hold to clear the whole answer",
  "a11y.closeSettings": "Close settings",
  "a11y.settings": "Settings",

  // --- Footer misc -------------------------------------------------------------------
  "inquiries.subject": "Mines of Idle Doomath — feedback from a player",
  "a11y.inquiries": "Inquiries — opens your email app to contact the developer",
  "share.achievement": "I earned '{name}' in Mines of Idle Doomath!",
  "a11y.shareAchievement": "Share achievement {name}",
  "a11y.mute": "Mute sound",
  "a11y.unmute": "Unmute sound",
} as const;

/** Every UI string key — derived from the English table (source of truth). */
export type TranslationKey = keyof typeof en;

/** Interpolation variables for `format`/`translate` ({name} placeholders). */
export type Vars = Record<string, string | number>;

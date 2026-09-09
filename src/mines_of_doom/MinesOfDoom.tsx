import { StatusBar } from "expo-status-bar";
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContent, useI18n } from "src/hooks/useI18n";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import type { DebrisParticlesRef } from "src/components/DebrisParticles";
import type { BlockBreakRef } from "src/components/BlockBreak";
import { Context } from "./Context";
import { getCaveTheme, getThemeTint, isOutfitId } from "./cosmetics";
import { styles } from "./styles";
import DepthBanner from "./components/DepthBanner";
import EquationDisplay from "./components/EquationDisplay";
import AnswerInput, { MAX_ANSWER_LENGTH } from "./components/AnswerInput";
import NumericKeypad from "src/components/NumericKeypad";
import ComboIndicator from "./components/ComboIndicator";
import ComboSaveIndicator from "./components/ComboSaveIndicator";
import PurchaseButtons from "./components/PurchaseButtons";
import MiningCanvas from "./components/MiningCanvas";
import MenuPanel from "./components/MenuPanel";
import type { AccountSettingsProps } from "./components/AccountTab";
import SavePill from "./components/SavePill";
import OnboardingOverlay from "./components/OnboardingOverlay";
import DailyBonusButton from "./components/DailyBonusButton";
import DailyEquationButton from "./components/DailyEquationButton";
import WeeklyContractButton from "./components/WeeklyContractButton";
import {
  ALL_PURCHASE_IDS,
  defaultSettingsData,
  saveVersion,
  serializeSaveData,
  getComboMultiplier,
  getComboRetention,
  getDepthTier,
  getDepthTierProgress,
  getPrestigeMultiplier,
  getResistantComboReset,
  getClickBoostMultiplier,
  COMBO_TIER_SIZE,
  getVisiblePurchases,
  hasAffordablePurchase,
  SettingsData,
  mulFloats,
} from "./game";
import {
  createSessionBaseline,
  getSessionStats,
  SessionBaseline,
} from "./session";
import {
  getAchievement,
  getAchievementBonus,
  getCompletedAchievementIds,
} from "./achievements";
import {
  CAVE_THEME_UNLOCK_TIER,
  FAST_MINER_UNLOCK_TIER,
  GOAL_TIERS,
  HARD_MODE_UNLOCK_TIER,
  LEGENDARY_MINER_UNLOCK_TIER,
  MINER_POWER_UNLOCK_TIER,
  PRESTIGE_UNLOCK_TIER,
  getCompletedTierIds,
} from "./goals";
import {
  formatNumber,
  getNumberNotation,
  setNumberNotation,
  subscribeNumberNotation,
} from "src/utils/format";
import { emojis } from "src/utils/graphics/emojis";
import type { FloatingTextRef } from "./components/FloatingTextLayer";
import { useMessages } from "./hooks/useMessages";
import {
  useGameEngine,
  type CosmeticPurchaseEventInput,
} from "./hooks/useGameEngine";
import { useSettings } from "./hooks/useSettings";
import { useSounds } from "./hooks/useSounds";
import { useHaptics } from "./hooks/useHaptics";
import { useCombo } from "./hooks/useCombo";
import { useShakeInput } from "./hooks/useShakeInput";
import { useMineTaps } from "./hooks/useMineTaps";
import { useJuiceWaves } from "./hooks/useJuiceWaves";
import { useIdleReminder } from "./hooks/useIdleReminder";
import { useGemPocket } from "./hooks/useGemPocket";
import { getJuiceTextSize, getJuiceWaves } from "./juice";
import { useAccessibilityReduceMotion } from "./hooks/useAccessibilityReduceMotion";
import { useEquations } from "./hooks/useEquations";
import { noteCrashEvent, setCrashContextState } from "./crashContext";
import { useDailyBonus } from "./hooks/useDailyBonus";
import { useWeeklyChallenge } from "./hooks/useWeeklyChallenge";
import { useDailyEquation } from "./hooks/useDailyEquation";
import { DAILY_EQUATION_BONUS } from "./dailyEquation";
import { useAnalytics } from "./hooks/useAnalytics";
import { useAdRewards } from "./hooks/useAdRewards";
import { useCloudSave, type CloudSaveSettingsProps } from "./hooks/useCloudSave";
import { selectCloudSaveProvider } from "./cloudSave";
import { selectAuthProvider } from "./auth";
import { selectTokenStore } from "./secureToken";
import { availableProviderKinds } from "./signinSdks";
import { useAccount } from "./hooks/useAccount";
import { useLeaderboard } from "./hooks/useLeaderboard";
import { selectLeaderboardProvider } from "./leaderboard";
import LeaderboardPanel from "./components/LeaderboardPanel";
import { selectAdProvider, COMBO_SAVE_WINDOW_MS, type AdKind } from "./ads";
import { useIap } from "./hooks/useIap";
import {
  IapProductId,
  IAP_PACK_GRANTS,
  IAP_PRODUCTS,
  iapGrantCosmeticIds,
  selectIapProvider,
} from "./iaps";
import LoadingScreen from "./components/LoadingScreen";
import AdRewardsPanel from "./components/AdRewardsPanel";
import IapPanel from "./components/IapPanel";

export default function MinesOfDoom() {
  // currently doesn't mute android touch sounds, but can in the future
  const [mute, setMute] = useLocalStorage<boolean>("mute", false);

  // Edge-to-edge (RN 0.86 / SDK 57): the window runs behind the status
  // bar and nav bar, so the game column's top (depth banner) and bottom
  // (footer row) must reserve the insets or the system bars eat them.
  // Zero on web/landscape-less cases where the OS reports no inset.
  const insets = useSafeAreaInsets();

  // On-screen keypad (todo: "Reimplement custom numeric keypad"): the
  // stored preference decides how answers are typed. On (the native
  // default): no TextInput is mounted at all, so the native keypad is
  // fully overridden — the NumericKeypad numpad renders in its own strip
  // below the canvas (the core-loop input, always reachable; the upgrades
  // menu lives in the side drawer over the canvas instead). Off: the OS
  // keyboard path in AnswerInput. The default is OFF on web (a web player
  // has a real keyboard; the numpad strip just eats vertical space) and ON
  // on native. Like `mute`, it's a plain display preference persisted in
  // AsyncStorage and applies immediately (the default only shapes first
  // launch — a stored preference, once set, wins on every platform).
  const [onScreenKeypad, setOnScreenKeypad] = useLocalStorage<boolean>(
    "onScreenKeypad",
    Platform.OS !== "web",
  );

  // The upgrades side drawer (todo: "upgrades menu as a side hidden
  // overlay on the canvas") holds the purchase list ONLY — the
  // cosmetics shop is NOT a tab here (todo: "No shop next to upgrades
  // menu"); it lives in the standalone 🛍️ shop panel (IapPanel — gem
  // AND one-time cash buys, todo: "move gem shop cosmetics to one time
  // purchase shop with gem and cash buy options"). The
  // keypad is likewise not in the drawer: when keypad mode is on it
  // lives in its own bottom strip (the core-loop input, always
  // reachable), when off the OS keyboard handles answers and there is
  // no on-screen keypad at all.
  // The drawer is hidden by default: the cave canvas keeps the whole
  // mid-screen, and the ⛏ upgrades button floating over the cave opens
  // it.
  const [upgradesOpen, setUpgradesOpen] = useState(false);

  // First-run onboarding (plan §2.1): shown until dismissed; the flag
  // persists in AsyncStorage so a skip/finish never resurfaces. The
  // loading flag hides the overlay until the stored value has been read,
  // so returning players don't flash it for a frame on cold start.
  const [onboardingDone, setOnboardingDone, onboardingLoading] =
    useLocalStorage<boolean>("onboardingDone", false);

  const { showMessage, displayMessage } = useMessages();
  // Autosave cadence (seconds) read by the game loop; kept in a ref so the
  // loop always sees the value without re-subscribing, and updated once
  // settings have loaded below.
  const autosaveSecondsRef = useRef(defaultSettingsData.autosave);
  // Forwarder for the engine's gem-buy cosmetics callback (features.md
  // pass-16 `cosmetics:analytics`): the analytics hook is instantiated
  // further down (hook order is fixed), so the engine hands its per-
  // purchase events to this ref, which the render fills in with the
  // real callback right after useAnalytics() returns.
  const onCosmeticPurchaseRef = useRef<
    ((ev: CosmeticPurchaseEventInput) => void) | null
  >(null);
  const {
    gameState,
    onTick,
    depth,
    mineralsPerSec,
    isLoaded,
    saveGame,
    saveDirty,
    addTapGain,
    applyAnswerReward,
    grantGems,
    offlineDouble,
    claimOfflineDouble,
    offlineTopUp,
    claimOfflineTopUp,
    upgradePower,
    buyMiner,
    buyFastMiner,
    buyLegendaryMiner,
    buyGem,
    buyGemChance,
    buyClickBoost,
    buyComboResist,
    buyAllMinerals,
    buyAllGems,
    upgradeMinerPower,
    completeTiers,
    completeAchievements,
    buyCosmetic,
    selectCosmetic,
    rerollPlayerSeed,
    buyCaveTheme,
    selectCaveTheme,
    grantIapCosmetics,
    sinkNewShaft,
    resetGame,
    exportSaveCode,
    importSaveCode,
    saveLoadFailed,
    restoreFromBlob,
  } = useGameEngine(
    displayMessage,
    () => autosaveSecondsRef.current,
    (ev) => onCosmeticPurchaseRef.current?.(ev),
  );
  // Localization is disabled for now (English only) — useI18n just hands
  // out the translator; the picker came back with the localization todo.
  const { t } = useI18n();
  const content = useContent();
  const depthTier = getDepthTier(depth);
  // Tier-4 cave theme recolors the depth tint (the natural theme's palette
  // is exactly the depth tint, so it's the unchanged look by default).
  const caveTint = getThemeTint(
    getCaveTheme(gameState.selectedCaveTheme),
    depthTier.id,
  );
  // Session baseline (todo: statistics detail): a snapshot of the save's
  // lifetime counters taken once, at the first render after the stored
  // save has loaded. The "this session" stats are current − baseline
  // (clamped in getSessionStats), so a mid-session reset/import can only
  // read 0, never negative. The one-shot ref init (never reset) means the
  // baseline survives the render pass it's created in; write-during-render
  // is safe here because it's idempotent and happens exactly once.
  const sessionBaselineRef = useRef<SessionBaseline | null>(null);
  if (isLoaded && sessionBaselineRef.current === null) {
    sessionBaselineRef.current = createSessionBaseline(gameState);
  }
  const sessionStats = sessionBaselineRef.current
    ? getSessionStats(gameState, sessionBaselineRef.current)
    : null;
  // Depth-tier click bonus + banked prestige multiplier + the tier-3 click
  // x2 upgrade included: this is the value taps and answers actually pay
  // with (the engine applies the same multipliers authoritatively), so
  // pending-gain / floating text agree.
  // Integer factors first (click power × click-x2 boost), then the float
  // multipliers through mulFloats — exactly what the engine's
  // applyAnswerReward pays, so pending-gain / floating text agree.
  const effectiveClickPower = mulFloats(
    BigInt(gameState.clickPower) * BigInt(getClickBoostMultiplier(gameState.clickBoostLevels)),
    [depthTier.clickBonus, getPrestigeMultiplier(gameState.prestigeLevel)],
  );
  const {
    settingsData,
    setSettingsData,
    equationSettings,
    setEquationSettings,
    handleSaveSettings,
  } = useSettings({ saveGame, displayMessage });

  // Stable so the memoized SettingsPanel doesn't re-render every tick.
  const handleSettingsDataChange = useCallback(
    (newSettings: SettingsData) => setSettingsData(newSettings),
    [setSettingsData],
  );

  // Number-notation mode (settings.notation): push the settings value into
  // format.ts's live store and subscribe, so a settings flip re-renders the
  // whole tree and every formatNumber() call site picks up the new mode
  // through its default argument — no call site threads the mode (same
  // store shape as the i18n locale store). The store set is a no-op when
  // the value hasn't changed, so the sync never loops.
  useSyncExternalStore(subscribeNumberNotation, getNumberNotation);
  useEffect(() => {
    setNumberNotation(settingsData.notation);
  }, [settingsData.notation]);

  // Purchase-button visibility (plan "Adjust"): by default only the core
  // buttons + anything the lifetime economy has ever reached (a sunk shaft
  // can't hide buttons again); the settings toggle forces the full list.
  const minerPowerUnlocked = gameState.completedTiers.includes(
    MINER_POWER_UNLOCK_TIER,
  );
  const fastMinerUnlocked = gameState.completedTiers.includes(
    FAST_MINER_UNLOCK_TIER,
  );
  const legendaryMinerUnlocked = gameState.completedTiers.includes(
    LEGENDARY_MINER_UNLOCK_TIER,
  );
  const prestigeUnlocked = gameState.completedTiers.includes(
    PRESTIGE_UNLOCK_TIER,
  );
  const lifetimeMinerals = gameState.lifetimeMinerals;
  const totalGemsMinted = gameState.totalGemsMinted;
  const visiblePurchases = useMemo(
    () =>
      settingsData.showAllPurchases
        ? new Set(ALL_PURCHASE_IDS)
        : getVisiblePurchases(
            { lifetimeMinerals, totalGemsMinted },
            {
              minerPowerUnlocked,
              fastMinerUnlocked,
              legendaryMinerUnlocked,
              prestigeUnlocked,
            },
          ),
    [
      settingsData.showAllPurchases,
      lifetimeMinerals,
      totalGemsMinted,
      minerPowerUnlocked,
      fastMinerUnlocked,
      legendaryMinerUnlocked,
      prestigeUnlocked,
    ],
  );

  // Indicator dot on the floating upgrades button: true while any
  // currently-visible purchase passes its button's own enabled check
  // (todo: "add indicator on upgrades button when something is
  // purchaseable"). Recomputed on every state change that can move either
  // side of any affordability check.
  const anyPurchaseAffordable = useMemo(
    () =>
      hasAffordablePurchase(visiblePurchases, {
        minerals: gameState.minerals,
        gems: gameState.gems,
        clickPower: gameState.clickPower,
        minerPower: gameState.minerPower,
        miners: gameState.miners,
        fastMiners: gameState.fastMiners,
        legendaryMiners: gameState.legendaryMiners,
        gemChanceLevels: gameState.gemChanceLevels,
        clickBoostLevels: gameState.clickBoostLevels,
        comboResistLevels: gameState.comboResistLevels,
        prestigeLevel: gameState.prestigeLevel,
        lifetimeMinerals: gameState.lifetimeMinerals,
        minerPowerUnlocked,
        fastMinerUnlocked,
        legendaryMinerUnlocked,
        prestigeUnlocked,
      }),
    [
      visiblePurchases,
      gameState.minerals,
      gameState.gems,
      gameState.clickPower,
      gameState.minerPower,
      gameState.miners,
      gameState.fastMiners,
      gameState.legendaryMiners,
      gameState.gemChanceLevels,
      gameState.clickBoostLevels,
      gameState.comboResistLevels,
      gameState.prestigeLevel,
      gameState.lifetimeMinerals,
      minerPowerUnlocked,
      fastMinerUnlocked,
      legendaryMinerUnlocked,
      prestigeUnlocked,
    ],
  );

  useEffect(() => {
    autosaveSecondsRef.current = settingsData.autosave;
  }, [settingsData.autosave]);

  // Cloud save (docs/store-integration.md §3): a device-
  // scoped backup of the serialized save on the Pocketbase deployment.
  // The provider is picked once (dev builds run the labeled in-memory
  // simulation; native production runs the real provider once the
  // Pocketbase URL lands; entry points — the settings section — are
  // hidden on the no-op, same rule as the ad/IAP entry points).
  const cloudProvider = useMemo(() => selectCloudSaveProvider(__DEV__), []);
  // Optional login (docs/todo.md "Optional login"): the auth provider
  // (dev-sim in dev, Pocketbase once configured, no-op elsewhere — same
  // "hidden until configured" rule as the cloud entry point) + the OS
  // secure token store (web: in-memory). The hook owns the session; the
  // stable getSessionToken below is what threads the session into the
  // cloud/leaderboard/IAP round-trips (null = the anonymous default).
  const authProvider = useMemo(() => selectAuthProvider(__DEV__), []);
  const tokenStore = useMemo(() => selectTokenStore(), []);
  const account = useAccount({ provider: authProvider, tokenStore });
  const { getSessionToken: accountSessionToken } = account;
  // Snapshot source: the latest state read from a ref so getCloudSnapshot
  // stays stable while always serializing the current save (the engine's
  // own saveGame does the same ref dance). updatedAt is the push time —
  // the server's last-write-wins key is the client clock by design.
  const cloudStateRef = useRef(gameState);
  cloudStateRef.current = gameState;
  const getCloudSnapshot = useCallback(
    () => ({
      blob: serializeSaveData({
        ...cloudStateRef.current,
        saveTime: Date.now(),
      }),
      saveVersion,
      updatedAt: Date.now(),
    }),
    [],
  );
  const cloudSave = useCloudSave({
    provider: cloudProvider,
    getSnapshot: getCloudSnapshot,
    restore: restoreFromBlob,
    isLoaded,
    saveLoadFailed,
    displayMessage,
    t,
    getSessionToken: accountSessionToken,
  });
  // Destructure the stable members: effect/callback deps reference the
  // bindings directly (exhaustive-deps happy without re-running on the
  // handle object's per-render identity).
  const {
    requestPush: cloudRequestPush,
    restoreFromCloud: cloudRestoreFromCloud,
    deleteMyData: cloudDeleteMyData,
  } = cloudSave;
  // GDPR "delete my data" (plan §Backend): the ConfirmableButton in the
  // settings section holds the plain wording; this is the crash-trail +
  // the hook call (which toasts the outcome).
  const handleDeleteData = useCallback(() => {
    noteCrashEvent("delete my data");
    void cloudDeleteMyData();
  }, [cloudDeleteMyData]);
  // Leaderboard (docs/store-integration.md §3): the top-10
  // max-depth scoreboard on the same Pocketbase deployment as the cloud
  // save. Same provider-selection rules (dev builds run the labeled
  // in-memory row; native production gets the real provider once the
  // Pocketbase URL lands; the trophy button stays hidden on the no-op —
  // the same "hidden until configured" rule as the ad/IAP/cloud entry
  // points). Only DERIVED lifetime stats leave the device (maxDepth is
  // the save's lifetime max — monotonic by construction).
  const leaderboardProvider = useMemo(
    () => selectLeaderboardProvider(__DEV__),
    [],
  );
  const leaderboardStateRef = useRef(gameState);
  leaderboardStateRef.current = gameState;
  const getLeaderboardStats = useCallback(
    () => ({
      bestDepth: Number(leaderboardStateRef.current.maxDepth),
      maxCombo: leaderboardStateRef.current.maxCombo,
      lifetimeMinerals: Number(leaderboardStateRef.current.lifetimeMinerals),
      achievementIds: leaderboardStateRef.current.completedAchievements,
    }),
    [],
  );
  const leaderboard = useLeaderboard({
    provider: leaderboardProvider,
    getStats: getLeaderboardStats,
    getSessionToken: accountSessionToken,
  });
  const { requestSubmit: leaderboardRequestSubmit } = leaderboard;

  // Push cadence (plan §Cloud save): every local save that lands — the
  // dirty→clean transition, autosave and manual save alike — requests a
  // push; the hook applies the 5-minute gate (and the toggle). The
  // prestige push below bypasses the cadence: it's the run boundary.
  const prevSaveDirtyRef = useRef(false);
  useEffect(() => {
    const wasDirty = prevSaveDirtyRef.current;
    prevSaveDirtyRef.current = saveDirty;
    if (isLoaded && wasDirty && !saveDirty) {
      cloudRequestPush("autosave");
      // Leaderboard submit piggybacks the same network turn (plan
      // §Leaderboard: same 5-minute cadence, fire-and-forget).
      leaderboardRequestSubmit();
    }
  }, [saveDirty, isLoaded, cloudRequestPush, leaderboardRequestSubmit]);
  // Settings bundle for the menu's cloud-backup section (memo keeps the
  // memoized MenuPanel/SettingsPanel quiet; lastSync moves at most once
  // per push — 5 minutes apart).
  const handleCloudRestore = useCallback(() => {
    noteCrashEvent("cloud restore");
    void cloudRestoreFromCloud();
  }, [cloudRestoreFromCloud]);
  const cloudSaveSettings = useMemo<CloudSaveSettingsProps>(
    () => ({
      available: cloudProvider.isAvailable(),
      isDevSim: cloudProvider.id === "dev-sim",
      signedIn: account.status === "in",
      enabled: cloudSave.enabled,
      setEnabled: cloudSave.setEnabled,
      lastSync: cloudSave.lastSync,
      onRestore: handleCloudRestore,
      onDeleteData: handleDeleteData,
    }),
    [
      cloudProvider,
      account.status,
      cloudSave.enabled,
      cloudSave.lastSync,
      cloudSave.setEnabled,
      handleCloudRestore,
      handleDeleteData,
    ],
  );
  // Settings bundle for the optional-account section (see
  // AccountSettingsProps): the callbacks are stable useAccount callbacks,
  // status/account move at sign-in/out only — the memo stays quiet.
  const accountSettings = useMemo<AccountSettingsProps>(
    () => ({
      available: authProvider.isAvailable(),
      isDevSim: authProvider.id === "dev-sim",
      status: account.status,
      account: account.account,
      onRegister: account.register,
      onLogin: account.login,
      onSignOut: account.signOut,
      onProviderSignIn: account.providerSignIn,
      // Platform constant ("hidden until ready" — [] on web, ["google"]
      // on android, both on ios); stable, no memo deps needed.
      providerKinds: availableProviderKinds,
      onSetPassword: account.setPassword,
      onLinkProvider: account.linkProvider,
    }),
    [
      authProvider,
      account.status,
      account.account,
      account.register,
      account.login,
      account.signOut,
      account.providerSignIn,
      account.setPassword,
      account.linkProvider,
    ],
  );

  // The "pickaxe" sound is the equipped pickaxe's unique swing sound
  // (falls back to the generic one for unknown ids, see useSounds). The
  // volume is the settings soundVolume (0–100, default 100) — the menu
  // mute toggle still wins over it — and settings.music gates the
  // looping cave-ambience bed (on by default) at the independent
  // settings.musicVolume level (default 50, the pass-3 accessibility
  // fix — no longer half the SFX level).
  const { play } = useSounds(
    mute,
    gameState.selectedPickaxe,
    settingsData.soundVolume,
    settingsData.music,
    settingsData.musicVolume,
  );
  // Haptic feedback (settings toggle, on by default): same stable-callback
  // pattern as `play` so the memoized tap/answer handlers can use it.
  const { haptic } = useHaptics(settingsData.haptics);
  const reduceMotion = useAccessibilityReduceMotion();
  const {
    combo,
    comboMultiplier,
    flashAnim,
    increment: incrementCombo,
    reset: resetCombo,
    restore: restoreCombo,
  } = useCombo(reduceMotion);
  // Combo resistance (tier-3 gem upgrade): the fraction of the combo a
  // wrong answer / mine tap keeps. Ref so the stable tap-reset callback
  // below always sees the current level without re-subscribing.
  const comboResistRatioRef = useRef(0);
  comboResistRatioRef.current = getComboRetention(gameState.comboResistLevels);
  // Rewarded-ad combo save (todo: "Allow saving combo with rewarded-ad"):
  // when a loss happens (wrong answer or mine tap), the pre-loss value is
  // restorable for COMBO_SAVE_WINDOW_MS via a completed ad — an "undo" for
  // the loss that just happened. Memory-only: it dies with the process, and
  // it never travels in the save.
  const [comboSave, setComboSave] = useState<{
    combo: number;
    until: number;
  } | null>(null);
  // Refs so the stable callbacks below (the tap reset, the ad claim) always
  // see the latest value without re-subscribing on every combo change.
  const comboRef = useRef(combo);
  comboRef.current = combo;
  const comboSaveRef = useRef(comboSave);
  comboSaveRef.current = comboSave;
  const noteComboLoss = useCallback((preLossCombo: number) => {
    if (preLossCombo <= 0) return;
    setComboSave({ combo: preLossCombo, until: Date.now() + COMBO_SAVE_WINDOW_MS });
  }, []);
  const handleComboReset = useCallback(() => {
    noteComboLoss(comboRef.current);
    resetCombo(comboResistRatioRef.current);
  }, [noteComboLoss, resetCombo]);

  // Called by the ad hook after a completed comboSave ad: restore the saved
  // value (or the current combo if the player already rebuilt past it) and
  // clear the offer. No-ops if the offer is gone.
  const claimComboSave = useCallback(() => {
    const saved = comboSaveRef.current;
    if (saved == null) return;
    comboSaveRef.current = null;
    setComboSave(null);
    restoreCombo(Math.max(comboRef.current, saved.combo));
  }, [restoreCombo]);
  const { shakeAnim, shake } = useShakeInput();

  const playerPickaxeAnimRef: MutableRefObject<() => void> = useRef<() => void>(
    () => {},
  );
  const debrisRef = useRef<DebrisParticlesRef>(null);
  const blockBreakRef = useRef<BlockBreakRef>(null);
  const floatingTextRef = useRef<FloatingTextRef>(null);
  // Juice-wave scheduler for equation answers (canvas taps schedule their
  // own waves inside useMineTaps). See juice.ts.
  const juiceWaves = useJuiceWaves();

  // Milestone toasts when depth crosses a 10m boundary (depth itself changes
  // every 500 minerals, so every-1m would be spam).
  const prevDepthRef = useRef(depth);
  useEffect(() => {
    const prev = prevDepthRef.current;
    prevDepthRef.current = depth;
    if (depth > prev && depth % 10n === 0n) {
      displayMessage(t("toast.depth", { depth: formatNumber(depth) }), 3000);
    }
  }, [depth, displayMessage, t]);

  // Biome toast when a new depth tier (see DEPTH_TIERS in game.ts) is entered.
  const prevTierRef = useRef(depthTier.id);
  useEffect(() => {
    const prev = prevTierRef.current;
    prevTierRef.current = depthTier.id;
    if (depthTier.id > prev) {
      displayMessage(
        t("toast.enteredTier", {
          tier: content("depthTier", String(depthTier.id), {
            title: depthTier.name,
          }).title,
          bonus: depthTier.clickBonus,
        }),
        3000,
      );
    }
  }, [depthTier, displayMessage, t, content]);

  // Goal tier completions (plan §4.6): completion is derived from lifetime
  // stats, the save's completedTiers only records fired celebrations. The
  // updater in completeTiers is idempotent (double-fires in dev can't pay
  // the bonus twice).
  useEffect(() => {
    const newly = getCompletedTierIds(gameState).filter(
      (id) => !gameState.completedTiers.includes(id),
    );
    if (newly.length === 0) return;
    completeTiers(newly);
    for (const tier of GOAL_TIERS.filter((t) => newly.includes(t.id))) {
      const tierText = content("goalTier", tier.id, {
        title: tier.name,
        detail: tier.unlock,
      });
      displayMessage(
        t("toast.tierComplete", {
          tier: tierText.title,
          bonus: formatNumber(tier.bonusMinerals),
          unlock: tierText.detail ?? tier.unlock,
        }),
        6000,
      );
    }
    if (newly.length > 0) haptic("success");
  }, [gameState, completeTiers, displayMessage, t, content, haptic]);

  // Achievements (plan §4.1): one-off bonus badges, kept distinct from the
  // goal tier gates above. Same derived-completion + idempotent-updater
  // pattern; multiple first-completions in one render collapse into one
  // toast so a save load can't spam the message overlay.
  useEffect(() => {
    const newly = getCompletedAchievementIds(gameState).filter(
      (id) => !gameState.completedAchievements.includes(id),
    );
    if (newly.length === 0) return;
    completeAchievements(newly);
    const names = newly
      .map((id) => {
        const a = getAchievement(id);
        return a
          ? content("achievement", a.id, { title: a.label }).title
          : id;
      })
      .slice(0, 3);
    const extra = newly.length - names.length;
    const label =
      extra > 0 ? `${names.join(" · ")} +${extra} more` : names.join(" · ");
    displayMessage(
      t("toast.achievement", {
        label,
        bonus: formatNumber(getAchievementBonus(newly)),
      }),
      6000,
    );
    haptic("success");
  }, [gameState, completeAchievements, displayMessage, t, content, haptic]);

  // Floating "+N" on canvas taps (stable so memoized consumers stay stable).
  // The size scales with the mined amount (juice.ts), and so does the tap
  // haptic (haptics.ts) — late-game taps buzz a little longer.
  const handleTapGain = useCallback(
    (gain: bigint) => {
      floatingTextRef.current?.spawn(
        `+${formatNumber(gain)}`,
        undefined,
        getJuiceTextSize(gain),
      );
      haptic("tap", getJuiceWaves(gain));
    },
    [haptic],
  );

  // Stable context value: creating a new object every render would re-render
  // every context consumer (all the Miners) on each tap, bypassing memo.
  const contextValue = useMemo(() => ({ onTick: onTick.current }), [onTick]);

  const { mineTap } = useMineTaps({
    clickPower: effectiveClickPower,
    play,
    playerPickaxeAnimRef,
    debrisRef,
    blockBreakRef,
    addTapGain,
    onResetCombo: handleComboReset,
    onGain: handleTapGain,
    reduceMotion,
  });

  // Idle reminder (features.md §7 gap candidate): a one-per-session,
  // once-per-minute-of-idle toast reminding that the mine keeps
  // collecting and autosaves. The activity signals are the two core-loop
  // inputs the player is actually doing: cave taps and answer submits —
  // the wrapper below marks both.
  const { markActivity } = useIdleReminder({
    // Gated on the onboarding overlay being gone (its stored flag loaded
    // AND dismissed): a player slowly reading first-run setup isn't idle,
    // and the overlay's full-screen backdrop shouldn't get a toast on top.
    enabled:
      settingsData.idleReminder &&
      !onboardingLoading &&
      onboardingDone === true,
    displayMessage,
  });
  const mineTapWithActivity = useCallback(
    () => {
      markActivity();
      mineTap();
    },
    [markActivity, mineTap],
  );

  // Gem pocket (features.md §7 "Random in-game events"): a rare bonus
  // node that forms in the cave; tap it for a bonus scaled to the
  // current click power, or let it fade. The collect flows through
  // addTapGain so lifetime stats stay exact, and counts as activity for
  // the idle reminder (it IS a cave interaction).
  const handlePocketCollected = useCallback(
    (bonus: number) => {
      const gain = BigInt(bonus);
      play("pickaxe", 80);
      haptic("success");
      markActivity();
      floatingTextRef.current?.spawn(
        `+${formatNumber(gain)} ${emojis.mineral}`,
        "#ffd47f",
        getJuiceTextSize(gain),
      );
      displayMessage(
        t("toast.gemPocketCollected", { bonus: formatNumber(gain) }),
        3000,
      );
    },
    [play, haptic, markActivity, floatingTextRef, displayMessage, t],
  );
  const gemPocket = useGemPocket({
    enabled: !onboardingLoading && onboardingDone === true,
    clickPower: effectiveClickPower,
    grantMinerals: addTapGain,
    displayMessage,
    onCollected: handlePocketCollected,
  });

  // Equation of the Day (todo "daily equation", features.md §7): one
  // fixed equation per local day, identical for every player (seeded by
  // the day key — see dailyEquation.ts). While in mode the main display
  // shows today's equation: wrong answers are penalty-free (see
  // isSoftIncorrect below), a correct one pays the normal reward AND the
  // daily bonus, then the mode exits.
  const dailyEquation = useDailyEquation({ displayMessage });
  const [dailyEquationMode, setDailyEquationMode] = useState(false);
  const dailyEquationModeRef = useRef(dailyEquationMode);
  dailyEquationModeRef.current = dailyEquationMode;

  const {
    equation,
    textInput,
    setTextInput,
    handleSubmit,
    showEquation,
  } = useEquations({
    equationSettings,
    onCorrect: (value) => {
      if (dailyEquationModeRef.current) {
        // The displayed equation IS today's (forced in by the button):
        // the daily bonus stacks on top of the normal answer reward.
        addTapGain(BigInt(DAILY_EQUATION_BONUS));
        dailyEquation.markSolved();
        setDailyEquationMode(false);
        haptic("success");
      }
      const gem = applyAnswerReward(value, comboMultiplier, combo + 1);
      // Floating "+N" showing exactly what this answer was worth.
      const gain =
        BigInt(Math.max(1, value)) *
        BigInt(comboMultiplier) *
        effectiveClickPower;
      play("pickaxe", 60);
      haptic("tap", getJuiceWaves(gain));
      incrementCombo();
      // Juice scales with the mined amount (juice.ts): the swing + debris
      // repeat per wave, the block breaks once per answer.
      blockBreakRef.current?.trigger();
      juiceWaves.run(reduceMotion ? 1 : getJuiceWaves(gain), () => {
        playerPickaxeAnimRef.current();
        debrisRef.current?.trigger();
      });
      floatingTextRef.current?.spawn(
        `+${formatNumber(gain)} ${emojis.mineral}`,
        "#8fbf8f",
        getJuiceTextSize(gain),
      );
      if (gem) {
        floatingTextRef.current?.spawn(`+1 ${emojis.gem}`, "#7fd4ff");
        displayMessage(t("toast.vein"), 3000);
      }
      // Combo tier-up: the multiplier just stepped up.
      const nextMult = getComboMultiplier(combo + 1);
      if (nextMult > comboMultiplier) {
        displayMessage(t("toast.comboUp", { mult: nextMult }), 2000);
      }
    },
    onIncorrect: () => {
      play("stone", 150);
      shake();
      haptic("error");
      // Combo resistance (tier-3 gem upgrade): part of the combo survives.
      const retention = getComboRetention(gameState.comboResistLevels);
      noteComboLoss(combo);
      if (combo > 0) {
        const kept = getResistantComboReset(combo, gameState.comboResistLevels);
        displayMessage(
          kept > 0
            ? t("toast.comboDropped", { combo: kept })
            : t("toast.comboLost"),
          1500,
        );
      }
      resetCombo(retention);
    },
    // Wrong answers are penalty-free while today's equation is displayed:
    // no combo reset, and the equation stays on screen for a retry.
    isSoftIncorrect: () => dailyEquationModeRef.current,
    onSoftIncorrect: () => {
      play("stone", 150);
      shake();
      haptic("error");
    },
  });

  // Answer submits mark idle-reminder activity too (the other half of
  // the core loop after cave taps): the wrapper is what AnswerInput /
  // NumericKeypad receive as onSubmit.
  const handleSubmitActivity = useCallback(
    () => {
      markActivity();
      handleSubmit();
    },
    [markActivity, handleSubmit],
  );

  // Equation-of-the-day entry point: force today's equation into the main
  // display and enter the soft-wrong mode. The button is disabled once
  // solved, so a start always targets an unsolved day.
  const handleDailyEquationStart = useCallback(() => {
    if (dailyEquation.solved || dailyEquationModeRef.current) return;
    noteCrashEvent("equation of the day started");
    setDailyEquationMode(true);
    showEquation(dailyEquation.equation);
    displayMessage(
      t("toast.dailyEquationStart", {
        bonus: formatNumber(dailyEquation.bonus),
      }),
      5000,
    );
  }, [
    dailyEquation.solved,
    dailyEquation.equation,
    dailyEquation.bonus,
    showEquation,
    displayMessage,
    t,
  ]);

  const handleMuteChange = useCallback((newVal: boolean) => setMute(newVal), [setMute]);

  // Settings toggle handler for the on-screen keypad (takes effect
  // immediately, no Save tap): on mounts the numpad strip below the
  // canvas, off unmounts it and the OS keyboard handles answers. The
  // upgrades drawer is independent either way.
  const handleKeypadSettingChange = useCallback(
    (newVal: boolean) => {
      setOnScreenKeypad(newVal);
    },
    [setOnScreenKeypad],
  );
  // Keypad handlers: setTextInput (useState) and handleSubmit (useCallback)
  // are stable, so these are stable too and the memoized keypad skips
  // re-rendering on the per-tick parent renders.
  const handleKeypadDigit = useCallback(
    (digit: string) =>
      setTextInput((old) =>
        old.length >= MAX_ANSWER_LENGTH ? old : old + digit,
      ),
    [setTextInput],
  );
  const handleKeypadBackspace = useCallback(
    () => setTextInput((old) => old.slice(0, -1)),
    [setTextInput],
  );
  const handleKeypadClear = useCallback(() => setTextInput(""), [setTextInput]);

  // Crash-context tracing (plan "Adjust"): the unreproducible Android
  // `describe` crash is diagnosed from its next occurrence, and a stack
  // alone doesn't say WHAT the game was doing. This records a bounded
  // trail of high-level transitions (never per-tick / per-answer — those
  // would evict the interesting events) plus a small state snapshot into
  // crashContext.ts, which recordCrash snapshots into every crash entry.
  useEffect(() => {
    noteCrashEvent("app start");
    setCrashContextState({ platform: Platform.OS, dev: __DEV__ ? "yes" : "no" });
  }, []);

  useEffect(() => {
    if (isLoaded) noteCrashEvent("save loaded");
  }, [isLoaded]);

  useEffect(() => {
    setCrashContextState({
      // Number() is fine for a diagnostic: a huge depth only loses float
      // precision in the crash log, never in the game.
      depth: Number(depth),
      prestiges: gameState.totalPrestiges,
      gems: gameState.gems,
    });
  }, [depth, gameState.totalPrestiges, gameState.gems]);

  const prevEquationModesRef = useRef<string | null>(null);
  useEffect(() => {
    const modes = (equationSettings.hardMode ? "hard" : "normal");
    const prev = prevEquationModesRef.current;
    prevEquationModesRef.current = modes;
    if (prev != null && prev !== modes) {
      noteCrashEvent(`equations: ${modes}`);
    }
  }, [equationSettings]);

  // Top-row save button (plan §2.1): saves immediately (autosave
  // continues in the background) and confirms with a toast so the tap
  // has feedback.
  const handleSaveNow = useCallback(() => {
    noteCrashEvent("manual save");
    saveGame();
    displayMessage(t("toast.saved"), 3000);
  }, [saveGame, displayMessage, t]);

  // Save-code export/import (plan §4.3): the engine handles the state;
  // this layer only adds the toasts. The imported save persists via the
  // normal autosave / background-save path (saving immediately here would
  // serialize the pre-import state, since the state ref updates on render).
  const handleImportSaveCode = useCallback(
    (code: string): boolean => {
      if (!importSaveCode(code)) {
        displayMessage(t("toast.invalidSaveCode"), 3000);
        return false;
      }
      displayMessage(t("toast.saveImported"), 3000);
      noteCrashEvent("save imported");
      return true;
    },
    [importSaveCode, displayMessage, t],
  );

  // Daily bonus / login streak (plan §4.2): minerals flow through the
  // same additive path as tap gains (lifetime stats included).
  const dailyBonus = useDailyBonus({
    grantMinerals: addTapGain,
    displayMessage,
  });
  const dailyClaim = dailyBonus.claim;
  const handleDailyClaim = useCallback(() => {
    noteCrashEvent("daily bonus claimed");
    dailyClaim();
  }, [dailyClaim]);

  // Weekly contract (todo: "weekly challenges"): the same additive grant
  // path as the daily bonus; progress is a derived delta on the live save
  // (see weeklyChallenge.ts for the design rules).
  const weeklyContract = useWeeklyChallenge({
    save: gameState,
    grantMinerals: addTapGain,
    displayMessage,
  });
  const weeklyClaim = weeklyContract.claim;
  const handleWeeklyClaim = useCallback(() => {
    noteCrashEvent("weekly contract claimed");
    weeklyClaim();
  }, [weeklyClaim]);

  // Local event logging (guardrail 5, "measure before scaling"): the
  // app-open record happens inside the hook (after its stored record has
  // loaded); the milestones are fired from the effects below. The hook is
  // the single owner of the record — Settings only displays it.
  const {
    state: analytics,
    onPrestige,
    onAdView: onFirstAdView,
    onIapPurchase: onFirstIap,
    onCosmeticPurchase,
    clear: onClearAnalytics,
  } = useAnalytics();
  // Fill the engine's forwarder with the real callback (the render-
  // body assignment keeps the engine's callback stable and always
  // current — same ref pattern as autosaveSecondsRef above).
  onCosmeticPurchaseRef.current = onCosmeticPurchase;

  // Rewarded ads (plan §5.1): the provider is picked in ads.ts behind the
  // documented swap point (selectAdProvider — see its docs): dev builds run
  // a clearly labeled simulation; production runs the real AdMob provider
  // once storeConfig.adMob is filled in (docs/store-integration.md §1) and
  // the no-op (entry points hidden) until then; web is always the no-op
  // (no web ad integration yet — adProvider.web.ts).
  const adProvider = selectAdProvider(__DEV__);
  const adRewards = useAdRewards({
    provider: adProvider,
    grantGems,
    offlineDouble,
    claimOfflineDouble,
    offlineTopUp,
    claimOfflineTopUp,
    comboSave: comboSave?.combo ?? null,
    claimComboSave,
    displayMessage,
    onAdView: onFirstAdView,
  });

  // Let an expired combo save go (the panel's countdown and the claim guard
  // the same `until`, so a save can at worst be restored a tick late, never
  // resurrected long after the window). Skipped while the comboSave ad is
  // mid-play: the player tapped "Watch" on this offer, so it must survive
  // the ad even if the window runs out during it.
  const comboSaveClaiming = adRewards.claiming === "comboSave";
  useEffect(() => {
    if (comboSave == null || comboSaveClaiming) return;
    const id = setInterval(() => {
      if (Date.now() >= (comboSaveRef.current?.until ?? 0)) {
        setComboSave(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [comboSave, comboSaveClaiming]);

  // In-app purchases (plan §5.2): dev builds run a clearly labeled
  // simulation; native production runs the real expo-iap → Pocketbase
  // provider once storeConfig.pocketbaseUrl is filled in (docs/
  // store-integration.md §1); web production runs the Stripe Checkout
  // provider (docs/todo.md #1) once the Stripe block is configured —
  // both fall back to the no-op (entry points hidden) until configured.
  // Entitlements are device-local and never travel in the save; the
  // first validated purchase feeds the analytics record. The provider
  // selection itself is the documented one-line swap point
  // (selectIapProvider — see its docs).

  // Debug-APK billing tests (docs/store-integration.md §2.4): a persisted,
  // user-toggled opt-in for the REAL store provider in dev builds (the
  // IAP panel shows the toggle). Off by default — dev builds run the
  // labeled simulation unless the player deliberately switches it.
  const [realStoreIap, setRealStoreIap] = useLocalStorage<boolean>(
    "iapRealStore",
    false,
  );
  const iapProvider = selectIapProvider(__DEV__, realStoreIap);
  const iap = useIap({
    provider: iapProvider,
    onPurchased: onFirstIap,
    displayMessage,
    getSessionToken: accountSessionToken,
  });

  // Stripe Checkout return-visit (web only, docs/todo.md #1): the player
  // paid on Stripe's hosted page and the browser is back on the app root.
  // The URL carries ?iap=success&iap_product=<id>&iap_sid=<session-id>
  // (or ?iap=cancel). Hand the pair to the provider (it persists it in
  // the pending-verify queue), run the restore — which replays the queue
  // (the server confirms the session with the Stripe API and mints the
  // entitlement row) and merges the server's entitlements — then strip
  // the flags so a refresh doesn't re-verify. Runs once on mount, web
  // only; the ref indirection keeps the effect deps empty (the restore
  // callback is stable enough, but the flag cleanup must happen exactly
  // once per return-visit, not on every re-render).
  const iapRestoreRef = useRef(iap.restore);
  iapRestoreRef.current = iap.restore;
  const iapProviderRef = useRef(iapProvider);
  iapProviderRef.current = iapProvider;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const win = (globalThis as { window?: Window }).window;
    const loc = win?.location;
    const hist = win?.history;
    if (!loc || !hist) return;
    const params = new URLSearchParams(loc.search);
    const flag = params.get("iap");
    if (flag !== "success" && flag !== "cancel") return;
    // Clean the URL first: the flags are one-shot. (replaceState keeps
    // the history entry — the player's back button shouldn't re-enter a
    // paid checkout state.)
    const clean = () => {
      params.delete("iap");
      params.delete("iap_product");
      params.delete("iap_sid");
      const qs = params.toString();
      hist.replaceState(null, "", loc.pathname + (qs ? `?${qs}` : ""));
    };
    clean();
    if (flag === "cancel") {
      // The player backed out on the hosted page: nothing to verify.
      return;
    }
    // Validate the URL product id against the catalog — the query string
    // is attacker-controllable, the catalog is the allowlist.
    const pidRaw = params.get("iap_product") ?? "";
    const productId =
      pidRaw in IAP_PRODUCTS ? (pidRaw as IapProductId) : null;
    const sid = params.get("iap_sid") ?? "";
    if (productId === null || !sid) return;
    // The provider (web .web swap) exposes noteCheckoutSuccess to queue
    // the (productId, session-id) verify; native/noop providers don't.
    // The queue is persisted, so even a crash before the verify POST is
    // fine — the next restore replays it.
    const note = iapProviderRef.current.noteCheckoutSuccess;
    if (!note) return;
    void Promise.resolve(note(productId, sid)).then(() => {
      void iapRestoreRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cosmetic IAP packs (plan §5.2): a validated purchase (or a restore /
  // a re-load on this device) permanently joins each owned pack's
  // cosmetic to the CURRENT save's owned lists, at no gem cost — the
  // engine grant is idempotent, and re-running it after a save import or
  // reset re-grants (the pack belongs to the player, not to one save).
  // The owned-list refs (not per-tick fields) are the effect deps: they
  // change on buy/import/reset/load, never on the 1s tick.
  useEffect(() => {
    const { cosmetics, caveThemes } = iapGrantCosmeticIds(iap.entitlements);
    // The grant's analytics events: only for ids the save DOESN'T already
    // own (the engine grant below is the source of truth — "iap" path,
    // gems unchanged by a pack). The closure's gameState is the
    // pre-grant state: the effect ran on the render where the
    // entitlements (or owned lists) changed, before the grant landed.
    const freshCosmetics = cosmetics.filter(
      (id) => !gameState.ownedCosmetics.includes(id),
    );
    const freshThemes = caveThemes.filter(
      (id) => !gameState.ownedCaveThemes.includes(id),
    );
    if (freshCosmetics.length > 0 || freshThemes.length > 0) {
      for (const id of freshCosmetics) {
        onCosmeticPurchaseRef.current?.({
          line: isOutfitId(id) ? "outfit" : "pickaxe",
          id,
          path: "iap",
          gems: gameState.gems,
        });
      }
      for (const id of freshThemes) {
        onCosmeticPurchaseRef.current?.({
          line: "theme",
          id,
          path: "iap",
          gems: gameState.gems,
        });
      }
    }
    if (cosmetics.length > 0 || caveThemes.length > 0) {
      grantIapCosmetics(cosmetics, caveThemes);
    }
  }, [
    iap.entitlements,
    grantIapCosmetics,
    gameState.ownedCosmetics,
    gameState.ownedCaveThemes,
    gameState.gems,
  ]);

  // The save's owned cosmetic ids (any source: gems, a pack, an import):
  // the panel's owned/equip rows join this with the device entitlements
  // (isIapProductOwned). Ref-stable across ticks, so the memoized
  // panel's props only churn on real ownership changes.
  const saveOwnedCosmeticIds = useMemo(
    () => [...gameState.ownedCosmetics, ...gameState.ownedCaveThemes],
    [gameState.ownedCosmetics, gameState.ownedCaveThemes],
  );

  // Free-path progress (guardrail 5): every prestige sunk live in this
  // session (the record keeps both the count and the first-prestige day).
  // The ref starts null so a loaded save that already has prestiges isn't
  // miscounted on the first effect run.
  const prevPrestigesRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevPrestigesRef.current;
    prevPrestigesRef.current = gameState.totalPrestiges;
    if (prev !== null && gameState.totalPrestiges > prev) {
      noteCrashEvent("prestige");
      onPrestige();
      // Prestige is the run boundary: push the backup immediately, no
      // 5-minute cadence (plan §Cloud save "Push"); the leaderboard row
      // (lifetime maxes) refreshes with it, cadence-gated in the hook.
      cloudRequestPush("prestige");
      leaderboardRequestSubmit();
    }
  }, [gameState.totalPrestiges, onPrestige, cloudRequestPush, leaderboardRequestSubmit]);

  // Crash-context trails for the monetization actions (dev-sim or store,
  // same paths).
  const adClaim = adRewards.claim;
  const handleAdClaim = useCallback((kind: AdKind) => {
    noteCrashEvent(`ad reward: ${kind}`);
    adClaim(kind);
  }, [adClaim]);
  const iapPurchase = iap.purchase;
  const handleIapPurchase = useCallback((id: IapProductId) => {
    noteCrashEvent(`iap purchase: ${id}`);
    iapPurchase(id);
  }, [iapPurchase]);
  // Unified-shop gem buy (todo: "move gem shop cosmetics to one time
  // purchase shop"): the pack's grant decides the engine action; both are
  // idempotent no-ops when unaffordable / already owned. Stable callbacks
  // so the memoized panel's props don't churn.
  const handleShopBuyGems = useCallback(
    (id: IapProductId) => {
      const grant = IAP_PACK_GRANTS[id];
      if (grant.kind === "caveTheme") buyCaveTheme(grant.id);
      else buyCosmetic(grant.id);
      haptic("success");
    },
    [buyCosmetic, buyCaveTheme, haptic],
  );
  const handleShopSelect = useCallback(
    (id: IapProductId) => {
      const grant = IAP_PACK_GRANTS[id];
      if (grant.kind === "caveTheme") selectCaveTheme(grant.id);
      else selectCosmetic(grant.id);
    },
    [selectCosmetic, selectCaveTheme],
  );
  const handleReset = useCallback(() => {
    noteCrashEvent("reset");
    resetGame();
  }, [resetGame]);

  // Cold start (plan §4.4): hold the screen on a loading state until the
  // stored save is loaded, instead of flashing the zeroed state first.
  // All hooks above have already run, so an early return is safe here.
  if (!isLoaded) {
    return <LoadingScreen reduceMotion={reduceMotion} />;
  }

  return (
    <Context.Provider value={contextValue}>
      <View
        style={[
          styles.container,
          // Edge-to-edge insets (see useSafeAreaInsets above): keep the
          // depth banner out from under the status bar and the footer row
          // out from under the nav bar. Full-bleed overlays use absolute
          // inset: 0, which still covers the whole screen (padding box).
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {/* Tablet/wide fix (todo): the game column is width-capped and
            centered (styles.contentColumn); the full-bleed overlays
            (toasts, onboarding) deliberately stay OUTSIDE it so their
            absolute inset: 0 backdrops still cover the whole screen. */}
        <View style={styles.contentColumn}>
        {/* Top menu row (todo: "move menu buttons to top of screen"): the
            old footer moved up so no entry point sits behind the OS
            keyboard. It wraps on narrow screens; the canvas floor below
            it keeps the cave visible even with every button showing. */}
        <View style={styles.headerRow}>
          {/* Menu is the first button (todo: "move menu button to top
              left of main screen") — the entry point to every other
              top-row button's settings and to save/account/goals. */}
          <MenuPanel
            settingsData={settingsData}
            onChangeSettingsData={handleSettingsDataChange}
            equationSettings={equationSettings}
            onChangeEquationSettings={setEquationSettings}
            showMessage={showMessage}
            onSave={handleSaveSettings}
            onReset={handleReset}
            onExportSaveCode={exportSaveCode}
            onImportSaveCode={handleImportSaveCode}
            mute={mute}
            onMuteChange={handleMuteChange}
            onScreenKeypad={onScreenKeypad}
            onKeypadChange={handleKeypadSettingChange}
            hardModeUnlocked={gameState.completedTiers.includes(
              HARD_MODE_UNLOCK_TIER,
            )}
            stats={gameState}
            session={sessionStats}
            analytics={analytics}
            onClearAnalytics={onClearAnalytics}
            cloudSave={cloudSaveSettings}
            account={accountSettings}
          />
          <SavePill
            dirty={saveDirty}
            reduceMotion={reduceMotion}
            onSave={handleSaveNow}
          />
          {/* The upgrades button floats over the cave instead (todo:
              "move upgrades button floating over the canvas") — see the
              canvasWrap below; the header row keeps every OTHER entry. */}
          <DailyBonusButton
            claimable={dailyBonus.claimable}
            bonus={dailyBonus.bonus}
            streak={dailyBonus.streak}
            freezes={dailyBonus.freezes}
            onClaim={handleDailyClaim}
          />
          <WeeklyContractButton
            claimable={weeklyContract.claimable}
            claimed={weeklyContract.claimed}
            bonus={weeklyContract.bonus}
            done={weeklyContract.doneCount}
            total={weeklyContract.total}
            onClaim={handleWeeklyClaim}
          />
          <DailyEquationButton
            solved={dailyEquation.solved}
            bonus={dailyEquation.bonus}
            onStart={handleDailyEquationStart}
          />
          {/* The trophy renders only while the provider is available
              (plan §Leaderboard "Availability gate"): hidden until the
              Pocketbase URL is configured, same rule as the ad/IAP
              entry points. */}
          {leaderboard.available && (
            <LeaderboardPanel
              handle={leaderboard}
              isDevSim={leaderboardProvider.id === "dev-sim"}
            />
          )}
          {adRewards.available && (
            <AdRewardsPanel
              isDevSim={adProvider.id === "dev-sim"}
              gemRollsLeft={adRewards.gemRollsLeft}
              comboSave={comboSave?.combo ?? null}
              comboSaveUntil={comboSave?.until ?? null}
              dailyCapLeft={adRewards.dailyCapLeft}
              offlineDouble={offlineDouble}
              offlineTopUp={offlineTopUp}
              claiming={adRewards.claiming}
              onClaim={handleAdClaim}
              onPrime={adRewards.prime}
            />
          )}
          {/* The unified shop (todo: "move gem shop cosmetics to one
              time purchase shop with gem and cash buy options") renders
              ALWAYS — the gem buy is the universal path (guardrail 1);
              only the cash extras inside it are gated on
              iap.available (the provider's availability). */}
          <IapPanel
            isDevSim={iapProvider.id === "dev-sim"}
            isDevBuild={__DEV__}
            realStoreIap={realStoreIap}
            onRealStoreChange={
              Platform.OS !== "web" ? setRealStoreIap : undefined
            }
            cashAvailable={iap.available}
            gems={gameState.gems}
            playerSeed={gameState.playerSeed}
            selectedOutfit={gameState.selectedOutfit}
            selectedPickaxe={gameState.selectedPickaxe}
            selectedCaveTheme={gameState.selectedCaveTheme}
            purchasing={iap.purchasing}
            entitlements={iap.entitlements}
            saveOwnedCosmeticIds={saveOwnedCosmeticIds}
            themesLocked={
              !gameState.completedTiers.includes(CAVE_THEME_UNLOCK_TIER)
            }
            onBuyGems={handleShopBuyGems}
            onPurchase={handleIapPurchase}
            onSelect={handleShopSelect}
            onReroll={rerollPlayerSeed}
          />
        </View>
        <DepthBanner
          depth={depth}
          mineralsPerSec={mineralsPerSec}
          tierName={content("depthTier", String(depthTier.id), {
            title: depthTier.name,
          }).title}
          clickBonus={depthTier.clickBonus}
        />
        <EquationDisplay
          equation={equation}
          clickPower={effectiveClickPower}
          comboMultiplier={comboMultiplier}
          multiplySymbol={equationSettings.multiplySymbol}
        />
        <AnswerInput
          value={textInput}
          setTextInput={setTextInput}
          onSubmit={handleSubmitActivity}
          shakeAnim={shakeAnim}
          useKeypad={onScreenKeypad}
          // While the onboarding overlay is up the input must not raise the
          // OS keyboard (it would swallow the setup Start button — see the
          // focusable prop doc in AnswerInput). The value is irrelevant
          // during the initial load (the game view isn't mounted yet).
          focusable={onboardingLoading || onboardingDone === true}
        />
        <ComboIndicator
          combo={combo}
          comboMultiplier={comboMultiplier}
          flashAnim={flashAnim}
        />
        {/* Combo-save pill (todo: "Allow saving combo with rewarded-ad"):
            the in-place "undo" for a combo just lost. It only renders
            while the claim is actually possible (canClaimComboSave covers
            provider availability, the offer window and the daily caps)
            AND the lost combo was worth a multiplier (COMBO_TIER_SIZE —
            the first tier-up; a lost sub-tier combo had no multiplier to
            lose), so small early-game losses don't nag. */}
        {adRewards.canClaimComboSave &&
          comboSave != null &&
          comboSave.combo >= COMBO_TIER_SIZE && (
            <ComboSaveIndicator
              combo={comboSave.combo}
              until={comboSave.until}
              claiming={comboSaveClaiming}
              onClaim={() => handleAdClaim("comboSave")}
              onPrime={() => adRewards.prime("comboSave")}
            />
          )}
        {/* The cave keeps the whole mid-screen: the upgrades drawer
            overlays it (hidden by default) instead of pushing it around,
            and the keypad strip below renders only while the on-screen
            keypad setting is on. */}
        <View style={styles.playArea}>
        <View style={styles.canvasWrap}>
        <MiningCanvas
          depth={depth}
          depthProgress={getDepthTierProgress(gameState.lifetimeMinerals)}
          tint={caveTint}
          minerals={gameState.minerals}
          gems={gameState.gems}
          miners={gameState.miners}
          fastMiners={gameState.fastMiners}
          legendaryMiners={gameState.legendaryMiners}
          onTap={mineTapWithActivity}
          pocket={gemPocket.pocket}
          onPocketCollect={gemPocket.collect}
          playerPickaxeAnimRef={playerPickaxeAnimRef}
          debrisRef={debrisRef}
          blockBreakRef={blockBreakRef}
          floatingTextRef={floatingTextRef}
          playerSeed={gameState.playerSeed}
          outfitId={gameState.selectedOutfit}
          pickaxeId={gameState.selectedPickaxe}
          reduceMotion={reduceMotion}
          emojiArt={settingsData.emojiArt}
        />
        {/* The upgrades button (todo: floating over the canvas, out of the
            way): bottom-right of the cave. zIndex 3 keeps it BELOW the
            drawer backdrop (z 4) — while the drawer is open it's dimmed
            out and the drawer's own ✕/backdrop close it, so the button
            never floats over the purchase rows. */}
        <Pressable
          testID="upgrades-toggle"
          accessibilityRole="button"
          accessibilityLabel={
            upgradesOpen
              ? t("main.a11yHideUpgrades")
              : t("main.a11yShowUpgrades")
          }
          onPress={() => setUpgradesOpen(!upgradesOpen)}
          accessibilityHint={
            anyPurchaseAffordable ? t("main.a11yAffordablePurchase") : undefined
          }
          style={styles.upgradesToggleFloat}
        >
          <Text style={styles.upgradesToggleText}>
            ⛏ {t("main.upgrades")}
          </Text>
          {/* Affordable-purchase indicator: a small dot in the button's
              top-right corner, mirroring the onboarding-dot palette. */}
          {anyPurchaseAffordable && (
            <View
              testID="upgrades-affordable-dot"
              accessibilityElementsHidden
              style={styles.upgradesAffordableDot}
            />
          )}
        </Pressable>
        </View>
        {/* Keypad strip (todo: keypad in a tab view with upgrades): the
            on-screen numpad lives in its own strip below the canvas —
            the core-loop input, always reachable. Renders only while the
            on-screen keypad setting is on; off, the OS keyboard handles
            answers and the strip doesn't exist at all. The upgrades
            drawer overlays it (todo: upgrades panel on top of keypad). */}
        {onScreenKeypad && (
          <NumericKeypad
            onDigit={handleKeypadDigit}
            onBackspace={handleKeypadBackspace}
            onClear={handleKeypadClear}
            onSubmit={handleSubmitActivity}
          />
        )}
        {/* The upgrades drawer (todo: upgrades menu as a side hidden
            overlay on the canvas; panel shows ON TOP of the keypad):
            hidden by default, anchored to the play area's right edge
            (canvas + keypad strip) so the OS keyboard — which covers the
            bottom strip — can never hide it. A tap on the dimmed backdrop
            closes it. */}
        {upgradesOpen && (
          <>
            <Pressable
              testID="upgrades-backdrop"
              accessibilityRole="button"
              accessibilityLabel={t("main.a11yCloseUpgrades")}
              onPress={() => setUpgradesOpen(false)}
              style={styles.upgradesBackdrop}
            />
            <View testID="upgrades-drawer" style={styles.upgradesDrawer}>
              <View style={styles.purchasesHeader}>
                <Pressable
                  testID="upgrades-drawer-close"
                  accessibilityRole="button"
                  accessibilityLabel={t("main.a11yCloseUpgrades")}
                  onPress={() => setUpgradesOpen(false)}
                  style={styles.upgradesDrawerClose}
                >
                  <Text style={styles.upgradesDrawerCloseText}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.purchasesScroll}>
                <PurchaseButtons
                visible={visiblePurchases}
                minerals={gameState.minerals}
                gems={gameState.gems}
                clickPower={gameState.clickPower}
                minerPower={gameState.minerPower}
                minerPowerUnlocked={gameState.completedTiers.includes(MINER_POWER_UNLOCK_TIER)}
                miners={gameState.miners}
                fastMiners={gameState.fastMiners}
                legendaryMiners={gameState.legendaryMiners}
                gemChanceLevels={gameState.gemChanceLevels}
                fastMinerUnlocked={gameState.completedTiers.includes(FAST_MINER_UNLOCK_TIER)}
                legendaryMinerUnlocked={gameState.completedTiers.includes(LEGENDARY_MINER_UNLOCK_TIER)}
                prestigeLevel={gameState.prestigeLevel}
                lifetimeMinerals={gameState.lifetimeMinerals}
                prestigeUnlocked={gameState.completedTiers.includes(PRESTIGE_UNLOCK_TIER)}
                clickBoostLevels={gameState.clickBoostLevels}
                comboResistLevels={gameState.comboResistLevels}
                onUpgradePower={upgradePower}
                onBuyMiner={buyMiner}
                onBuyFastMiner={buyFastMiner}
                onBuyLegendaryMiner={buyLegendaryMiner}
                onBuyGem={buyGem}
                onBuyGemChance={buyGemChance}
                onBuyClickBoost={buyClickBoost}
                onBuyComboResist={buyComboResist}
                onUpgradeMinerPower={upgradeMinerPower}
                onSinkNewShaft={sinkNewShaft}
                onBuyAllMinerals={buyAllMinerals}
                onBuyAllGems={buyAllGems}
                />
              </ScrollView>
            </View>
          </>
        )}
        </View>
        </View>
        {showMessage && (
          <View style={styles.messageOverlay} pointerEvents="none">
            <Text style={styles.messageText}>{showMessage}</Text>
          </View>
        )}
        {!onboardingLoading && onboardingDone !== true && (
          <OnboardingOverlay
            onDismiss={() => {
              // Persist the setup step's choices: the equation settings
              // (operator toggles, symbol display) have no other writer
              // than the menu's Save button, which this overlay has no
              // access to — and a player who unticks division in setup
              // expects it to stick. The keypad toggle persists itself
              // (useLocalStorage). The "Settings saved" toast is the
              // honest confirmation that the choices were written.
              handleSaveSettings();
              setOnboardingDone(true);
            }}
            equationSettings={equationSettings}
            onEquationSettingsChange={setEquationSettings}
            onScreenKeypad={onScreenKeypad}
            onKeypadChange={handleKeypadSettingChange}
          />
        )}
        <StatusBar style="auto" />
      </View>
    </Context.Provider>
  );
}

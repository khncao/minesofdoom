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
import { Platform, Pressable, ScrollView, View } from "react-native";
import { T as Text } from "./textScale";
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
import CaveBackground from "src/components/CaveBackground";
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
  getComboMultiplier,
  getComboRetention,
  getDepthTier,
  getPrestigeMultiplier,
  getResistantComboReset,
  getClickBoostMultiplier,
  COMBO_TIER_SIZE,
  getVisiblePurchases,
  hasAffordablePurchase,
  mulFloats,
  isStaleSave,
} from "./game";
import {
  createSessionBaseline,
  getSessionStats,
  SessionBaseline,
} from "./session";
import { defaultEquationSettings } from "src/utils/math/equations";
import { eraseAllAppStorage } from "./eraseAll";
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
import { serializeSavePayload, SaveCodeSettings } from "./saveCode";
import { useSounds } from "./hooks/useSounds";
import { useCustomSkin } from "./hooks/useCustomSkin";
import {
  CUSTOM_SKIN_UNLOCK_COST_GEMS,
  activeSkinArt,
  customSkinGridToUri,
} from "./customSkin";
import { bundledSpriteById } from "./bundledSprites";
import { gridToPngDataUri, type PixelGrid } from "src/utils/graphics/pixelArt";
import { pickCustomSkinAudio, pickCustomSkinImage } from "./customSkinPicker";
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
import {
  useCloudSave,
  type CloudSaveSettingsProps,
} from "./hooks/useCloudSave";
import { pushCohortRecord, selectCloudSaveProvider } from "./cloudSave";
import { buildCohortRecord } from "./analytics";
import { getLocalDayKey } from "./dailyBonus";
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
import TextScaleProvider, { nextTextScale } from "./textScale";

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

  // UI text size (gap-ranking.md Tier 1 #2): a GLOBAL scale for the whole
  // game UI (4 steps, 85%–130%, see TEXT_SCALE_STEPS in textScale.tsx),
  // NOT an OS font-accessibility proxy — the native OS font setting is a
  // different, independent lever (and on web it barely exists), so this
  // is a plain display preference like `mute` and `onScreenKeypad`:
  // persisted in AsyncStorage, applied immediately. The stored value IS
  // the step multiplier (1 = default); the provider sanitizes on read,
  // so a hand-edited blob can never leave the band.
  const [textScale, setTextScale] = useLocalStorage<number>("textScale", 1);

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
  // Forwarder for the goal-tier milestone stamps (pass 23
  // `analytics:tier-milestone`): the tier-completion effect runs before
  // the analytics hook below (hook order is fixed), so it stamps through
  // this ref instead of a direct callback.
  const onTierMilestoneRef = useRef<((tierId: string) => void) | null>(null);
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
    buyCustomSkin,
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
  // tap/answer payouts and floating text agree.
  // Integer factors first (click power × click-x2 boost), then the float
  // multipliers through mulFloats — exactly what the engine's
  // applyAnswerReward pays, so the floating "+N" on solve matches.
  const effectiveClickPower = mulFloats(
    BigInt(gameState.clickPower) *
      BigInt(getClickBoostMultiplier(gameState.clickBoostLevels)),
    [depthTier.clickBonus, getPrestigeMultiplier(gameState.prestigeLevel)],
  );
  const {
    settingsData,
    updateSettingsData,
    equationSettings,
    updateEquationSettings,
    handleSaveSettings,
  } = useSettings({ saveGame, displayMessage });

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
  const prestigeUnlocked =
    gameState.completedTiers.includes(PRESTIGE_UNLOCK_TIER);
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
        gemsBoughtWithMinerals: gameState.gemsBoughtWithMinerals,
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
      gameState.gemsBoughtWithMinerals,
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
  // Settings ride-along application (settings portability): merge the
  // validated partials over the current stores — the same merge-over-
  // existing shape the per-key stores load with, and a full encode always
  // carries every key, so nothing is ever reset to a default.
  const applyImportedSettings = useCallback(
    (imported: SaveCodeSettings) => {
      if (imported.settings != null) {
        updateSettingsData((prev) => ({ ...prev, ...imported.settings }));
      }
      if (imported.equationSettings != null) {
        updateEquationSettings((prev) => ({
          ...prev,
          ...imported.equationSettings,
        }));
      }
    },
    [updateSettingsData, updateEquationSettings],
  );

  // Cloud-restore wrapper: same settings application as save-code import;
  // useCloudSave's `restore` contract stays (blob) => boolean.
  const restoreBlob = useCallback(
    (blob: string) => restoreFromBlob(blob, applyImportedSettings),
    [restoreFromBlob, applyImportedSettings],
  );

  // Snapshot source: the latest state read from a ref so getCloudSnapshot
  // stays stable while always serializing the current save (the engine's
  // own saveGame does the same ref dance). updatedAt is the push time —
  // the server's last-write-wins key is the client clock by design.
  const cloudStateRef = useRef(gameState);
  cloudStateRef.current = gameState;
  // Settings ride along with the cloud snapshot (settings portability —
  // "the cloud backup rides the same decision" as save codes): a ref so
  // the stable snapshot callback always serializes the current stores.
  const cloudSettingsRef = useRef({ settingsData, equationSettings });
  cloudSettingsRef.current = { settingsData, equationSettings };
  const getCloudSnapshot = useCallback(() => {
    const { settingsData: s, equationSettings: e } = cloudSettingsRef.current;
    return {
      blob: serializeSavePayload(
        { ...cloudStateRef.current, saveTime: Date.now() },
        s,
        e,
      ),
      saveVersion,
      updatedAt: Date.now(),
    };
  }, []);
  const cloudSave = useCloudSave({
    provider: cloudProvider,
    getSnapshot: getCloudSnapshot,
    restore: restoreBlob,
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
  // Custom skin (todo: "Custom skinning"): a device-local slot in its own
  // AsyncStorage key (not in the save model), unlocked by a one-time gem
  // spend or the IAP pass; uploads are web-only for now (native = later).
  const {
    skin: customSkin,
    unlock: unlockCustomSkin,
    setEquipped: setCustomSkinEquipped,
    setGrid: setCustomSkinGrid,
    setAudio: setCustomSkinAudio,
    setArt: setCustomSkinArt,
    clear: clearCustomSkin,
  } = useCustomSkin();
  // The equipped skin's body art as a data URI — the player miner's
  // body override. A bundled sprite (bundledSprites.ts, the CC0 library)
  // takes precedence over an uploaded 16×16 grid; neither set keeps the
  // outfit body. The grid path is cached per grid JSON.
  const customSkinBodyUri = useMemo(() => {
    const art = activeSkinArt(customSkin);
    if (art === null) {
      return null;
    }
    if (art.kind === "bundled") {
      const sprite = bundledSpriteById(art.spriteId);
      return sprite?.uri ?? null;
    }
    const grid = art.grid;
    // SAFETY: a 16×16 (string|null)[][] IS a PixelGrid — the readonly
    // grid type is the same cells, so this is a shape assertion only.
    return customSkinGridToUri(grid, (g) =>
      gridToPngDataUri(g as unknown as PixelGrid),
    );
  }, [customSkin]);
  const { play } = useSounds(
    mute,
    gameState.selectedPickaxe,
    settingsData.soundVolume,
    settingsData.music,
    settingsData.musicVolume,
    customSkin.equipped ? customSkin.audio : null,
  );
  // Haptic feedback (settings toggle, on by default): same stable-callback
  // pattern as `play` so the memoized tap/answer handlers can use it.
  const { haptic } = useHaptics(settingsData.haptics);
  // Reduce effects: the manual settings toggle OR'd with the OS-level
  // reduce-motion preference (web only; see the hook). This single
  // boolean drives the debris, combo flash, pocket pulse, miner bobbing
  // and save-pill pulse below.
  const reduceMotion = useAccessibilityReduceMotion(settingsData.reduceEffects);
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
    setComboSave({
      combo: preLossCombo,
      until: Date.now() + COMBO_SAVE_WINDOW_MS,
    });
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
    // The gate moments, measured at the moment they happen (the readout
    // is data-driven: whatever tiers exist, stamped by id). Idempotent —
    // the analytics stamp never re-stamps a tier.
    for (const id of newly) onTierMilestoneRef.current?.(id);
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
        return a ? content("achievement", a.id, { title: a.label }).title : id;
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
  const mineTapWithActivity = useCallback(() => {
    markActivity();
    mineTap();
  }, [markActivity, mineTap]);

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

  const { equation, textInput, setTextInput, handleSubmit, showEquation } =
    useEquations({
      equationSettings,
      onCorrect: (value) => {
        // FTUE funnel: the single fold point for "time to core" — first
        // correct answer stamps, every later answer is a no-op.
        onFirstAnswer();
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
          const kept = getResistantComboReset(
            combo,
            gameState.comboResistLevels,
          );
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
  const handleSubmitActivity = useCallback(() => {
    markActivity();
    handleSubmit();
  }, [markActivity, handleSubmit]);

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

  // Auto equation of the day (todo: the daily question pops up on its own;
  // the 📅 header icon only renders while this toggle is OFF): with the
  // toggle on (default) an unsolved daily equation starts itself, at most
  // once per local day — the per-dayKey ref guard is what makes a repeated
  // render (and a manual exit-then-restart on the same day) a no-op.
  // Onboarding-gated like the gem pocket: the tutorial owns the display
  // first. A solved day is skipped outright (nothing pops up, nothing to
  // solve), so a returning player never sees the equation again today.
  const dailyEquationAutoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settingsData.autoDailyEquation) return;
    if (onboardingLoading || onboardingDone !== true) return;
    if (dailyEquation.solved || dailyEquationModeRef.current) return;
    if (dailyEquationAutoRef.current === dailyEquation.dayKey) return;
    dailyEquationAutoRef.current = dailyEquation.dayKey;
    handleDailyEquationStart();
  }, [
    settingsData.autoDailyEquation,
    onboardingLoading,
    onboardingDone,
    dailyEquation.solved,
    dailyEquationMode,
    dailyEquation.dayKey,
    handleDailyEquationStart,
  ]);

  const handleMuteChange = useCallback(
    (newVal: boolean) => setMute(newVal),
    [setMute],
  );

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
  // Text-size stepper (settings row): −/+ move one step; nextTextScale
  // clamps at both ends and sanitizes the current value, so any stored
  // blob lands back on a valid step before moving.
  const handleTextScaleChange = useCallback(
    (dir: -1 | 1) => setTextScale(nextTextScale(textScale, dir)),
    [setTextScale, textScale],
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
    setCrashContextState({
      platform: Platform.OS,
      dev: __DEV__ ? "yes" : "no",
    });
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
    const modes = equationSettings.hardMode ? "hard" : "normal";
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
  // this layer adds the toasts and the settings ride-along (export reads
  // the live stores; import merges them back in). The imported save
  // persists via the normal autosave / background-save path (saving
  // immediately here would serialize the pre-import state, since the
  // state ref updates on render).
  // F52.2: replay the 4-step tutorial — the flag has exactly one other
  // write site (dismiss), so without this row a player who skipped it
  // has no way to re-read it.
  const handleReplayTutorial = useCallback(
    () => setOnboardingDone(false),
    [setOnboardingDone],
  );

  // Local event logging (guardrail 5, "measure before scaling"): the
  // app-open record happens inside the hook (after its stored record has
  // loaded); the milestones are fired from the effects below. The hook is
  // the single owner of the record — Settings only displays it.
  const {
    state: analytics,
    onPrestige,
    onAdView: onFirstAdView,
    onAdOutcome: onFirstAdOutcome,
    onIapPurchase: onFirstIap,
    onTierMilestone,
    onCosmeticPurchase,
    onFeatureFirstUse,
    onFirstAnswer,
    onOnboardingStep,
    onOnboardingEnd,
    onStaleReturn,
    clear: onClearAnalytics,
  } = useAnalytics();

  // Stale-save detection (Tier 0 #2): once the save is loaded, check it
  // against game.ts isStaleSave and fold a hit into the local analytics
  // record (the fold is idempotent per local day; lastActiveDay flips to
  // "today" on the first active tick, so the check converges off).
  useEffect(() => {
    if (!isLoaded || !gameState) return;
    if (isStaleSave(gameState.lastActiveDay, gameState.saveTime, Date.now())) {
      onStaleReturn();
    }
  }, [isLoaded, gameState, onStaleReturn]);

  // Fill the engine's forwarder with the real callback (the render-
  // body assignment keeps the engine's callback stable and always
  // current — same ref pattern as autosaveSecondsRef above).
  onCosmeticPurchaseRef.current = onCosmeticPurchase;
  onTierMilestoneRef.current = onTierMilestone;

  // Opt-in analytics sharing (todo #1, guardrail 5 "measure before
  // scaling"): while the settings row analyticsShare is ON (OFF by
  // default), the REDUCED local analytics record uploads at most once
  // per local day (buildCohortRecord → pushCohortRecord — one row per
  // device, a few hundred bytes). The dayKey ref is the cadence guard:
  // the first qualifying render of a local day uploads; a failed upload
  // keeps the ref clear so the next event retries the same day. Flipping
  // the toggle off stops uploads at once; the stored server copy goes
  // only with the GDPR delete (the settings row says so plainly).
  const cohortUploadDayRef = useRef<string | null>(null);
  useEffect(() => {
    if (analytics === null) return;
    if (!settingsData.analyticsShare) return;
    const day = getLocalDayKey(Date.now());
    if (cohortUploadDayRef.current === day) return;
    let cancelled = false;
    pushCohortRecord(buildCohortRecord(analytics)).then((ok) => {
      if (ok && !cancelled) cohortUploadDayRef.current = day;
    });
    return () => {
      cancelled = true;
    };
  }, [analytics, settingsData.analyticsShare]);

  // F27.4 first-use stamp: first cloud link — the account hook's status
  // settling to "in" is the single point every sign-in path (login,
  // register, provider) passes through; the fold is idempotent, so a
  // repeated effect fire is a no-op.
  useEffect(() => {
    if (account.status === "in") onFeatureFirstUse("cloud-link");
  }, [account.status, onFeatureFirstUse]);

  // F27.4 first-use stamp: first leaderboard open (the panel's onToggle
  // fires it; the fold is idempotent).
  const handleLeaderboardOpen = useCallback(() => {
    onFeatureFirstUse("leaderboard-open");
  }, [onFeatureFirstUse]);

  const handleExportSaveCode = useCallback(() => {
    // F27.4 first-use stamp: exporting a save code at all (the
    // export-with-data-deletion format is the same string).
    onFeatureFirstUse("save-code-export");
    return exportSaveCode(settingsData, equationSettings, onboardingDone);
  }, [
    exportSaveCode,
    settingsData,
    equationSettings,
    onboardingDone,
    onFeatureFirstUse,
  ]);

  const handleImportSaveCode = useCallback(
    (code: string): boolean => {
      const imported = importSaveCode(code);
      if (imported == null) {
        displayMessage(t("toast.invalidSaveCode"), 3000);
        return false;
      }
      if (imported.settings != null || imported.equationSettings != null) {
        applyImportedSettings(imported);
      }
      // F52.1: a save code carries the tutorial-dismissed flag, so a
      // restored veteran doesn't re-see the 4-step tutorial. Absent/true
      // is a no-op for a player who already finished; a fresh install
      // importing a veteran save skips it the same way the flag would on
      // a cold load.
      if (imported.onboardingDone === true) {
        setOnboardingDone(true);
      }
      displayMessage(t("toast.saveImported"), 3000);
      noteCrashEvent("save imported");
      return true;
    },
    [
      importSaveCode,
      applyImportedSettings,
      displayMessage,
      t,
      setOnboardingDone,
    ],
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

  // Auto daily bonus (todo: the idle reward pops up on its own; the 🎁
  // header icon only renders while this toggle is OFF): with the toggle
  // on (default) a claimable streak bonus claims itself, at most once per
  // local day. `claim` is internally claimable-guarded and synchronously
  // re-points its state ref, so a stray double-call can never pay twice —
  // the per-dayKey ref just keeps the effect honest. Onboarding-gated
  // like the auto equation above.
  const dailyBonusAutoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settingsData.autoDailyBonus) return;
    if (onboardingLoading || onboardingDone !== true) return;
    if (!dailyBonus.claimable) return;
    if (dailyBonusAutoRef.current === dailyBonus.dayKey) return;
    dailyBonusAutoRef.current = dailyBonus.dayKey;
    dailyClaim();
  }, [
    settingsData.autoDailyBonus,
    onboardingLoading,
    onboardingDone,
    dailyBonus.claimable,
    dailyBonus.dayKey,
    dailyClaim,
  ]);

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
    onFeatureFirstUse("weekly-claim");
    weeklyClaim();
  }, [weeklyClaim, onFeatureFirstUse]);

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
    onAdOutcome: onFirstAdOutcome,
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
    // Read the payload BEFORE cleaning: clean() mutates this very
    // URLSearchParams object (it deletes the iap_* keys), so anything
    // read afterwards would come back empty and the verify queue would
    // silently never fill — the purchase would never be confirmed.
    const pidRaw = params.get("iap_product") ?? "";
    const sid = params.get("iap_sid") ?? "";
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
    // expo-router's web URL sync re-writes the location from its route
    // state shortly after mount, which would resurrect the one-shot
    // flags we just stripped (and re-trigger the verify on refresh).
    // Re-clean across the next couple of animation frames, after that
    // sync settles — a bounded burst, once per load. (Idempotent:
    // clean() just deletes the same keys again.)
    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      clean();
      rafB = requestAnimationFrame(clean);
    });
    const cancelReClean = () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
    };
    if (flag === "cancel") {
      // The player backed out on the hosted page: nothing to verify.
      cancelReClean();
      return;
    }
    // Validate the URL product id against the catalog — the query string
    // is attacker-controllable, the catalog is the allowlist.
    const productId = pidRaw in IAP_PRODUCTS ? (pidRaw as IapProductId) : null;
    if (productId === null || !sid) return cancelReClean;
    // The provider (web .web swap) exposes noteCheckoutSuccess to queue
    // the (productId, session-id) verify; native/noop providers don't.
    // The queue is persisted, so even a crash before the verify POST is
    // fine — the next restore replays it.
    const note = iapProviderRef.current.noteCheckoutSuccess;
    if (!note) return cancelReClean;
    void Promise.resolve(note(productId, sid)).then(() => {
      void iapRestoreRef.current();
    });
    return cancelReClean;
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
    const { cosmetics, caveThemes, customSkin } = iapGrantCosmeticIds(
      iap.entitlements,
    );
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
    if (customSkin) {
      // Idempotent: only writes when not already unlocked; never touches
      // the player's uploads. (No analytics event: the pass grants a slot,
      // not a catalog cosmetic.)
      unlockCustomSkin();
    }
  }, [
    iap.entitlements,
    grantIapCosmetics,
    unlockCustomSkin,
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
  }, [
    gameState.totalPrestiges,
    onPrestige,
    cloudRequestPush,
    leaderboardRequestSubmit,
  ]);

  // Crash-context trails for the monetization actions (dev-sim or store,
  // same paths).
  const adClaim = adRewards.claim;
  const handleAdClaim = useCallback(
    (kind: AdKind) => {
      noteCrashEvent(`ad reward: ${kind}`);
      adClaim(kind);
    },
    [adClaim],
  );
  const iapPurchase = iap.purchase;
  const handleIapPurchase = useCallback(
    (id: IapProductId) => {
      noteCrashEvent(`iap purchase: ${id}`);
      iapPurchase(id);
    },
    [iapPurchase],
  );
  // Unified-shop gem buy (todo: "move gem shop cosmetics to one time
  // purchase shop"): the pack's grant decides the engine action; both are
  // idempotent no-ops when unaffordable / already owned. Stable callbacks
  // so the memoized panel's props don't churn.
  const handleSkinImageUpload = useCallback(async () => {
    const res = await pickCustomSkinImage();
    if (res.kind === "image") {
      setCustomSkinGrid(res.grid);
      displayMessage(t("toast.skinImageSaved"), 2000);
    } else if (res.kind === "invalid") {
      displayMessage(t("toast.skinImageInvalid"), 3000);
    } else if (res.kind === "unsupported") {
      displayMessage(t("toast.skinUnsupported"), 3000);
    }
  }, [displayMessage, t, setCustomSkinGrid]);
  const handleSkinAudioUpload = useCallback(async () => {
    const res = await pickCustomSkinAudio();
    if (res.kind === "audio") {
      setCustomSkinAudio(res.uri);
      displayMessage(t("toast.skinAudioSaved"), 2000);
    } else if (res.kind === "invalid") {
      displayMessage(t("toast.skinAudioInvalid"), 3000);
    } else if (res.kind === "unsupported") {
      displayMessage(t("toast.skinUnsupported"), 3000);
    }
  }, [displayMessage, t, setCustomSkinAudio]);

  const handleShopBuyGems = useCallback(
    (id: IapProductId) => {
      const grant = IAP_PACK_GRANTS[id];
      if (grant.kind === "customSkin") {
        // One-time gem unlock of the custom-skin slot: unlock + equip so
        // the player's already-uploaded pixels come to life. No grant —
        // the skin pixels are the player's own uploads, never a cosmetic.
        if (buyCustomSkin(CUSTOM_SKIN_UNLOCK_COST_GEMS)) {
          unlockCustomSkin();
          setCustomSkinEquipped(true);
        }
      } else if (grant.kind === "caveTheme") buyCaveTheme(grant.id);
      else buyCosmetic(grant.id);
      haptic("success");
    },
    [
      buyCosmetic,
      buyCaveTheme,
      buyCustomSkin,
      unlockCustomSkin,
      setCustomSkinEquipped,
      haptic,
    ],
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

  // "Erase all data" (a superset of Reset — see eraseAll.ts for the
  // scope): wipe EVERYTHING the app persists locally, not just the
  // save. The live in-memory state is reset to defaults FIRST because
  // a native app has no page reload — the in-memory values are what a
  // next autosave would rewrite; on web the reload below guarantees a
  // clean boot regardless.
  const signOut = account.signOut;
  const handleEraseAllData = useCallback(async () => {
    noteCrashEvent("erase-all-data");
    resetGame();
    updateSettingsData(defaultSettingsData);
    updateEquationSettings(defaultEquationSettings);
    setMute(false);
    setOnScreenKeypad(Platform.OS !== "web");
    await signOut();
    try {
      await eraseAllAppStorage();
    } catch (e) {
      console.error("Erase all data failed", e);
      displayMessage(t("settings.eraseAllDataFailed"), 5000);
      return;
    }
    if (Platform.OS === "web") {
      window.location.reload();
    } else {
      displayMessage(t("settings.eraseAllDataDone"), 4000);
    }
  }, [
    resetGame,
    updateSettingsData,
    updateEquationSettings,
    setMute,
    setOnScreenKeypad,
    signOut,
    displayMessage,
    t,
  ]);

  // Cold start (plan §4.4): hold the screen on a loading state until the
  // stored save is loaded, instead of flashing the zeroed state first.
  // All hooks above have already run, so an early return is safe here.
  if (!isLoaded) {
    return <LoadingScreen reduceMotion={reduceMotion} />;
  }

  return (
    <Context.Provider value={contextValue}>
      {/* Whole-UI text scale (textScale.tsx): every <T/> in the tree
          reads this; the provider sanitizes the stored step and is
          OUTSIDE the container View so overlays/tooltips/drawers scale. */}
      <TextScaleProvider scale={textScale}>
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
        {/* Full-screen cave background (todo 2026-07-14 #3): parallax
            rows + jagged foreground walls covering the WHOLE screen,
            not just the mining area. pointerEvents: none inside. */}
        <CaveBackground
          depth={depth}
          tint={caveTint}
          emojiArt={settingsData.emojiArt}
        />
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
              onChangeSettingsData={updateSettingsData}
              equationSettings={equationSettings}
              onChangeEquationSettings={updateEquationSettings}
              showMessage={showMessage}
              onSave={handleSaveSettings}
              onReset={handleReset}
              onEraseAllData={handleEraseAllData}
              onExportSaveCode={handleExportSaveCode}
              onImportSaveCode={handleImportSaveCode}
              onReplayTutorial={handleReplayTutorial}
              mute={mute}
              onMuteChange={handleMuteChange}
              onScreenKeypad={onScreenKeypad}
              onKeypadChange={handleKeypadSettingChange}
              textScale={textScale}
              onTextScaleChange={handleTextScaleChange}
              hardModeUnlocked={gameState.completedTiers.includes(
                HARD_MODE_UNLOCK_TIER,
              )}
              stats={gameState}
              session={sessionStats}
              analytics={analytics}
              onClearAnalytics={onClearAnalytics}
              onFirstUse={onFeatureFirstUse}
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
            {/* The idle reward's 🎁 icon renders ONLY while the auto-claim
              toggle is off (todo: remove the icon, pop it up instead): on
              (default) the effect above claims the bonus itself. */}
            {!settingsData.autoDailyBonus && (
              <DailyBonusButton
                claimable={dailyBonus.claimable}
                bonus={dailyBonus.bonus}
                streak={dailyBonus.streak}
                freezes={dailyBonus.freezes}
                onClaim={handleDailyClaim}
              />
            )}
            <WeeklyContractButton
              claimable={weeklyContract.claimable}
              claimed={weeklyContract.claimed}
              bonus={weeklyContract.bonus}
              done={weeklyContract.doneCount}
              total={weeklyContract.total}
              onClaim={handleWeeklyClaim}
            />
            {/* The daily question's 📅 icon renders ONLY while the auto
              toggle is off (todo: remove the icon, pop it up instead): on
              (default) the effect above starts the equation itself. */}
            {!settingsData.autoDailyEquation && (
              <DailyEquationButton
                solved={dailyEquation.solved}
                bonus={dailyEquation.bonus}
                onStart={handleDailyEquationStart}
              />
            )}
            {/* The trophy renders only while the provider is available
              (plan §Leaderboard "Availability gate"): hidden until the
              Pocketbase URL is configured, same rule as the ad/IAP
              entry points. */}
            {leaderboard.available && (
              <LeaderboardPanel
                handle={leaderboard}
                isDevSim={leaderboardProvider.id === "dev-sim"}
                onOpen={handleLeaderboardOpen}
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
              customSkin={customSkin}
              onUploadSkinImage={handleSkinImageUpload}
              onUploadSkinAudio={handleSkinAudioUpload}
              onPickBundledSprite={setCustomSkinArt}
              onClearSkin={() => {
                clearCustomSkin();
                displayMessage(t("toast.skinCleared"), 2000);
              }}
              onBuyGems={handleShopBuyGems}
              onPurchase={handleIapPurchase}
              onSelect={handleShopSelect}
              onReroll={rerollPlayerSeed}
            />
          </View>
          <DepthBanner
            depth={depth}
            mineralsPerSec={mineralsPerSec}
            tierName={
              content("depthTier", String(depthTier.id), {
                title: depthTier.name,
              }).title
            }
            clickBonus={depthTier.clickBonus}
          />
          <EquationDisplay
            equation={equation}
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
            {/* The cave play area breaks out of the width-capped column
              on wide web screens (styles.canvasFullBleed) — full-bleed
              play area, capped content. (The cave itself now lives at
              the screen root, todo 2026-07-14 #3.) */}
            <View
              style={[
                styles.canvasWrap,
                Platform.OS === "web" && styles.canvasFullBleed,
              ]}
            >
              <MiningCanvas
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
                playerBodyUri={customSkinBodyUri}
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
                  anyPurchaseAffordable
                    ? t("main.a11yAffordablePurchase")
                    : undefined
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
                      gemsBoughtWithMinerals={gameState.gemsBoughtWithMinerals}
                      clickPower={gameState.clickPower}
                      minerPower={gameState.minerPower}
                      minerPowerUnlocked={gameState.completedTiers.includes(
                        MINER_POWER_UNLOCK_TIER,
                      )}
                      miners={gameState.miners}
                      fastMiners={gameState.fastMiners}
                      legendaryMiners={gameState.legendaryMiners}
                      gemChanceLevels={gameState.gemChanceLevels}
                      fastMinerUnlocked={gameState.completedTiers.includes(
                        FAST_MINER_UNLOCK_TIER,
                      )}
                      legendaryMinerUnlocked={gameState.completedTiers.includes(
                        LEGENDARY_MINER_UNLOCK_TIER,
                      )}
                      prestigeLevel={gameState.prestigeLevel}
                      lifetimeMinerals={gameState.lifetimeMinerals}
                      prestigeUnlocked={gameState.completedTiers.includes(
                        PRESTIGE_UNLOCK_TIER,
                      )}
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
        {/* The live region stays mounted so screen readers announce each
            message change (a live region that mounts together with its
            content is not reliably announced). On web, RN maps
            accessibilityLiveRegion to aria-live; natively it drives the
            platform announce. pointerEvents="none" as before — the region
            never intercepts input. */}
        <View
          style={styles.messageOverlay}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
        >
          {showMessage ? (
            <Text style={styles.messageText}>{showMessage}</Text>
          ) : null}
        </View>
        {!onboardingLoading && onboardingDone !== true && (
          <OnboardingOverlay
            onDismiss={(completed) => {
              // FTUE funnel: first dismissal wins (the overlay's own
              // final-"Start" vs Skip decision is the completion flag);
              // the setup step's choices persist themselves on change
              // (useSettings writes each change to AsyncStorage), so
              // dismissal only needs to persist the onboarding flag.
              onOnboardingEnd(completed);
              setOnboardingDone(true);
            }}
            onStep={onOnboardingStep}
            equationSettings={equationSettings}
            onEquationSettingsChange={updateEquationSettings}
            onScreenKeypad={onScreenKeypad}
            onKeypadChange={handleKeypadSettingChange}
          />
        )}
        <StatusBar style="auto" />
      </View>
      </TextScaleProvider>
    </Context.Provider>
  );
}

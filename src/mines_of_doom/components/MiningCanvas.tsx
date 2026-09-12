import {
    memo,
    MutableRefObject,
    RefObject,
    useEffect,
    useRef,
    useState,
} from "react";
import { Animated, Easing, Image, View } from "react-native";
import { T as Text } from "../textScale";
import { useT } from "src/hooks/useI18n";
import Miner from "./Miner";
import DebrisParticles, {
    DebrisParticlesRef,
} from "src/components/DebrisParticles";
import BlockBreak, { BlockBreakRef } from "src/components/BlockBreak";
import FloatingTextLayer, { FloatingTextRef } from "./FloatingTextLayer";
import { formatNumber } from "src/utils/format";
import {
    gemSpriteUri,
    mineralChunkSpriteUri,
} from "src/utils/graphics/pixelArt";
import { emojis } from "src/utils/graphics/emojis";
import { rosterDisplay, rosterSeed } from "../cosmetics";
import { styles } from "../styles";
import { GemPocket, pocketPosition } from "../gemPocket";

// Pixel-art currency icons (plan §4.5) — replaces the old 🪨/💎 emoji
// display. Call the (internally cached) getters lazily so emoji mode never
// even bakes the PNGs.
const CURRENCY_ICON = { width: 20, height: 20 };
const CURRENCY_EMOJI = { fontSize: 20 };

/**
 * Minimum press duration for a cave press to count as a mine (plan §2.1
 * "canvas tap vs. equation submit"). Quick taps used to reset the combo
 * accidentally while players were answering equations — a short press is
 * now a deliberate no-op, and mining is the cave's "slow" action.
 */
const MINE_HOLD_MS = 300;

const MiningCanvas = memo(function MiningCanvas({
    minerals,
    gems,
    miners,
    fastMiners,
    legendaryMiners,
    minerOutfits = undefined,
    onTap,
    playerPickaxeAnimRef,
    debrisRef,
    blockBreakRef,
    floatingTextRef,
    playerSeed,
    outfitId,
    pickaxeId,
    playerBodyUri,
    playerPickaxeUri,
    reduceMotion,
    emojiArt,
    pocket,
    onPocketCollect,
}: {
    minerals: bigint;
    gems: number;
    miners: number;
    /** Tier-2 second miner type: rendered smaller, cheaper/weaker. */
    fastMiners: number;
    /** Tier-5 endgame miner type: the premium raw-output crew. */
    legendaryMiners: number;
    /**
     * Per-crew outfit overrides (todo: "allow visual customization (iap
     * cosmetic) of hired miners individually"): roster slot decimal string →
     * owned outfit id (the caller filters to owned). A normal-crew miner
     * with an override wears it instead of the player's selected outfit;
     * fast/legendary miners always wear the player's look.
     */
    minerOutfits?: Record<string, string>;
    onTap: () => void;
    playerPickaxeAnimRef: MutableRefObject<() => void>;
    /** Seeded sprite variants (cosmetics). */
    playerSeed: number;
    outfitId: string;
    pickaxeId: string;
    /**
     * Custom-skin body for the PLAYER miner only (todo: "Custom skinning"):
     * a PNG data URI of the player's own 16×16 pixels. Roster miners keep
     * the outfit look. null/undefined = the normal seeded outfit body.
     */
    playerBodyUri?: string | null;
    /**
     * Custom-skin pickaxe for the PLAYER miner only (the pickaxe slot):
     * a PNG data URI of the player's own 16×16 pickaxe sprite. Roster
     * miners keep their equipped pickaxes. null/undefined = the stock
     * procedural pickaxe.
     */
    playerPickaxeUri?: string | null;
    /** OS reduce-motion preference: suppresses decorative effects. */
    reduceMotion: boolean;
    /** Low-end fallback (plan §4.5): emoji instead of pixel sprites. */
    emojiArt: boolean;
    /** The live rare bonus node (gemPocket.ts), or null when none. */
    pocket: GemPocket | null;
    /** Collect the live pocket (quick tap, no hold required). */
    onPocketCollect: () => void;
    debrisRef: RefObject<DebrisParticlesRef | null>;
    blockBreakRef: RefObject<BlockBreakRef | null>;
    floatingTextRef: RefObject<FloatingTextRef | null>;
}) {
    // Refs only — hold duration must not trigger re-renders per press.
    const holdStartRef = useRef(0);
    // Wind-up (plan "Adjust"): one re-render per press start / end (never
    // per tick) flags the player Miner to pull the pickaxe back while the
    // hold is in flight; on release the snap-back + (mined?) swing play.
    const [holding, setHolding] = useState(false);
    const t = useT();

    // Pocket presence pulse: one scale loop, only while a pocket is live and
    // the player hasn't opted out of decorative motion.
    const pocketScale = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (pocket == null || reduceMotion) {
            pocketScale.setValue(1);
            return;
        }
        pocketScale.setValue(1);
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pocketScale, {
                    toValue: 1.25,
                    duration: 500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pocketScale, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pocket, reduceMotion, pocketScale]);

    // The visible crew column (todo: "have miners line up down the middle
    // vertically along the mine background shaft"): rosterDisplay picks which
    // hires render (capped for a phone-sized column) and how small each row
    // is as it recedes up the shaft. Fast/legendary variants seed off 1000/
    // 2000+index as before so their sprite variants can't collide with the
    // normal-miner column.
    const rosterItems = rosterDisplay(miners, fastMiners, legendaryMiners);

    return (
        /*
      Plain View + responder system instead of Pressable.
      On web, Pressable keeps pressed state in React and re-renders
      twice per tap, which dominated the cost of rapid tapping.
    */
        <View
            testID="mining-canvas"
            style={{ ...styles.canvas, paddingTop: 10 }}
            onStartShouldSetResponder={() => true}
            onResponderStart={() => {
                holdStartRef.current = Date.now();
                setHolding(true);
            }}
            onResponderRelease={() => {
                const held = Date.now() - holdStartRef.current;
                holdStartRef.current = 0;
                setHolding(false);
                if (held >= MINE_HOLD_MS) {
                    onTap();
                }
            }}
            onResponderTerminate={() => {
                holdStartRef.current = 0;
                setHolding(false);
            }}
            onResponderTerminationRequest={() => false}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.holdToMine")}
        >
            <FloatingTextLayer ref={floatingTextRef} />
            {pocket != null &&
                (() => {
                    const { leftPct, topPct } = pocketPosition(pocket.seed);
                    return (
                        /*
              Its own responder: the deepest view wins the negotiation, so
              a tap here never falls through to the cave's hold-to-mine,
              and the pocket collects on a QUICK tap (no MINE_HOLD_MS) —
              it's a bonus, so an accidental tap can only ever help.
            */
                        <Animated.View
                            testID="gem-pocket"
                            accessibilityRole="button"
                            accessibilityLabel={t("a11y.gemPocket", {
                                bonus: formatNumber(pocket.bonus),
                            })}
                            style={{
                                position: "absolute",
                                left: `${leftPct}%`,
                                top: `${topPct}%`,
                            }}
                            onStartShouldSetResponder={() => true}
                            onResponderRelease={() => onPocketCollect()}
                            onResponderTerminate={() => {}}
                        >
                            <Animated.View
                                style={{
                                    transform: [{ scale: pocketScale }],
                                    width: 34,
                                    height: 34,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {/*
                  A MINERAL pocket (it pays minerals, ~8× click power) —
                  the art matches the currency it pays.
                */}
                                {emojiArt ? (
                                    <Text
                                        style={{
                                            fontSize: 26,
                                            userSelect: "none",
                                        }}
                                    >
                                        {emojis.mineral}
                                    </Text>
                                ) : (
                                    <Image
                                        source={{
                                            uri: mineralChunkSpriteUri(),
                                        }}
                                        style={{ width: 28, height: 28 }}
                                    />
                                )}
                            </Animated.View>
                        </Animated.View>
                    );
                })()}
            <View style={{ alignItems: "center" }}>
                <View style={styles.flexCenteredRow}>
                    {emojiArt ? (
                        <Text style={{ ...CURRENCY_EMOJI, userSelect: "none" }}>
                            {emojis.mineral}
                        </Text>
                    ) : (
                        <Image
                            source={{ uri: mineralChunkSpriteUri() }}
                            style={CURRENCY_ICON}
                        />
                    )}
                    <Text
                        testID="mineral-count"
                        style={{ ...styles.text, alignSelf: "center" }}
                    >
                        {formatNumber(minerals)}
                    </Text>
                </View>
                <View style={styles.flexCenteredRow}>
                    {emojiArt ? (
                        <Text style={{ ...CURRENCY_EMOJI, userSelect: "none" }}>
                            {emojis.gem}
                        </Text>
                    ) : (
                        <Image
                            source={{ uri: gemSpriteUri() }}
                            style={CURRENCY_ICON}
                        />
                    )}
                    <Text style={{ ...styles.text, alignSelf: "center" }}>
                        {formatNumber(gems)}
                    </Text>
                </View>

                <View style={{ alignItems: "center", marginTop: 2 }}>
                    {/* Crew column, far-most first: the nearest (normal) hires sit
              right above the player, the far legendary rows at the top.
              Each row wears its per-miner outfit override when assigned
              (normal crew only), else the player's selected outfit. */}
                    {[...rosterItems].reverse().map((item) => (
                        <Miner
                            key={`${item.kind}-${item.index}`}
                            scale={item.scale}
                            reactOnTick={true}
                            seed={rosterSeed(
                                playerSeed,
                                item.kind === "normal"
                                    ? item.index
                                    : item.kind === "fast"
                                      ? 1000 + item.index
                                      : 2000 + item.index,
                            )}
                            outfitId={
                                item.kind === "normal"
                                    ? (minerOutfits?.[String(item.index)] ??
                                      outfitId)
                                    : outfitId
                            }
                            pickaxeId={pickaxeId}
                            reduceMotion={reduceMotion}
                            emojiArt={emojiArt}
                        />
                    ))}
                    <View
                        style={{ position: "relative", alignItems: "center" }}
                    >
                        <Miner
                            key={"player"}
                            animateRef={playerPickaxeAnimRef}
                            isPlayer={true}
                            windingUp={holding}
                            seed={playerSeed}
                            outfitId={outfitId}
                            pickaxeId={pickaxeId}
                            reduceMotion={reduceMotion}
                            emojiArt={emojiArt}
                            bodyOverrideUri={playerBodyUri}
                            pickaxeOverrideUri={playerPickaxeUri}
                        />
                        <DebrisParticles
                            ref={debrisRef}
                            reduceMotion={reduceMotion}
                            emojiArt={emojiArt}
                        />
                        <BlockBreak ref={blockBreakRef} />
                    </View>
                </View>
                <View style={styles.hintPill}>
                    <Text
                        style={{
                            ...styles.text,
                            opacity: 0.6,
                            fontSize: 11,
                            userSelect: "none",
                        }}
                    >
                        {t("ui.holdToMineHint")}
                    </Text>
                </View>
            </View>
        </View>
    );
});

export default MiningCanvas;

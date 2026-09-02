import { memo, MutableRefObject, RefObject, useRef } from "react";
import { Image, Text, View } from "react-native";
import Miner from "./Miner";
import DebrisParticles, {
  DebrisParticlesRef,
} from "apps/components/DebrisParticles";
import BlockBreak, { BlockBreakRef } from "apps/components/BlockBreak";
import CaveBackground from "apps/components/CaveBackground";
import FloatingTextLayer, {
  FloatingTextRef,
} from "./FloatingTextLayer";
import { formatNumber } from "apps/utils/format";
import { gemSpriteUri, mineralChunkSpriteUri } from "apps/utils/graphics/pixelArt";
import { rosterSeed } from "../cosmetics";
import { styles } from "../styles";

// Pixel-art currency icons (plan §4.5), cached PNG data URIs — replaces the
// old 🪨/💎 emoji display. Module-level so the strings are built once.
const MINERAL_URI = mineralChunkSpriteUri();
const GEM_URI = gemSpriteUri();
const CURRENCY_ICON = { width: 20, height: 20 };

/**
 * Minimum press duration for a cave press to count as a mine (plan §2.1
 * "canvas tap vs. equation submit"). Quick taps used to reset the combo
 * accidentally while players were answering equations — a short press is
 * now a deliberate no-op, and mining is the cave's "slow" action.
 */
const MINE_HOLD_MS = 300;

const MiningCanvas = memo(function MiningCanvas({
  depth,
  tint,
  minerals,
  gems,
  miners,
  fastMiners,
  legendaryMiners,
  onTap,
  playerPickaxeAnimRef,
  debrisRef,
  blockBreakRef,
  floatingTextRef,
  playerSeed,
  outfitId,
  pickaxeId,
  reduceMotion,
}: {
  depth: number;
  /** Cave background tint for the current depth tier. */
  tint: string;
  minerals: number;
  gems: number;
  miners: number;
  /** Tier-2 second miner type: rendered smaller, cheaper/weaker. */
  fastMiners: number;
  /** Tier-5 endgame miner type: the premium raw-output crew. */
  legendaryMiners: number;
  onTap: () => void;
  playerPickaxeAnimRef: MutableRefObject<() => void>;
  /** Seeded sprite variants (cosmetics). */
  playerSeed: number;
  outfitId: string;
  pickaxeId: string;
  /** OS reduce-motion preference: suppresses decorative effects. */
  reduceMotion: boolean;
  debrisRef: RefObject<DebrisParticlesRef>;
  blockBreakRef: RefObject<BlockBreakRef>;
  floatingTextRef: RefObject<FloatingTextRef>;
}) {
  // Refs only — hold duration must not trigger re-renders per press.
  const holdStartRef = useRef(0);
  return (
    /*
      Plain View + responder system instead of Pressable.
      On web, Pressable keeps pressed state in React and re-renders
      twice per tap, which dominated the cost of rapid tapping.
    */
    <View
      style={{ ...styles.canvas, paddingTop: 10 }}
      onStartShouldSetResponder={() => true}
      onResponderStart={() => {
        holdStartRef.current = Date.now();
      }}
      onResponderRelease={() => {
        const held = Date.now() - holdStartRef.current;
        holdStartRef.current = 0;
        if (held >= MINE_HOLD_MS) {
          onTap();
        }
      }}
      onResponderTerminate={() => {
        holdStartRef.current = 0;
      }}
      onResponderTerminationRequest={() => false}
      accessibilityRole="button"
      accessibilityLabel="Hold to mine"
    >
      <CaveBackground depth={depth} tint={tint} />
      <FloatingTextLayer ref={floatingTextRef} />
      <View style={{ alignItems: "center" }}>
        <View style={styles.flexCenteredRow}>
          <Image source={{ uri: MINERAL_URI }} style={CURRENCY_ICON} />
          <Text style={{ ...styles.text, alignSelf: "center" }}>
            {formatNumber(minerals)}
          </Text>
        </View>
        <View style={styles.flexCenteredRow}>
          <Image source={{ uri: GEM_URI }} style={CURRENCY_ICON} />
          <Text style={{ ...styles.text, alignSelf: "center" }}>
            {formatNumber(gems)}
          </Text>
        </View>

        <View style={{ position: "relative", alignItems: "center" }}>
          <Miner
            key={"player"}
            animateRef={playerPickaxeAnimRef}
            isPlayer={true}
            seed={playerSeed}
            outfitId={outfitId}
            pickaxeId={pickaxeId}
            reduceMotion={reduceMotion}
          />
          <DebrisParticles ref={debrisRef} reduceMotion={reduceMotion} />
          <BlockBreak ref={blockBreakRef} />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {[...Array(Math.min(miners, 50))].map((_, idx) => (
            <Miner
              key={idx}
              scale={0.5}
              reactOnTick={true}
              seed={rosterSeed(playerSeed, idx)}
              outfitId={outfitId}
              pickaxeId={pickaxeId}
              reduceMotion={reduceMotion}
            />
          ))}
          {/* Fast miners: smaller, seed offset by 1000 so their sprite
              variants can't collide with the normal-miner row. */}
          {[...Array(Math.min(fastMiners, 50))].map((_, idx) => (
            <Miner
              key={`fast-${idx}`}
              scale={0.35}
              reactOnTick={true}
              seed={rosterSeed(playerSeed, 1000 + idx)}
              outfitId={outfitId}
              pickaxeId={pickaxeId}
              reduceMotion={reduceMotion}
            />
          ))}
          {/* Legendary miners (tier-5 endgame): the premium crew, seed
              offset by 2000 so their sprite variants can't collide with
              either of the other two rows. */}
          {[...Array(Math.min(legendaryMiners, 50))].map((_, idx) => (
            <Miner
              key={`legendary-${idx}`}
              scale={0.55}
              reactOnTick={true}
              seed={rosterSeed(playerSeed, 2000 + idx)}
              outfitId={outfitId}
              pickaxeId={pickaxeId}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>
        <Text
          style={{
            ...styles.text,
            opacity: 0.45,
            fontSize: 11,
            userSelect: "none",
          }}
        >
          hold to mine
        </Text>
      </View>
    </View>
  );
});

export default MiningCanvas;

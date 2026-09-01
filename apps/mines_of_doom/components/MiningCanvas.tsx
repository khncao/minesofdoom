import { memo, MutableRefObject, RefObject } from "react";
import { Text, View } from "react-native";
import Miner from "./Miner";
import DebrisParticles, {
  DebrisParticlesRef,
} from "apps/components/DebrisParticles";
import BlockBreak, { BlockBreakRef } from "apps/components/BlockBreak";
import CaveBackground from "apps/components/CaveBackground";
import FloatingTextLayer, {
  FloatingTextRef,
} from "./FloatingTextLayer";
import { emojiText } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import { rosterSeed } from "../cosmetics";
import { styles } from "../styles";

const MiningCanvas = memo(function MiningCanvas({
  depth,
  tint,
  minerals,
  gems,
  miners,
  fastMiners,
  onTap,
  playerPickaxeAnimRef,
  debrisRef,
  blockBreakRef,
  floatingTextRef,
  playerSeed,
  outfitId,
  pickaxeId,
}: {
  depth: number;
  /** Cave background tint for the current depth tier. */
  tint: string;
  minerals: number;
  gems: number;
  miners: number;
  /** Tier-2 second miner type: rendered smaller, cheaper/weaker. */
  fastMiners: number;
  onTap: () => void;
  playerPickaxeAnimRef: MutableRefObject<() => void>;
  /** Seeded sprite variants (cosmetics). */
  playerSeed: number;
  outfitId: string;
  pickaxeId: string;
  debrisRef: RefObject<DebrisParticlesRef>;
  blockBreakRef: RefObject<BlockBreakRef>;
  floatingTextRef: RefObject<FloatingTextRef>;
}) {
  return (
    /*
      Plain View + responder system instead of Pressable.
      On web, Pressable keeps pressed state in React and re-renders
      twice per tap, which dominated the cost of rapid tapping.
    */
    <View
      style={{ ...styles.canvas, paddingTop: 10 }}
      onStartShouldSetResponder={() => true}
      onResponderRelease={onTap}
      onResponderTerminationRequest={() => false}
      accessibilityRole="button"
      accessibilityLabel="Mine"
    >
      <CaveBackground depth={depth} tint={tint} />
      <FloatingTextLayer ref={floatingTextRef} />
      <View style={{ alignItems: "center" }}>
        <View style={styles.flexCenteredRow}>
          {emojiText("mineral")}
          <Text style={{ ...styles.text, alignSelf: "center" }}>
            {formatNumber(minerals)}
          </Text>
        </View>
        <View style={styles.flexCenteredRow}>
          {emojiText("gem")}
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
          />
          <DebrisParticles ref={debrisRef} />
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
            />
          ))}
        </View>
      </View>
    </View>
  );
});

export default MiningCanvas;

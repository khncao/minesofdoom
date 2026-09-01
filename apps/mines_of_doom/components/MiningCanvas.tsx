import { memo, MutableRefObject, RefObject } from "react";
import { Text, View } from "react-native";
import Miner from "./Miner";
import DebrisParticles, {
  DebrisParticlesRef,
} from "apps/components/DebrisParticles";
import CaveBackground from "apps/components/CaveBackground";
import FloatingTextLayer, {
  FloatingTextRef,
} from "./FloatingTextLayer";
import { emojiText } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import { styles } from "../styles";

const MiningCanvas = memo(function MiningCanvas({
  depth,
  minerals,
  gems,
  miners,
  onTap,
  playerPickaxeAnimRef,
  debrisRef,
  floatingTextRef,
}: {
  depth: number;
  minerals: number;
  gems: number;
  miners: number;
  onTap: () => void;
  playerPickaxeAnimRef: MutableRefObject<() => void>;
  debrisRef: RefObject<DebrisParticlesRef>;
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
      <CaveBackground depth={depth} />
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
          />
          <DebrisParticles ref={debrisRef} />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {[...Array(Math.min(miners, 50))].map((_, idx) => (
            <Miner key={idx} scale={0.5} reactOnTick={true} />
          ))}
        </View>
      </View>
    </View>
  );
});

export default MiningCanvas;

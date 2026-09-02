import React, { MutableRefObject, useContext, useEffect, useMemo, useRef } from "react";
import { Animated, Image } from "react-native";
import { Context } from "../Context";
import { getPickaxe, rollMinerLook } from "../cosmetics";
import { minerSpriteUri, pickaxeSpriteUri } from "apps/utils/graphics/pixelArt";
import { clockPhase, getSharedClock } from "apps/utils/graphics/animationClock";

export interface MinerProps {
  animateRef?: MutableRefObject<() => void>;
  scale?: number;
  reactOnTick?: boolean;
  isPlayer?: boolean;
  /** Seeded variant: the player uses their own seed, roster miners use a
   *  seed derived from it (see rosterSeed). */
  seed: number;
  outfitId: string;
  pickaxeId: string;
  /** OS reduce-motion preference: suppresses the idle bob. */
  reduceMotion?: boolean;
}

// Minimum time between pickaxe swings so fast tapping doesn't queue up
// unbounded animations (which triggers "Excessive number of pending callbacks").
const MIN_PICKAXE_INTERVAL = 100;

// Idle-bob amplitude (px) and bump width (share of the 1s clock cycle).
// The bump is centered at 0.25 + 0.5*phase so its [center-0.25, center+0.25]
// window always fits inside [0, 1] — no wrap-around, so a single plain
// interpolate (which needs an increasing inputRange) is enough.
const BOB_AMPLITUDE = -2;
const BOB_WINDOW = 0.25;

function Miner({ scale = 1, ...props }: MinerProps) {
  const appContext = useContext(Context);
  const pickaxeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const lastPickaxeRef = useRef(0);
  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const pickaxeAnimate = () => {
    // Throttle so rapid tapping can't stack unbounded pickaxe animations.
    const now = Date.now();
    if (now - lastPickaxeRef.current < MIN_PICKAXE_INTERVAL) {
      return;
    }
    lastPickaxeRef.current = now;
    // Cancel the in-flight swing so fast taps don't run multiple springs on
    // the same values concurrently (they fight each other and stack frame
    // callbacks).
    activeAnimRef.current?.stop();
    pickaxeAnim.setValue(0);
    bounceAnim.setValue(0);
    activeAnimRef.current = Animated.parallel([
      Animated.spring(pickaxeAnim, {
        toValue: 100,
        velocity: 2000,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -6,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    ]);
    activeAnimRef.current.start();
  };

  useEffect(() => () => {
    activeAnimRef.current?.stop();
  }, []);

  const spin = pickaxeAnim.interpolate({
    inputRange: [0, 90],
    outputRange: ["0deg", "90deg"],
  });

  // Idle bob from the shared animation clock (plan §4.5): one 1s loop drives
  // every miner; each gets a deterministic phase from its seed so the roster
  // sways as a wave instead of moving in lockstep. Null under reduce-motion.
  const bob = useMemo(() => {
    if (props.reduceMotion) {
      return null;
    }
    const clock = getSharedClock();
    const center = 0.25 + 0.5 * clockPhase(props.seed, 17);
    return clock.interpolate({
      inputRange: [center - BOB_WINDOW, center, center + BOB_WINDOW],
      outputRange: [0, BOB_AMPLITUDE, 0],
    });
  }, [props.seed, props.reduceMotion]);

  if (props.animateRef != null) {
    props.animateRef.current = pickaxeAnimate;
  }
  useEffect(() => {
    if (!props.reactOnTick || appContext == null) {
      return;
    }
    appContext.onTick.push(pickaxeAnimate);
    return () => {
      const i = appContext.onTick.indexOf(pickaxeAnimate);
      if (i !== -1) appContext.onTick.splice(i, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Programmatic pixel sprites: deterministic per (seed, outfit) / theme,
  // cached as PNG data URIs so all same-variant miners share one image.
  const bodyUri = useMemo(
    () => minerSpriteUri(rollMinerLook(props.seed, props.outfitId)),
    [props.seed, props.outfitId],
  );
  const pickaxeUri = useMemo(
    () => pickaxeSpriteUri(getPickaxe(props.pickaxeId).theme),
    [props.pickaxeId],
  );

  const bodySize = props.isPlayer ? 44 : 24;
  const pickaxeSize = props.isPlayer ? 36 : 20;

  return (
    <Animated.View
      style={{
        alignItems: "center",
        transform:
          bob == null
            ? [{ translateY: bounceAnim }, { scale }]
            : [{ translateY: bob }, { translateY: bounceAnim }, { scale }],
      }}
    >
      <Image
        source={{ uri: bodyUri }}
        style={{ width: bodySize, height: bodySize }}
        accessibilityRole="image"
      />
      <Animated.Image
        source={{ uri: pickaxeUri }}
        style={{
          width: pickaxeSize,
          height: pickaxeSize,
          // Overlap the body so the pickaxe reads as held, same offset feel
          // as the old emoji + pickaxe layout.
          marginTop: props.isPlayer ? -18 : -10,
          marginLeft: props.isPlayer ? 12 : 7,
          transform: [{ rotate: spin }],
        }}
      />
    </Animated.View>
  );
}

export default React.memo(Miner);

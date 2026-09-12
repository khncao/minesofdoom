import { createContext, useContext, type ReactNode } from "react";
import {
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from "react-native";

/**
 * In-app text size (docs/gap-ranking.md Tier 1 #2): the app hard-codes
 * fontSize 11–12 across every surface with no user control, and the
 * audience skews young — the research calls in-app text scaling "the
 * cheapest high-impact item" in the accessibility playbooks. Mechanism:
 * components import { T as Text } from this module; T walks each Text's
 * style at render time and multiplies every numeric fontSize by the
 * context scale. No style-object refactor: the shared StyleSheet.create
 * constants stay untouched (applyTextScale never mutates them — it
 * returns a new object only for entries that carry a fontSize).
 * Animated styles are left alone: their fontSize entries are
 * Animated.Value objects, not numbers. OS-level font scaling is
 * unaffected (allowFontScaling defaults to true and still composes).
 */

/** What applyTextScale returns: a style object with scaled fontSize. */
/** The four scale steps, persisted as the exact number. */
export const TEXT_SCALE_STEPS = [0.85, 1, 1.15, 1.3] as const;
export type TextScaleStep = (typeof TEXT_SCALE_STEPS)[number];

/**
 * Nearest-step coercion for a stored/loaded value (the persisted blob is
 * not trusted: a hand-edited AsyncStorage entry may hold anything).
 * Invalid input → the default step (1).
 */
export function sanitizeTextScale(v: unknown): TextScaleStep {
  if (typeof v !== "number" || !Number.isFinite(v)) return 1;
  let best: TextScaleStep = 1;
  let bestDist = Infinity;
  for (const step of TEXT_SCALE_STEPS) {
    const d = Math.abs(step - v);
    if (d < bestDist) {
      bestDist = d;
      best = step;
    }
  }
  return best;
}

/** The step after `dir` moves from the current value, clamped at both ends. */
export function nextTextScale(current: unknown, dir: -1 | 1): TextScaleStep {
  const i = TEXT_SCALE_STEPS.indexOf(sanitizeTextScale(current));
  const j = Math.min(TEXT_SCALE_STEPS.length - 1, Math.max(0, i + dir));
  return TEXT_SCALE_STEPS[j];
}

/**
 * Multiply every numeric fontSize in a style (object, StyleSheet.create
 * entry, array, nested array) by `scale`, rounding to the nearest px with
 * a floor of 8 so small labels never vanish at the low step. Returns the
 * SAME reference when nothing changed (including scale === 1), so the
 * shared style objects from styles.ts are never copied or mutated for
 * nothing. Non-style entries (functions, strings, Animated values) pass
 * through untouched.
 */
/**
 * Structural view of a style object for the walk (TextStyle is an
 * interface, so the parameter itself is typed with RN's StyleProp).
 */
type StyleLike = { [k: string]: unknown };

export function applyTextScale(
  style: StyleProp<TextStyle>,
  scale: number,
): StyleProp<TextStyle> {
  if (scale === 1) return style;
  if (Array.isArray(style)) {
    let changed = false;
    const out: StyleProp<TextStyle>[] = [];
    for (const entry of style) {
      // RecursiveArray's elements admit readonly arrays, which
      // StyleProp doesn't — the walk only reads, so the cast is safe.
      const e = applyTextScale(entry as StyleProp<TextStyle>, scale);
      if (e !== entry) changed = true;
      out.push(e);
    }
    return changed ? out : style;
  }
  if (
    typeof style === "object" &&
    style !== null &&
    !Array.isArray(style)
  ) {
    const obj = style as StyleLike;
    const fontSize = obj.fontSize;
    if (typeof fontSize === "number" && Number.isFinite(fontSize)) {
      return {
        ...(style as object),
        fontSize: Math.max(8, Math.round(fontSize * scale)),
      };
    }
  }
  return style;
}

const TextScaleContext = createContext<number>(1);

/** Own the scale in MinesOfDoom (persisted), apply it to the whole tree. */
export default function TextScaleProvider({
  scale,
  children,
}: {
  scale: number;
  children: ReactNode;
}) {
  return (
    <TextScaleContext.Provider value={sanitizeTextScale(scale)}>
      {children}
    </TextScaleContext.Provider>
  );
}

/**
 * The scaling Text. Import as `import { T as Text } from "…/textScale"` —
 * the only per-file change the feature needs (JSX stays identical).
 * Composes any style prop shape RN's Text accepts; everything else is
 * forwarded verbatim.
 */
export function T(props: TextProps) {
  const scale = useContext(TextScaleContext);
  if (scale === 1 || !props.style) return <Text {...props} />;
  return (
    <Text {...props} style={applyTextScale(props.style, scale)} />
  );
}

import { memo } from "react";
import { View } from "react-native";
import BottomModal from "src/components/BottomModal";
import Button from "src/components/Button";
import { T as Text } from "../textScale";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import { WeeklyGoalProgress } from "../weeklyChallenge";
import { styles } from "../styles";

/**
 * Weekly contract button (todo: "weekly challenges"): sits next to the
 * daily bonus in the top menu row. 📜 while any goal is still open, bright
 * while the claim is pending.
 *
 * The icon is ALWAYS tappable (todo: "weekly contract should always be
 * clickable and status is known"): the tap opens the contract sheet, which
 * states the status in words (in progress / claimable / already claimed —
 * i.e. "no tasks left" is a known, named state, not a dimmed dead icon)
 * and lists every task with its progress. The claim itself happens inside
 * the sheet, so the same surface both shows and acts on the status. The
 * honest reset note (real Monday boundary, no fake urgency — see
 * weeklyChallenge.ts) stays in the sheet with the status.
 */
const WeeklyContractButton = memo(function WeeklyContractButton({
  progress,
  claimable,
  claimed,
  bonus,
  onClaim,
}: {
  progress: WeeklyGoalProgress[];
  claimable: boolean;
  claimed: boolean;
  bonus: number;
  onClaim: () => void;
}) {
  const t = useT();
  const done = progress.filter((p) => p.done).length;
  const total = progress.length;
  const label = claimable
    ? t("a11y.weeklyClaimable", { bonus: formatNumber(bonus) })
    : claimed
      ? t("a11y.weeklyClaimed")
      : t("a11y.weeklyProgress", { done, total });
  const status = claimable
    ? t("weekly.statusClaimable")
    : claimed
      ? t("weekly.statusClaimed")
      : t("weekly.statusInProgress", { done, total });
  return (
    <BottomModal
      pressable={
        // Bright while claimable (something to do), softer otherwise —
        // never dimmed so low it reads as broken: the tap always works.
        <Text style={{ fontSize: 30, opacity: claimable ? 1 : 0.75 }}>📜</Text>
      }
      accessibilityLabel={label}
      testID="weekly-contract-button"
      sheetTestID="weekly-contract-sheet"
    >
      <View style={{ gap: 10, padding: 12 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ ...styles.text, fontWeight: "bold", fontSize: 14 }}>
            {t("weekly.title")}
          </Text>
          <Text
            style={{
              ...styles.text,
              fontSize: 12,
              color: claimable ? "#ffd28a" : "#bbb",
            }}
          >
            {status}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {t("weekly.resetNote")}
          </Text>
        </View>
        {/* Per-task progress: same row + bar visual language as the
          goals view (GoalsPanel) so the two trackers read alike. */}
        {progress.map((p) => (
          <View key={p.goal.id} style={{ gap: 1 }}>
            <Text style={{ ...styles.text, fontSize: 11 }}>
              {p.done ? "✅" : "▶"} {p.goal.label} —{" "}
              {formatNumber(p.current >= p.target ? p.target : p.current)}/
              {formatNumber(p.target)}
            </Text>
            <View
              style={{
                height: 5,
                backgroundColor: "#1f1f1f",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 5,
                  width: `${Math.min(
                    100,
                    Math.round((p.current / p.target) * 100),
                  )}%`,
                  backgroundColor: p.done ? "#8fbf8f" : "#ffaa44",
                }}
              />
            </View>
          </View>
        ))}
        {claimable ? (
          <Button
            title={t("weekly.claim", { bonus: formatNumber(bonus) })}
            onPress={onClaim}
            testId="weekly-claim-button"
          />
        ) : (
          // No tasks to do right now: say so instead of a dead button
          // (the in-progress rows above already show what's left).
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {status}
          </Text>
        )}
      </View>
    </BottomModal>
  );
});

export default WeeklyContractButton;

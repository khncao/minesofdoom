import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import BottomModal from "apps/components/BottomModal";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import {
  GOAL_TIERS,
  getCompletedTierIds,
  getGoalProgress,
  isGoalComplete,
} from "../goals";
import { ACHIEVEMENTS, isAchievementComplete } from "../achievements";
import { SaveData } from "../game";
import { styles } from "../styles";

/**
 * The "Goals" view (plan §4.6): every tier is listed with per-goal progress
 * bars so players can see what's coming, and each completed tier shows what
 * it unlocked. Below the tiers, the achievements badge list (plan §4.1):
 * one-off bonuses, no gates. Completion is derived live from lifetime
 * stats; the save only records which bonuses already fired.
 */
const GoalsContent = memo(function GoalsContent({
  stats,
}: {
  stats: SaveData;
}) {
  const completed = getCompletedTierIds(stats);
  const activeIndex = completed.length; // first uncompleted tier

  return (
    <View style={{ gap: 14, padding: 12 }}>
      {GOAL_TIERS.map((tier, i) => {
        const done = completed.includes(tier.id);
        const active = i === activeIndex;
        return (
          <View key={tier.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Text style={{ fontSize: 14 }}>
                {done ? "✅" : active ? "▶" : "🔒"}
              </Text>
              <Text
                style={{
                  ...styles.text,
                  fontWeight: "bold",
                  opacity: done ? 0.6 : 1,
                }}
              >
                {tier.name}
              </Text>
            </View>
            <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
              Unlocks: {tier.unlock} · Bonus:{" "}
              {formatNumber(tier.bonusMinerals)} {emojis.mineral}
            </Text>
            {tier.goals.map((goal) => {
              const progress = getGoalProgress(stats, goal);
              const goalDone = isGoalComplete(stats, goal);
              return (
                <View key={goal.id} style={{ gap: 1, marginLeft: 22 }}>
                  <Text style={{ ...styles.text, fontSize: 11 }}>
                    {goal.label} —{" "}
                    {formatNumber(Math.min(progress.current, progress.target))}
                    /{formatNumber(progress.target)}
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
                        width: `${Math.round(progress.fraction * 100)}%`,
                        backgroundColor: goalDone ? "#8fbf8f" : "#ffaa44",
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      <Text style={{ ...styles.text, fontWeight: "bold", fontSize: 14, marginTop: 4 }}>
        🏅 Achievements
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        One-off bonuses — no unlocks, just confetti.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {ACHIEVEMENTS.map((a) => {
          const done = isAchievementComplete(stats, a);
          const current = stats[a.metric];
          return (
            <View
              key={a.id}
              style={{
                width: "48%",
                gap: 2,
                paddingVertical: 6,
                paddingHorizontal: 8,
                backgroundColor: "#1f1f1f",
                borderRadius: 6,
                opacity: done ? 1 : 0.55,
              }}
            >
              <Text style={{ fontSize: 12 }}>
                {done ? "✅" : a.icon} {a.label}
              </Text>
              <Text style={{ fontSize: 10, color: "#aaa" }}>
                {formatNumber(Math.min(current, a.target))}/
                {formatNumber(a.target)} · +{formatNumber(a.bonusMinerals)}{" "}
                {emojis.mineral}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const GoalsPanel = memo(function GoalsPanel({ stats }: { stats: SaveData }) {
  // Stable element so the memoized BottomModal can skip re-rendering when
  // only unrelated state changed (mirrors the SettingsPanel pattern).
  const goalsChildren = useMemo(() => <GoalsContent stats={stats} />, [stats]);

  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>🎯</Text>}
      accessibilityLabel="Goals"
      scrollable
    >
      {goalsChildren}
    </BottomModal>
  );
});

export default GoalsPanel;

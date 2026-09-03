import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { emojis } from "src/utils/graphics/emojis";
import { useContent, useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import { shareText } from "../share";
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
 * The "Goals" view (plan §4.6), rendered inside the footer menu sheet
 * (MenuPanel): every tier is listed with per-goal progress
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
  const t = useT();
  const content = useContent();
  const completed = getCompletedTierIds(stats);
  const activeIndex = completed.length; // first uncompleted tier

  return (
    <View style={{ gap: 14, padding: 12 }}>
      {GOAL_TIERS.map((tier, i) => {
        const done = completed.includes(tier.id);
        const active = i === activeIndex;
        const tierText = content("goalTier", tier.id, {
          title: tier.name,
          detail: tier.unlock,
        });
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
                {tierText.title}
              </Text>
            </View>
            <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
              {t("goals.unlocks", {
                unlock: tierText.detail ?? tier.unlock,
                bonus: formatNumber(tier.bonusMinerals),
              })}
            </Text>
            {tier.goals.map((goal) => {
              const progress = getGoalProgress(stats, goal);
              const goalDone = isGoalComplete(stats, goal);
              return (
                <View key={goal.id} style={{ gap: 1, marginLeft: 22 }}>
                  <Text style={{ ...styles.text, fontSize: 11 }}>
                    {content("goal", goal.id, { title: goal.label }).title} —{" "}
                    {formatNumber(
                      progress.current >= progress.target
                        ? progress.target
                        : progress.current,
                    )}
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
        {t("goals.achievements")}
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        {t("goals.achievementsNote")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {ACHIEVEMENTS.map((a) => {
          const done = isAchievementComplete(stats, a);
          const current = stats[a.metric];
          const title = content("achievement", a.id, { title: a.label }).title;
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
                {done ? "✅" : a.icon} {title}
              </Text>
              <Text style={{ fontSize: 10, color: "#aaa" }}>
                {formatNumber(
                  current >= a.target ? a.target : current,
                )}/
                {formatNumber(a.target)} · +{formatNumber(a.bonusMinerals)}{" "}
                {emojis.mineral}
              </Text>
              {/* Share action (docs/store-integration-plan.md §Achievements):
                  a plain-text string via the platform share sheet, no
                  backend. Only on COMPLETED rows — sharing an unearned
                  badge would be a lie. */}
              {done && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.shareAchievement", {
                    name: title,
                  })}
                  onPress={() => {
                    void shareText(
                      t("share.achievement", { name: title }),
                    );
                  }}
                  hitSlop={8}
                  style={{ alignSelf: "flex-end", padding: 4 }}
                >
                  <Text style={{ fontSize: 11 }}>📤</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default GoalsContent;

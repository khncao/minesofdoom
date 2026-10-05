import { memo } from "react";
import { View } from "react-native";
import BottomModal, { NAV_ICON_SIZE } from "src/components/BottomModal";
import Button from "src/components/Button";
import { T as Text } from "../textScale";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import type { DailyQuestProgress } from "../dailyQuests";
import type { WeeklyGoalProgress } from "../weeklyChallenge";
import { styles } from "../styles";

/** One progress row + bar, shared by both halves of the sheet. */
function GoalRow({
  done,
  claimed,
  label,
  current,
  target,
  note,
  action,
}: {
  done: boolean;
  /** A paid-out daily quest reads as spent rather than merely done. */
  claimed?: boolean;
  label: string;
  current: number;
  target: number;
  /**
   * The reward this task pays, stated on the row itself (todo: "Add notes
   * showing rewards for daily/weekly tasks"). Previously the payout only
   * appeared once the task was already finished — the claim button
   * appearing was the first sign of what it was worth, which makes a
   * reward the thing you learn about after earning it.
   */
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 1 }}>
      <Text style={{ ...styles.text, fontSize: 11 }}>
        {claimed ? "✅" : done ? "◼" : "▶"} {label} —{" "}
        {formatNumber(current >= target ? target : current)}/
        {formatNumber(target)}
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
            width: `${Math.min(100, Math.round((current / target) * 100))}%`,
            backgroundColor: done ? "#8fbf8f" : "#ffaa44",
          }}
        />
      </View>
      {note ? (
        <Text style={{ ...styles.text, fontSize: 10, color: "#c9a227" }}>
          {note}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

/**
 * The quest log (todo: "Add daily quests"): the 📜 button in the top menu
 * row opens ONE sheet with both cadences — today's three quests on top,
 * the weekly contract below.
 *
 * The daily half did NOT get its own navbar button on purpose. The row is
 * padding-bound and already sits at its 360px budget with seven icons (see
 * BottomModal.NAV_ICON_SIZE); an eighth glyph would have meant shrinking
 * every icon in the strip below ~18px to fit. Sharing the 📜 button keeps
 * the strip intact and puts the two kinds of quest — which the player
 * thinks of as one thing — in one place, with one reset note each.
 *
 * Both halves reward gems (todo: "daily quests and weekly quests should
 * reward gems (1 gem for daily quests, 10 for weekly)"), which is the
 * second reason the two live together: the sheet is where "what am I owed
 * today" is answered.
 *
 * The icon is ALWAYS tappable (todo: "weekly contract should always be
 * clickable and status is known"): the tap opens the sheet, which states
 * every status in words (in progress / claimable / already claimed — i.e.
 * "nothing left today" is a known, named state, not a dimmed dead icon).
 * Claims happen inside the sheet, so the same surface both shows and acts
 * on the status. The honest reset notes (real midnight / Monday
 * boundaries, no fake urgency) stay with their sections.
 */
const QuestLogButton = memo(function QuestLogButton({
  dailyQuests,
  dailyDoneCount,
  dailyTotal,
  dailyClaimable,
  dailyGems,
  onClaimQuest,
  weeklyProgress,
  weeklyClaimable,
  weeklyClaimed,
  weeklyBonus,
  weeklyGemBonus,
  onClaimWeekly,
}: {
  dailyQuests: DailyQuestProgress[];
  dailyDoneCount: number;
  dailyTotal: number;
  dailyClaimable: number;
  dailyGems: number;
  onClaimQuest: (questId: string) => void;
  weeklyProgress: WeeklyGoalProgress[];
  weeklyClaimable: boolean;
  weeklyClaimed: boolean;
  weeklyBonus: number;
  weeklyGemBonus: number;
  onClaimWeekly: () => void;
}) {
  const t = useT();
  const anythingClaimable = weeklyClaimable || dailyClaimable > 0;
  const label = anythingClaimable
    ? t("a11y.weeklyClaimable", {
        bonus: formatNumber(weeklyBonus),
        gems: weeklyGemBonus,
      })
    : weeklyClaimed
      ? t("a11y.weeklyClaimed")
      : t("a11y.weeklyProgress", {
          done: dailyDoneCount,
          total: dailyTotal,
        });
  const weeklyStatus = weeklyClaimable
    ? t("weekly.statusClaimable")
    : weeklyClaimed
      ? t("weekly.statusClaimed")
      : t("weekly.statusInProgress", {
          done: weeklyProgress.filter((p) => p.done).length,
          total: weeklyProgress.length,
        });

  return (
    <BottomModal
      pressable={
        // Bright while something is claimable, softer otherwise — never
        // dimmed so low it reads as broken: the tap always works.
        <Text style={{ fontSize: NAV_ICON_SIZE, opacity: anythingClaimable ? 1 : 0.75 }}>
          📜
        </Text>
      }
      accessibilityLabel={label}
      testID="quest-log-button"
      sheetTestID="quest-log-sheet"
      // Two sections now (three daily rows + three weekly rows, each with
      // a bar and a claim button). On a short screen that is taller than a
      // content-sized sheet, so it scrolls rather than overflowing.
      scrollable
    >
      <View style={{ gap: 10, padding: 12 }}>
        {/* Today's three quests. Each is claimed on its OWN row rather than
            as one "claim all": the per-quest claim is what makes a gem
            feel earned, and it means a player who finishes two of three is
            not asked to wait for the third. */}
        <View style={{ gap: 6 }}>
          <Text style={{ ...styles.text, fontWeight: "bold", fontSize: 14 }}>
            {t("quest.logTitle")}
          </Text>
          <Text
            style={{
              ...styles.text,
              fontSize: 12,
              color: dailyClaimable > 0 ? "#ffd28a" : "#bbb",
            }}
          >
            {t("quest.dailyTitle")}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {dailyClaimable > 0
              ? t("quest.dailyStatus", {
                  done: dailyDoneCount,
                  total: dailyTotal,
                  claimable: dailyClaimable,
                })
              : t("quest.dailyDone")}
          </Text>
          {dailyQuests.map((q) => (
            <GoalRow
              key={q.quest.id}
              done={q.done}
              claimed={q.done && !q.claimable}
              label={t(q.quest.label)}
              current={q.current}
              target={q.target}
              // The per-quest payout, on the row from the start (todo:
              // "Add notes showing rewards for daily/weekly tasks").
              note={t("quest.rewardNote", { gems: dailyGems })}
              action={
                q.claimable ? (
                  <Button
                    title={t("quest.claim", { gems: dailyGems })}
                    onPress={() => onClaimQuest(q.quest.id)}
                    testId={`quest-claim-${q.quest.id}`}
                    tone="gem"
                  />
                ) : null
              }
            />
          ))}
          <Text style={{ ...styles.text, fontSize: 11, color: "#999" }}>
            {t("quest.dailyResetNote")}
          </Text>
        </View>

        {/* The weekly contract: same row + bar visual language, its own
            cadence, and its own claim (minerals + gems in one go). */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              ...styles.text,
              fontSize: 12,
              color: weeklyClaimable ? "#ffd28a" : "#bbb",
            }}
          >
            {t("weekly.title")}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {weeklyStatus}
          </Text>
          {/* The contract pays ONCE for all of its tasks, so the reward is
              one note for the whole section rather than a figure repeated
              on each row (three quoted payouts would read as 3× the
              reward). */}
          <Text
            style={{ ...styles.text, fontSize: 11, color: "#c9a227" }}
            testID="weekly-reward-note"
          >
            {t("weekly.rewardNote", {
              total: weeklyProgress.length,
              bonus: formatNumber(weeklyBonus),
              gems: weeklyGemBonus,
            })}
          </Text>
          {weeklyProgress.map((p) => (
            <GoalRow
              key={p.goal.id}
              done={p.done}
              label={t(p.goal.label)}
              current={p.current}
              target={p.target}
            />
          ))}
          <Text style={{ ...styles.text, fontSize: 11, color: "#999" }}>
            {t("weekly.resetNote")}
          </Text>
          {weeklyClaimable ? (
            <Button
              title={t("weekly.claim", {
                bonus: formatNumber(weeklyBonus),
                gems: weeklyGemBonus,
              })}
              onPress={onClaimWeekly}
              testId="weekly-claim-button"
            />
          ) : null}
        </View>
      </View>
    </BottomModal>
  );
});

export default QuestLogButton;
import { memo } from "react";
import { Text, View } from "react-native";
import Button from "src/components/Button";
import { useT } from "src/hooks/useI18n";
import { AnalyticsState, summarizeAnalytics } from "../analytics";
import { formatCrashContext } from "../crashContext";
import { useCrashLog } from "../hooks/useCrashLog";
import InquiriesButton from "./InquiriesButton";
import LegalSection from "./LegalSection";
import { styles } from "../styles";

/**
 * Menu "About" tab (todo: "reorganize menus with clean reimplementation"):
 * the rarely-opened tail of the old settings scroll — legal notices,
 * the inquiries link, and the two debug sections (analytics + crash
 * log) — gathered in one place so the gameplay settings stay short.
 */
const AboutTab = memo(function AboutTab({
  analytics,
  onClearAnalytics,
}: {
  /** Guardrail 6: the local analytics record for the debug section
   *  (single owner is MinesOfDoom's useAnalytics; read-through only). */
  analytics: AnalyticsState | null;
  /** Data-deletion path for the analytics record. */
  onClearAnalytics: () => void;
}) {
  return (
    <View style={{ gap: 2, marginTop: 5 }} testID="about-view">
      {/* Essential legal notices (todo): privacy policy + terms/disclaimer,
          in-app links. */}
      <LegalSection />
      {/* Mailing link (todo): a rarely-used action, kept one tap away
          of the menu but out of the gameplay settings. */}
      <View style={styles.flexCenteredRow}>
        <InquiriesButton />
      </View>
      <AnalyticsSection analytics={analytics} onClear={onClearAnalytics} />
      <CrashLogSection />
    </View>
  );
});

/**
 * Debug section (guardrail 5 "measure before scaling"): the local
 * analytics record as a selectable, copyable summary — the measurement
 * the UA-spend decision is based on, readable without pulling the app off
 * the device. Rendered only while a record is loaded (the hook is the
 * single writer, so there's no second storage reader to race it); after
 * a Clear the section hides and a fresh record is established next open.
 */
function AnalyticsSection({
  analytics,
  onClear,
}: {
  analytics: AnalyticsState | null;
  onClear: () => void;
}) {
  const t = useT();
  if (analytics == null) return null;
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          {t("settings.analytics")}
        </Text>
        <Button title={t("settings.clear")} onPress={onClear} />
      </View>
      <Text
        selectable
        style={{ color: "#d6c48f", fontSize: 11, lineHeight: 15 }}
      >
        {summarizeAnalytics(analytics)}
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
        {t("settings.analyticsNote")}
      </Text>
    </View>
  );
}

/**
 * Debug section (plan "Adjust"): the persisted crash log from
 * crashLogging.ts. Rendered only when at least one crash has been
 * recorded, so players who never crash never see it. The stack text is
 * selectable so a full trace can be copied off-device — the whole point
 * while chasing the unreproducible Android `describe` crash (release
 * builds have no red box).
 */
function CrashLogSection() {
  const { entries, clear } = useCrashLog();
  const t = useT();
  if (entries == null || entries.length === 0) return null;
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          {t("settings.crash")}
        </Text>
        <Button title={t("settings.clear")} onPress={clear} />
      </View>
      {entries.slice(0, 3).map((entry, i) => {
        const contextText = formatCrashContext(entry.context);
        return (
          <View
            key={i}
            style={{
              backgroundColor: "#1f1f1f",
              borderRadius: 6,
              borderWidth: 1,
              borderColor: "#444",
              paddingHorizontal: 10,
              paddingVertical: 6,
              gap: 2,
            }}
          >
            <Text
              selectable
              style={{ ...styles.text, fontSize: 12 }}
            >
              {entry.name}: {entry.message}
              {entry.source === "global" ? " (global)" : ""}
              {entry.count > 1 ? ` (×${entry.count})` : ""}
            </Text>
            <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
              {new Date(entry.ts).toLocaleString()}
            </Text>
            {entry.stack.length > 0 && (
              <Text
                selectable
                style={{ color: "#9fd69f", fontSize: 11, lineHeight: 15 }}
              >
                {entry.stack}
              </Text>
            )}
            {contextText.length > 0 && (
              <Text
                selectable
                style={{ color: "#d6c48f", fontSize: 11, lineHeight: 15 }}
              >
                {contextText}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default AboutTab;

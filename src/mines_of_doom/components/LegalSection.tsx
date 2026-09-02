import { memo } from "react";
import { Text, View } from "react-native";
import BottomModal from "src/components/BottomModal";
import { useContent, useI18n } from "src/hooks/useI18n";
import { LEGAL_DOCS, type LegalDoc } from "../legal";
import { styles } from "../styles";

/**
 * Legal notices (todo: "privacy policy, disclaimer and other essential
 * legal notices with links at the bottom of settings"). Rendered at the
 * very bottom of the settings sheet: a heading and one link per document.
 * Each link IS a BottomModal trigger, so tapping it slides up a scrollable
 * modal with the full text — in-app, works on web and native alike, and
 * needs no external hosting (the web build is a static export).
 *
 * Memoized like the other settings sections: the links/contents depend
 * only on the static legal.ts data, so this never re-renders on game ticks.
 */
const LegalSection = memo(function LegalSection() {
  const { t } = useI18n();
  const content = useContent();
  return (
    <View style={{ gap: 4, marginTop: 10 }}>
      <Text style={{ ...styles.text, fontWeight: "bold" }}>
        {t("legal.heading")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {LEGAL_DOCS.map((doc) => {
          const text = content("legalDoc", doc.id, { title: doc.title });
          return (
            <BottomModal
              key={doc.id}
              pressable={
                <Text
                  accessibilityRole="link"
                  style={{ ...styles.text, color: "#8ec5ff" }}
                >
                  {text.title}
                </Text>
              }
              accessibilityLabel={text.title}
              scrollable
            >
              <LegalDocContent doc={doc} />
            </BottomModal>
          );
        })}
      </View>
    </View>
  );
});

function LegalDocContent({ doc }: { doc: LegalDoc }) {
  const content = useContent();
  const docText = content("legalDoc", doc.id, { title: doc.title });
  return (
    <View style={{ gap: 10, paddingHorizontal: 2, paddingTop: 4 }}>
      <Text style={{ ...styles.text, fontSize: 16, fontWeight: "bold" }}>
        {docText.title}
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        {useI18n().t("legal.meta", {
          version: doc.version,
          date: doc.effectiveDate,
        })}
      </Text>
      {doc.sections.map((section) => {
        const sectionText = content("legalSection", `${doc.id}:${section.heading}`, {
          title: section.heading,
          body: section.body,
        });
        return (
          <View key={section.heading} style={{ gap: 2 }}>
            <Text style={{ ...styles.text, fontWeight: "bold" }}>
              {sectionText.title}
            </Text>
            <Text
              selectable
              style={{
                ...styles.text,
                fontSize: 12,
                color: "#ddd",
                lineHeight: 18,
              }}
            >
              {sectionText.body ?? section.body}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default LegalSection;

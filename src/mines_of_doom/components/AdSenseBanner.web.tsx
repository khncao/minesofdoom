/**
 * AdSense display banner (docs/todo.md #2) — WEB variant.
 *
 * Placement rules (kid-safe guardrail, non-negotiable): the banner lives
 * INSIDE the shop sheet (IapPanel) — a player-invoked overlay. It never
 * renders over the game canvas or during play, and it is the only
 * display slot in the app (guardrail 2: rewarded ads for the in-game
 * rewards stay the only in-play ads; this is the web monetization slot).
 * It is labeled (transparency guardrail 4).
 *
 * Gating (same "empty config = hidden no-op" pattern as everything else):
 * `isAdSenseConfigured()` must pass (ca-pub- client + slot id in
 * storeConfig.ts). While the config is empty the +html.tsx loader script
 * is not emitted at all, so there is zero ad-network traffic until the
 * ids land.
 *
 * DOM: the loader script (pagead js) is injected by +html.tsx from the
 * same storeConfig values. This component emits the raw
 * `<ins class="adsbygoogle">` unit through react-native-web's
 * `unstable_createElement` escape hatch (the supported way to render an
 * arbitrary DOM element from RN web) and pushes the unit onto
 * `window.adsbygoogle` so AdSense renders it. The pagead loader is async,
 * so if it hasn't landed yet the push retries briefly; the loader's own
 * initial DOM scan is the fallback that catches the unit either way.
 */
import { useEffect } from "react";
import { unstable_createElement } from "react-native-web";
import { Text, View } from "react-native";
import { useI18n } from "src/hooks/useI18n";
import { storeConfig, isAdSenseConfigured } from "../storeConfig";
import { styles } from "../styles";

declare global {
  interface Window {
    /** Pushed onto by the pagead loader; each push renders one unit. */
    adsbygoogle?: unknown[];
  }
}

/** Push this unit onto the AdSense queue. True once the loader is up. */
function pushAdUnit(): boolean {
  const w = (globalThis as { window?: Window }).window;
  const queue = w?.adsbygoogle;
  if (Array.isArray(queue)) {
    queue.push({});
    return true;
  }
  return false;
}

export default function AdSenseBanner() {
  const { t } = useI18n();
  const enabled = isAdSenseConfigured();

  useEffect(() => {
    if (!enabled) return;
    // The unit is a raw DOM node mounted below; pushing tells AdSense to
    // render it. If the async loader script hasn't arrived yet, retry at
    // 250ms intervals (bounded) — the loader's initial DOM scan will
    // also pick the unit up when it boots, as a fallback.
    if (pushAdUnit()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (pushAdUnit() || tries >= 20) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [enabled]);

  if (!enabled) return null;

  const adUnit = unstable_createElement("ins", {
    className: "adsbygoogle",
    style: { display: "block" },
    "data-ad-client": storeConfig.adsense.client,
    "data-ad-slot": storeConfig.adsense.slot,
    "data-ad-format": "horizontal",
    "data-full-width-responsive": "true",
  });

  return (
    <View style={{ gap: 2 }}>
      <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
        {t("iap.adLabel")}
      </Text>
      <View>{adUnit}</View>
    </View>
  );
}

/**
 * Legal notices (todo: "privacy policy, disclaimer and other essential
 * legal notices with links at the bottom of settings").
 *
 * Pure data module: the documents are plain strings with no framework
 * dependency, so they render identically on web and native, stay testable,
 * and need no external hosting (the web build is a static export, and
 * pointing players at a live URL would break offline/static use and add
 * another domain to keep in sync). The UI (LegalSection) opens each doc in
 * an in-app scrollable modal from a link at the bottom of Settings.
 *
 * The text below is written to match the app's ACTUAL behavior — that is
 * the whole point of a privacy policy. Keep it in sync when behavior
 * changes:
 *  - data storage: the AsyncStorage keys in game.ts / useLocalStorage,
 *    analytics.ts and crashLogging.ts (Settings → "Local stats (debug)"
 *    and "Recent errors (debug)" show + clear them);
 *  - ads: ads.ts (no ad SDK is bundled today; entry points are hidden
 *    until a real provider ships — if one does, update the ad paragraph);
 *  - purchases: iaps.ts (processed by the app store; only the entitlement
 *    reaches this app);
 *  - contact: the same address as InquiriesButton.
 */

export const LEGAL_CONTACT_EMAIL = "minus4kelvin@gmail.com";

export type LegalDocId = "privacy" | "terms";

export type LegalDoc = {
  id: LegalDocId;
  title: string;
  version: string;
  effectiveDate: string;
  sections: { heading: string; body: string }[];
};

const PRIVACY_POLICY: LegalDoc = {
  id: "privacy",
  title: "Privacy Policy",
  version: "1.0",
  effectiveDate: "2026-09-02",
  sections: [
    {
      heading: "Short version",
      body:
        "Mines of Doom does not collect personal information. Your game data is stored on your device only, nothing is sent over the network, and there is no account system. This policy spells that out and covers the few edges (in-app purchases, and rewarded ads if they become available on your platform).",
    },
    {
      heading: "What we store, and where",
      body:
        "Everything the game keeps lives in private local storage on your device (Android/iOS: the app's private storage via AsyncStorage; web: your browser's local storage for this site). It includes:\n\n• Your save data (minerals, upgrades, cosmetics, goals, achievements, settings).\n• A small local stats record (when you first opened the app, active days, first ad view, purchase count, prestige count). It is used only for our own development decisions, is readable on-device in Settings → “Local stats (debug)”, and can be deleted there at any time.\n• A short crash log (recent error messages only, never your save data or anything personal), shown and clearable in Settings → “Recent errors (debug)”.\n• Timestamps for the daily bonus and ad reward limits.\n\nNone of this data ever leaves your device. You can also delete everything at once with Settings → Reset.",
    },
    {
      heading: "What we do NOT collect",
      body:
        "No name, email address, or other personal information. No device identifiers. No third-party analytics SDK. No network transmission of any kind. There is no account, no login, and no way for us to identify you or link your game data to you.\n\nThe “Save code” feature (Settings → Save code) produces a code containing your save data. Sharing that code shares your progress — do not share it with people you do not trust. We never ask for it.",
    },
    {
      heading: "In-app purchases",
      body:
        "Optional in-app purchases (cosmetic packs and Remove Ads) are processed by the app store you installed the game from (Google Play or the Apple App Store). Payment details are handled by the store, not by us — we only ever learn that a purchase succeeded, so the game can grant the item. The web version of the game is 100% free and does not offer any purchases.",
    },
    {
      heading: "Advertising",
      body:
        "The web version of the game contains no advertising at all.\n\nMobile versions may offer strictly optional, player-initiated rewarded video ads (you tap “watch” yourself, and you only receive the in-game reward if you finish the video; there are no other ad formats). If a rewarded ad provider is active on your platform, it may process the data its own privacy policy describes in order to serve those videos; we do not pass it any personal information about you, and no ad ever affects gameplay outside the reward you explicitly asked for. Ad settings and opt-out are handled through the store/platform ad controls. We are an independent developer and are not affiliated with Google, Apple, or any ad network.",
    },
    {
      heading: "Children",
      body:
        "The game is intended for all ages and contains no chat, no external links, and no user-generated content. Consistent with that, advertising (where present) is configured for child-directed treatment and rewards only in-game items — never real-world goods.",
    },
    {
      heading: "Changes to this policy",
      body: "Material changes will be noted here with a new version and date.",
    },
    {
      heading: "Contact",
      body: `Questions, or requests to delete your data (beyond the in-app Clear/Reset controls), can be sent to ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};

const TERMS_OF_USE: LegalDoc = {
  id: "terms",
  title: "Terms of Use & Disclaimer",
  version: "1.0",
  effectiveDate: "2026-09-02",
  sections: [
    {
      heading: "The game",
      body:
        "Mines of Doom (“the game”) is a free-to-play idle mining game. “Free to play” means you can reach the full game and all end-game content without spending money; some cosmetic items can also be bought with real money, and everything buyable can also be earned in-game.",
    },
    {
      heading: "Virtual goods",
      body:
        "Minerals, gems, and all other in-game items are virtual only. They have no real-world value, cannot be exchanged for money or goods, and cannot be transferred between players except by the in-app save-code feature, which you use at your own risk (importing a code replaces your current save).",
    },
    {
      heading: "In-app purchases",
      body:
        "Purchases are charged to your app-store account and are subject to the store's own terms and refund policy. Purchased items are delivered to the account on the device you bought them on, and a purchase of “Remove Ads” or a cosmetic pack is final once the item has been delivered or used. By purchasing you confirm you agree to the app store's terms of service.",
    },
    {
      heading: "Your save data",
      body:
        "Your progress is stored on your device (see the Privacy Policy). Clearing the app's local data, reinstalling, or using Settings → Reset will permanently erase your progress. The save-code feature is provided as a backup/sharing aid; we do not keep a copy of your save and cannot restore one if it is lost.",
    },
    {
      heading: "No affiliation",
      body:
        "The game is an independent product. It is not affiliated with, endorsed by, or sponsored by Apple Inc., Google LLC, or any advertising network. “Apple”, the Apple logo, “iPhone”, “iOS”, and “App Store” are trademarks of Apple Inc.; “Google Play” and “Android” are trademarks of Google LLC. All trademarks are the property of their respective owners.",
    },
    {
      heading: "Disclaimer",
      body:
        "The game is provided “as is” without warranty of any kind, express or implied, including but not limited to fitness for a particular purpose, merchantability, and non-infringement. We make no guarantee that the game will be uninterrupted, error-free, or available at any particular time. To the maximum extent permitted by law, we are not liable for any loss of progress, virtual items, or other damages arising from use of the game.",
    },
    {
      heading: "Changes",
      body: "We may update the game and these terms over time; material changes will be noted with a new version and date.",
    },
    {
      heading: "Contact",
      body: `Questions about these terms can be sent to ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [PRIVACY_POLICY, TERMS_OF_USE];

export function getLegalDoc(id: LegalDocId): LegalDoc {
  const doc = LEGAL_DOCS.find((d) => d.id === id);
  if (doc == null) throw new Error(`Unknown legal doc: ${id}`);
  return doc;
}

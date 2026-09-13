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
 * changes (v2.0, 2026-09-06, rewrote the policy for accounts/cloud/
 * Stripe/AdSense, which v1.0 — written before any of that shipped —
 * correctly said did not exist; v2.1, 2026-09-16, fixed the "Children"
 * section to match the S6 decision — teen+ (13+), NOT child-directed,
 * tagForChildDirectedTreatment: false — see legal.test.ts; v2.2,
 * 2026-09-17, added the in-app account-deletion flow (Account tab →
 * "Delete account", the same GDPR erasure the Save tab's "delete my
 * data" runs when signed in) and the published account-deletion.html
 * page that the Play listing's account-deletion field links to):
 *  - The "Children" section's age position must stay in sync with
 *    storeConfig.adMob.tagForChildDirectedTreatment (F45.1 net);
 *  - local data: the AsyncStorage keys in game.ts / useLocalStorage and
 *    crashLog.ts (Settings → "Local stats (debug)" and "Recent errors
 *    (debug)" show + clear them);
 *  - accounts + cloud: auth.ts, cloudSave.ts, leaderboard.ts (single
 *    developer server, Pocketbase — see pb_hooks/README.md);
 *  - ads: ads.ts, adProvider*.ts + adSenseProvider*.ts (native: AdMob
 *    rewarded only; web: AdSense Ad Placement API rewarded ads — update
 *    the ad paragraph if that changes);
 *  - purchases: iaps.ts + iapProvider*.ts (native: store IAP; web:
 *    Stripe Checkout — card data never reaches this app);
 *  - the published HTML versions (public/privacy-policy.html,
 *    public/terms-of-use.html, public/account-deletion.html) are
 *    GENERATED from this file by __test__/legalDocs.test.ts — edit here
 *    only, then run the tests.
 *  - contact: the same address as InquiriesButton.
 */

export const LEGAL_CONTACT_EMAIL = "minus4kelvin@gmail.com";

export type LegalDocId = "privacy" | "terms" | "deletion";

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
  version: "2.2",
  effectiveDate: "2026-09-17",
  sections: [
    {
      heading: "Short version",
      body: "Mines of Idle Doomath is a free idle game. By default, your progress lives only on your device — no account is required. If you choose to create an account, your progress is backed up to the developer's server so you can restore it on another device, and you can (optionally, under a display name you choose) post scores to the leaderboard. Advertising is minimal by design: on both mobile and the web, only full-screen ads that you start yourself (rewarded) — you tap “watch”, you finish the ad, you get the in-game reward. We do not build advertising profiles from your game data, we do not share your data with anyone, and we do not sell it.",
    },
    {
      heading: "What we store on your device",
      body: "Everything the game keeps locally lives in private storage on your device (Android/iOS: the app's private storage via AsyncStorage; web: your browser's local storage for this site). It includes:\n\n• Your save data (minerals, upgrades, cosmetics, goals, achievements, settings).\n• A small local stats record (when you first opened the app, active days, first ad view, purchase count, prestige count). It is used only for our own development decisions, is readable on-device in Settings → “Local stats (debug)”, and can be deleted there at any time.\n• A short crash log (recent error messages only, never your save data or anything personal), shown and clearable in Settings → “Recent errors (debug)”.\n• If you have an account: a local session token for that account (your password itself is never stored on the device).\n• If you opted into ads: the platform's advertising identifier (Google Play Services advertising ID on Android; the App Tracking Transparency prompt on iOS) is used by the ad network, not us, for its own purposes described in its policy.\n\nYou can delete any of it individually (the debug sections above, or Save → Reset for the game save), or delete ALL of it at once with Save → “Erase all data” — that erases everything the app stores on the device (save, settings, stats, error log, ad opt-in, account session) and cannot be undone; your cloud save, if you have one, is kept and can still be restored.",
    },
    {
      heading: "Accounts and cloud sync (optional)",
      body: "Creating an account is optional; the game is fully playable without one. If you sign up, the developer's server (minesofdoom.minus4kelvin.com — a single server operated by the developer) stores:\n\n• Your email address. Your password, if you set one, is stored only as a salted hash — we could never read it back, and neither could an attacker who stole the database.\n• If you sign in with Google or Apple: only the identifier that provider gives us. The sign-in token is verified directly by the provider; we never see or store your password or anything else from that account, and no game data is ever shared with the provider.\n• Your cloud save: a snapshot of your progress (the same data you can see in the game), pushed automatically every few minutes while you play, used to restore on a new device or after a factory reset.\n• Your leaderboard entries, if you submit any: your chosen display name (defaulting to a generic one — your email is never shown) and the score itself.\n\nAll of this is on the one server above. It is not processed by, stored on, or visible to, any third party.",
    },
    {
      heading: "What we do NOT collect",
      body: "No name (beyond a leaderboard display name you choose yourself), no location, no contacts, no third-party analytics SDK, no data brokers, no data sharing of any kind. Nothing in this game is used to build an advertising profile of you.\n\nThe “Save code” feature (Settings → Save code) produces a code containing your save data. Sharing that code shares your progress — do not share it with people you do not trust. We never ask for it.",
    },
    {
      heading: "In-app purchases",
      body: "Optional purchases (cosmetic packs) are processed by the platform you bought them on — Google Play or the Apple App Store on mobile, or Stripe Checkout in the web version. Payment details are handled by the store or by Stripe, not by us: we only ever learn that a purchase succeeded, so the game can grant the item, and we tie that fact to your device (and to your account, if you are signed in). No card or payment information ever reaches this app or the developer's server.",
    },
    {
      heading: "Advertising",
      body: "Mobile: strictly optional, player-initiated rewarded video ads (Google AdMob). You tap “watch” yourself, and you only receive the in-game reward if you finish the video; there are no interstitials and no banners. The rewarded ad rewards an in-game item (minerals), never a real-world product.\n\nWeb: likewise strictly optional, player-initiated rewarded ads (Google AdSense) — you tap “watch” yourself, and you only receive the in-game reward if you finish the ad. There are no interstitials and no banners anywhere.\n\nIf a rewarded ad provider is active, it may process the data its own privacy policy describes in order to serve those ads; we do not pass it any personal information about you, and no ad ever affects gameplay outside the reward you explicitly asked for. Ad settings and opt-out are handled through the store/platform ad controls, and simply not tapping “watch” disables mobile ads entirely. We are an independent developer and are not affiliated with Google, Apple, or any ad network.",
    },
    {
      heading: "Children",
      body: "The game is intended for a teen audience (13 and up) and is not directed at children. It contains no chat, no external links, and no user-generated content. Consistent with that, the game — including its advertising, where present — is not treated as a child-directed service, and the optional, player-initiated rewarded ads reward only in-game items — never real-world goods. We do not knowingly collect personal information from anyone under 13. If you believe a child under 13 has created an account, email us at the address below and we will delete it.",
    },
    {
      heading: "Deletion",
      body: "Local game data: Save → “Erase all data” (or Save → Reset for just the game save; the local stats and crash log can also be cleared individually in Settings). Account data (account, cloud save, leaderboard entries, purchases): delete it yourself with one tap in the app (menu → Account → “Delete account”) or follow the steps in our account deletion instructions at https://minesofdoom.minus4kelvin.com/account-deletion.html. You can also email us from the address you signed up with and it will be deleted, including the database and backups. Data that Google or Apple hold on your behalf is managed by their own settings and policies.",
    },
    {
      heading: "Changes to this policy",
      body: "Material changes will be noted here with a new version and date, and on the published web copy of this policy. Continued use of the game after a change means you accept the updated policy; if you disagree, delete your account data as described above.",
    },
    {
      heading: "Contact",
      body: `Questions, or requests to access or delete your data (beyond the in-app controls above), can be sent to ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};

const TERMS_OF_USE: LegalDoc = {
  id: "terms",
  title: "Terms of Use & Disclaimer",
  version: "2.0",
  effectiveDate: "2026-09-06",
  sections: [
    {
      heading: "The game",
      body: "Mines of Idle Doomath (“the game”) is a free-to-play idle mining game. “Free to play” means you can reach the full game and all end-game content without spending money; some cosmetic items can also be bought with real money, and everything buyable can also be earned in-game.",
    },
    {
      heading: "Virtual goods",
      body: "Minerals, gems, and all other in-game items are virtual only. They have no real-world value, cannot be exchanged for money or goods, and cannot be transferred between players except by the in-app save-code feature, which you use at your own risk (importing a code replaces your current save).",
    },
    {
      heading: "In-app purchases",
      body: "Purchases are charged to your app-store account (mobile) or your payment method at Stripe Checkout (web) and are subject to that platform's own terms and refund policy. Purchased items are delivered to the device you bought them on, and a purchase of a cosmetic pack is final once the item has been delivered or used. By purchasing you confirm you agree to the store's terms of service.",
    },
    {
      heading: "Your save data",
      body: "Your progress is stored on your device (see the Privacy Policy). Clearing the app's local data, reinstalling, or using Settings → Reset will erase it from that device. If you created an account, your progress is also kept in the developer's cloud save, which you can restore from on the same or another device; without an account, we do not keep a copy of your save and cannot restore one if it is lost. The save-code feature is provided as a backup/sharing aid and works the same way with or without an account.",
    },
    {
      heading: "No affiliation",
      body: "The game is an independent product. It is not affiliated with, endorsed by, or sponsored by Apple Inc., Google LLC, or any advertising network. “Apple”, the Apple logo, “iPhone”, “iOS”, and “App Store” are trademarks of Apple Inc.; “Google Play” and “Android” are trademarks of Google LLC. All trademarks are the property of their respective owners.",
    },
    {
      heading: "Disclaimer",
      body: "The game is provided “as is” without warranty of any kind, express or implied, including but not limited to fitness for a particular purpose, merchantability, and non-infringement. We make no guarantee that the game will be uninterrupted, error-free, or available at any particular time. To the maximum extent permitted by law, we are not liable for any loss of progress, virtual items, or other damages arising from use of the game.",
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

// Account-deletion instructions — the page the Play listing's
// "account deletion" field links to (published as
// public/account-deletion.html by __test__/legalDocs.test.ts). Play
// requires it to: refer to the app/developer name, feature the steps
// to request deletion, and say what is deleted vs kept + any retention
// period. The in-app flow is the prominent path; email is the
// no-device fallback (the sidecar's /api/app/delete is the single
// erasure both paths run — see pb_hooks/endpoints.js).
const ACCOUNT_DELETION: LegalDoc = {
  id: "deletion",
  title: "Account Deletion",
  version: "1.0",
  effectiveDate: "2026-09-17",
  sections: [
    {
      heading: "Delete your account from the app (fastest)",
      body: "The fastest way is from inside the app:\n\n1. Open Mines of Idle Doomath.\n2. Open the menu and go to the Account tab.\n3. If you are not signed in, sign in first (email, or the provider you registered with).\n4. Tap “Delete account” and confirm.\n\nYour account is deleted immediately and you are signed out on all of your devices. No email is needed.",
    },
    {
      heading: "Delete your account by email (no app needed)",
      body: `If you no longer have the app installed, email ${LEGAL_CONTACT_EMAIL} from the email address you signed up with, with “Account deletion” as the subject. To protect your data, we only act on a request that comes from the registered address. The account will be deleted within 30 days of the request.`,
    },
    {
      heading: "What is deleted",
      body: "Deleting your account permanently erases, from our server: the account and its sign-in credentials (email and password, and any linked Google or Apple identity); every cloud save linked to the account, on every device; your leaderboard entry; and the purchase records linked to the account, so they cannot be restored onto a new account. Every signed-in device is signed out.",
    },
    {
      heading: "What is kept, and for how long",
      body: "Data that exists only on your device (the local game save, settings, and local stats) is not affected by an account deletion — erase that separately in the app (Save → “Erase all data”).\n\nDeleted data is removed from the live database immediately. Our only other copies are routine nightly server backups, which are rotated and overwritten; we do not retain deleted data beyond 30 days and never use it for any purpose after deletion.\n\nIf you signed in with Google or Apple, the data those companies hold is managed by their own settings and policies. If you bought something through Google Play or the App Store, the store keeps its own transaction records for legal reasons that we cannot delete; we delete only our own copies.",
    },
    {
      heading: "Contact",
      body: `Questions, or help with a deletion request: ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [
  PRIVACY_POLICY,
  TERMS_OF_USE,
  ACCOUNT_DELETION,
];

export function getLegalDoc(id: LegalDocId): LegalDoc {
  const doc = LEGAL_DOCS.find((d) => d.id === id);
  if (doc == null) throw new Error(`Unknown legal doc: ${id}`);
  return doc;
}

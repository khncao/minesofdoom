/**
 * Web landing content for the static export (`src/app/+html.tsx`).
 *
 * Why this module exists: the game is a single client-rendered route, and
 * the static export's `<body>` only contains the app shell — everything the
 * player reads is painted by JavaScript after boot. A search crawler (or an
 * AdSense reviewer) looking at the served HTML therefore saw a page with no
 * text at all, which is the "insufficient content" rejection reason. This is
 * the copy that is rendered server-side into the document, below the game
 * canvas: real headings, sentences and lists that exist in the HTML source
 * and link to the static content pages under `public/`.
 *
 * Pure data (no framework imports), like `legal.ts`, so it can be rendered
 * by `+html.tsx` and asserted directly by
 * `__test__/siteContent.test.ts` (which also pins the nav links against the
 * files that actually ship in `public/` and against `public/sitemap.xml`).
 *
 * English-only by design: this is published web page copy, matching the
 * English-only pages under `public/` (about/privacy/terms/how-to-play/faq).
 * In-app player strings go through `src/utils/i18n` instead.
 */
import { LEGAL_CONTACT_EMAIL } from "./legal";

export type SiteNavLink = { label: string; href: string };

/**
 * The publisher of this game, shown in the footer of every published page.
 *
 * Deliberately NOT part of `SITE_NAV_LINKS`: the unit test pins every nav href
 * to a file that actually ships in `public/` and to an entry in
 * `public/sitemap.xml` under this site's own origin. An off-site link belongs
 * in the footer as publisher attribution instead — which is what Apple's
 * enrollment review wants anyway: evidence that the domain
 * `minus4kelvin.com` and the app that lives on this subdomain are the same
 * organization, stated in both directions.
 */
export const SITE_PUBLISHER = {
  name: "−4 Kelvin LLC",
  url: "https://minus4kelvin.com/",
  label: "Published by −4 Kelvin LLC",
} as const;

export type WebContentSection = {
  heading: string;
  paragraphs?: string[];
  /** Rendered as a numbered list after the paragraphs. */
  numbered?: string[];
  /** Rendered as a bulleted list after the paragraphs. */
  bullets?: string[];
};

export type WebFaqEntry = { question: string; answer: string };

/** The one contact address (single source: legal.ts). */
export const SITE_CONTACT_EMAIL = LEGAL_CONTACT_EMAIL;

/**
 * Site navigation, rendered in the footer of the game page (via `+html.tsx`)
 * and asserted against the files in `public/` by the unit test. Keep this in
 * sync with the hand-written footers on the `public/*.html` pages and with
 * `public/sitemap.xml`.
 */
export const SITE_NAV_LINKS: SiteNavLink[] = [
  { label: "Play the game", href: "/" },
  { label: "How to play", href: "/how-to-play.html" },
  { label: "FAQ", href: "/faq.html" },
  { label: "About", href: "/about.html" },
  { label: "Privacy Policy", href: "/privacy-policy.html" },
  { label: "Terms of Use", href: "/terms-of-use.html" },
  { label: "Account Deletion", href: "/account-deletion.html" },
];

export const WEB_LANDING_HEADING =
  "Mines of Idle Doomath — a free idle math mining game";

export const WEB_LANDING_INTRO: string[] = [
  "Mines of Idle Doomath is a free idle game about a tiny crew of miners working a very deep shaft. The idea is simple: the game shows you a short arithmetic equation, you type the answer, and every correct answer pays out minerals. Minerals buy upgrades and miners, miners keep digging while you are away, and when a run grows as far as it can you sink a new shaft for a permanent bonus. It runs in the browser on this site, and as an app on Android and iOS.",
  "It is built for short sessions and long ones alike. Answer a handful of equations on a coffee break and your crew keeps working after you close the tab; leave the game running and the shaft keeps producing on its own. Nothing is gated behind a purchase, and the only ads are optional, player-started rewarded videos that nobody has to watch.",
];

export const WEB_CONTENT_SECTIONS: WebContentSection[] = [
  {
    heading: "How to play",
    paragraphs: [
      "The whole game sits on one screen: an equation to solve, a keypad, and the mine itself. If you can do mental arithmetic, you already know how to play.",
    ],
    numbered: [
      "Read the equation at the top of the mine — for example, 7 × 8.",
      "Type the answer on the on-screen keypad and confirm it. A correct answer pays minerals and builds your combo; a wrong or skipped one only resets the combo, never your progress.",
      "Press and hold the mine face to mine by hand while you think. Manual mining is a second, smaller income stream that keeps earning between equations.",
      "Spend what you earn in the upgrades panel. Better pickaxes and click power raise what every answer is worth, while hired miners dig on their own.",
      "Clear the daily question, the weekly contract and the goals panel. Each one pays a one-off bonus that speeds up the slow stretch of a run.",
      "When the numbers start to crawl, sink a new shaft. Prestige resets the run in exchange for a permanent multiplier, so the next shaft starts stronger than the last.",
    ],
  },
  {
    heading: "Minerals, gems and upgrades",
    paragraphs: [
      "Minerals are the main currency and the one every equation pays out. They buy click-power upgrades, automatic mining crew, and the deeper equipment tiers that keep a run moving. Every purchase makes the next one feel closer, which is the loop the whole game is built around.",
      "Gems are the second track. They come from achievements, the daily and weekly bonuses, and the optional rewarded videos, and they feed a separate set of upgrades: cosmetic pickaxes and outfits, quality-of-life automation, and the gem-only lines that unlock later in a run. Two currencies means two goals at any moment, so there is almost always a sensible next purchase.",
    ],
  },
  {
    heading: "Your crew, and how it looks",
    paragraphs: [
      "Hired miners appear in the crew column beside the shaft, stacked in depth so the nearest miner is the newest hire. Every crew member can be dressed in any outfit or pickaxe you own, so no two crews end up identical. If you would rather draw your own, the custom skin slot lets you upload pixel-art for your miner and their pickaxe.",
      "All of the cosmetic content is earnable in game with gems, and the same cosmetic lines are also available as optional paid packs. The packs are a shortcut, never a gate: nothing you can buy changes how fast the game plays.",
    ],
  },
  {
    heading: "Free to play, and honest about it",
    paragraphs: [
      "Every part of the game is reachable without paying. A free player can unlock the same upgrades, the same miners and the same cosmetics as a spender, just possibly more slowly. Paid packs are cosmetic or convenience only and never gate progress, and there is no paywall anywhere in the progression.",
      "Ads are rewarded videos only. A full-screen ad plays when you choose to start one in exchange for an in-game bonus. There are no banners, no interstitials, no ads that interrupt play, and no fake countdowns, invented scarcity or pre-checked offers anywhere in the game.",
    ],
  },
  {
    heading: "Where you can play",
    paragraphs: [
      "The web version on this site is the same game as the Android and iOS apps, with the same save format on each platform. Progress is stored on your device by default. Creating a free account is optional and backs the save up to the developer's server so you can continue on another device, and it lets you post a score to the leaderboard under a name you choose.",
      "The game stays playable with no connection at all: cloud saves, the leaderboard, ads and purchases are the only features that use the network, and they fail quietly instead of blocking play when it is unavailable.",
    ],
  },
  {
    heading: "Who makes it",
    paragraphs: [
      `Mines of Idle Doomath is made by one independent developer, minus4kelvin. Questions, bug reports, feedback and account-deletion requests all go to the same inbox and are read by a person: ${SITE_CONTACT_EMAIL}.`,
    ],
  },
];

export const WEB_FAQ: WebFaqEntry[] = [
  {
    question: "Is Mines of Idle Doomath free?",
    answer:
      "Yes. The game is free to play on the web and free to download on Android and iOS, and every upgrade, miner and cosmetic can be earned by playing. Optional paid packs and rewarded videos exist, but nothing is locked behind them.",
  },
  {
    question: "Do I need an account to play?",
    answer:
      "No. The game is fully playable on the device you are using with no account at all. An account is only worth creating if you want cloud saves across devices or want to post a score to the leaderboard.",
  },
  {
    question: "What kind of math does the game use?",
    answer:
      "Addition, subtraction, multiplication and division, scaled to your progress. Harder equations pay more. Settings let you choose which equation types appear, how difficult they get, and how big numbers are written, including scientific notation for the very large values late in a run.",
  },
  {
    question: "Does the game need an internet connection?",
    answer:
      "No. The free path works offline. Ads, cloud saves, the leaderboard and purchases are the only features that need a connection, and they degrade quietly rather than blocking the game.",
  },
  {
    question: "How do the rewarded ads work?",
    answer:
      "When a rewarded video is available, an in-game button offers a bonus such as gems or a saved combo in exchange for watching the whole thing. The ad only ever plays after you tap that button, and closing it early simply means no bonus. There are no ads anywhere else in the game.",
  },
  {
    question: "How does prestige work?",
    answer:
      "Once a run reaches the prestige tier, you can sink a new shaft. That resets the current run — minerals, upgrades and hired miners — in exchange for a permanent multiplier that carries into every future run. It is the main long-term loop and it is available to every player.",
  },
  {
    question: "Can I reset or delete my progress?",
    answer:
      "Yes. The Save section of the settings menu can reset the current run or erase all local data, and the debug sections clear the local stats and crash log individually. If you have an account, the Account tab can delete the account and everything stored on the server in one step, and the published account-deletion page repeats the same instructions.",
  },
  {
    question: "Which platforms are supported?",
    answer:
      "Web, Android and iOS. Each platform runs the same game and the same save format, and the web build is a static export, so it loads quickly and works offline once loaded.",
  },
];

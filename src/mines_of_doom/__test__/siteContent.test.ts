/**
 * Shape net for the published web content (the AdSense "insufficient
 * content" fix, 2026-09-13).
 *
 * The game is a single client-rendered route, so the served HTML used to
 * carry no readable text. The content that fixes that lives in two places:
 *
 *  - `src/mines_of_doom/siteContent.ts` — the server-rendered landing copy
 *    and site nav that `src/app/+html.tsx` puts into the exported HTML, and
 *  - the static pages under `public/` (about / how-to-play / faq plus the
 *    generated legal pages).
 *
 * Nothing here tests game logic; it pins the *published site* the way
 * `legalDocs.test.ts` pins the legal documents: the landing copy is
 * substantial, every nav link points at a file that actually ships, the
 * sitemap covers exactly those pages, and every published page carries the
 * full navigation (no dead ends) and enough text to be a real page. A
 * rename, a dropped file or a link typo fails here instead of silently
 * shipping to a reviewer.
 *
 * Jest's `expect` takes no message argument, so the throw-based checks below
 * carry the context (which page, which link).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  SITE_NAV_LINKS,
  WEB_CONTENT_SECTIONS,
  WEB_FAQ,
  WEB_LANDING_INTRO,
} from "../siteContent";

const PUBLIC_DIR = path.join(__dirname, "..", "..", "..", "public");
const SITE_ORIGIN = "https://minesofdoom.minus4kelvin.com";

/** Visible text of an HTML document (drops head/scripts/styles/tags). */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text.length === 0 ? 0 : text.split(" ").length;
}

function readPublic(file: string): string {
  return fs.readFileSync(path.join(PUBLIC_DIR, file), "utf8");
}

function publicFileExists(file: string): boolean {
  return fs.existsSync(path.join(PUBLIC_DIR, file));
}

/** Local .html hrefs referenced by a page (the site's internal links). */
function localHtmlLinks(html: string): string[] {
  const links = new Set<string>();
  for (const m of html.matchAll(/href="(\/[^"#?]*\.html)"/g)) {
    links.add(m[1]);
  }
  return [...links];
}

/** The nav hrefs that must appear on every published page. */
const NAV_HREFS = SITE_NAV_LINKS.map((l) => l.href);
/** The pages that must carry the full nav (the game page gets it from the
 *  server-rendered +html template, asserted by the Playwright boot spec). */
const CONTENT_PAGES = NAV_HREFS.filter((h) => h !== "/" && h.endsWith(".html"));

describe("web site content (server-rendered landing copy)", () => {
  it("carries enough readable copy to be a real page", () => {
    const all = [
      ...WEB_LANDING_INTRO,
      ...WEB_CONTENT_SECTIONS.flatMap((s) => [
        s.heading,
        ...(s.paragraphs ?? []),
        ...(s.numbered ?? []),
        ...(s.bullets ?? []),
      ]),
      ...WEB_FAQ.flatMap((f) => [f.question, f.answer]),
    ].join(" ");
    // A reviewer should see paragraphs, not a stub. The full copy is well
    // above this; the floor only catches a section being deleted.
    expect(wordCount(all)).toBeGreaterThanOrEqual(800);
  });

  it("gives every content section a heading and a body", () => {
    expect(WEB_CONTENT_SECTIONS.length).toBeGreaterThanOrEqual(5);
    for (const section of WEB_CONTENT_SECTIONS) {
      expect(section.heading.trim().length).toBeGreaterThan(0);
      const body = [
        ...(section.paragraphs ?? []),
        ...(section.numbered ?? []),
        ...(section.bullets ?? []),
      ];
      expect(body.length).toBeGreaterThan(0);
    }
  });

  it("asks real questions in the FAQ", () => {
    expect(WEB_FAQ.length).toBeGreaterThanOrEqual(5);
    for (const entry of WEB_FAQ) {
      expect(entry.question.endsWith("?")).toBe(true);
      expect(entry.answer.length).toBeGreaterThan(40);
    }
  });
});

describe("web site navigation and published pages", () => {
  it("has unique nav links that all point at shipped files", () => {
    expect(new Set(NAV_HREFS).size).toBe(NAV_HREFS.length);
    expect(NAV_HREFS).toContain("/");
    for (const href of CONTENT_PAGES) {
      if (!publicFileExists(href.slice(1))) {
        throw new Error(`nav points at a missing page: public${href}`);
      }
    }
  });

  it("publishes every nav page with a title, real text and the full nav", () => {
    for (const href of CONTENT_PAGES) {
      const html = readPublic(href.slice(1));
      if (!/<title>[^<]+<\/title>/.test(html)) {
        throw new Error(`${href} has no usable <title>`);
      }
      const words = wordCount(visibleText(html));
      if (words < 250) {
        throw new Error(`${href} is too thin to publish (${words} words)`);
      }
      for (const nav of NAV_HREFS) {
        // A page does not link to itself; every OTHER page must be reachable.
        if (nav === href) continue;
        if (!html.includes(`href="${nav}"`)) {
          throw new Error(`${href} does not link to ${nav}`);
        }
      }
    }
  });

  it("keeps internal .html links resolvable (no dead links)", () => {
    for (const href of CONTENT_PAGES) {
      const html = readPublic(href.slice(1));
      for (const link of localHtmlLinks(html)) {
        if (!publicFileExists(link.slice(1))) {
          throw new Error(`${href} links to a missing page: ${link}`);
        }
      }
    }
  });

  it("lists every published page in the sitemap, and nothing missing", () => {
    const sitemap = readPublic("sitemap.xml");
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    // The sitemap must name the origin the canonical tags use.
    for (const loc of locs) {
      expect(loc.startsWith(SITE_ORIGIN)).toBe(true);
    }
    for (const href of NAV_HREFS) {
      const url = href === "/" ? SITE_ORIGIN + "/" : SITE_ORIGIN + href;
      if (!locs.includes(url)) {
        throw new Error(`sitemap.xml does not list ${url}`);
      }
    }
    for (const loc of locs) {
      const file = loc.slice(SITE_ORIGIN.length + 1);
      if (file === "" || !file.endsWith(".html")) continue;
      if (!publicFileExists(file)) {
        throw new Error(`sitemap.xml lists a missing page: public/${file}`);
      }
    }
  });
});

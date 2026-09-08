/**
 * Publishes the in-app legal documents as static HTML for the store
 * listings — GitHub Pages / Play Console want a URL, and the app's own
 * privacy policy lives inside the app (in-app LegalSection modal), which a
 * store reviewer cannot reach.
 *
 * This test is the codegen: it renders src/mines_of_doom/legal.ts into
 * public/privacy-policy.html and public/terms-of-use.html (the static web
 * export serves public/ at the site root, so the published URLs are
 * https://minesofdoom.pages.dev/privacy-policy.html and .../
 * terms-of-use.html). Running `npm test` after editing legal.ts therefore
 * regenerates the published copies — legal.ts stays the single source of
 * truth, and a mismatch can never ship.
 *
 * The rendered output is deterministic (same input → same bytes), so the
 * committed HTML only changes when the legal text does.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { LEGAL_DOCS, LEGAL_CONTACT_EMAIL, type LegalDoc } from "../legal";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One legal doc → a small standalone page (no external assets, works
 * offline, renders the same in any browser or email client). */
function renderDoc(doc: LegalDoc): string {
  const sections = doc.sections
    .map(
      (s) =>
        `    <section>\n      <h2>${escapeHtml(s.heading)}</h2>\n      <p>${escapeHtml(s.body).replace(/\n/g, "<br/>")}</p>\n    </section>`,
    )
    .join("\n");
  return `<!doctype html>
<!-- GENERATED FILE — do not edit by hand. Rendered from
     src/mines_of_doom/legal.ts by src/mines_of_doom/__test__/legalDocs.test.ts
     (run npm test after editing legal.ts to regenerate). -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.title)} — Mines of Idle Doomath</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
      h1 { font-size: 1.6rem; }
      .meta { color: #666; font-size: 0.9rem; }
      section { margin-bottom: 1.5rem; }
      a { color: #06c; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="meta">Mines of Idle Doomath · Version ${escapeHtml(doc.version)} · Effective ${escapeHtml(doc.effectiveDate)}</p>
${sections}
    <p class="meta">Questions: <a href="mailto:${escapeHtml(LEGAL_CONTACT_EMAIL)}">${escapeHtml(LEGAL_CONTACT_EMAIL)}</a></p>
  </body>
</html>
`;
}

const PUBLIC_DIR = path.join(__dirname, "..", "..", "..", "public");

describe("legal document publication (codegen for the store listings)", () => {
  it.each(LEGAL_DOCS.map((d) => [d.id, d] as const))("publishes %s as public HTML", (id, doc) => {
    const file = id === "privacy" ? "privacy-policy.html" : "terms-of-use.html";
    const html = renderDoc(doc);
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.writeFileSync(path.join(PUBLIC_DIR, file), html, "utf8");

    // The published page must actually carry the doc (a render regression
    // would otherwise ship a placeholder URL to store reviewers).
    expect(fs.readFileSync(path.join(PUBLIC_DIR, file), "utf8")).toBe(html);
    expect(html).toContain(`<title>${escapeHtml(doc.title)} — Mines of Idle Doomath</title>`);
    expect(html).toContain(`Version ${doc.version} · Effective ${doc.effectiveDate}`);
    expect(html).toContain(LEGAL_CONTACT_EMAIL);
  });

  it("rendering is deterministic (the committed HTML only changes with the text)", () => {
    for (const doc of LEGAL_DOCS) {
      expect(renderDoc(doc)).toBe(renderDoc(doc));
    }
  });
});

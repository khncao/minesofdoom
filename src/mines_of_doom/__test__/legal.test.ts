import { LEGAL_DOCS, LEGAL_CONTACT_EMAIL, getLegalDoc } from "../legal";
import { storeConfig } from "../storeConfig";

/**
 * Net for the legal notices (todo: privacy policy + disclaimer at the bottom
 * of settings). These documents are shown to store reviewers and players, so
 * the guards are deliberately structural: every doc must render something,
 * and the contact address must be the real one (the same as the in-app
 * inquiries button) rather than a placeholder.
 */

describe("legal documents", () => {
  it("ships exactly the privacy policy and terms of use", () => {
    expect(LEGAL_DOCS.map((d) => d.id).sort()).toEqual([
      "privacy",
      "terms",
    ]);
  });

  it("has unique ids, and getLegalDoc round-trips", () => {
    const ids = LEGAL_DOCS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const doc of LEGAL_DOCS) {
      expect(getLegalDoc(doc.id)).toBe(doc);
    }
  });

  it("every doc has a title, version, effective date, and non-empty sections", () => {
    for (const doc of LEGAL_DOCS) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.version.length).toBeGreaterThan(0);
      expect(doc.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(doc.sections.length).toBeGreaterThan(0);
      for (const section of doc.sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.body.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("the policy's child-directed claim matches the shipped AdMob flag (F45.1)", () => {
    // The S6 decision (security-audit.md, 2026-09-08): teen+ (13+), NOT
    // child-directed. The published policy must not assert an ad
    // configuration the shipped code does not have — this is the sibling
    // net that keeps the prose and storeConfig.adMob.tagForChildDirected-
    // Treatment in sync, so a future flag flip can't silently falsify
    // the policy again.
    const children = getLegalDoc("privacy").sections.find(
      (s) => s.heading === "Children",
    );
    expect(children).toBeDefined();
    const body = (children as { body: string }).body;
    if (storeConfig.adMob.tagForChildDirectedTreatment) {
      expect(body).toMatch(/child-directed treatment/i);
    } else {
      expect(body).not.toMatch(/configured for child-directed treatment/i);
      expect(body).toMatch(/not directed at children/i);
      // The recorded position is a concrete 13+, not a vague
      // "platform minimum age" claim.
      expect(body).toMatch(/13/);
    }
  });

  it("the contact email is the real developer address, not a placeholder", () => {
    expect(LEGAL_CONTACT_EMAIL).toBe("minus4kelvin@gmail.com");
    // ...and it actually appears in every doc's contact section, so a
    // rename of the constant above can't silently orphan the text.
    for (const doc of LEGAL_DOCS) {
      expect(doc.sections.some((s) => s.body.includes(LEGAL_CONTACT_EMAIL))).toBe(
        true,
      );
    }
  });
});

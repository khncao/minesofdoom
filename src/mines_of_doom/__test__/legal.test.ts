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
  it("ships exactly the privacy policy, terms, and deletion docs", () => {
    expect(LEGAL_DOCS.map((d) => d.id).sort()).toEqual([
      "deletion",
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

  it("the policy's child-directed claim matches the shipped Unity flag (F45.1)", () => {
    // The policy must not assert an ad configuration the shipped code does
    // not have — this is the sibling net that keeps the prose and
    // storeConfig.admob.childDirectedTreatment in sync, so a future flag
    // flip can't silently falsify the policy again. (That is exactly what
    // the 2026-09-30 Play rejection was: stale "ads" answers.)
    const children = getLegalDoc("privacy").sections.find(
      (s) => s.heading === "Children",
    );
    expect(children).toBeDefined();
    const body = (children as { body: string }).body;
    if (storeConfig.admob.childDirectedTreatment) {
      // Ads ARE treated as child-directed: say so, and say the reward is
      // in-game only (Families forbids real-world rewards).
      expect(body).toMatch(/treated as child-directed/i);
      expect(body).toMatch(/non-personalized|contextual/i);
      expect(body).toMatch(/never real-world goods/i);
      // And the child-directed posture is only honest if the advertising
      // id really is unavailable.
      if (storeConfig.admob.stripAdvertisingId) {
        expect(body).toMatch(/does not use an advertising identifier/i);
      }
    } else {
      expect(body).not.toMatch(/treated as child-directed/i);
      expect(body).toMatch(/not directed at children/i);
    }
  });

  it("the contact email is the real developer address, not a placeholder", () => {
    expect(LEGAL_CONTACT_EMAIL).toBe("minus4kelvin@gmail.com");
    // ...and it actually appears in every doc's contact section, so a
    // rename of the constant above can't silently orphan the text.
    for (const doc of LEGAL_DOCS) {
      expect(
        doc.sections.some((s) => s.body.includes(LEGAL_CONTACT_EMAIL)),
      ).toBe(true);
    }
  });
});

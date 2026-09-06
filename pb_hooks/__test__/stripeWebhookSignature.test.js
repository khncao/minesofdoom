/**
 * Tests for the sidecar's Stripe-Signature verification
 * (sidecar/verify.js verifyStripeWebhookSignature) — the docs/security-
 * audit.md S2 fix: the webhook HMAC is checked where the RAW body still
 * exists (the sidecar), before anything is forwarded to Pocketbase.
 */
const crypto = require("crypto");
const S = require("../sidecar/verify");

const SECRET = "whsec_test_secret";
const NOW_SEC = 1700000000;
const PAYLOAD = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

function sign(secret, payload, t) {
  return crypto.createHmac("sha256", secret).update(t + "." + payload).digest("hex");
}

function header(secret, payload, t) {
  return `t=${t},v1=${sign(secret, payload, t)}`;
}

describe("verifyStripeWebhookSignature (sidecar, S2)", () => {
  test("a valid signature over the exact payload is accepted", () => {
    expect(S.verifyStripeWebhookSignature(SECRET, PAYLOAD, header(SECRET, PAYLOAD, NOW_SEC), NOW_SEC)).toEqual({ ok: true });
  });

  test("a tampered payload is rejected", () => {
    const res = S.verifyStripeWebhookSignature(SECRET, PAYLOAD + " ", header(SECRET, PAYLOAD, NOW_SEC), NOW_SEC);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("signature mismatch");
  });

  test("a wrong secret is rejected", () => {
    const res = S.verifyStripeWebhookSignature("whsec_other", PAYLOAD, header(SECRET, PAYLOAD, NOW_SEC), NOW_SEC);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("signature mismatch");
  });

  test("a missing header is rejected", () => {
    expect(S.verifyStripeWebhookSignature(SECRET, PAYLOAD, undefined, NOW_SEC)).toEqual({
      ok: false,
      reason: "missing Stripe-Signature header",
    });
  });

  test("a missing timestamp is rejected", () => {
    const res = S.verifyStripeWebhookSignature(
      SECRET,
      PAYLOAD,
      `v1=${sign(SECRET, PAYLOAD, NOW_SEC)}`,
      NOW_SEC,
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("missing signature timestamp");
  });

  test("a header without any v1 entry is rejected", () => {
    const res = S.verifyStripeWebhookSignature(SECRET, PAYLOAD, `t=${NOW_SEC},v1hmac256=abcd`, NOW_SEC);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no v1 signature in header");
  });

  test("a timestamp outside the ±5-minute tolerance is rejected", () => {
    const old = NOW_SEC - (S.STRIPE_SIGNATURE_TOLERANCE_SEC + 1);
    expect(S.verifyStripeWebhookSignature(SECRET, PAYLOAD, header(SECRET, PAYLOAD, old), NOW_SEC).ok).toBe(false);
    const future = NOW_SEC + (S.STRIPE_SIGNATURE_TOLERANCE_SEC + 1);
    expect(S.verifyStripeWebhookSignature(SECRET, PAYLOAD, header(SECRET, PAYLOAD, future), NOW_SEC).ok).toBe(false);
  });

  test("a timestamp at the tolerance edge is still accepted", () => {
    const edge = NOW_SEC - S.STRIPE_SIGNATURE_TOLERANCE_SEC;
    expect(S.verifyStripeWebhookSignature(SECRET, PAYLOAD, header(SECRET, PAYLOAD, edge), NOW_SEC)).toEqual({ ok: true });
  });

  test("multiple signature entries: one matching v1 among several is accepted", () => {
    const h = `t=${NOW_SEC},v1hmac256=deadbeef,v1=${sign(SECRET, PAYLOAD, NOW_SEC)},v1=0000`;
    expect(S.verifyStripeWebhookSignature(SECRET, PAYLOAD, h, NOW_SEC)).toEqual({ ok: true });
  });

  test("multiple v1 entries: all-wrong is rejected", () => {
    const h = `t=${NOW_SEC},v1=0000,v1=1111`;
    const res = S.verifyStripeWebhookSignature(SECRET, PAYLOAD, h, NOW_SEC);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("signature mismatch");
  });

  test("an unconfigured secret is rejected (fail closed)", () => {
    expect(S.verifyStripeWebhookSignature("", PAYLOAD, header(SECRET, PAYLOAD, NOW_SEC), NOW_SEC)).toEqual({
      ok: false,
      reason: "webhook secret not configured",
    });
  });

  test("it never throws on garbage input", () => {
    expect(S.verifyStripeWebhookSignature(SECRET, PAYLOAD, ",,", NOW_SEC).ok).toBe(false);
    expect(S.verifyStripeWebhookSignature(SECRET, PAYLOAD, "t=abc", NOW_SEC).ok).toBe(false);
  });
});

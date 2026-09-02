const SUFFIXES = ["", "k", "M", "B", "T", "Qa", "Qi"];

/**
 * Format a number with compact notation (1.2k, 3.4M, 1.2B).
 * Numbers below 10,000 are shown in full.
 *
 * Accepts `number | bigint` — minerals (and derived lifetime/depth stats)
 * are bigint in the save; counts and costs stay numbers. The bigint path
 * mirrors the number path exactly, using integer arithmetic (values only
 * ever shrink here, so no overflow is possible).
 */
export function formatNumber(value: number | bigint): string {
  if (typeof value === "bigint") {
    return formatBigNumber(value);
  }
  if (!Number.isFinite(value)) {
    return value.toString();
  }
  let abs = Math.abs(value);
  if (abs < 10000) {
    return Math.floor(abs).toString();
  }
  let tier = 0;
  while (abs >= 1000 && tier < SUFFIXES.length - 1) {
    abs /= 1000;
    tier++;
  }
  const suffix = SUFFIXES[tier];
  // 1-2 decimal places, trimmed (1.2k, 10k, 100k)
  const scaled = abs >= 100 ? Math.floor(abs) : abs >= 10 ? Math.floor(abs * 10) / 10 : Math.floor(abs * 100) / 100;
  return `${scaled}${suffix}`;
}

/**
 * bigint formatting that mirrors the number path:
 * - < 10,000 → full integer
 * - >= 10,000 → scaled by 1000s with a suffix, adaptive decimals
 *   (>= 100: whole number; >= 10: one decimal; else two), trailing
 *   zeros trimmed — all with exact integer arithmetic.
 * As with the number path, tier stops at Qi for absurdly large values.
 */
function formatBigNumber(value: bigint): string {
  const abs = value < 0n ? -value : value;
  if (abs < 10000n) {
    return abs.toString();
  }
  let tier = 0;
  let scaled = abs;
  while (scaled >= 1000n && tier < SUFFIXES.length - 1) {
    scaled /= 1000n;
    tier++;
  }
  const suffix = SUFFIXES[tier];
  const pow = 1000n ** BigInt(tier);
  if (scaled >= 100n) {
    return `${scaled}${suffix}`;
  }
  if (scaled >= 10n) {
    // One decimal, computed on the pre-scaled value so nothing is lost.
    const digits = (abs * 10n) / pow;
    return digits % 10n === 0n
      ? `${digits / 10n}${suffix}`
      : `${digits / 10n}.${digits % 10n}${suffix}`;
  }
  // Two decimals, trailing zeros trimmed like JS number stringification
  // does for Math.floor(abs * 100) / 100 (1.25 → "1.25", 1.20 → "1.2").
  const digits = (abs * 100n) / pow; // floor(scaled * 100)
  const frac = digits % 100n;
  const intPart = digits / 100n;
  if (frac === 0n) {
    return `${intPart}${suffix}`;
  }
  if (frac % 10n === 0n) {
    return `${intPart}.${frac / 10n}${suffix}`;
  }
  return `${intPart}.${frac.toString().padStart(2, "0")}${suffix}`;
}

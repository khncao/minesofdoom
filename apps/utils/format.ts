const SUFFIXES = ["", "k", "M", "B", "T", "Qa", "Qi"];

/**
 * Format a number with compact notation (1.2k, 3.4M, 1.2B).
 * Numbers below 10,000 are shown in full.
 */
export function formatNumber(value: number): string {
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

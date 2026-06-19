/**
 * Compute mean, population standard deviation, and count of a numeric array.
 * Population std: divide by n (not n-1).
 */
export function scoreStats(nums: number[]): { mean: number; std: number; n: number } {
  const n = nums.length;
  if (n === 0) return { mean: 0, std: 0, n: 0 };
  const mean = nums.reduce((s, x) => s + x, 0) / n;
  const variance = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance), n };
}

/**
 * Count distinct outputs after normalising: trim, lowercase, collapse internal whitespace.
 */
export function distinctOutputs(strings: string[]): number {
  const normalised = strings.map((s) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '),
  );
  return new Set(normalised).size;
}

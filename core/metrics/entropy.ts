/**
 * Shannon entropy computed in BITS (log base 2).
 * @param counts - a map of label → count (or frequency); values must be > 0.
 * @returns entropy in bits; 0 when only one distinct label or input is empty.
 */
export function shannonEntropy(counts: Record<string, number>): number {
  const values = Object.values(counts).filter((v) => v > 0);
  if (values.length <= 1) return 0;
  const total = values.reduce((sum, v) => sum + v, 0);
  return values.reduce((h, v) => {
    const p = v / total;
    return h - p * Math.log2(p);
  }, 0);
}

/**
 * Compute tool-selection entropy (in bits) from a list of tool-name labels.
 * Empty list → 0. All identical → 0. Uniform N-way split → log2(N) bits.
 */
export function toolSelectionEntropy(labels: string[]): number {
  if (labels.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const label of labels) {
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return shannonEntropy(counts);
}

// Shared numeric helpers.

/** Median of the given values. The median ignores outliers better than the mean. */
export function median(values: number[]): number {
    if (values.length === 0) {
        throw new TypeError("median() requires at least one value");
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Arithmetic mean of the given values. */
export function mean(values: number[]): number {
    if (values.length === 0) {
        throw new TypeError("mean() requires at least one value");
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Pure debounce utility — zero imports.
 *
 * Returns a debounced version of `fn` that delays invocation by `ms` milliseconds.
 * Each call resets the timer; only the last call in a burst actually fires `fn`.
 */

/**
 * Creates a debounced function that delays calling `fn` until `ms` milliseconds
 * have elapsed since the last invocation.
 *
 * @param fn - The function to debounce.
 * @param ms - The delay in milliseconds.
 * @returns A debounced wrapper around `fn`.
 */
export function debounce(fn: () => void, ms: number): () => void {
  // Stub: returns fn unchanged. Real implementation added in Task 1.
  return fn;
}

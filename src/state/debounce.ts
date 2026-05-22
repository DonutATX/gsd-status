/**
 * Pure debounce utility — zero imports.
 *
 * Returns a debounced version of `fn` that delays invocation by `ms` milliseconds.
 * Each call resets the timer; only the last call in a burst actually fires `fn`.
 */

/**
 * Creates a debounced function that delays calling `fn` until `ms` milliseconds
 * have elapsed since the last invocation. Rapid repeated calls within the window
 * coalesce into a single invocation (WAT-02).
 *
 * @param fn - The function to debounce.
 * @param ms - The delay in milliseconds.
 * @returns A debounced wrapper around `fn`.
 */
export function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return function debounced() {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn();
    }, ms);
  };
}

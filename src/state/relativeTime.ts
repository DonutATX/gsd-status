/**
 * Pure relative-time helper — zero imports.
 *
 * Formats an ISO timestamp string as a human-readable relative time string
 * (e.g. "2h ago"). Used by the status bar tooltip to surface last-entry age.
 */

/**
 * Returns a human-readable relative time string for the given ISO timestamp.
 *
 * Buckets: "just now" (<60s), "Nm ago" (<60m), "Nh ago" (<24h), "N days ago" (>=24h).
 * Returns "unknown" for falsy, non-parseable, or future timestamps.
 *
 * @param isoString - An ISO 8601 timestamp string, or undefined.
 * @returns A human-readable relative time string.
 */
export function relativeTime(isoString: string | undefined): string {
  if (!isoString) return 'unknown';
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'unknown';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d} days ago`;
}

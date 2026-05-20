/**
 * Pure line / frontmatter helpers — zero vscode imports.
 *
 * Linear regex only (no nested quantifiers). Single-pass scans.
 */

/**
 * Split text into lines, normalizing CRLF and LF.
 * `splitLines('a\r\nb\nc')` === `['a', 'b', 'c']`.
 * `splitLines('')` === `['']`.
 */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/**
 * Read a YAML-ish frontmatter block delimited by `---` fences.
 *
 * - Looks for an opening `---` at line 0 or line 1 (allows a single blank/BOM-ish leader).
 * - Collects only top-level `key: value` pairs (lowercase letters / underscores).
 * - Skips indented continuation lines (e.g. nested `progress:` block).
 * - Stops at the closing `---` fence.
 * - Returns an empty Map if no frontmatter is present (never throws).
 */
export function readFrontmatter(lines: string[]): Map<string, string> {
  const result = new Map<string, string>();
  if (lines.length === 0) {
    return result;
  }

  let openIdx = -1;
  if (lines[0] === '---') {
    openIdx = 0;
  } else if (lines.length > 1 && lines[1] === '---') {
    openIdx = 1;
  } else {
    return result;
  }

  const keyValue = /^([a-z_]+):\s*(.+?)\s*$/;
  for (let i = openIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---') {
      break;
    }
    // Skip indented continuation lines (nested blocks like `progress:` children).
    if (line.length > 0 && (line[0] === ' ' || line[0] === '\t')) {
      continue;
    }
    const match = keyValue.exec(line);
    if (match) {
      result.set(match[1], match[2]);
    }
  }
  return result;
}

/**
 * Strip one matched pair of leading/trailing `"` or `'` from a value.
 * Returns `undefined` unchanged.
 */
export function stripQuotes(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value.length >= 2) {
    const first = value.charAt(0);
    const last = value.charAt(value.length - 1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

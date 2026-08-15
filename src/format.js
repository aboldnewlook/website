// Small pure helpers shared across the scoping and rendering layers.
// Ported verbatim from the resume Worker (jrschumacher/resume), plus a date
// formatter for blog timestamps.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Parse a comma-separated tag string into a lowercased, de-duped array. */
export function parseTags(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Parse a comma-separated tag string into a lowercased Set. */
export function tagSet(raw) {
  return new Set(parseTags(raw));
}

/** Count of shared members between a Set and an iterable of tags. */
export function intersectionCount(set, tags) {
  let n = 0;
  for (const t of tags) if (set.has(t)) n++;
  return n;
}

/** True if the Set shares at least one member with the tags iterable. */
export function intersects(set, tags) {
  for (const t of tags) if (set.has(t)) return true;
  return false;
}

/**
 * Format a 'YYYY-MM' or 'present' token for display.
 * '2025-01' -> 'Jan 2025', 'present' -> 'Present'.
 */
export function formatMonth(token) {
  if (!token) return "";
  const t = String(token).trim();
  if (t.toLowerCase() === "present") return "Present";
  const m = /^(\d{4})-(\d{2})$/.exec(t);
  if (!m) return t;
  const year = m[1];
  const monthIdx = parseInt(m[2], 10) - 1;
  const month = MONTHS[monthIdx] ?? m[2];
  return `${month} ${year}`;
}

/** Format a role's start/end into 'Mon YYYY – Mon YYYY'. */
export function formatDateRange(start, end) {
  const s = formatMonth(start);
  const e = formatMonth(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

/**
 * Format a D1 TEXT timestamp ('YYYY-MM-DD ...' or ISO) as '15 August 2026'.
 * Returns "" for null/unparseable input rather than inventing a date.
 */
export function formatDate(raw) {
  if (!raw) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw).trim());
  if (!m) return "";
  const monthIdx = parseInt(m[2], 10) - 1;
  const month = MONTHS[monthIdx];
  if (!month) return "";
  return `${parseInt(m[3], 10)} ${month} ${m[1]}`;
}

/** The machine-readable half of a <time> element: 'YYYY-MM-DD' or "". */
export function isoDate(raw) {
  if (!raw) return "";
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim());
  return m ? m[1] : "";
}

/** Escape a string for safe interpolation into HTML text/attributes. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

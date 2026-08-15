// Site-wide knobs. Deliberately one file, deliberately tiny.

/**
 * Which résumé target the homepage renders.
 *
 * `targets` has no "default" column and this Worker does not get to change that
 * schema, so the choice lives here as a constant. Change this one string to
 * re-point the homepage; everything else follows.
 *
 * Current targets: "principal-security", "staff-architect".
 */
export const DEFAULT_TARGET = "principal-security";

export const SITE_NAME = "aboldnewlook";

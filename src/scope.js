// The scoping algorithm — a faithful port of build.py's score() / eligible()
// and the assembly loop. This decides which real accomplishments a target
// selects and how they're ordered. It never invents content.

import { tagSet, intersectionCount, intersects, formatDateRange } from "./format.js";

/**
 * Is a bullet eligible for a target?
 *   eligible  <=>  (T ∩ exclude == ∅)  AND  (include empty  OR  T ∩ include ≠ ∅)
 * @param {Set<string>} T          the bullet's tag set
 * @param {object} ctx             precomputed target tag sets
 */
export function eligible(T, ctx) {
  if (intersects(ctx.exclude, T)) return false;
  if (ctx.include.size === 0) return true;
  return intersects(ctx.include, T);
}

/**
 * Score a bullet for a target.
 *   score = |T ∩ include| + 2·|T ∩ boost| + (metric non-empty ? 1 : 0)
 */
export function score(T, hasMetric, ctx) {
  return (
    intersectionCount(ctx.include, T) +
    2 * intersectionCount(ctx.boost, T) +
    (hasMetric ? 1 : 0)
  );
}

/** Precompute the target's tag sets once per build. */
function targetContext(target) {
  return {
    include: tagSet(target.include_tags),
    boost: tagSet(target.boost_tags),
    exclude: tagSet(target.exclude_tags),
  };
}

function hasMetric(metric) {
  return typeof metric === "string" && metric.trim() !== "";
}

/**
 * Build the structured résumé for a target from the raw backlog.
 * Returns a renderer-agnostic object consumed by html/text/docx/pdf.
 *
 * @param {object} target   a row from `targets`
 * @param {object} data     { companies, roles, accomplishments, profile }
 */
export function assemble(target, data) {
  const ctx = targetContext(target);
  const maxBullets = target.max_bullets_per_role ?? 0;
  const numHighlights = target.num_highlights ?? 0;

  // Annotate every accomplishment with its parsed tag set, eligibility, score.
  const scored = data.accomplishments.map((a) => {
    const T = tagSet(a.tags);
    const isEligible = eligible(T, ctx);
    return {
      ...a,
      _score: isEligible ? score(T, hasMetric(a.metric), ctx) : -1,
      _eligible: isEligible,
    };
  });

  const eligibleBullets = scored.filter((a) => a._eligible);

  // --- Per role: rank for inclusion, then display in original DB order. ---
  const byRole = new Map();
  for (const a of eligibleBullets) {
    if (!byRole.has(a.role_id)) byRole.set(a.role_id, []);
    byRole.get(a.role_id).push(a);
  }
  const selectedByRole = new Map();
  for (const [roleId, bullets] of byRole) {
    const ranked = [...bullets]
      .sort((x, y) => y._score - x._score) // rank decides inclusion
      .slice(0, maxBullets)
      .sort((x, y) => x.id - y.id); // display in DB / insertion order
    if (ranked.length) selectedByRole.set(roleId, ranked);
  }

  // --- Key Impact Highlights: top-N across all eligible bullets, dedup by text. ---
  let highlights = [];
  if (numHighlights > 0) {
    const seen = new Set();
    highlights = [...eligibleBullets]
      .sort((x, y) => y._score - x._score || x.id - y.id)
      .filter((a) => {
        const key = a.bullet.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, numHighlights)
      .map((a) => a.bullet);
  }

  // --- Experience: companies by sort_order, roles within by sort_order. ---
  const rolesByCompany = new Map();
  for (const r of data.roles) {
    if (!rolesByCompany.has(r.company_key)) rolesByCompany.set(r.company_key, []);
    rolesByCompany.get(r.company_key).push(r);
  }

  const experience = [];
  for (const company of [...data.companies].sort((a, b) => a.sort_order - b.sort_order)) {
    const companyRoles = (rolesByCompany.get(company.key) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((role) => {
        const bullets = selectedByRole.get(role.id);
        if (!bullets || bullets.length === 0) return null;
        return {
          title: role.title,
          note: role.note ?? "",
          dateRange: formatDateRange(role.start, role.end),
          bullets: bullets.map((b) => b.bullet),
        };
      })
      .filter(Boolean);

    if (companyRoles.length === 0) continue; // skip empty companies
    experience.push({
      display: company.display,
      location: company.location ?? "",
      roles: companyRoles,
    });
  }

  return {
    ...profileToHeader(data.profile, target),
    highlights,
    experience,
    skills: profileSection(data.profile, "skill"),
    community: profileOrdinals(data.profile, "community"),
    education: profileEducation(data.profile),
  };
}

// --- profile shaping helpers ------------------------------------------------

function profileMap(profile, section) {
  const out = new Map();
  for (const row of profile) {
    if (row.section === section) out.set(row.key, row.value);
  }
  return out;
}

function profileToHeader(profile, target) {
  const contact = profileMap(profile, "contact");
  return {
    name: contact.get("name") ?? "",
    headline: target.headline ?? "",
    summary: target.summary ?? "",
    contact: {
      email: contact.get("email") ?? "",
      github: contact.get("github") ?? "",
      linkedin: contact.get("linkedin") ?? "",
    },
  };
}

/** Skills: preserve DB row order; { category, value } per row. */
function profileSection(profile, section) {
  return profile
    .filter((r) => r.section === section)
    .map((r) => ({ category: r.key, value: r.value }));
}

/** Community: ordered by numeric ordinal key. */
function profileOrdinals(profile, section) {
  return profile
    .filter((r) => r.section === section)
    .sort((a, b) => Number(a.key) - Number(b.key))
    .map((r) => r.value);
}

/** Education: { school, degree } per row. */
function profileEducation(profile) {
  return profile
    .filter((r) => r.section === "education")
    .map((r) => ({ school: r.key, degree: r.value }));
}

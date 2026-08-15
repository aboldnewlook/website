// D1 read helpers for the PUBLIC résumé tables (binding: RESUME, database
// resume-public). Ported from the resume Worker's src/db.js; the only change is
// the binding it is handed. This module knows about exactly five tables —
// profile, companies, roles, accomplishments, targets — and nothing else exists
// in that database to know about.

/** Fetch all rows the scoping/assembly layer needs, in a single batch. */
export async function loadBacklog(DB) {
  const [companies, roles, accomplishments, profile] = await DB.batch([
    DB.prepare("SELECT key, display, location, sort_order FROM companies ORDER BY sort_order"),
    DB.prepare("SELECT id, company_key, title, start, end, note, sort_order FROM roles ORDER BY sort_order"),
    DB.prepare("SELECT id, role_id, bullet, tags, metric, date_added, notes FROM accomplishments ORDER BY id"),
    DB.prepare("SELECT section, key, value FROM profile"),
  ]);

  return {
    companies: companies.results ?? [],
    roles: roles.results ?? [],
    accomplishments: accomplishments.results ?? [],
    profile: profile.results ?? [],
  };
}

/** Fetch a single target by name, or null if unknown. */
export async function getTarget(DB, name) {
  const row = await DB.prepare(
    `SELECT name, headline, summary, include_tags, boost_tags, exclude_tags,
            max_bullets_per_role, num_highlights
       FROM targets WHERE name = ?`,
  )
    .bind(name)
    .first();
  return row ?? null;
}

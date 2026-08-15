// Plain-text renderer — the LinkedIn-paste artifact. Straight string build
// from the assembled structure: bullets as "- ", blank lines between sections.

function heading(title) {
  return `${title.toUpperCase()}\n${"-".repeat(title.length)}`;
}

/** Render the assembled résumé to plain text. */
export function renderText(resume) {
  const out = [];

  // Masthead
  if (resume.name) out.push(resume.name);
  if (resume.headline) out.push(resume.headline);
  const contact = [resume.contact.email, resume.contact.github, resume.contact.linkedin]
    .filter(Boolean)
    .join(" · ");
  if (contact) out.push(contact);

  if (resume.summary) out.push("", resume.summary);

  if (resume.highlights.length) {
    out.push("", heading("Key Impact Highlights"));
    for (const h of resume.highlights) out.push(`- ${h}`);
  }

  if (resume.experience.length) {
    out.push("", heading("Experience"));
    for (const company of resume.experience) {
      const loc = company.location ? ` — ${company.location}` : "";
      out.push("", `${company.display}${loc}`);
      for (const role of company.roles) {
        const note = role.note ? ` (${role.note})` : "";
        const dates = role.dateRange ? ` · ${role.dateRange}` : "";
        out.push(`  ${role.title}${dates}${note}`);
        for (const b of role.bullets) out.push(`    - ${b}`);
      }
    }
  }

  if (resume.skills.length) {
    out.push("", heading("Skills"));
    for (const s of resume.skills) out.push(`${s.category}: ${s.value}`);
  }

  if (resume.community.length) {
    out.push("", heading("Community"));
    for (const c of resume.community) out.push(`- ${c}`);
  }

  if (resume.education.length) {
    out.push("", heading("Education"));
    for (const ed of resume.education) out.push(`${ed.school} — ${ed.degree}`);
  }

  return out.join("\n") + "\n";
}

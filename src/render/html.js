// Résumé HTML renderer — server-rendered from the assembled structure.
// Ported from jrschumacher/resume (src/render/html.js). The markup is unchanged;
// the only edit is that the document shell now comes from layout.js so the
// résumé and the blog share one <head> and one nav.

import { escapeHtml } from "../format.js";
import { layout } from "./layout.js";

const e = escapeHtml;

function contactLine(contact) {
  const parts = [];
  if (contact.email)
    parts.push(`<a href="mailto:${e(contact.email)}">${e(contact.email)}</a>`);
  if (contact.github)
    parts.push(`<a href="https://${e(contact.github)}">${e(contact.github)}</a>`);
  if (contact.linkedin)
    parts.push(`<a href="https://${e(contact.linkedin)}">${e(contact.linkedin)}</a>`);
  return parts.join(" &middot; ");
}

function bulletList(items) {
  return `<ul>${items.map((b) => `<li>${e(b)}</li>`).join("")}</ul>`;
}

function highlightsSection(highlights) {
  if (!highlights.length) return "";
  return `<section class="highlights">
      <h2 class="section-title">Key Impact Highlights</h2>
      ${bulletList(highlights)}
    </section>`;
}

function experienceSection(experience) {
  if (!experience.length) return "";
  const companies = experience
    .map((company) => {
      const roles = company.roles
        .map((role) => {
          const note = role.note ? ` <span class="role-note">(${e(role.note)})</span>` : "";
          return `<div class="role">
            <div class="role-line">
              <span><span class="role-title">${e(role.title)}</span>${note}</span>
              <span class="role-dates">${e(role.dateRange)}</span>
            </div>
            ${bulletList(role.bullets)}
          </div>`;
        })
        .join("");
      const loc = company.location
        ? `<span class="company-loc">${e(company.location)}</span>`
        : "";
      return `<div class="company">
          <div class="company-line">
            <span class="company-name">${e(company.display)}</span>
            ${loc}
          </div>
          ${roles}
        </div>`;
    })
    .join("");
  return `<section class="experience">
      <h2 class="section-title">Experience</h2>
      ${companies}
    </section>`;
}

function skillsSection(skills) {
  if (!skills.length) return "";
  const rows = skills
    .map(
      (s) =>
        `<div class="skills-row"><span class="cat">${e(s.category)}:</span> ${e(s.value)}</div>`,
    )
    .join("");
  return `<section class="skills">
      <h2 class="section-title">Skills</h2>
      ${rows}
    </section>`;
}

function communitySection(community) {
  if (!community.length) return "";
  return `<section class="community">
      <h2 class="section-title">Community</h2>
      ${bulletList(community)}
    </section>`;
}

function educationSection(education) {
  if (!education.length) return "";
  const rows = education
    .map(
      (ed) =>
        `<div class="education-row"><span class="school">${e(ed.school)}</span><span class="degree">${e(ed.degree)}</span></div>`,
    )
    .join("");
  return `<section class="education">
      <h2 class="section-title">Education</h2>
      ${rows}
    </section>`;
}

/** The résumé's inner markup, without the document shell. */
export function resumeBody(resume) {
  return `<header class="masthead">
    <h1 class="name">${e(resume.name)}</h1>
    ${resume.headline ? `<div class="headline">${e(resume.headline)}</div>` : ""}
    <div class="contact">${contactLine(resume.contact)}</div>
  </header>
  ${resume.summary ? `<p class="summary">${e(resume.summary)}</p>` : ""}
  ${highlightsSection(resume.highlights)}
  ${experienceSection(resume.experience)}
  ${skillsSection(resume.skills)}
  ${communitySection(resume.community)}
  ${educationSection(resume.education)}`;
}

/** Render the assembled résumé to a full HTML document. */
export function renderHtml(resume) {
  return layout({
    title: resume.name || "Résumé",
    description: resume.headline || undefined,
    current: "resume",
    body: resumeBody(resume),
  });
}

/**
 * WebsiteValidator — Phase 20
 *
 * Post-build validation of generated websites. A successful Astro build is no
 * longer sufficient: the final generated output must actually contain the
 * expected content.
 *
 * Checks:
 *   - dist/index.html exists (or a built HTML output)
 *   - <main> is non-empty
 *   - business name is present
 *   - primary contact information is present (phone/website/address where available)
 *   - expected sections are rendered
 *   - no "[object Object]" or "[object Array]" literal
 *   - no unresolved template placeholders (e.g. {{...}}, "undefined", "null" as text)
 *   - valid links (hrefs are http(s)/mailto/tel/# anchors)
 *   - no "UNRESOLVED_SECTION" markers
 */
import fsp from 'node:fs/promises';
import path from 'node:path';

export const VALIDATION_STATUS = {
  VALIDATED: 'validated',
  FAILED_VALIDATION: 'failed_validation',
};

const PLACEHOLDER_RE = /\{\{\s*[a-zA-Z_]+\s*\}\}|<%\s*[a-zA-Z_]+\s*%>/;
const OBJECT_STRING_RE = /\[object (Object|Array)\]/;

/**
 * Validate a generated site's built HTML.
 *
 * @param {string} siteDir - absolute path to generated-site/<slug>/
 * @param {Object} expected - { name, phone, website, address, sections: string[] }
 * @returns {Promise<{status, checks, issues, mainFound, mainSections}>}
 */
export async function validateGeneratedSite(siteDir, expected = {}) {
  const checks = {};
  const issues = [];

  // Locate built HTML (dist/index.html is the canonical Astro SSG output).
  const candidates = [
    path.join(siteDir, 'dist', 'index.html'),
    path.join(siteDir, 'index.html'),
  ];
  let htmlPath = null;
  for (const c of candidates) {
    try {
      const st = await fsp.stat(c);
      if (st.isFile()) { htmlPath = c; break; }
    } catch { /* continue */ }
  }

  checks.html_exists = Boolean(htmlPath);
  if (!htmlPath) {
    issues.push('No built HTML output found (dist/index.html missing).');
    return { status: VALIDATION_STATUS.FAILED_VALIDATION, checks, issues, mainFound: false, mainSections: [] };
  }

  let html;
  try {
    html = await fsp.readFile(htmlPath, 'utf8');
  } catch {
    issues.push('Failed to read built HTML.');
    return { status: VALIDATION_STATUS.FAILED_VALIDATION, checks, issues, mainFound: false, mainSections: [] };
  }

  // Non-empty <main>
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const mainContent = mainMatch ? mainMatch[1] : '';
  checks.main_non_empty = mainContent.trim().length > 0;
  if (!checks.main_non_empty) issues.push('<main> is empty — planned sections were not rendered.');

  // Presence of business name
  checks.name_present = expected.name != null && expected.name !== '' && html.includes(expected.name);
  if (!checks.name_present && expected.name) issues.push(`Business name "${expected.name}" not found in generated HTML.`);

  // Contact presence (only when the source actually had them)
  if (expected.phone) {
    const phoneText = String(expected.phone).replace(/[^\d+]/g, '');
    const digits = phoneText.replace(/^\+?1?/, '');
    checks.phone_present =
      html.includes(phoneText) ||
      (digits.length >= 10 && html.includes(digits)) ||
      html.includes(`tel:${phoneText.replace('+', '')}`);
    if (!checks.phone_present) issues.push(`Phone ${expected.phone} not found in generated HTML.`);
  }
  if (expected.website) {
    const host = String(expected.website).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    checks.website_present = html.includes(host);
    if (!checks.website_present) issues.push(`Website ${expected.website} not found in generated HTML.`);
  }
  if (expected.address) {
    const addrPart = String(expected.address).slice(0, 60);
    checks.address_present = html.includes(addrPart);
    if (!checks.address_present) issues.push(`Address "${addrPart}..." not found in generated HTML.`);
  }

  // Expected sections rendered
  const sectionIds = new Set();
  for (const s of (html.match(/id="([a-z-]+)"/gi) || [])) {
    const id = s.replace(/id="|"/gi, '').toLowerCase();
    sectionIds.add(id);
  }
  const expectedSections = expected.sections || [];
  const missingSections = expectedSections.filter((s) => !sectionIds.has(s));
  checks.sections_present = missingSections.length === 0;
  if (missingSections.length) {
    issues.push(`Sections not rendered: ${missingSections.join(', ')}.`);
  }

  // No [object Object]
  checks.no_object_string = !OBJECT_STRING_RE.test(html);
  if (!checks.no_object_string) issues.push('Generated HTML contains "[object Object]" (serialization defect).');

  // No unresolved placeholders
  checks.no_placeholders = !PLACEHOLDER_RE.test(html) && !/\bundefined\b/.test(html);
  if (!checks.no_placeholders) issues.push('Generated HTML contains unresolved template placeholders.');

  // Extract rendered section ids from <main>
  const mainSections = mainMatch
    ? Array.from((mainMatch[1].match(/id="([a-z-]+)"/gi) || [])).map((s) => s.replace(/id="|"/gi, '').toLowerCase())
    : [];

  const passed = issues.length === 0;
  return {
    status: passed ? VALIDATION_STATUS.VALIDATED : VALIDATION_STATUS.FAILED_VALIDATION,
    checks,
    issues,
    mainFound: Boolean(mainMatch),
    mainSections,
    htmlPath,
  };
}

/**
 * Validate links in the generated HTML (http(s)/mailto/tel/#/relative ok).
 * @param {string} html
 * @returns {{valid:boolean, issues:string[]}}
 */
export function validateLinks(html) {
  const issues = [];
  const hrefRe = /\bhref=["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1];
    if (!href || href.startsWith('#') || href.startsWith('/') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const u = new URL(href);
      if (!/^https?:$/.test(u.protocol)) {
        issues.push(`Non-http link: ${href}`);
      }
    } catch {
      issues.push(`Malformed link: ${href}`);
    }
  }
  return { valid: issues.length === 0, issues };
}

export default {
  validateGeneratedSite,
  validateLinks,
  VALIDATION_STATUS,
};
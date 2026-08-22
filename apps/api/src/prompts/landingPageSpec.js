export const LANDING_PAGE_SPEC_PROMPT = `You are a senior UX designer, conversion strategist and frontend information architect.

Generate a structured landing-page specification for a local business.

BUSINESS DNA:
{{BUSINESS_DNA}}

WEBSITE STRATEGY:
{{WEBSITE_STRATEGY}}

DIGITAL AUDIT:
{{DIGITAL_AUDIT}}

The output will be rendered by a React component system.

DO NOT output arbitrary HTML. DO NOT output React code. Return only structured JSON.

REQUIRED SECTIONS (in order):
1. navigation 2. hero 3. trustIndicators 4. services 5. valueProposition 6. about 7. testimonials (only when verified) 8. gallery (only when valid images) 9. faq 10. location 11. cta 12. footer

Each section must have: id, type, purpose, priority, visibility, layout, content, cta, styling

CRITICAL RULES:
1. NO fake claims 2. NO fake reviews 3. NO fake awards 4. NO invented certifications 5. NO generic filler
6. Use business's ACTUAL positioning 7. Keep copy CONCISE 8. Optimize for MOBILE 9. ONE dominant CTA 10. Professional agency quality

COPY LIMITS:
Headline: 5-10 words, Subheadline: 10-15 words, Descriptions: 20-30 words, Buttons: 2-4 words

MOBILE FIRST: Hero centered, services stacked, CTAs full-width 44px min, click-to-call everywhere

CONVERSION: Primary CTA in hero/nav/services/about/final/footer. Trust indicators above fold. Minimal friction.

OUTPUT: Return ONLY valid JSON with pageTitle, pageDescription, primaryCTA, sections, theme, metadata.

SKIP sections with no verified data (testimonials, gallery, certifications, awards).

Base everything on ACTUAL business data. Be CONCISE. MOBILE FIRST. ONE dominant CTA. NO fabrication.`;

export const buildLandingPageSpecPrompt = (brandDNA, websiteStrategy, digitalAudit) => {
  return LANDING_PAGE_SPEC_PROMPT
    .replace('{{BUSINESS_DNA}}', JSON.stringify(brandDNA, null, 2))
    .replace('{{WEBSITE_STRATEGY}}', JSON.stringify(websiteStrategy, null, 2))
    .replace('{{DIGITAL_AUDIT}}', JSON.stringify(digitalAudit, null, 2));
};

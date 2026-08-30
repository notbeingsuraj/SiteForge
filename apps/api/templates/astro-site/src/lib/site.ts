// SiteForge generated-site config library.
// The SiteForge WebsiteGenerationService writes src/data/site.config.json
// from a verified BusinessProfile. This module reads it and exposes typed
// helpers that the deterministic Astro components use to render.

// Astro supports JSON imports natively.
import rawConfig from '../data/site.config.json';

export interface BusinessFacts {
  name: string | null;
  category: string | null;
  categories: string[];
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  hours: Record<string, unknown> | null;
  hoursText: string | null;
  rating: number | null;
  reviewCount: number | null;
}

export interface Theme {
  style: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  borderRadius: string;
}

export interface SiteConfig {
  site: {
    slug: string;
    title: string;
    description: string;
    lang: string;
    style: string;
  };
  business: BusinessFacts;
  facts: Array<{ claim: string; source: string; verified: boolean }>;
  copy: {
    hero: { headline: string | null; subheadline: string | null; cta: string | null; secondaryCta: string | null };
    services: { heading: string | null; items: Array<{ name: string; headline?: string; description: string; benefits?: string[] }> };
    about: { heading: string | null; story: string | null; differentiators: string[] };
    faq: Array<{ question: string; answer: string }>;
  };
  sections: string[];
  theme: Theme;
  primaryCta: { text: string; action: string; href: string | null };
  secondaryCta: { text: string; href: string | null } | null;
  provenance: Record<string, string>;
  generatedAt: string | null;
}

export const siteConfig = rawConfig as unknown as SiteConfig;

/** Whether a given section id should be rendered (driven by WebsiteGenerationService). */
export function hasSection(id: string): boolean {
  return Array.isArray(siteConfig.sections) && siteConfig.sections.includes(id);
}

/** Deterministic CSS custom-property block derived from the verified theme. */
export function themeCss(): string {
  const c = siteConfig.theme.colorPalette;
  const t = siteConfig.theme.typography;
  const b = siteConfig.theme.borderRadius || '12px';
  return [
    `--color-primary: ${css(c.primary)};`,
    `--color-secondary: ${css(c.secondary)};`,
    `--color-accent: ${css(c.accent)};`,
    `--color-background: ${css(c.background)};`,
    `--color-surface: ${css(c.surface)};`,
    `--color-text: ${css(c.text)};`,
    `--color-muted: ${css(c.muted)};`,
    `--font-heading: ${t.headingFont || "Georgia, serif"};`,
    `--font-body: ${t.bodyFont || "system-ui, sans-serif"};`,
    `--radius: ${b};`,
  ].join('\n');
}

function css(v: string | undefined): string {
  if (!v) return 'inherit';
  // Basic safety: only permit tokens safe for CSS custom property values.
  return v.replace(/[;{}]/g, '');
}

/** Build a tel: href only when a phone number is actually present. */
export function telHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

/** Build a maps directions href when coordinates are present. */
export function directionsHref(lat: number | null, lng: number | null, address: string | null): string | null {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return null;
}

/** Resolve the correct href for a CTA action using only verified facts. */
export function ctaHref(action: string): string | null {
  const b = siteConfig.business;
  switch (action) {
    case 'call':
      return telHref(b.phone);
    case 'visit':
    case 'directions':
      return directionsHref(b.latitude, b.longitude, b.address);
    case 'email':
      return b.email ? `mailto:${b.email}` : null;
    case 'website':
      return b.website ? b.website : null;
    case 'contact':
    default:
      // contact resolves to whichever contact channel is available.
      return telHref(b.phone) || (b.website ? b.website : null);
  }
}

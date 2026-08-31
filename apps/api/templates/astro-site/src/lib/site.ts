// SiteForge generated-site config library (V2).
// The SiteForge WebsiteGenerationService writes src/data/site.config.json
// from a verified BusinessProfile + Design Intelligence. This module reads it 
// and exposes typed helpers that the deterministic Astro components use to render.

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

export interface DesignTokens {
  motion?: {
    intensity: 'none' | 'subtle' | 'moderate' | 'expressive';
    allowedEffects: string[];
  };
  imageTreatment?: {
    aspectRatios: string[];
    overlayStyle: 'none' | 'gradient' | 'tint' | 'vignette' | 'duotone';
    borderTreatment: 'none' | 'rounded' | 'sharp' | 'organic' | 'film';
    shadowStyle: 'none' | 'subtle' | 'elevated' | 'dramatic' | 'inner';
  };
  iconTreatment?: {
    style: 'outline' | 'filled' | 'duotone' | 'hand-drawn' | 'minimal';
    weight: string;
    size: string;
  };
  layout?: {
    maxWidth: string;
    sectionSpacing: string;
    grid: string;
    heroComposition: 'centered' | 'split-left' | 'split-right' | 'full-bleed' | 'asymmetric';
  };
  weightScale?: {
    light: number;
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  letterSpacing?: {
    tight: string;
    normal: string;
    wide: string;
  };
  shadowStyle?: string;
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
  designTokens?: DesignTokens;
}

export interface AssetInfo {
  id: string;
  path: string;
  width: number;
  height: number;
  format: string;
  size: number;
  aspectRatio: string;
  treatment?: Record<string, unknown>;
  derivatives?: {
    webp?: string;
    avif?: string;
    sizes?: string[];
  };
}

export interface DesignIntelligenceMeta {
  layoutFamily?: string;
  visualDirection?: string;
  assetPlan?: {
    hero?: { type: string; subject: string; aspectRatio: string; resolution: string };
    supporting?: Array<{ id: string; purpose: string; subject: string; aspectRatio: string; resolution: string }>;
    gallery?: { count: number; style: string; layout: string };
    optimization?: { formats: string[]; sizes: string[]; loading: Record<string, unknown> };
  };
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
    trust?: Array<{ claim: string; verified: boolean; icon?: string }>;
    statistics?: Array<{ label: string; value: string }>;
    location?: { address: string; mapEmbed?: string };
    hours?: Record<string, string>;
    contact?: { phone?: string; email?: string; website?: string };
    cta?: { headline: string; subheadline: string; ctaText: string };
  };
  sections: string[];
  theme: Theme;
  primaryCta: { text: string; action: string; href: string | null };
  secondaryCta: { text: string; href: string | null } | null;
  provenance: Record<string, string>;
  generatedAt: string | null;
  designIntelligence?: DesignIntelligenceMeta;
  assets?: {
    hero?: AssetInfo;
    supporting?: AssetInfo[];
    gallery?: AssetInfo[];
  };
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

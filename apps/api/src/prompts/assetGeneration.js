/**
 * Asset Generation Prompt
 * 
 * Generates detailed prompts for image generation providers.
 */

export const ASSET_GENERATION_PROMPT = `You are a professional photographer and art director creating visual assets for a local business website.

BUSINESS:
{{BUSINESS_PROFILE}}

BRAND DNA:
{{BRAND_DNA}}

DESIGN SYSTEM:
{{DESIGN_SYSTEM}}

ASSET SPECIFICATION:
{{ASSET_SPEC}}

REQUIREMENTS:
- Generate a detailed, specific prompt for image generation
- Style must match the design system exactly
- Subject must be business-specific and authentic
- No generic stock photo language
- Technical specs must be met exactly
- No text, logos, or watermarks in generated image

OUTPUT FORMAT:
Return ONLY a detailed image generation prompt string. No JSON, no markdown.`;

export function buildAssetGenerationPrompt(businessProfile, brandDNA, designSystem, assetSpec) {
  const styleGuide = buildStyleGuide(designSystem);
  
  return ASSET_GENERATION_PROMPT
    .replace('{{BUSINESS_PROFILE}}', JSON.stringify(businessProfile, null, 2))
    .replace('{{BRAND_DNA}}', JSON.stringify(brandDNA, null, 2))
    .replace('{{DESIGN_SYSTEM}}', JSON.stringify(designSystem, null, 2))
    .replace('{{ASSET_SPEC}}', JSON.stringify(assetSpec, null, 2));
}

function buildStyleGuide(designSystem) {
  if (!designSystem) return 'Professional, clean, modern aesthetic';
  
  const { colorSystem, typography, imageTreatment, layout } = designSystem;
  
  return `
VISUAL STYLE GUIDE:
- Color Palette: Primary ${colorSystem?.primary}, Secondary ${colorSystem?.secondary}, Accent ${colorSystem?.accent}
- Background: ${colorSystem?.background}, Surface: ${colorSystem?.surface}
- Typography: Display ${typography?.display?.family}, Body ${typography?.body?.family}
- Image Treatment: ${imageTreatment?.overlayStyle} overlay, ${imageTreatment?.borderTreatment} borders, ${imageTreatment?.shadowStyle} shadows
- Aspect Ratios: ${imageTreatment?.aspectRatios?.join(', ')}
- Layout: ${layout?.heroComposition} hero, ${layout?.grid} grid
`;
}
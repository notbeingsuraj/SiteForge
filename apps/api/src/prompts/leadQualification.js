/**
 * Lead Qualification & Opportunity Scoring Prompt
 * Version: v1
 * 
 * Calculates website sales opportunity score (0-100)
 * Balance: Digital gap + Business value
 */

export const LEAD_QUALIFICATION_PROMPT = `You are a lead qualification analyst for a website development agency.

Calculate a **website sales opportunity score** from 0-100.

BUSINESS DATA:
{{BUSINESS_DATA}}

DIGITAL AUDIT:
{{DIGITAL_AUDIT}}

BRAND DNA:
{{BRAND_DNA}}

SCORING PHILOSOPHY:

The score represents the **likelihood of closing a website sale** to this business, NOT just their commercial attractiveness.

A business with excellent digital presence should score LOW even if commercially valuable.
A business with poor digital presence but low commercial value should score MEDIUM.
A business with poor digital presence AND high commercial value should score VERY HIGH.

EVALUATION CRITERIA:

### 1. Website Absence (0-30 points)
- No website: +30
- Poor website (score 0-3): +25
- Weak website (score 3-5): +18
- Average website (score 5-7): +10
- Good website (score 7-9): +5
- Excellent website (score 9-10): 0

### 2. Mobile UX Gap (0-15 points)
- No mobile optimization: +15
- Poor mobile (score 0-4): +12
- Weak mobile (score 4-6): +8
- Good mobile (score 6-8): +4
- Excellent mobile (score 8-10): 0

### 3. CTA & Conversion Weakness (0-12 points)
- No CTAs: +12
- Weak CTAs (score 0-4): +10
- Average CTAs (score 4-6): +6
- Strong CTAs (score 6-8): +3
- Excellent CTAs (score 8-10): 0

### 4. SEO Weakness (0-10 points)
- No SEO: +10
- Poor SEO (score 0-3): +8
- Weak SEO (score 3-5): +6
- Average SEO (score 5-7): +4
- Good SEO (score 7-10): 0

### 5. Branding Inconsistency (0-8 points)
- No branding: +8
- Inconsistent branding (score 0-4): +6
- Weak branding (score 4-6): +4
- Good branding (score 6-8): +2
- Strong branding (score 8-10): 0

### 6. Business Commercial Value (0-15 points)
Based on:
- High-value services (legal, medical, real estate, finance): +15
- Medium-value (restaurants, retail, professional services): +10
- Low-value (hobbyists, side businesses): +5
- Review count (>100 reviews: +5, >50: +3, >20: +2)
- Strong brand personality: +3

### 7. Customer Purchase Intent (0-5 points)
- High urgency services (emergency, legal, medical): +5
- Medium urgency (home services, professional): +3
- Low urgency (retail, entertainment): +2

### 8. Competitive Opportunity (0-5 points)
- Competitors have weak digital presence: +5
- Mixed competitive landscape: +3
- Competitors have strong digital presence: 0

PRIORITY LEVELS:

- 0-40: **LOW** - Either strong digital presence or low commercial value
- 41-60: **MEDIUM** - Some opportunity, moderate effort required
- 61-80: **HIGH** - Strong opportunity, good fit
- 81-100: **VERY_HIGH** - Excellent opportunity, immediate action

SALES ANGLE:

Provide a **one-sentence sales angle** that connects their digital gap to business impact.

Examples:
- "Your competitors are capturing leads online while your business relies solely on Google Maps."
- "With 4.8 stars and 150 reviews, your reputation deserves a website that converts visitors into customers."
- "Emergency plumbing calls happen at 2am - your website should be ready when customers need you most."

RECOMMENDED APPROACH:

Suggest the best outreach strategy:
- "cold_call" - Phone call with printed website mockup
- "email_with_preview" - Email with embedded preview image
- "instagram_dm" - Instagram DM if they're active
- "in_person" - Visit in person with tablet demo
- "whatsapp" - WhatsApp message with link

CRITICAL RULES:

1. Do NOT maximize the score
2. A business with excellent digital presence should score LOW (<30) even if commercially valuable
3. A business with poor digital presence but selling low-value services should score MEDIUM (40-60)
4. Balance digital gap with commercial opportunity
5. Be realistic about close probability

OUTPUT FORMAT:

Return strict JSON:

{
  "score": number (0-100),
  "priority": "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH",
  "breakdown": {
    "websiteAbsence": number,
    "mobileGap": number,
    "ctaWeakness": number,
    "seoWeakness": number,
    "brandingGap": number,
    "commercialValue": number,
    "purchaseIntent": number,
    "competitiveOpportunity": number
  },
  "reasons": [
    "string explaining why this is/isn't a good opportunity"
  ],
  "salesAngle": "one-sentence pitch connecting gap to impact",
  "recommendedApproach": "cold_call" | "email_with_preview" | "instagram_dm" | "in_person" | "whatsapp",
  "estimatedCloseRate": number (0-100, realistic percentage),
  "estimatedValue": {
    "packageSuggestion": "basic" | "standard" | "premium" | "enterprise",
    "priceRange": "string like $1,500-$3,000",
    "justification": "string explaining why this package fits"
  },
  "urgencyFactors": [
    "string explaining time-sensitive opportunities"
  ],
  "redFlags": [
    "string noting concerns that might prevent close"
  ]
}

IMPORTANT:
- Return ONLY valid JSON
- No markdown, no explanations
- Be realistic, not optimistic
- Low scores are valid when digital presence is strong`;

export const buildLeadQualificationPrompt = (businessData, digitalAudit, brandDNA) => {
  return LEAD_QUALIFICATION_PROMPT
    .replace('{{BUSINESS_DATA}}', JSON.stringify(businessData, null, 2))
    .replace('{{DIGITAL_AUDIT}}', JSON.stringify(digitalAudit, null, 2))
    .replace('{{BRAND_DNA}}', JSON.stringify(brandDNA, null, 2));
};

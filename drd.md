# SiteForge

## Detailed Requirements Document

**Version:** 1.0

---

# 1. System Architecture

```text
                    ┌───────────────────┐
                    │      User         │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   React Frontend  │
                    └─────────┬─────────┘
                              │
                         REST API
                              │
                              ▼
                    ┌───────────────────┐
                    │ Node / Express    │
                    │ Backend           │
                    └─────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
       Business Data       AI Engine        MongoDB
       Collection          OmniRoute         Database
            │                 │
            ▼                 ▼
       External APIs      LLM Providers
```

---

# 2. Technology Stack

## Frontend

* React
* Vite
* Tailwind CSS
* React Router
* TanStack Query
* Zustand where necessary
* Zod
* Lucide React

## Backend

* Node.js
* Express
* MongoDB
* Mongoose
* JWT
* bcrypt
* Helmet
* express-rate-limit
* Zod/Joi

## AI

OmniRoute as the unified model gateway.

Possible model roles:

### Reasoning

Strong reasoning model.

### Coding

Claude/GPT-class coding model.

### Fast extraction

Cheap/fast model.

### Copywriting

Strong general-purpose model.

Do not hard-code your application to one model provider.

---

# 3. Monorepo Structure

Recommended:

```text
siteforge/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── ui/
│   ├── types/
│   ├── prompts/
│   ├── config/
│   └── validators/
│
├── docs/
│
├── .env.example
├── package.json
└── README.md
```

---

# 4. Backend Architecture

```text
src/
│
├── config/
│
├── controllers/
│
├── services/
│
├── models/
│
├── routes/
│
├── middleware/
│
├── validators/
│
├── prompts/
│
├── utils/
│
├── workers/
│
└── app.js
```

---

# 5. Service Architecture

Separate business logic into services.

```text
GoogleMapsService
BusinessResearchService
WebsiteAuditService
BusinessDNAService
OpportunityScoringService
WebsiteStrategyService
LandingPageService
OutreachService
PricingService
LeadService
AIService
```

This matters because putting everything into Express controllers is how a promising codebase becomes a haunted house.

---

# 6. Processing Pipeline

```text
Google Maps URL
       │
       ▼
URL Validation
       │
       ▼
Business Resolution
       │
       ▼
Data Collection
       │
       ▼
Data Normalization
       │
       ▼
Website Audit
       │
       ▼
Business DNA
       │
       ▼
Opportunity Score
       │
       ▼
Website Strategy
       │
       ▼
Landing Page Specification
       │
       ▼
Landing Page Renderer
       │
       ▼
Outreach Generation
       │
       ▼
Lead Saved
```

---

# 7. Important Architecture Decision

Do NOT have the LLM directly generate the final React application.

Instead:

```text
Business Data
      ↓
Business DNA JSON
      ↓
Website Strategy JSON
      ↓
Landing Page Schema
      ↓
React Renderer
```

This gives you predictable output.

Example:

```json
{
  "hero": {
    "headline": "...",
    "subheadline": "...",
    "primaryCTA": "...",
    "secondaryCTA": "..."
  },
  "sections": [
    "trust",
    "services",
    "about",
    "reviews",
    "gallery",
    "location",
    "faq",
    "cta"
  ]
}
```

Your React frontend renders this schema.

The AI controls **content and configuration**, while your application controls **structure and code**.

---

# 8. MongoDB Collections

## users

```text
_id
name
email
passwordHash
role
createdAt
updatedAt
```

## leads

```text
_id
businessId
status
opportunityScore
priority
assignedPackage
quotedPrice
notes
lastContactedAt
nextFollowUpAt
createdAt
updatedAt
```

## businesses

```text
_id
name
category
address
phone
website
rating
reviewCount
openingHours
mapsUrl
description
services
socialLinks
photos
coordinates
source
createdAt
updatedAt
```

## businessAnalyses

```text
_id
businessId
businessDNA
digitalAudit
opportunityScore
scoreReasons
competitors
createdAt
```

## websiteProjects

```text
_id
businessId
strategy
landingPageSchema
versions
status
createdAt
updatedAt
```

## outreach

```text
_id
businessId
whatsapp
email
instagram
callScript
createdAt
```

## pricing

```text
_id
name
description
price
features
active
```

---

# 9. API Endpoints

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

## Business

```text
POST /api/business/analyse
GET  /api/business/:id
GET  /api/business/:id/analysis
```

## Website

```text
POST /api/websites/generate
GET  /api/websites/:id
POST /api/websites/:id/regenerate
POST /api/websites/:id/versions
```

## Outreach

```text
POST /api/outreach/generate
GET  /api/outreach/:businessId
```

## Leads

```text
GET    /api/leads
POST   /api/leads
GET    /api/leads/:id
PATCH  /api/leads/:id
DELETE /api/leads/:id
```

## Pricing

```text
GET /api/pricing
POST /api/pricing
PATCH /api/pricing/:id
```

---

# 10. Frontend Routes

```text
/login

/
/dashboard

/leads
/leads/:id

/analyse

/business/:id

/business/:id/analysis

/websites/:id

/websites/:id/preview

/websites/:id/outreach

/settings
```

---

# 11. Dashboard UX

Primary CTA:

**Analyse Business**

Input:

```text
Paste Google Maps URL
[____________________________]

        Analyse Business
```

After processing:

```text
Business
↓
Analysis
↓
Website
↓
Outreach
↓
Lead
```

---

# 12. Analysis UI

Display:

### Business Overview

* Name
* Category
* Location
* Rating
* Reviews
* Website

### Opportunity

Large score:

```text
87 / 100
HIGH OPPORTUNITY
```

Then show reasons.

### Digital Audit

```text
Website       Poor
Mobile UX     Poor
SEO           Weak
CTA           Weak
Branding      Average
Trust         Strong
```

### Business DNA

Cards:

* Audience
* Positioning
* Services
* Brand personality
* Customer intent

---

# 13. Website Generator UI

Three-column layout:

```text
┌──────────┬───────────────────────────┬──────────────┐
│ Sections │       Live Preview        │ AI Controls  │
│          │                           │              │
│ Hero     │       WEBSITE             │ Theme       │
│ Services │       PREVIEW              │ CTA         │
│ Reviews  │                           │ Layout       │
│ About    │                           │ Regenerate   │
│ Contact  │                           │              │
└──────────┴───────────────────────────┴──────────────┘
```

---

# 14. Website Schema

```json
{
  "theme": {
    "style": "modern-local-premium",
    "primaryColor": "#111111",
    "accentColor": "#...",
    "fontStyle": "modern"
  },
  "hero": {},
  "trustBar": {},
  "services": [],
  "about": {},
  "reviews": [],
  "gallery": [],
  "faq": [],
  "location": {},
  "cta": {},
  "footer": {}
}
```

---

# 15. AI Reliability Rules

Every AI output must:

1. Use structured JSON.
2. Pass schema validation.
3. Never invent business facts.
4. Separate facts from inference.
5. Identify missing data.
6. Avoid fake testimonials.
7. Avoid fake certifications.
8. Avoid fabricated awards.
9. Avoid unsupported claims.
10. Return confidence levels where appropriate.

Example:

```json
{
  "fact": "Business has 4.7 rating",
  "source": "google_maps",
  "confidence": 1
}
```

versus:

```json
{
  "inference": "Customers likely value reliability",
  "confidence": 0.72
}
```

---

# 16. Error Handling

If business extraction fails:

```text
Unable to analyse this business.

Reason:
Business information could not be reliably retrieved.

Try another Google Maps URL.
```

Do not silently generate fictional data.

If AI generation fails:

* retry with fallback model
* validate response
* log failure
* show partial results

---

# 17. AI Pipeline

Recommended model routing:

```text
Fast model
    ↓
Extraction / normalization

Reasoning model
    ↓
Business analysis

Strong model
    ↓
Website strategy

Strong coding/content model
    ↓
Landing-page schema

Fast model
    ↓
Outreach variations
```

OmniRoute should provide a single abstraction layer.

Application code should call:

```text
AIService.generate(...)
```

rather than directly calling a specific provider everywhere.

---

# 18. Observability

Log:

* request ID
* business ID
* model
* prompt version
* token usage
* latency
* error
* retry count

Store prompt versions.

Example:

```text
business-dna-v1
business-dna-v2
website-strategy-v1
outreach-v1
```

This will let you determine which prompts actually work rather than trusting the ancient human tradition of "this prompt feels better."

---

# 19. Security

Never send:

* API keys
* database credentials
* JWT secrets

to frontend.

Use:

```text
.env
```

Backend only.

Implement:

* Helmet
* CORS
* rate limiting
* request validation
* authentication middleware
* authorization middleware
* secure cookies or secure JWT strategy

---

# 20. V1 Development Order

### Phase 1

Project setup.

### Phase 2

Authentication.

### Phase 3

Lead database.

### Phase 4

Google Maps/business ingestion.

### Phase 5

AI Business DNA.

### Phase 6

Opportunity scoring.

### Phase 7

Website strategy.

### Phase 8

Landing-page renderer.

### Phase 9

Outreach generation.

### Phase 10

Dashboard polish.

### Phase 11

Testing.

### Phase 12

Deployment.

Do not start by building the pretty landing-page generator. The pretty part is the bait. The data pipeline is the product.

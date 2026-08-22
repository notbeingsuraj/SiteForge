# SiteForge

## Product Requirements Document

**Version:** 1.0
**Product Type:** Internal Sales & Website Generation Platform
**Stack:** MERN
**Primary AI Interface:** OmniRoute
**AI Coding Agents:** Cline + Kiro AI

---

## 1. Executive Summary

SiteForge is an internal web application designed to help a website-development business identify local businesses that have weak or outdated digital presences and rapidly produce sales-ready website concepts.

The user submits a Google Maps business URL.

SiteForge analyses the available business information and produces:

* Business profile
* Business category
* Target audience
* Value proposition
* Brand personality
* Services/products
* Location information
* Competitive positioning
* Existing digital presence
* Website quality assessment
* Digital opportunity score
* Recommended website strategy
* Suggested website sections
* AI-generated landing page
* Outreach message
* Call script
* Suggested pricing package

The application is primarily a **lead-generation and sales acceleration tool**, not a general-purpose website builder.

---

# 2. Problem Statement

Local businesses frequently have:

* No website
* Outdated websites
* Poor mobile experiences
* Weak branding
* Poor conversion flows
* Incomplete business information
* Weak calls-to-action
* Poor SEO
* Inconsistent branding across platforms

Manually researching these businesses and creating personalized website proposals is slow.

SiteForge reduces this workflow from:

**Research → Analyse → Design → Write proposal → Contact**

to:

**Paste URL → Analyse → Generate → Contact**

---

# 3. Target User

Primary user:

A freelance developer, agency, or small web-development company attempting to acquire local-business clients.

Initial product should support a single internal user.

Multi-user functionality is explicitly out of scope for V1.

---

# 4. Core User Journey

### Step 1

User opens dashboard.

### Step 2

User pastes Google Maps URL.

Example:

`https://maps.google.com/...`

### Step 3

System validates URL.

### Step 4

System resolves business information.

### Step 5

System collects available public information.

### Step 6

AI creates Business DNA.

### Step 7

AI evaluates website/digital presence.

### Step 8

System generates Opportunity Score.

### Step 9

AI generates website strategy.

### Step 10

AI generates landing-page specification.

### Step 11

Frontend renderer creates website preview.

### Step 12

User reviews generated website.

### Step 13

User saves lead.

### Step 14

System generates:

* WhatsApp message
* Email
* Instagram DM
* Call script
* Proposal summary

### Step 15

User contacts business.

### Step 16

Lead status is updated.

---

# 5. V1 Features

## 5.1 Lead Input

Input:

* Google Maps URL

Optional:

* Lead name
* Internal notes
* Target package
* Custom instructions

Validation:

* Detect valid Google Maps URL
* Reject unrelated URLs
* Prevent duplicate leads

---

# 5.2 Business Intelligence

Extract available information such as:

* Business name
* Category
* Address
* Phone
* Website
* Rating
* Review count
* Opening hours
* Business description
* Services
* Social links where publicly available
* Photos where legally usable
* Location
* Google Maps URL

Important:

The system must distinguish between:

**Verified information**

and

**AI-generated inference.**

AI must never present inferred information as factual.

---

# 5.3 Business DNA

Business DNA should contain:

### Identity

* Business name
* Category
* Location
* Business type

### Positioning

* Primary value proposition
* Secondary value propositions
* Likely customer segments
* Customer intent

### Brand

* Brand personality
* Tone
* Visual direction
* Suggested color direction
* Typography direction

### Commercial

* Core services
* High-value services
* Likely customer acquisition channels
* Conversion opportunities

### Digital Presence

* Existing website
* Website quality
* Mobile quality
* SEO quality
* CTA quality
* Branding consistency
* Trust signals
* Social presence

### Opportunity

* Website necessity
* Conversion opportunity
* Competitive opportunity
* Estimated business value of a website

---

# 5.4 Digital Opportunity Score

Score from 0–100.

Suggested weighting:

| Factor                  | Weight |
| ----------------------- | -----: |
| No website              |     25 |
| Poor website            |     15 |
| Weak CTA                |     10 |
| Poor mobile UX          |     10 |
| Weak branding           |     10 |
| Weak SEO                |     10 |
| Strong reviews          |      5 |
| High-value service      |     10 |
| Competitive opportunity |      5 |

Score interpretation:

### 80–100

High-priority lead

### 60–79

Good lead

### 40–59

Medium priority

### 0–39

Low priority

The score must be explainable.

Example:

> Opportunity Score: 87

Reasons:

* No website detected
* 4.7 rating with 380 reviews
* High-intent local service
* Strong customer trust
* No clear conversion funnel

---

# 5.5 Website Strategy Generator

Generate:

* Website objective
* Target audience
* Primary CTA
* Secondary CTA
* Recommended pages
* Homepage structure
* Content hierarchy
* Trust signals
* Conversion strategy
* SEO strategy
* Visual direction

Example homepage:

1. Announcement
2. Navigation
3. Hero
4. Trust indicators
5. Services
6. Why choose us
7. Reviews
8. Gallery
9. Location
10. FAQ
11. CTA
12. Footer

---

# 5.6 Landing Page Generator

Generate a production-quality landing page concept.

Requirements:

* Responsive
* Mobile-first
* SEO-friendly
* Strong CTA
* Accessible
* Business-specific
* No generic AI filler
* No fake testimonials
* No invented claims

The system should generate a structured page specification rather than blindly generating arbitrary HTML.

---

# 5.7 Website Preview

Preview should support:

* Desktop
* Tablet
* Mobile

User actions:

* Open preview
* Regenerate
* Edit
* Save version
* Duplicate
* Export

---

# 5.8 Outreach Generator

Generate:

### WhatsApp

Short personalized message.

### Email

Professional sales email.

### Instagram DM

Short conversational message.

### Call Script

Structure:

1. Introduction
2. Reason for calling
3. Business observation
4. Website opportunity
5. Offer
6. Objection handling
7. Closing

---

# 5.9 Pricing Recommendation

V1 should use manually configurable packages.

Example:

### Starter

₹7,999

### Professional

₹14,999

### Premium

₹29,999+

Pricing should not be automatically determined purely by AI.

AI can recommend a package based on:

* Business size
* Website complexity
* Number of pages
* Features
* Commercial value

The user retains final control.

---

# 5.10 Lead CRM

Lead statuses:

* New
* Analysing
* Qualified
* Website Generated
* Contacted
* Follow-up
* Interested
* Proposal Sent
* Negotiation
* Won
* Lost
* Not Interested

Lead fields:

* Business
* Contact
* Score
* Website status
* Generated website
* Package
* Price
* Last contacted
* Next follow-up
* Notes

---

# 6. Dashboard

Dashboard should display:

### Metrics

* Total leads
* High-priority leads
* Websites generated
* Contacted leads
* Interested leads
* Won leads
* Estimated pipeline value

### Lead table

Columns:

* Business
* Category
* Location
* Opportunity score
* Website status
* Lead status
* Package
* Created date

Filters:

* Score
* Category
* Location
* Status
* Website availability

Sorting:

* Highest opportunity
* Newest
* Highest reviews
* Highest rating

---

# 7. V1 Non-Goals

Do NOT build these initially:

* Automated cold calling
* Automated WhatsApp messaging
* Automated email sending
* Payment system
* Multi-tenant SaaS
* Full website hosting platform
* Advanced CRM
* AI autonomous browser agent
* Complex analytics
* Automatic pricing negotiation

These are distractions until the core sales workflow proves useful.

---

# 8. Success Metrics

Primary metric:

**Time from Google Maps URL → sales-ready website proposal**

Target:

< 5 minutes.

Secondary:

* Websites generated per hour
* Qualified leads per hour
* Outreach messages generated
* Lead conversion rate
* Website proposal acceptance rate
* Average deal value

---

# 9. Security

Requirements:

* JWT authentication
* Password hashing
* Rate limiting
* Helmet
* CORS configuration
* Input validation
* MongoDB sanitization
* Environment variables
* API key isolation
* Server-side AI calls

Never expose AI API keys to the browser.

---

# 10. V1 Definition of Done

A user can:

1. Paste a Google Maps URL.
2. Analyse the business.
3. View Business DNA.
4. View opportunity score.
5. View digital audit.
6. Generate website strategy.
7. Generate landing page.
8. Preview landing page.
9. Generate outreach messages.
10. Assign pricing.
11. Save the lead.
12. Change lead status.
13. Return to the lead later.

That constitutes the first usable version.

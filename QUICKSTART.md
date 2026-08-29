# SiteForge - Quick Start

## ✅ Built Successfully!

Complete stateless Business Intelligence Research application.

## 🚀 Start in 2 Steps

### 1. Configure Backend
```bash
cd apps/api
# Edit .env:
# - OMNIROUTE_API_KEY=your-omniroute-api-key
```

### 2. Run App
```bash
npm run dev
```

**Access:** http://localhost:5173

## 🎯 Core Feature

**Business Intelligence Research Engine**
- Extracts business data from public web sources (official websites, structured data)
- Accepts Google Maps URLs as input identifiers only (no API calls)
- Supports user-provided business data
- Normalizes into structured JSON with provenance & confidence
- Never fabricates information
- Returns null for unknowns

Location: `apps/api/src/services/BusinessResearchService.js`

## 📊 Implemented

✅ Business Intelligence Engine  
✅ Brand DNA Generation  
✅ Website Strategy Generation  
✅ Landing Page Specification  
✅ Website Copywriting  
✅ Digital Presence Audit  
✅ Lead Qualification  
✅ Sales Outreach Generation  

## 🏗️ Structure

```
apps/api/          Backend (Express - Stateless)
apps/web/          Frontend (React + TypeScript)
packages/          Shared code
```

## 📚 Docs

- `prd.md` - Product requirements
- `drd.md` - Technical architecture
- `README.md` - Overview

## 🔐 Security

- JWT authentication
- Rate limiting
- CORS, Helmet
- Input validation
- SSRF protection for web fetching

---

**Stack:** Express + React + Node.js (Stateless - No Database)  
**Built:** August 21, 2026

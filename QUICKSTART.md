# SiteForge - Quick Start

## ✅ Built Successfully!

Complete MERN stack Business Intelligence Research application.

## 🚀 Start in 3 Steps

### 1. Configure Backend
```bash
cd apps/api
# Edit .env:
# - MONGODB_URI=mongodb://localhost:27017/siteforge
# - JWT_SECRET=your-secure-secret
# - OMNIROUTE_API_KEY=your-api-key
```

### 2. Start MongoDB
```bash
mongod
# Or use MongoDB Atlas
```

### 3. Run App
```bash
npm run dev
```

**Access:** http://localhost:5173

## 🎯 Core Feature

**Business Intelligence Research Engine**
- Extracts business data from Google Maps
- Normalizes into structured JSON
- Never fabricates information
- Returns null for unknowns

Location: `apps/api/src/services/BusinessResearchService.js`

## 📊 Implemented

✅ JWT Authentication  
✅ Lead Management (CRUD)  
✅ Business Intelligence Engine  
✅ Dashboard with metrics  
✅ Lead detail views  

## 🏗️ Structure

```
apps/api/          Backend (Express + MongoDB)
apps/web/          Frontend (React + TypeScript)
packages/          Shared code
```

## 📚 Docs

- `prd.md` - Product requirements
- `drd.md` - Technical architecture
- `README.md` - Overview

## 🔐 Security

- bcrypt password hashing
- JWT authentication
- Rate limiting
- CORS, Helmet
- Input validation

---

**Stack:** MongoDB + Express + React + Node.js  
**Built:** August 21, 2026

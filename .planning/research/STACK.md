# Technology Stack

**Project:** Webloom Deep Research Intelligence Engine
**Researched:** 2026-09-01

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 18+ / 20+ | Runtime | LTS, native fetch, ES modules |
| Express | 4.18+ | API Framework | Mature, middleware ecosystem |
| TypeScript | 5.3+ | Type Safety | Critical for evidence/claim models |
| Vite | 5.0+ | Frontend Build | Fast HMR, ESM native |

### AI / LLM Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OmniRoute | Current | AI Routing Layer | Multi-provider abstraction, fallback, cost control |
| Models | auto/best-coding, reasoning, fast, copywriting | Specialized roles | Coding model for code gen, reasoning for research |

### Structured Data Provider
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Geoapify | v2 API | Structured business data | Places API + geocode + place-details; category hierarchy |

### Web Extraction
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| r.jina.ai | Current | Content extraction proxy | Handles JS-rendered pages, clean markdown extraction |
| axios | 1.6+ | HTTP Client | Retries, timeouts, interceptors |
| cheerio | 1.0+ | HTML Parsing | Fast, jQuery-like API for server-side DOM |

### Search/Discovery (NEW - to be selected)
| Technology | Purpose | Why |
|------------|---------|-----|
| **Bing Web Search API** OR **Brave Search API** OR **DuckDuckGo HTML** | Primary source discovery | Need at least 2 independent search providers for source independence |

### Database / Storage
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Redis** (or in-memory Map for dev) | Caching layer | Entity resolution, document cache, evidence cache, research state |
| File-based JSON (`.webloom.json`) | Manifest/Persistence | Generated sites manifest, research dossiers (no DB needed for personal tool) |

### Generated Site Renderer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Astro** | 4.0+ | Static site renderer | Zero-JS by default, perfect for marketing pages, component islands for interactivity |
| Alternative: Vite + React | 5.0+ | Alternative renderer | If team prefers React consistency with control panel |

### Configuration
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| dotenv | 16.0+ | Environment config | Standard, secure |
| config/env.js | Custom | Centralized config | Already exists, well-structured |

### Testing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `node --test` | Node 18+ | Unit/Integration | Zero dependencies, native |
| Playwright | 1.40+ | E2E | If needed for generated site validation |

### Observability / Logging
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Console + structured JSON | Native | Logging | Already implemented with safe redaction |
| Custom metrics | Custom | Research quality metrics | Deterministic, no external deps |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Search Provider | Bing/Brave/DuckDuckGo | Google Custom Search | Violates "ZERO dependency on Google for discovery" |
| Renderer | Astro | Next.js | Next.js requires server for SSR; Astro static is simpler for local |
| Search Provider | Single provider | Multiple providers | Need source independence for verification |
| Database | Redis/File | PostgreSQL | Overkill for personal tool; file/Redis sufficient |
| ORM | None | Prisma/TypeORM | Schema flexibility needed for evidence graph; raw JSON/files simpler |
| AI Framework | OmniRoute (raw) | LangChain/LlamaIndex | Too heavy; OmniRoute already abstracts providers cleanly |

## Installation

```bash
# Core dependencies (already in package.json)
npm install axios cheerio

# Dev dependencies
npm install -D typescript vitest @types/node

# New dependencies for deep research (to be added)
npm install ioredis  # for caching layer
# Search API client (depends on chosen provider)
```

## Configuration (env vars needed)

```env
# Existing
OMNIROUTE_API_KEY=
OMNIROUTE_BASE_URL=
GEOAPIFY_API_KEY=
EXTRACTION_TIMEOUT=30000
EXTRACTION_MAX_RETRIES=2

# New for Deep Research
SEARCH_API_KEY=           # Bing/Brave/DuckDuckGo
SEARCH_API_PROVIDER=      # 'bing' | 'brave' | 'duckduckgo'
REDIS_URL=                # optional, for caching
RESEARCH_MAX_QUERIES=50   # per run budget
RESEARCH_MAX_PAGES=200    # per run budget
RESEARCH_MAX_REVIEWS=200  # per run budget
RESEARCH_MAX_ITERATIONS=10
RESEARCH_MAX_RUNTIME_MS=300000  # 5 min safety limit
CACHE_TTL_STATIC_DAYS=30
CACHE_TTL_HOURS=24
CACHE_TTL_REVIEWS_HOURS=6
```

## Sources

- `apps/api/src/services/AIService.js` - OmniRoute integration, model roles, fallback logic
- `apps/api/src/services/GeoapifyProvider.js` - Structured data provider implementation
- `apps/api/src/services/providers/ProviderAdapter.js` - Canonical profile mapping
- `apps/api/src/services/BusinessDataExtractor.js` - r.jina.ai extraction, metadata parsing
- `apps/api/src/services/BusinessProfile.js` - Provenance-tracked profile
- `apps/api/src/services/BusinessResearchService.js` - Provider orchestration pipeline
- `apps/api/src/services/BusinessProfileValidator.js` - Validation rules
- `WEBSITE-GENERATION-ARCHITECTURE.md` - Architecture document (sections 1, 3, 6, 7, 9)
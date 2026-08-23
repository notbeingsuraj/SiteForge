# SiteForge

Internal Sales & Website Generation Platform for identifying local businesses with weak digital presences and rapidly producing sales-ready website concepts.

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express (Stateless - No Database)
- **AI**: OmniRoute (unified model gateway)

## Project Structure

```
siteforge/
├── apps/
│   ├── api/          # Backend Express API
│   └── web/          # React frontend
├── prd.md            # Product Requirements Document
├── drd.md            # Detailed Requirements Document
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables in apps/api/.env
# Required:
# - GOOGLE_MAPS_API_KEY=your-google-maps-api-key
# - OMNIROUTE_API_KEY=your-omniroute-api-key
# Optional:
# - PORT=5001
# - FRONTEND_URL=http://localhost:5173
# - OMNIROUTE_BASE_URL=https://api.omniroute.ai/v1
# - DEBUG_BUSINESS_ANALYSIS=false

# Start development servers
npm run dev
```

### Development

```bash
# Run both frontend and backend
npm run dev

# Run only backend
npm run dev:api

# Run only frontend
npm run dev:web
```

## Features

- Google Maps URL business extraction
- AI-powered business analysis (Business DNA)
- Website quality assessment
- Opportunity scoring
- Automated website strategy generation
- Landing page preview
- Outreach message generation (WhatsApp, Email, Instagram, Call scripts)

## Documentation

See [prd.md](./prd.md) and [drd.md](./drd.md) for detailed requirements and architecture.

## License

ISC

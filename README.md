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
# - PORT=5000
# - JWT_SECRET=your-secure-secret
# - OMNIROUTE_API_KEY=your-api-key
# Optional:
# - FRONTEND_URL=http://localhost:5173

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

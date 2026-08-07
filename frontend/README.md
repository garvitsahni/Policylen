# PolicyLens Frontend

React 19 + Vite 8 + Tailwind CSS 4 + framer-motion UI for PolicyLens, the health insurance policy analyzer.

## Quick Start

```bash
npm install
npm run dev
```

Serves on **http://localhost:5173**. The Vite dev server proxies `/api` and `/health` to the backend on `http://localhost:3000` (see `vite.config.js`).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Run oxlint |
| `npm run preview` | Preview the production build |

## Layout

- `src/App.jsx` — top-level view routing (upload → analysis → chat)
- `src/components/` — feature components (ScoreCard, FlagCard, ChatPanel, ScenarioSimulator, PitchCompare, etc.)
- `src/components/ui/` — shared UI primitives (VerificationStamp, SeverityBadge, RupeeDisplay, LanguageToggle)
- `src/lib/` — hooks and formatting utilities (`useMediaQuery.js`, `rupee.ts`)

## Prerequisites

The backend (`/api`, port 3000) and AI service (port 8001) must be running — see the [root README](../README.md#quick-start) for the full setup.

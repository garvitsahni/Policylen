# PolicyLens Backend

This repository contains the backend API for PolicyLens, a health insurance policy analysis tool.

## Overview

PolicyLens analyzes health insurance policy PDFs to identify red flags, calculate policy health scores, and provide Q&A grounded in the actual document content.

## Architecture

```
Frontend (React/Vite/Tailwind) ←→ Backend (Node/Express/Prisma) ←→ AI Service (Python/FastAPI)
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+

### Setup Instructions

1. **Install dependencies**

```bash
# Backend
cd backend
npm install

# AI Service  
cd ai-service
source venv/bin/activate
pip install -r requirements.txt
```

2. **Environment Configuration**

Create `.env` file:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/policylens
GEMINI_API_KEY=your_gemini_api_key_here
```

3. **Database Setup**

Initialize and migrate the database:

```bash
cd backend
npx prisma migrate dev
```

4. **Run Services**

```bash
# Start Backend
cd backend
npm run dev

# Start AI Service
cd ai-service
source venv/bin/activate
uvicorn app.main:app --reload
```

## API Endpoints

### Document Processing

`POST /api/documents`

Upload a health insurance policy PDF:

**Request Body:**
```json
{
  "file": "application/pdf"
}
```

**Response:**
```json
{
  "documentId": "uuid",
  "status": "extracted",
  "extractedText": "...pdf content...",
  "pageCount": 20,
  "message": "Extraction complete"
}
```

`GET /api/documents/:id`

Retrieve document by ID:

**Response:**
```json
{
  "id": "uuid",
  "fileName": "policy.pdf",
  "status": "ready",
  "extractedText": "...",
  "clauses": [...],
  "flags": [...],
  "score": {...},
  "chunks": [...]
}
```

### Flags and Scoring

`GET /api/documents/:id/flags`

List flags for a document:

`GET /api/documents/:id/score`

Get Policy Health Score:

`POST /api/documents/:id/chat`

Ask questions about the policy:

**Request Body:**
```json
{
  "question": "Is diabetes covered from day one?"
}
```

**Response:**
```json
{
  "answer": "Based on the policy document, diabetes is not covered from day one. There's a 2-year waiting period for pre-existing conditions including diabetes.",
  "groundedInDocument": true,
  "citedClauseId": "clause_uuid"
}
```

## Development

### Local Development

Run both services simultaneously:

```bash
# Terminal 1
npm run dev

# Terminal 2  
uvicorn app:app --reload --port 8001
```

### Testing

```bash
# Backend tests
npm test

# AI Service tests
pytest
```

## Project Structure

```
backend/
  ├── src/
  │   ├── routes/
  │   │   └── documents.ts    # Express routes
  │   ├── services/          # Business logic
  │   │   ├── flagEngine.ts   # Deterministic flag matching
  │   │   ├── scoring.ts     # Policy health score calculation
  │   │   └── extraction.ts  # Data extraction utils
  │   ├── flag-engine/       # Deterministic flag matching module
  │   └── prisma/            # Prisma configuration
  │       └── schema.prisma   # Database schema
  ├── package.json
  └── prisma.config.ts

ai-service/
  ├── app/                  # FastAPI application
  │   ├── extract.py       # PDF text extraction
  │   ├── chat.py          # Chat API
  │   ├── embed.py         # Embedding generation
  │   ├── pitch_compare.py # Pitch comparison
  │   └── main.py          # FastAPI app
  └── requirements.txt

frontend/
  ├── src/
  │   ├── components/      # UI components
  │   │   ├── ui/          # shadcn/ui components
  │   │   ├── layout/      # Layout components
  │   │   └── pages/       # Page components
  │   ├── hooks/           # Custom hooks
  │   ├── utils/           # Utility functions
  │   ├── services/        # API client
  │   ├── stores/          # Zustand stores
  │   └── styles/          # Global styles
  ├── lib/                # Core utilities
  └── assets/             # Project assets

samples/
  ├── sample1.pdf
  ├── sample2.pdf
  └── sample3.pdf

data/
  ├── taxonomy.json      # Red/green flag taxonomy
  └── settlement_ratios.json  # IRDAI settlement ratios
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `GEMINI_API_KEY` | Gemini API key | Required |
| `PORT` | Backend server port | `3000` |
| `AI_SERVICE_URL` | AI service endpoint | `http://localhost:8001` |

### Environment-Specific Configuration

#### Development

```env
DATABASE_URL=postgresql://postgres:localpassword@localhost:5432/policylens
GEMINI_API_KEY=dev_key_here
```

#### Production

```env
DATABASE_URL=postgresql://postgres:prodpassword@db.example.com:5432/policylens
GEMINI_API_KEY=prod_key_here
```

## Deployment

### Docker

Build and run the application:

```bash
# Build images
docker build -t policylens-backend ./backend
docker build -t policylens-ai ./ai-service

# Run services
docker-compose up --build
```

### Local Deployment

```bash
# Start PostgreSQL
docker-compose up postgres

# Start all services
docker-compose up --build
```

## Project Notes

### Technology Choices

- **Node/Express**: API orchestration and database communication
- **Prisma**: Type-safe database access layer
- **Python/FastAPI**: LLM-facing logic (extraction, chat, generation)
- **PostgreSQL + pgvector**: Document storage and vector embeddings for RAG
- **React/Vite/Tailwind**: Modern, performant frontend

### Key Design Decisions

1. **Deterministic Flag Classification**: No LLM influence in flag determination - all logic in code
2. **Architecture Separation**: LLM logic isolated in Python, API orchestration in Node.js
3. **No Advice Generation**: Explanations only, no recommendations or financial/legal guidance
4. **RAG-Only Chat**: Chat answers grounded strictly in uploaded documents
5. **Sample PDF Testing**: Manual spot-checking against source PDFs for validation

### Known Limitations

- Scanned/document PDFs are not supported in this initial version
- Document is processed in plaintext only (no OCR)
- PDF extraction quality depends on document structure

### Future Enhancements

- Live scraping of complaint forums (post-hackathon)
- OCR support for scanned PDFs (post-hackathon)
- Authentication and multi-user support (post-hackathon)
- Advanced vector store integration (beyond pgvector)
- More scenario types in scenario simulator

## License

This project is part of the PolicyLens hackathon build. Please refer to the project documentation for usage terms and licensing information.
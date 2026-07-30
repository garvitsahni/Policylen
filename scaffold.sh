#!/usr/bin/env bash
# PolicyLens Phase 0 scaffold. Run from the repo root (the folder containing this file).
# This creates the directory structure and initializes each sub-project; it does NOT
# install dependencies or start services for you beyond what's noted. Review before running.
set -e

echo "== Creating directory structure =="
mkdir -p backend/src/routes backend/src/services backend/src/flag-engine backend/prisma
mkdir -p ai-service/app
mkdir -p samples uploads

echo "== Frontend (Vite + React) =="
if [ ! -d frontend ]; then
  npm create vite@latest frontend -- --template react
  cd frontend
  npm install
  npm install -D tailwindcss postcss autoprefixer
  npx tailwindcss init -p
  cd ..
else
  echo "frontend/ already exists, skipping"
fi

echo "== Backend (Node/Express/Prisma) =="
if [ ! -f backend/package.json ]; then
  cd backend
  npm init -y
  npm install express multer dotenv cors
  npm install prisma @prisma/client --save
  npx prisma init
  cd ..
else
  echo "backend/package.json already exists, skipping init"
fi

echo "== AI service (Python/FastAPI) =="
if [ ! -d ai-service/venv ]; then
  cd ai-service
  python3 -m venv venv
  source venv/bin/activate
  pip install fastapi "uvicorn[standard]" python-multipart pypdf pdfplumber \
              google-genai psycopg2-binary python-dotenv
  pip freeze > requirements.txt
  deactivate
  cd ..
else
  echo "ai-service/venv already exists, skipping"
fi

echo "== Copying seed data references =="
echo "  data/taxonomy.json and data/settlement_ratios.json should already be in place."
echo "  backend/src/flag-engine should read them directly — do not duplicate."

echo "== Done. Next steps =="
echo "  1. cp .env.example .env  and fill in GEMINI_API_KEY, DATABASE_URL"
echo "  2. Ensure Postgres is running with the pgvector extension available"
echo "  3. Paste the Prisma schema from docs/architecture.md §3 into backend/prisma/schema.prisma"
echo "  4. cd backend && npx prisma migrate dev --name init"
echo "  5. Acquire 2-3 sample policy PDFs into samples/"
echo "  6. Proceed with IMPLEMENTATION_PLAN.md Phase 0 verification gate"

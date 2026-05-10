#!/bin/bash
set -e

# ─── Colors ───────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        EduGenie — Startup Script     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"

# ─── 1. Copy .env if needed ──────────────────
if [ ! -f backend/.env ]; then
  cp .env.example backend/.env
  echo -e "${YELLOW}[env] Copied .env.example → backend/.env (edit with your keys)${NC}"
fi

# ─── 2. Start Docker services ────────────────
echo -e "${GREEN}[docker] Starting Qdrant + Redis...${NC}"
docker compose up -d

echo -e "${GREEN}[docker] Waiting for services to be ready...${NC}"
sleep 5

# Verify Qdrant
if curl -s http://localhost:6333/healthz > /dev/null 2>&1; then
  echo -e "${GREEN}[docker] ✓ Qdrant is running on :6333${NC}"
else
  echo -e "${RED}[docker] ✗ Qdrant failed to start${NC}"
fi

# Verify Redis
if redis-cli ping > /dev/null 2>&1; then
  echo -e "${GREEN}[docker] ✓ Redis is running on :6379${NC}"
else
  echo -e "${YELLOW}[docker] ⚠ Redis CLI not found — verify manually${NC}"
fi

# ─── 3. Pull Ollama models ───────────────────
echo -e "${GREEN}[ollama] Pulling LLM model...${NC}"
ollama pull llama3.1:8b-instruct-q4_K_M

echo -e "${GREEN}[ollama] Pulling embedding model...${NC}"
ollama pull nomic-embed-text

# ─── 4. Start Python AI services ─────────────
start_python_service() {
  local name=$1
  local dir=$2
  local port=$3

  echo -e "${GREEN}[ai-services] Setting up ${name}...${NC}"
  cd "ai-services/${dir}"

  if [ ! -d "venv" ]; then
    python3 -m venv venv
  fi

  source venv/bin/activate
  pip install -q -r requirements.txt
  nohup uvicorn main:app --host 0.0.0.0 --port "${port}" > "../../logs/${name}.log" 2>&1 &
  echo -e "${GREEN}[ai-services] ✓ ${name} started on :${port}${NC}"
  deactivate
  cd ../..
}

mkdir -p logs

start_python_service "tts" "tts" 8001
start_python_service "stt" "stt" 8002
start_python_service "pdf-parser" "pdf-parser" 8004
start_python_service "reranker" "reranker" 8005

# ─── 5. Start Backend ────────────────────────
echo -e "${GREEN}[backend] Installing dependencies...${NC}"
cd backend
npm install
echo -e "${GREEN}[backend] Starting dev server...${NC}"
nohup npm run dev > ../logs/backend.log 2>&1 &
cd ..

# ─── 6. Start Frontend ───────────────────────
echo -e "${GREEN}[frontend] Installing dependencies...${NC}"
cd frontend
npm install
echo -e "${GREEN}[frontend] Starting dev server...${NC}"
nohup npm run dev > ../logs/frontend.log 2>&1 &
cd ..

# ─── Done ─────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         All services started!        ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  Frontend:  http://localhost:5173     ║${NC}"
echo -e "${CYAN}║  Backend:   http://localhost:3001     ║${NC}"
echo -e "${CYAN}║  Qdrant:    http://localhost:6333     ║${NC}"
echo -e "${CYAN}║  Redis:     redis://localhost:6379    ║${NC}"
echo -e "${CYAN}║  TTS:       http://localhost:8001     ║${NC}"
echo -e "${CYAN}║  STT:       http://localhost:8002     ║${NC}"
echo -e "${CYAN}║  PDF:       http://localhost:8004     ║${NC}"
echo -e "${CYAN}║  Reranker:  http://localhost:8005     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Logs are in ./logs/ directory${NC}"

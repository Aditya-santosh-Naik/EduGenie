@echo off
title EduGenie Startup

echo ======================================
echo        EduGenie — Startup Script
echo ======================================

:: ── 1. Copy .env if needed ──────────────
if not exist backend\.env (
    copy .env.example backend\.env
    echo [env] Copied .env.example to backend\.env
)

:: ── 2. Start Docker services ────────────
echo [docker] Starting Qdrant + Redis...
docker compose up -d
timeout /t 5 /nobreak >nul

:: ── 3. Start ComfyUI (If installed) ──────
echo [comfyui] Checking for ComfyUI...
if exist "..\ComfyUI_windows_portable\run_nvidia_gpu.bat" (
    echo [comfyui] Starting ComfyUI server...
    cd ..\ComfyUI_windows_portable
    start /B "ComfyUI" cmd /c "run_nvidia_gpu.bat > ..\EduGenie\logs\comfyui.log 2>&1"
    cd ..\EduGenie
) else if exist "ComfyUI_windows_portable\run_nvidia_gpu.bat" (
    echo [comfyui] Starting ComfyUI server...
    cd ComfyUI_windows_portable
    start /B "ComfyUI" cmd /c "run_nvidia_gpu.bat > ..\logs\comfyui.log 2>&1"
    cd ..
) else (
    echo [comfyui] WARNING: ComfyUI_windows_portable not found. Image/Video gen will be disabled.
)

:: ── 4. Start Ollama and Pull Models ──────
echo [ollama] Checking if Ollama is running...
tasklist | find /i "ollama app.exe" >nul || (
    echo [ollama] Starting Ollama...
    start "" "ollama app.exe"
)

echo [ollama] Waiting for Ollama to become ready...
:WaitForOllama
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -UseBasicParsing; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto WaitForOllama
)
echo [ollama] Ollama is ready!

echo [ollama] Pulling LLM model...
ollama pull llama3.1:8b-instruct-q4_K_M

echo [ollama] Pulling embedding model...
ollama pull nomic-embed-text

:: ── 4. Create logs directory ────────────
if not exist logs mkdir logs

:: ── 5. Start Python AI services ─────────
echo [ai-services] Setting up TTS...
cd ai-services\tts
if not exist venv ( python -m venv venv )
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
start /B "EduGenie-TTS" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8001 > ..\..\logs\tts.log 2>&1"
call deactivate
cd ..\..

echo [ai-services] Setting up STT...
cd ai-services\stt
if not exist venv ( python -m venv venv )
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
start /B "EduGenie-STT" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8002 > ..\..\logs\stt.log 2>&1"
call deactivate
cd ..\..

echo [ai-services] Setting up PDF Parser...
cd ai-services\pdf-parser
if not exist venv ( python -m venv venv )
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
start /B "EduGenie-PDF" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8004 > ..\..\logs\pdf-parser.log 2>&1"
call deactivate
cd ..\..

echo [ai-services] Setting up Reranker...
cd ai-services\reranker
if not exist venv ( python -m venv venv )
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
start /B "EduGenie-Reranker" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8005 > ..\..\logs\reranker.log 2>&1"
call deactivate
cd ..\..

:: ── 6. Start Backend ────────────────────
echo [backend] Installing dependencies...
cd backend
call npm install
echo [backend] Starting dev server...
start /B "EduGenie-Backend" cmd /c "npm run dev > ..\logs\backend.log 2>&1"
cd ..

:: ── 7. Start Frontend ───────────────────
echo [frontend] Installing dependencies...
cd frontend
call npm install
echo [frontend] Starting dev server...
start /B "EduGenie-Frontend" cmd /c "npm run dev > ..\logs\frontend.log 2>&1"
cd ..

:: ── Done ─────────────────────────────────
echo.
echo ======================================
echo        All services started!
echo ======================================
echo  Frontend:  http://localhost:5173
echo  Backend:   http://localhost:3001
echo  Qdrant:    http://localhost:6333
echo  Redis:     redis://localhost:6379
echo  TTS:       http://localhost:8001
echo  STT:       http://localhost:8002
echo  PDF:       http://localhost:8004
echo  Reranker:  http://localhost:8005
echo ======================================
echo.
echo Logs are in .\logs\ directory
pause

# EduGenie — Session Handoff (2026-09-03)

## State: working end to end

Sign in / create account / guest, explanation streaming, image generation,
Mermaid diagrams, applications, a continuous learning path, customisable
quizzes and interactive flashcards are all verified working.

Firebase has been removed entirely and replaced with local JWT auth.

---

## The big performance fix

Ollama was generating at **~7 tokens/sec**, which made a full explanation take
4–5 minutes and get truncated by client timeouts. The cause was not the model:
Ollama decides its GPU/CPU layer split **once, when the model loads**, and it
was loading while ComfyUI held VRAM — so it put 0.44GB of a 2.7GB model on the
GPU and cached that decision for the whole keep_alive window.

`ensureOllamaOnGpu()` in `backend/src/services/vramLock.ts` now checks the split
after freeing ComfyUI and evicts the model if less than 90% is on the GPU, so
the next request reloads it properly.

| | before | after |
|---|---|---|
| generation speed | 7.0 tok/s | **77.4 tok/s** |
| model on GPU | 16% | **100%** |
| explanation, cold after an image gen | 4–5 min (truncated) | **~20 s** |

Also removed `num_gpu: 1` from `llm.ts` — in Ollama that means "offload 1
layer", not "use 1 GPU". It was not the main cause, but it was wrong.

---

## Features

### Explanations
The main prompt asks for 8 fields; qwen2.5:3b reliably returns only
`explanationText`. Rather than fight it, `generateVisuals()` in `llm.ts` makes a
second small-schema call for images, diagram, applications and next steps, which
the model handles well. These arrive as an `extras` SSE event and are merged in
`useExplain.ts`.

The prompt uses a **worked example about a different topic** (the human heart)
because the model was otherwise echoing the schema placeholders back verbatim
("Real-world application 1"). `TEMPLATE_ECHO` in `llm.ts` filters any that slip
through.

### Continuous learning (new)
After each explanation a **Continue learning** card offers 3–4 clickable next
steps, each with a topic, a level badge and a one-line reason. Clicking one sets
the topic and level and immediately generates the next explanation.

A "Go deeper: <topic> (<next level>)" step is appended deterministically in
`useExplain.ts` (`withDeeperStep`), so the path is never empty even if the model
returns nothing — beginner → intermediate → advanced.

### Quizzes (new)
Question count is now selectable (presets 3/5/10/15 plus any number 1–20,
clamped server-side). The system prompt no longer hardcodes 5. "More questions"
on the results screen sends the questions already answered as `exclude` so the
model doesn't repeat itself, and the cache key includes the count so asking for
10 doesn't replay the 5.

Verified: requested 3 → got 3, requested 8 → got 8.

### Flashcards (rewritten)
Real two-sided cards that rotate in 3D on click, with prev/next navigation, a
Due/All deck toggle and SM-2 rating (Hard/Good/Easy).

Saving used to look only for `-` bullets under `## Key Concepts`; the model
writes prose, so it silently saved an empty array. It now falls back to one card
per `## ` section — heading asks, paragraph answers — and reports when it truly
can't build any.

### Images
Only ever generated on an explicit click. Three styles (Illustration / Cartoon /
Diagram) and a Regenerate button. ComfyUI poll timeout raised 120s → 420s, and a
480s client timeout with a real error message replaced the spinner that could
hang forever. Failures now return 503 with a reason instead of a silent null.

---

## Things that were quietly broken and are now fixed

- **~20 Tailwind classes that don't exist in `tailwind.config.ts`** — `bg-panel`,
  `text-muted`, `bg-accent`, `accent-dark`, `text-warn`, `bg-primary`,
  `bg-surface-lighter`, `text-background`. Tailwind emits nothing for these, so
  the login inputs rendered as white boxes and most buttons were unstyled.
- **`.btn-secondary` and `.custom-scrollbar` were used but never defined** in
  `index.css` — "Explain Differently" and the flashcard nav were bare text.
- **Login rendered inside the app shell** — sidebar, XP bar and Genie widget
  showed behind the login card. Routing is now split so `/login` is standalone.
- **The LLM safety classifier rejected ordinary topics** — "blackhole" returned
  "This topic cannot be explained in this context." Replaced with a
  deterministic regex gate, which also removed a whole extra inference per
  question.
- **`useAuth()` fired `GET /api/auth/me` 6+ times per load** — the restore
  effect ran in every component that called the hook. Split into
  `useAuthBootstrap()`, mounted once.
- **Mermaid diagrams never rendered.** Three separate causes, in order:
  Vite's dep-optimizer cache went stale when `firebase` was removed, so
  mermaid's lazily-imported `flowDiagram` chunk 404'd; the error branch
  unmounted the container ref, so no later attempt could ever recover; and the
  scratch-node cleanup deleted the SVG it had just painted, because
  `mermaid.render(id, …)` returns an SVG carrying that same id.
- **Guest sign-in swallowed its errors** — spinner reverted with no message.

---

## Environment

- **Backend** — http://localhost:3001 (`npm run dev` in `backend/`)
- **Frontend** — **http://localhost:5174** (5173 is occupied by another
  project, "HealthAI")
- **Ollama** — http://localhost:11434 · `qwen2.5:3b` (in use), `gemma4:12b`
- **ComfyUI** — http://localhost:8188 · `--lowvram`, FLUX schnell Q4 GGUF
- **Python** — 3.12 system, **3.11.9** installed this session for ComfyUI's venv
  (its 6GB of cp311 packages were unusable after 3.11 was uninstalled)
- **Docker is not installed**, so Qdrant and Redis are down. The backend
  degrades gracefully: the vector store falls back to an embedded cosine index
  in `.data/vectors.json`, and the cache and progress store fall back to disk.
  RAG and caching both work without Docker — see the v2 section below.
- **Python AI services** — TTS 8001, STT 8002, PDF 8004, reranker 8005, all on
  Python 3.11 venvs.
- Test account: `test@edugenie.local` / `test123456`

```bash
cd D:/Edugenie/backend && npm run dev
```

```bash
cd D:/Edugenie/frontend && npm run dev -- --port 5174 --strictPort
```

```bash
cd D:/Edugenie/ComfyUI && ./.venv/Scripts/python.exe main.py --port 8188 --lowvram --disable-auto-launch
```

---

## Known gaps

- **Video generation is a stub.** The route and worker exist but return
  placeholder output — there was no VRAM budget for a video model alongside the
  LLM and FLUX.
- **No automated tests.** The highest-value first targets would be chunk
  boundaries, the SM-2 scheduler arithmetic, and the VRAM lock's release paths
  under abort and failure.
- **Scanned PDFs return nothing** — there is no OCR stage. The parser detects
  this and returns 422 rather than indexing an empty document.
- **Docker is not installed here**, so Qdrant and Redis do not run. This is no
  longer a functional limitation: the vector store falls back to an embedded
  index and the cache and progress store fall back to disk.
- The main explanation prompt still asks for 8 fields it will not get. It works
  because of the separate `extras` call, but it could be trimmed.

---

# v2 — bug fixes

Everything above still holds. This pass made the half-built parts actually run
and fixed the defects that surfaced once they did.

## Now genuinely working

- **RAG, end to end.** PDF → parse → heading-aware chunking → embeddings →
  vector search → cross-encoder rerank → grounded explanation. Verified with a
  document describing an invented subject the model cannot know: asked cold it
  invented an unrelated definition; after ingest it taught the document's actual
  content.
- **Document understanding.** `ai-services/pdf-parser` runs on PyMuPDF with
  heading detection by font size, and upgrades to docling automatically if that
  heavier dependency is installed.
- **Voice.** TTS (8001) and STT (8002) both run. TTS tries Kokoro and falls back
  to the OS speech engine, so the service works on a fresh clone with a small
  install. A synthesize-then-transcribe round trip returns the original text.
- **Reranking.** The reranker venv pointed at a deleted Python 3.14. Rebuilt on
  CPU-only torch, and the default model is now a ~90MB cross-encoder instead of
  a 2.2GB one, configurable via `RERANKER_MODEL`.
- **Progress survives restarts.** XP, levels, streaks and badges are written to
  disk, with Redis as a cache in front rather than the only store.

## Security fixes

- **Identity came from the client.** `/api/explain` and the gamification routes
  read `userId` out of the request body, so any caller could read another
  student's uploaded documents or credit XP to another account. Identity now
  comes from the verified JWT on every route.
- **The response cache could leak across users.** Its key was
  `(topic, mode, level)` — no owner, no context. An explanation grounded in one
  student's private upload could be replayed to another. The key now includes
  the owner and a digest of the retrieved context.
- **XP awards are clamped** so a malformed or hostile client cannot mint levels.

## Correctness and UX fixes

- **Cancel did nothing and clicks stacked GPU jobs.** The `AbortController` was
  never passed to `fetch`, and lived in a hook that three components instantiate
  separately. Requests piled up on the VRAM lock. The signal is now threaded
  through and one generation is in flight app-wide.
- **Retrieval had no relevance floor.** Nearest-neighbour search always returns
  something, so asking about levers with only a biology PDF indexed wove that
  document into the lesson. Chunks must now clear a cosine threshold
  (`RAG_MIN_SCORE`, default 0.7).
- **Model-generated Mermaid often failed to parse.** The model emits orphan
  lines like `C: <3.2%` and raw angle brackets in labels. `sanitizeMermaid()`
  keeps the structural lines, escapes label angles, and renders nothing at all
  when no diagram survives.
- **`explanationText` sometimes arrives as a nested object** rather than a
  markdown string, which rendered an empty card and left the streaming preview
  stuck on "Initializing". Both paths now flatten it back to markdown.
- **Inline markdown was printed literally** — bold and bullets showed as raw
  asterisks. Now rendered as nodes, not injected HTML.
- **Buttons inside the search form had no `type`**, so they defaulted to
  `submit`: pressing Enter triggered the microphone, and switching answer mode
  fired a full explanation.
- **Upload is no longer hidden** — it is back in the nav as "Materials".
- `startup.bat` pulled `llama3.1:8b` while `.env` used `qwen2.5:3b`, creates its
  venvs on Python 3.11, and no longer falls through into its own subroutine.
- Added the missing favicon.

## Verified this pass

Both projects typecheck and build clean. Backend, frontend and all four Python
services healthy; login, streaming explanation, PDF upload and retrieval,
quiz generation (requested 3, got 3), TTS through the authenticated route,
gamification persistence across a restart, and a 401 for unauthenticated calls.
`ollama ps` showed qwen2.5:3b at 2.4GB of 2.4GB resident — 100% on GPU.

## Running it

```bash
cd D:/Edugenie/ai-services/pdf-parser && ./venv/Scripts/python.exe main.py
```

```bash
cd D:/Edugenie/ai-services/tts && ./venv/Scripts/python.exe main.py
```

```bash
cd D:/Edugenie/ai-services/stt && ./venv/Scripts/python.exe main.py
```

```bash
cd D:/Edugenie/ai-services/reranker && ./venv/Scripts/python.exe main.py
```

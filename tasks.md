# Implementation Tasks — Financial Document Extraction Tool

## Status Legend
`Pending` · `In Progress` · `Done`

---

## Phase 1 — Foundation

| # | Task | Description | Status |
|---|------|-------------|--------|
| 1 | Create project directory | Scaffold `financial-extractor/` folder structure | Done |
| 1a | Create `.gitignore` | Ignore `.env`, `uploads/`, `results/`, `__pycache__/`, `.venv/`, `*.pyc` — security-critical before any commit | Done |
| 1b | Set up Python virtual environment | `python3.11 -m venv .venv` inside `financial-extractor/` — needed to run locally without Docker | Done |
| 2 | Set up `pyproject.toml` | Define Python dependencies: fastapi, uvicorn, docling, ollama, rq, redis, pydantic-settings, python-multipart | Done |
| 3 | Create `.env.example` | Template env file with OLLAMA_MODEL, OLLAMA_BASE_URL, REDIS_URL, UPLOAD_DIR, RESULTS_DIR | Done |
| 4 | Create `config.py` | Load all settings from env vars using pydantic-settings | Done |
| 5 | Create `main.py` | FastAPI app with lifespan, health check `GET /health`, and CORS middleware (allows React dev server on port 5173 to call API on port 8000) | Done |
| 6 | Create `job_store.py` | SQLite job table: id, status, file_path, result_path, error, created_at, updated_at | Done |
| 7 | Create `file_store.py` | Save uploaded files and result JSONs to local disk | Done |
| 8 | Create upload endpoint | `POST /upload` — validate MIME type (PDF/JPG/PNG), save file, create job, enqueue task | Done |
| 9 | Create RQ worker skeleton | Worker that picks up jobs, logs job ID, marks complete — no pipeline yet | Done |
| 10 | Create `docker-compose.yml` | **3 services only: api, worker, redis** — Ollama stays native on host (already installed with model). Worker calls Ollama at `http://host.docker.internal:11434` via `OLLAMA_BASE_URL` env var | Done |

---

## Phase 2 — Docling: Digital PDFs

| # | Task | Description | Status |
|---|------|-------------|--------|
| 11 | Create `detector.py` | Detect if PDF has a native text layer (digital) vs is image-only (scanned) | Done |
| 12 | Create `docling_processor.py` — digital path | Use Docling to extract text from digital PDFs and output clean Markdown | Done |
| 13 | Wire Docling into worker | Worker calls detector → docling_processor, logs Markdown output for manual review | Done |

---

## Phase 3 — Docling: Scanned PDFs & Images

| # | Task | Description | Status |
|---|------|-------------|--------|
| 14 | Extend `docling_processor.py` — scanned path | Enable OCR + TableFormer path in Docling for scanned PDFs and image files | Pending |
| 15 | Test both Docling paths | Run a digital PDF and a scanned PDF through each path, inspect Markdown quality | Pending |
| 15a | Get sample test fixtures | Download 2–3 real financial statement PDFs (balance sheet, income statement) — one digital, one scanned — to use throughout testing in tasks 15, 20, and 23 | Pending |

---

## Phase 4 — LLM Extraction

| # | Task | Description | Status |
|---|------|-------------|--------|
| 16 | ~~Pull Ollama model~~ | ~~Pull `qwen3.5:4b` via Ollama~~ | Done |
| 17 | Create extraction prompt | Write `prompts/financial_extraction.txt` — instruct LLM to extract all data as nested JSON | Pending |
| 18 | Create `ollama_extractor.py` | Call Ollama REST API with Markdown + prompt, parse JSON response with error recovery | Pending |
| 19 | Wire Ollama into worker | Full pipeline: detector → docling → ollama → save result | Pending |
| 20 | Iterate on prompt quality | Test with sample financial documents, tune prompt until extracted JSON is accurate | Pending |

---

## Phase 5 — API Completion

| # | Task | Description | Status |
|---|------|-------------|--------|
| 21 | Create jobs endpoint | `GET /jobs/{id}` — return job status and progress from SQLite | Pending |
| 22 | Create results endpoint | `GET /results/{id}` — return full extraction JSON from file system | Pending |
| 23 | End-to-end test | Upload a real balance sheet PDF → poll status → fetch result → verify JSON manually | Pending |

---

## Phase 6 — Hardening

| # | Task | Description | Status |
|---|------|-------------|--------|
| 24 | Error handling | Handle corrupt file, unsupported MIME type, Ollama timeout, blank pages gracefully | Pending |
| 25 | Unit tests | Tests for detector, docling_processor, ollama_extractor | Pending |
| 26 | Integration tests | End-to-end API flow: upload → poll → result for digital PDF, scanned PDF, image | Pending |
| 27 | Docker Compose end-to-end | Verify all 4 services start and full pipeline works inside Docker | Pending |
| 28 | Write README | Setup instructions, how to run locally, how to run with Docker | Pending |

---

## Phase 7 — Frontend UI

| # | Task | Description | Status |
|---|------|-------------|--------|
| 29 | Scaffold React app | Vite + TypeScript inside `financial-extractor/ui/` | Pending |
| 30 | Upload page | Drag-and-drop file upload, calls `POST /upload`, shows job ID | Pending |
| 31 | Status polling | Polls `GET /jobs/:id` every 3s, shows progress indicator | Pending |
| 32 | Results view | Renders extracted JSON as a readable tree, not raw text | Pending |
| 33 | Download button | Download result as JSON or CSV | Pending |
| 34 | Error states | Clear error messages for failed jobs or unsupported files | Pending |
| 35 | Serve from FastAPI | FastAPI serves the built React app as static files — no separate server needed | Pending |

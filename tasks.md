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
| 14 | Extend `docling_processor.py` — scanned path | Enable OCR + TableFormer path in Docling for scanned PDFs and image files | Done |
| 15 | Test both Docling paths | Run a digital PDF and a scanned PDF through each path, inspect Markdown quality | Done |
| 15a | Get sample test fixtures | Download 2–3 real financial statement PDFs (balance sheet, income statement) — one digital, one scanned — to use throughout testing in tasks 15, 20, and 23 | Done |

---

## Phase 4 — LLM Extraction

| # | Task | Description | Status |
|---|------|-------------|--------|
| 16 | ~~Pull Ollama model~~ | ~~Pull `qwen3.5:4b` via Ollama~~ | Done |
| 17 | Create extraction prompt | Write `prompts/financial_extraction.txt` — instruct LLM to extract all data as nested JSON | Done |
| 18 | Create `ollama_extractor.py` | Call Ollama REST API with Markdown + prompt, parse JSON response with error recovery | Done |
| 19 | Wire Ollama into worker | Full pipeline: detector → docling → ollama → save result | Done |
| 20 | Iterate on prompt quality | Test with sample financial documents, tune prompt until extracted JSON is accurate | Done |

---

## Phase 5 — API Completion

| # | Task | Description | Status |
|---|------|-------------|--------|
| 21 | Create jobs endpoint | `GET /jobs/{id}` — return job status and progress from SQLite | Done |
| 22 | Create results endpoint | `GET /results/{id}` — return full extraction JSON from file system | Done |
| 23 | End-to-end test | Upload a real balance sheet PDF → poll status → fetch result → verify JSON manually | Done |

---

## Phase 6 — Hardening

| # | Task | Description | Status |
|---|------|-------------|--------|
| 24 | Error handling | Handle corrupt file, unsupported MIME type, Ollama timeout, blank pages gracefully | Done |
| 25 | Unit tests | Tests for detector, docling_processor, ollama_extractor | Done |
| 26 | Integration tests | End-to-end API flow: upload → poll → result for digital PDF, scanned PDF, image | Done |
| 27 | Docker Compose end-to-end | Verify all 4 services start and full pipeline works inside Docker | Done |
| 28 | Write README | Setup instructions, how to run locally, how to run with Docker | Done |

---

## Phase 6b — Backend Additions

| # | Task | Description | Status |
|---|------|-------------|--------|
| 28a | Add reprocess endpoint | `POST /jobs/{id}/reprocess` — reset status to queued, clear result_path + error, re-enqueue `process_job(job_id)` in RQ. File: `app/api/jobs.py` | Done |
| 28b | Add list jobs endpoint | `GET /jobs` — return all jobs from SQLite ordered by created_at DESC. Useful for testing and future admin use. File: `app/api/jobs.py` | Done |

---

## Phase 7 — Frontend UI

| # | Task | Description | Status |
|---|------|-------------|--------|
| 29 | Scaffold React app | Vite + TypeScript inside `financial-extractor/ui/` | Pending |
| 30 | Drop zone (multi-file) | Drag-and-drop multiple files, client-side MIME/size validation, staged file list with remove, uploads each file via `POST /upload` in parallel | Pending |
| 31 | Jobs table | Table with columns: checkbox, filename, status badge, metadata, accuracy rating, view button, download button, actions menu. Rows persisted in localStorage. | Pending |
| 32 | Status polling | Each row polls `GET /jobs/:id` every 3s, stops on terminal state. Metadata populates on completion. | Pending |
| 33 | View modal | Modal overlay with collapsible section tree, metadata header, footer buttons: Reprocess / Download / Close. Esc to close. | Pending |
| 34 | Download options | Per-row and bulk: JSON download, CSV download (depth-first flatten), bulk ZIP download, bulk merged CSV with source_file column | Pending |
| 35 | Bulk actions | Multi-select rows, bulk action bar: Download ZIP, Merged CSV, Reprocess, Clear from list | Pending |
| 36 | Error states | Failed row shows error in status cell. Upload errors shown inline in drop zone. Reprocess resets failed jobs. | Pending |
| 37 | Serve from FastAPI | FastAPI serves the built React app as static files from `ui/dist/` — no separate server needed | Pending |

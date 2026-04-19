# DocAI — Claude Code Guide

Financial Document Extraction Tool for bank operations teams.
Upload a financial document (PDF/image) → receive structured JSON of all extracted data.

---

## Key Files — Read These First

| File | Purpose |
|------|---------|
| `plan.md` | Full implementation plan — stack choices, folder structure, LLM prompt strategy, verification steps |
| `tasks.md` | All 35 tasks across 7 phases with status. Start here to know what's done and what's next |
| `architecture.md` | Mermaid architecture diagram — open in Obsidian to render |
| `test.md` | **After every phase implementation, run the tests described here before marking any task Done** |

---

## Testing Rule

**After completing every phase, read `test.md` and run all tests described there before marking tasks Done.**

---

## Project Location

Code goes in: `~/Projects/DocAI/financial-extractor/`

---

## Runtime Environment (already set up — do not reinstall)

| Tool | Status | Detail |
|------|--------|--------|
| Python 3.11 | Installed | `/opt/homebrew/bin/python3.11` — use this, NOT system python3 |
| Docker Desktop | Installed + running | `docker` and `docker compose` available |
| Ollama | Installed + running natively | Binary at `/opt/homebrew/bin/ollama`, server on `http://localhost:11434` |
| qwen3.5:4b | Downloaded | 3.4 GB model ready — task 16 in tasks.md is already Done |

**Important:** Ollama runs natively on the host, NOT in Docker. Docker Compose runs only 3 services: `api`, `worker`, `redis`. The worker reaches Ollama via `http://host.docker.internal:11434`.

---

## Stack

- **Language:** Python 3.11
- **API:** FastAPI + Uvicorn
- **Document parsing:** Docling (IBM open source) — handles digital PDFs, scanned PDFs, images
- **LLM extraction:** Ollama + qwen3.5:4b (local, no API cost, no data leaves machine)
- **Task queue:** RQ (Redis Queue)
- **Storage:** SQLite (jobs) + local file system (documents + results)
- **UI (Phase 7):** React + Vite, served as static files from FastAPI

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/upload` | Upload document, returns `job_id` immediately |
| GET | `/jobs/{id}` | Poll job status (queued / running / completed / failed) |
| GET | `/results/{id}` | Fetch extracted JSON when job is complete |
| GET | `/health` | Health check |

---

## Running Locally (without Docker)

```bash
cd ~/Projects/DocAI/financial-extractor
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000   # API
rq worker extraction                         # Worker (separate terminal)
```

Ollama must be running (`ollama serve` or via the Ollama menu bar app).

## Running with Docker

```bash
cd ~/Projects/DocAI/financial-extractor
docker compose -f docker/docker-compose.yml up
```

Redis and the app services start in Docker. Ollama continues running natively on the host.

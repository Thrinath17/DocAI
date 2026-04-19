# Financial Extractor

Upload a financial document (PDF or image) and get back a structured JSON of all extracted financial data — balance sheets, income statements, cash flow statements.

Everything runs locally. No paid APIs, no data leaves your machine.

---

## What it does

1. You upload a PDF (digital or scanned) or image (JPEG/PNG)
2. Docling parses it to clean Markdown (with OCR for scanned files)
3. A local Ollama LLM (`qwen3.5:4b`) extracts all financial data as structured JSON
4. You poll for status and fetch the result when complete

---

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11 | `/opt/homebrew/bin/python3.11` on Mac with Homebrew |
| Docker Desktop | Any recent | For the containerised setup |
| Ollama | Any | Must be running natively (not in Docker) |
| qwen3.5:4b | — | Pull once: `ollama pull qwen3.5:4b` |

---

## Setup

```bash
git clone <repo>
cd financial-extractor

# Copy env template and edit if needed
cp .env.example .env

# Create virtual environment (local dev only)
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

---

## Running locally (without Docker)

You need Ollama running and Redis available locally.

**Terminal 1 — API:**
```bash
cd financial-extractor
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Worker:**
```bash
cd financial-extractor
source .venv/bin/activate
./run-worker.sh
```

---

## Running with Docker

Ollama must be running natively on your host (the worker reaches it via `host.docker.internal:11434`).

```bash
cd financial-extractor
docker compose -f docker/docker-compose.yml up
```

This starts 3 containers: `api` (port 8000), `worker`, and `redis`.

To rebuild after code changes:
```bash
docker compose -f docker/docker-compose.yml build
```

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/upload` | Upload a file. Returns `job_id` immediately. |
| `GET` | `/jobs/{id}` | Poll job status: `queued` / `running` / `completed` / `failed` |
| `GET` | `/results/{id}` | Fetch extracted JSON (returns 202 if not complete yet) |
| `GET` | `/health` | Health check |

**Upload example:**
```bash
JOB=$(curl -s -X POST http://localhost:8000/upload \
  -F "file=@balance-sheet.pdf;type=application/pdf" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

# Poll until done
while true; do
  STATUS=$(curl -s http://localhost:8000/jobs/$JOB | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 5
done

# Fetch result
curl -s http://localhost:8000/results/$JOB | python3 -m json.tool
```

**Supported file types:** PDF, JPEG, PNG (max 50 MB)

---

## Running tests

```bash
source .venv/bin/activate
pytest tests/ -v
```

Unit tests cover `detector`, `docling_processor`, and `ollama_extractor`. Integration tests cover the full API flow without needing a running Redis or Ollama.

---

## Configuration

All settings are loaded from environment variables (or a `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_MODEL` | `qwen3.5:4b` | Ollama model to use |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `UPLOAD_DIR` | `./uploads` | Where uploaded files are stored |
| `RESULTS_DIR` | `./results` | Where result JSONs are stored |
| `DATABASE_URL` | `./jobs.db` | SQLite database path |
| `MAX_UPLOAD_BYTES` | `52428800` | Max file size (50 MB) |

---

## Processing time (CPU only)

| Document type | Typical time |
|---------------|-------------|
| Digital PDF (3–5 pages) | 1–3 minutes |
| Scanned PDF / image (3–5 pages) | 3–7 minutes |

Time is dominated by the LLM extraction step. Adding a GPU speeds up Ollama automatically.

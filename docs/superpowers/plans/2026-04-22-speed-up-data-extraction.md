# Speed Up Data Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce per-document extraction time from ~2 minutes to under 60 seconds by adding timing instrumentation, optimising Ollama inference parameters, enabling Apple Silicon GPU acceleration in Docling, and supporting parallel worker processes.

**Architecture:** The pipeline (detect → Docling → Ollama → save) has no timing today, so we don't know which stage owns the 2 minutes. We instrument first, then apply targeted fixes in order of impact: Ollama context/token limits, markdown size cap before the LLM, Docling MPS acceleration for Apple Silicon, and a multi-worker setup for parallel throughput.

**Tech Stack:** Python 3.11, Docling v2 (`AcceleratorOptions`), Ollama Python SDK, RQ, Docker Compose

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `app/queue/worker.py` | Modify | Add per-stage `time.perf_counter()` timing logs |
| `scripts/monitor-resources.sh` | Create | Shell script: check Ollama GPU status + CPU usage during a job |
| `app/config.py` | Modify | Add `ollama_num_ctx`, `ollama_num_predict`, `max_markdown_chars` env-backed settings |
| `app/pipeline/ollama_extractor.py` | Modify | Pass new config params to `generate()`; truncate oversized markdown before LLM call |
| `app/pipeline/docling_processor.py` | Modify | Enable `AcceleratorOptions` (MPS on Apple Silicon, 4 CPU threads) |
| `docker/docker-compose.yml` | Modify | Document `--scale worker=N` pattern; no hardcoded replicas needed |
| `run-worker.sh` | Modify | Accept optional COUNT arg to start N workers locally |
| `tests/unit/test_worker_timing.py` | Create | Tests for timing log output |
| `tests/unit/test_config.py` | Create | Tests for new config fields and env-var overrides |
| `tests/unit/test_ollama_extractor.py` | Add tests | Tests for `_truncate_markdown` and `num_ctx`/`num_predict` pass-through |
| `tests/unit/test_docling_processor.py` | Add tests | Test that `_make_converter` passes `AcceleratorOptions` |

---

## Task 1: Add Per-Stage Timing to the Worker

**Files:**
- Modify: `app/queue/worker.py`
- Create: `tests/unit/test_worker_timing.py`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_worker_timing.py`:

```python
from unittest.mock import patch, MagicMock
from app.queue.worker import process_job


def test_process_job_logs_timing(caplog):
    job = MagicMock()
    job.file_path = "/fake/doc.pdf"

    with patch("app.queue.worker.get_job", return_value=job), \
         patch("app.queue.worker.update_job"), \
         patch("app.queue.worker.detect", return_value="digital"), \
         patch("app.queue.worker.to_markdown", return_value="## Balance Sheet\n\n| A | B |\n| 1 | 2 |"), \
         patch("app.queue.worker.extract", return_value={"test": 1}), \
         patch("app.queue.worker.save_result", return_value="/fake/result.json"), \
         caplog.at_level("INFO"):
        process_job("test-job-123")

    timing_logs = [r.message for r in caplog.records if "TIMING" in r.message]
    assert any("stage=detect" in log for log in timing_logs)
    assert any("stage=docling" in log for log in timing_logs)
    assert any("stage=ollama" in log for log in timing_logs)
    assert any("stage=total" in log for log in timing_logs)
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd ~/Projects/DocAI/financial-extractor && source .venv/bin/activate
pytest tests/unit/test_worker_timing.py -v
```
Expected: FAIL — `AssertionError` because no TIMING lines are logged yet.

- [ ] **Step 3: Replace app/queue/worker.py with timed version**

```python
import logging
import time

from app.models.job import JobStatus
from app.queue.job_store import get_job, update_job
from app.pipeline.detector import detect, DocumentKind
from app.pipeline.docling_processor import to_markdown
from app.pipeline.ollama_extractor import extract
from app.storage.file_store import save_result

logger = logging.getLogger(__name__)


def process_job(job_id: str) -> None:
    logger.info("Starting job %s", job_id)

    job = get_job(job_id)
    if job is None:
        logger.error("Job %s not found in database", job_id)
        return

    update_job(job_id, JobStatus.running)

    try:
        t0 = time.perf_counter()

        kind = detect(job.file_path)
        t1 = time.perf_counter()
        logger.info("TIMING job=%s stage=detect elapsed=%.2fs kind=%s", job_id, t1 - t0, kind)

        markdown = to_markdown(job.file_path, use_ocr=(kind == DocumentKind.scanned))
        t2 = time.perf_counter()
        logger.info(
            "TIMING job=%s stage=docling elapsed=%.2fs markdown_len=%d",
            job_id, t2 - t1, len(markdown),
        )

        result = extract(markdown)
        t3 = time.perf_counter()
        logger.info("TIMING job=%s stage=ollama elapsed=%.2fs", job_id, t3 - t2)

        result_path = save_result(job_id, result)
        update_job(job_id, JobStatus.completed, result_path=result_path)

        logger.info(
            "TIMING job=%s stage=total elapsed=%.2fs | detect=%.2fs docling=%.2fs ollama=%.2fs",
            job_id, t3 - t0,
            t1 - t0,
            t2 - t1,
            t3 - t2,
        )

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        update_job(job_id, JobStatus.failed, error=str(exc))
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/test_worker_timing.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/queue/worker.py tests/unit/test_worker_timing.py
git commit -m "feat: add per-stage timing instrumentation to extraction worker"
```

---

## Task 2: Create Resource Monitoring Script

**Files:**
- Create: `scripts/monitor-resources.sh`

This script is run in a second terminal **while a job is processing** to show where CPU/GPU time is going. Run it immediately after uploading a document.

- [ ] **Step 1: Create scripts directory and write the script**

```bash
mkdir -p ~/Projects/DocAI/financial-extractor/scripts
```

Create `scripts/monitor-resources.sh`:

```bash
#!/bin/bash
# Run this in a second terminal WHILE a job is processing.
# It shows Ollama GPU status, worker CPU/memory, and how to get GPU power readings.
#
# Usage: ./scripts/monitor-resources.sh

set -euo pipefail

echo "=== Ollama: loaded models and VRAM/RAM usage ==="
/opt/homebrew/bin/ollama ps

echo ""
echo "=== Worker process CPU + memory ==="
WORKER_PID=$(pgrep -f "rq worker" | head -1 || true)
if [ -n "$WORKER_PID" ]; then
    ps -p "$WORKER_PID" -o pid,command,pcpu,pmem,rss
else
    echo "No rq worker process found. Is the worker running?"
fi

echo ""
echo "=== Top CPU consumers (snapshot) ==="
ps -Ao pid,command,pcpu,pmem -r | head -10

echo ""
echo "=== Ollama GPU acceleration check ==="
OLLAMA_PS=$(/opt/homebrew/bin/ollama ps 2>/dev/null || echo "")
if echo "$OLLAMA_PS" | grep -q "100%"; then
    echo "OK — model fully loaded into GPU (Metal MPS active)"
elif echo "$OLLAMA_PS" | grep -q "%"; then
    echo "WARNING — model only partially on GPU. Some layers running on CPU (slow)."
    echo "$OLLAMA_PS"
else
    echo "Model not currently loaded. Upload a doc and re-run this script during processing."
fi

echo ""
echo "=== For live GPU power during a job run ==="
echo "  sudo powermetrics --samplers gpu_power -i 500 -n 10"
echo "  Look for 'GPU Power' > 0 W — confirms Metal inference is active."
```

- [ ] **Step 2: Make executable and verify it runs cleanly**

```bash
chmod +x ~/Projects/DocAI/financial-extractor/scripts/monitor-resources.sh
bash -n ~/Projects/DocAI/financial-extractor/scripts/monitor-resources.sh
```
Expected: No syntax errors printed.

```bash
~/Projects/DocAI/financial-extractor/scripts/monitor-resources.sh
```
Expected: Prints Ollama status and CPU summary without error (Ollama section may say "not loaded" if no job is running — that's fine).

- [ ] **Step 3: How to read the output**

| Output | What it means | Action |
|--------|---------------|--------|
| `ollama ps` shows `100%` GPU | Metal MPS is active — Ollama is fast | Nothing needed |
| `ollama ps` shows `0%` or empty | CPU-only inference — very slow | Restart Ollama: `ollama serve` |
| Worker CPU > 80% during Docling stage | Docling OCR is CPU-bound | Task 5 (AcceleratorOptions) will help |
| Worker CPU < 10%, job still running | Waiting on Ollama — LLM is bottleneck | Tasks 3–4 will help |

- [ ] **Step 4: Commit**

```bash
git add scripts/monitor-resources.sh
git commit -m "feat: add resource monitoring script for extraction pipeline profiling"
```

---

## Task 3: Add Tunable Ollama Parameters to Config

**Files:**
- Modify: `app/config.py`
- Modify: `.env.example`
- Create: `tests/unit/test_config.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/test_config.py`:

```python
from app.config import Settings


def test_ollama_perf_defaults():
    s = Settings()
    assert s.ollama_num_ctx == 8192
    assert s.ollama_num_predict == 2048
    assert s.max_markdown_chars == 40_000


def test_ollama_perf_from_env(monkeypatch):
    monkeypatch.setenv("OLLAMA_NUM_CTX", "4096")
    monkeypatch.setenv("OLLAMA_NUM_PREDICT", "1024")
    monkeypatch.setenv("MAX_MARKDOWN_CHARS", "20000")
    s = Settings()
    assert s.ollama_num_ctx == 4096
    assert s.ollama_num_predict == 1024
    assert s.max_markdown_chars == 20000
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd ~/Projects/DocAI/financial-extractor && source .venv/bin/activate
pytest tests/unit/test_config.py -v
```
Expected: FAIL — `AttributeError: 'Settings' object has no attribute 'ollama_num_ctx'`

- [ ] **Step 3: Update app/config.py**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    ollama_model: str = "qwen3.5:4b"
    ollama_base_url: str = "http://localhost:11434"
    ollama_num_ctx: int = 8192      # context window tokens — smaller = faster KV cache prefill
    ollama_num_predict: int = 2048  # max output tokens — financial JSON rarely exceeds this

    redis_url: str = "redis://localhost:6379/0"

    upload_dir: str = "./uploads"
    results_dir: str = "./results"

    database_url: str = "./jobs.db"

    max_upload_bytes: int = 50 * 1024 * 1024
    max_markdown_chars: int = 40_000  # truncate before LLM if markdown is larger than this


settings = Settings()
```

- [ ] **Step 4: Add to .env.example**

Open `.env.example` and append these lines at the end:

```
# Ollama performance tuning
OLLAMA_NUM_CTX=8192
OLLAMA_NUM_PREDICT=2048
MAX_MARKDOWN_CHARS=40000
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/unit/test_config.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/config.py .env.example tests/unit/test_config.py
git commit -m "feat: add tunable Ollama performance parameters to config"
```

---

## Task 4: Apply Parameters and Add Markdown Truncation in Extractor

**Files:**
- Modify: `app/pipeline/ollama_extractor.py`
- Modify: `tests/unit/test_ollama_extractor.py` (add new tests, keep existing ones)

- [ ] **Step 1: Add the failing tests to tests/unit/test_ollama_extractor.py**

Append these functions to the existing file (do not remove any existing tests):

```python
from unittest.mock import patch, MagicMock
from app.pipeline.ollama_extractor import _truncate_markdown, extract


def test_truncate_markdown_short_text_unchanged():
    md = "Short financial summary"
    assert _truncate_markdown(md, max_chars=100) == md


def test_truncate_markdown_long_text_is_cut():
    md = "x" * 200
    result = _truncate_markdown(md, max_chars=100)
    assert len(result) < 200
    assert "[TRUNCATED" in result


def test_extract_passes_num_ctx_and_num_predict():
    mock_response = MagicMock()
    mock_response.response = '{"company": "ACME", "revenue": 100}'

    with patch("app.pipeline.ollama_extractor.Client") as MockClient:
        mock_client = MockClient.return_value
        mock_client.generate.return_value = mock_response

        extract("## Balance Sheet\n\n| Assets | 100 |")

        call_kwargs = mock_client.generate.call_args.kwargs
        assert "num_ctx" in call_kwargs["options"]
        assert "num_predict" in call_kwargs["options"]
        assert call_kwargs["options"]["num_ctx"] == 8192
        assert call_kwargs["options"]["num_predict"] == 2048
```

- [ ] **Step 2: Run to verify the new tests fail**

```bash
pytest tests/unit/test_ollama_extractor.py -v -k "truncate or num_ctx"
```
Expected: FAIL — `ImportError: cannot import name '_truncate_markdown'` and assertion errors

- [ ] **Step 3: Replace app/pipeline/ollama_extractor.py**

```python
import json
import logging
import re
from pathlib import Path

from ollama import Client

from app.config import settings

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "financial_extraction.txt"
_prompt_template: str | None = None


def _get_prompt_template() -> str:
    global _prompt_template
    if _prompt_template is None:
        _prompt_template = _PROMPT_PATH.read_text(encoding="utf-8")
    return _prompt_template


def _truncate_markdown(markdown: str, max_chars: int) -> str:
    if len(markdown) <= max_chars:
        return markdown
    logger.warning(
        "Markdown length %d exceeds max_markdown_chars=%d — truncating. "
        "Raise MAX_MARKDOWN_CHARS in .env if extraction is missing data.",
        len(markdown), max_chars,
    )
    return markdown[:max_chars] + "\n\n[TRUNCATED — document exceeded size limit]"


def _parse_json(text: str) -> dict:
    # qwen3 models emit <think>...</think> before the answer — strip it
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # Strip markdown code fences if the model wrapped the JSON anyway
    text = re.sub(r"^```(?:json)?\s*", "", text).rstrip("` \n")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: extract outermost JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(
        f"Could not parse JSON from LLM response. Preview: {text[:300]!r}"
    )


def extract(markdown: str) -> dict:
    markdown = _truncate_markdown(markdown, settings.max_markdown_chars)
    prompt = _get_prompt_template().replace("{markdown_content}", markdown)

    client = Client(host=settings.ollama_base_url, timeout=300)
    logger.info(
        "ollama: model=%s prompt_len=%d num_ctx=%d num_predict=%d",
        settings.ollama_model, len(prompt),
        settings.ollama_num_ctx, settings.ollama_num_predict,
    )

    response = client.generate(
        model=settings.ollama_model,
        prompt=prompt,
        stream=False,
        think=False,
        options={
            "temperature": 0,
            "num_ctx": settings.ollama_num_ctx,
            "num_predict": settings.ollama_num_predict,
        },
    )

    raw = response.response
    logger.info("ollama: response_len=%d chars", len(raw))

    result = _parse_json(raw)
    logger.info("ollama: extracted %d top-level keys", len(result))
    return result
```

- [ ] **Step 4: Run the full extractor test suite to verify all pass**

```bash
pytest tests/unit/test_ollama_extractor.py -v
```
Expected: All tests PASS (existing `_parse_json` tests + new truncate/num_ctx tests)

- [ ] **Step 5: Commit**

```bash
git add app/pipeline/ollama_extractor.py tests/unit/test_ollama_extractor.py
git commit -m "feat: add num_ctx/num_predict limits and markdown truncation to Ollama extractor"
```

---

## Task 5: Enable Docling Accelerator Options for Apple Silicon

**Files:**
- Modify: `app/pipeline/docling_processor.py`
- Modify: `tests/unit/test_docling_processor.py` (add test, keep existing tests)

- [ ] **Step 1: Verify AcceleratorOptions is available in the installed Docling version**

```bash
cd ~/Projects/DocAI/financial-extractor && source .venv/bin/activate
python -c "from docling.datamodel.pipeline_options import AcceleratorOptions, AcceleratorDevice; print('OK')"
```

- If this prints `OK`: proceed with Steps 2–6.
- If this raises `ImportError`: skip to Step 6b (graceful fallback).

- [ ] **Step 2: Add the failing test to tests/unit/test_docling_processor.py**

Append this function to the existing file (do not remove any existing tests):

```python
def test_make_converter_passes_accelerator_options():
    from unittest.mock import patch, MagicMock
    from app.pipeline.docling_processor import _make_converter

    mock_accel_cls = MagicMock(return_value=MagicMock())

    with patch("app.pipeline.docling_processor.AcceleratorOptions", mock_accel_cls), \
         patch("app.pipeline.docling_processor.AcceleratorDevice", MagicMock()), \
         patch("app.pipeline.docling_processor.DocumentConverter"):
        _make_converter(use_ocr=False)

    mock_accel_cls.assert_called_once()
    call_kwargs = mock_accel_cls.call_args.kwargs
    assert call_kwargs.get("num_threads", 0) >= 4
```

- [ ] **Step 3: Run to verify it fails**

```bash
pytest tests/unit/test_docling_processor.py::test_make_converter_passes_accelerator_options -v
```
Expected: FAIL — `AssertionError` (AcceleratorOptions not called yet)

- [ ] **Step 4: Replace app/pipeline/docling_processor.py**

```python
import logging
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    AcceleratorOptions,
    AcceleratorDevice,
)
from docling.document_converter import DocumentConverter, PdfFormatOption

logger = logging.getLogger(__name__)


def _make_converter(use_ocr: bool) -> DocumentConverter:
    opts = PdfPipelineOptions()
    opts.do_ocr = use_ocr
    opts.do_table_structure = True  # TableFormer — critical for balance sheets
    opts.accelerator_options = AcceleratorOptions(
        num_threads=4,              # parallel page processing on CPU
        device=AcceleratorDevice.AUTO,  # MPS on Apple Silicon, CUDA on Nvidia, CPU otherwise
    )
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )


# Module-level converters — initialised once per worker process to avoid
# reloading the TableFormer weights on every job.
_converter_digital: DocumentConverter | None = None
_converter_ocr: DocumentConverter | None = None


def _get_converter(use_ocr: bool) -> DocumentConverter:
    global _converter_digital, _converter_ocr
    if use_ocr:
        if _converter_ocr is None:
            logger.info("Initialising Docling converter (OCR=True)")
            _converter_ocr = _make_converter(use_ocr=True)
        return _converter_ocr
    else:
        if _converter_digital is None:
            logger.info("Initialising Docling converter (OCR=False)")
            _converter_digital = _make_converter(use_ocr=False)
        return _converter_digital


def to_markdown(file_path: str, use_ocr: bool) -> str:
    """
    Convert *file_path* to Markdown.  Returns the Markdown string.
    Raises RuntimeError if Docling reports a failure.
    """
    path = Path(file_path)
    logger.info("docling: converting %s (ocr=%s)", path.name, use_ocr)

    converter = _get_converter(use_ocr)
    result = converter.convert(str(path))

    if result.status.name not in ("SUCCESS", "PARTIAL_SUCCESS"):
        raise RuntimeError(
            f"Docling conversion failed for {path.name}: status={result.status.name}"
        )

    markdown = result.document.export_to_markdown()
    logger.info(
        "docling: %s → %d chars of Markdown (status=%s)",
        path.name,
        len(markdown),
        result.status.name,
    )

    if not markdown.strip():
        raise RuntimeError(
            f"Docling produced no text for {path.name}. The file may be blank or corrupt."
        )

    return markdown
```

- [ ] **Step 5: Run all docling tests to verify they pass**

```bash
pytest tests/unit/test_docling_processor.py -v
```
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add app/pipeline/docling_processor.py tests/unit/test_docling_processor.py
git commit -m "feat: enable AcceleratorOptions in Docling for Apple Silicon MPS and 4-thread processing"
```

- [ ] **Step 6b (only if AcceleratorOptions unavailable — run instead of steps 2–6):**

If Step 1 raised `ImportError`, add a graceful fallback to `_make_converter` instead:

```python
def _make_converter(use_ocr: bool) -> DocumentConverter:
    opts = PdfPipelineOptions()
    opts.do_ocr = use_ocr
    opts.do_table_structure = True
    try:
        from docling.datamodel.pipeline_options import AcceleratorOptions, AcceleratorDevice
        opts.accelerator_options = AcceleratorOptions(
            num_threads=4,
            device=AcceleratorDevice.AUTO,
        )
        logger.info("Docling AcceleratorOptions enabled (num_threads=4, device=AUTO)")
    except ImportError:
        logger.warning("AcceleratorOptions not available in this Docling version — using defaults")
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )
```

Then commit:

```bash
git add app/pipeline/docling_processor.py
git commit -m "feat: add AcceleratorOptions to Docling with graceful fallback for older versions"
```

---

## Task 6: Support Multiple Parallel Workers

**Files:**
- Modify: `run-worker.sh`

Multiple workers process queued jobs concurrently — this doesn't speed up a single document but allows N documents uploaded at once to be processed in parallel.

**Note on Docker:** `docker compose up --scale worker=2` already works with the current `docker-compose.yml` — no file change needed. Each worker instance is a separate container sharing the same Redis queue and SQLite volume.

- [ ] **Step 1: Update run-worker.sh to accept a COUNT argument**

```bash
#!/bin/bash
# Always use this script to start workers locally — never call rq directly.
# OBJC_DISABLE_INITIALIZE_FORK_SAFETY is required on macOS; without it the
# worker's forked child process is silently killed by the OS, leaving jobs
# stuck in 'running' state with no error logged.
#
# Usage:
#   ./run-worker.sh        # 1 worker (default)
#   ./run-worker.sh 2      # 2 workers in background
set -e

COUNT=${1:-1}

if [ "$COUNT" -eq 1 ]; then
    OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES \
      exec rq worker extraction --url "${REDIS_URL:-redis://localhost:6379/0}"
else
    echo "Starting $COUNT workers..."
    for i in $(seq 1 "$COUNT"); do
        OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES \
          rq worker extraction --url "${REDIS_URL:-redis://localhost:6379/0}" &
        echo "Worker $i started (PID $!)"
    done
    echo "Stop all workers with: pkill -f 'rq worker'"
    wait
fi
```

- [ ] **Step 2: Verify no syntax errors**

```bash
bash -n ~/Projects/DocAI/financial-extractor/run-worker.sh
```
Expected: No output (clean parse).

- [ ] **Step 3: Test single-worker invocation still works**

```bash
cd ~/Projects/DocAI/financial-extractor && source .venv/bin/activate
timeout 3 ./run-worker.sh || true
```
Expected: Worker starts, prints `RQ worker 'extraction' started`, then exits after 3 seconds (timeout). No crash.

- [ ] **Step 4: Document Docker multi-worker usage in a comment in docker-compose.yml**

Open `docker/docker-compose.yml` and add a comment at the very top:

```yaml
# To run multiple workers for parallel job processing:
#   docker compose -f docker/docker-compose.yml up --scale worker=2
#
# Each worker instance shares the uploads/, results/, and jobs.db volumes.
```

- [ ] **Step 5: Commit**

```bash
git add run-worker.sh docker/docker-compose.yml
git commit -m "feat: support multiple parallel workers via run-worker.sh count arg and docker compose scale"
```

---

## Task 7: Run Full Test Suite and Verify All Timings

After implementing all tasks, run the full test suite and then process a real document to measure the improvement.

- [ ] **Step 1: Run unit tests**

```bash
cd ~/Projects/DocAI/financial-extractor && source .venv/bin/activate
pytest tests/unit/ -v
```
Expected: All tests PASS.

- [ ] **Step 2: Start the stack and process a real document**

In terminal 1:
```bash
cd ~/Projects/DocAI/financial-extractor && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

In terminal 2:
```bash
cd ~/Projects/DocAI/financial-extractor && source .venv/bin/activate
./run-worker.sh
```

In terminal 3 — upload a PDF and watch the worker logs:
```bash
curl -s -F "file=@uploads/<any-existing-pdf-uuid>.pdf" http://localhost:8000/upload
```
(Replace `<any-existing-pdf-uuid>` with a real filename from the `uploads/` directory.)

- [ ] **Step 3: Read the TIMING lines from worker output**

The worker will print lines like:
```
TIMING job=abc stage=detect    elapsed=0.03s  kind=digital
TIMING job=abc stage=docling   elapsed=18.4s  markdown_len=6234
TIMING job=abc stage=ollama    elapsed=42.1s
TIMING job=abc stage=total     elapsed=60.6s  | detect=0.03s docling=18.4s ollama=42.1s
```

Use the breakdown to decide if further tuning is needed:
- **Docling > 30s**: consider reducing `num_threads` if CPU is thermal-throttling, or check that `AcceleratorDevice.AUTO` picked MPS
- **Ollama > 60s**: reduce `OLLAMA_NUM_CTX` in `.env` (try `4096`) or check GPU with `./scripts/monitor-resources.sh`
- **markdown_len > 40000**: a document was truncated — raise `MAX_MARKDOWN_CHARS` in `.env` if results are incomplete

---

## Self-Review

**Spec coverage:**
- ✓ "how to increase the speed of data extraction" — Tasks 3–5 reduce per-doc time (Ollama context limits, markdown cap, Docling MPS)
- ✓ "how to check resource utilization" — Task 2 (monitoring script) + Task 1 (timing logs show exactly where time goes)
- ✓ Parallel throughput — Task 6 (multi-worker)

**Placeholder scan:** All tasks contain complete, runnable code. No TBD, no "similar to task N", no empty steps.

**Type consistency:**
- `_truncate_markdown(markdown: str, max_chars: int) -> str` defined in Task 4 Step 3, tested in Task 4 Step 1 — consistent.
- `AcceleratorOptions(num_threads=4, device=AcceleratorDevice.AUTO)` used in Task 5 Step 4 and tested in Task 5 Step 2 with `call_kwargs.get("num_threads")` — consistent.
- `settings.ollama_num_ctx` and `settings.ollama_num_predict` added in Task 3, consumed in Task 4, tested in both — consistent.

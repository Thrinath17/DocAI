# DocAI Extraction Performance — Findings & Suggestions

**Date:** 2026-04-23
**Baseline:** ~2 minutes per document (before changes on `feat/speed-up-extraction`)
**Test doc:** 486 KB digital PDF, `qwen3.5:4b` model

---

## Timing Breakdown (after branch changes)

| Stage | Time | % of total | Notes |
|-------|------|------------|-------|
| detect | 0.23s | 0.2% | pypdfium2 text scan — negligible |
| docling | **9.87s** | 7.6% | Digital PDF path, MPS active |
| ollama | **119.38s** | 92.2% | **The bottleneck** |
| **total** | **129.47s** | | |

---

## What the Branch Already Fixed

### Docling: OCR/parsing is now fast
- `AcceleratorOptions(device=AUTO)` successfully activated **Apple Silicon MPS** (Metal GPU).
- Log confirms: `Accelerator device: 'mps'`
- Docling went from an estimated 60–90s (CPU-only) down to **9.87s**.
- For scanned PDFs and images (the OCR path), this improvement will be even larger.

### Ollama: parameters are now controlled
- `num_ctx=8192` and `num_predict=2048` are now passed explicitly to every inference call.
- Oversized markdown is truncated before hitting the LLM (prevents context overflow on large docs).
- `think=False` was already set — extended chain-of-thought is disabled.

---

## Root Cause: Ollama is the Bottleneck

Ollama consumed **119 seconds** (92% of total time) to process a ~10,400 character prompt and return a ~5,900 character JSON response.

### Why it's slow

| Factor | Detail |
|--------|--------|
| **Model size** | `qwen3.5:4b` is loaded as **6.0 GB** — this is a Q8 (near full-precision) quantization. Q4 would be ~2.7 GB and roughly 2× faster. |
| **Context window** | `num_ctx=8192` allocates a large KV cache. The actual prompt was ~2,600 tokens — only 32% of the window was used. |
| **Output length** | Response was ~1,400 tokens (~12 tokens/sec on MPS). This is normal for Q8 on M-series, but Q4 would be ~20–25 tok/sec. |

GPU IS active (`ollama ps` shows `100% GPU`, Metal confirmed). The slowness is the model weight size, not a GPU configuration issue.

---

## Suggestions (ordered by impact)

### 1. Switch to Q4 quantized model — biggest win, 5 min effort

Pull the Q4 version of the same model:

```bash
ollama pull qwen3:4b
```

Then update `.env`:

```
OLLAMA_MODEL=qwen3:4b
```

**Expected result:** Model drops from 6.0 GB → ~2.5 GB. Inference speed goes from ~12 tok/sec → ~25–35 tok/sec. Ollama stage should drop from 119s to ~50–60s. Quality impact is minimal for structured JSON extraction tasks.

> `qwen3:4b` is the default Q4_K_M quantization. It's the same model family, just lighter weights.

---

### 2. Reduce `OLLAMA_NUM_CTX` to 4096 — quick win, no model change needed

The prompt for this test doc was ~2,600 tokens. The current `num_ctx=8192` allocates a KV cache for 8,192 tokens — more than 3× what was needed.

Update `.env`:

```
OLLAMA_NUM_CTX=4096
```

**Expected result:** Smaller KV cache = faster attention computation and less memory pressure. Estimated saving: 20–40s on the Ollama stage. Safe for documents up to ~3,500 tokens of content (most single financial statements).

> If you process very long documents (multi-year reports, 20+ page PDFs), raise this back to 8192.

---

### 3. Run 2 workers for parallel throughput — no speed improvement per doc, but doubles volume

If multiple documents are uploaded at once, they queue up and process one at a time. Two workers process two docs simultaneously.

```bash
# Locally
./run-worker.sh 2

# Docker
docker compose -f docker/docker-compose.yml up --scale worker=2
```

**Expected result:** Two documents that previously took 4 minutes total now take ~2 minutes total. Per-document latency is unchanged; throughput doubles.

> On an M-series Mac with 16 GB RAM, running two concurrent Ollama instances will contend for memory. Test with your actual RAM before using this in production.

---

### 4. Consider `qwen2.5:3b` for fastest local inference (experimental)

If quality holds up for your specific documents, a 3B model infers ~2× faster than a 4B model:

```bash
ollama pull qwen2.5:3b
```

Test on a sample of real documents before switching. Financial extraction needs precise number copying — validate JSON accuracy before committing.

---

## Recommended Next Steps

1. **Do now:** Set `OLLAMA_NUM_CTX=4096` in `.env` — zero risk, immediate improvement.
2. **Do next:** Pull `qwen3:4b` and test extraction quality on 3–5 real documents. If JSON output matches the current model, switch permanently.
3. **Monitor:** After each change, run a job and grep the worker logs for `TIMING stage=ollama` to compare.

---

## How to Check Timing on Any Job

Worker logs print a summary line at the end of every job:

```
TIMING job=<id> stage=total elapsed=Xs | detect=Xs docling=Xs ollama=Xs
```

To grep it live:
```bash
# If running locally
./run-worker.sh 2>&1 | grep TIMING

# If running in Docker
docker compose logs -f worker | grep TIMING
```

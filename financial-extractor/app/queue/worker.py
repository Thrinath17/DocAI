import logging

from app.models.job import JobStatus
from app.queue.job_store import get_job, update_job
from app.pipeline.detector import detect, DocumentKind
from app.pipeline.docling_processor import to_markdown

logger = logging.getLogger(__name__)


def process_job(job_id: str) -> None:
    logger.info("Starting job %s", job_id)

    job = get_job(job_id)
    if job is None:
        logger.error("Job %s not found in database", job_id)
        return

    update_job(job_id, JobStatus.running)

    try:
        # Phase 2: detect document type then extract Markdown via Docling
        kind = detect(job.file_path)
        use_ocr = kind == DocumentKind.scanned
        logger.info("Job %s: document kind=%s", job_id, kind)

        markdown = to_markdown(job.file_path, use_ocr=use_ocr)

        # Log first 500 chars so the output can be inspected manually (task 13)
        logger.info(
            "Job %s: Markdown preview (first 500 chars):\n%s",
            job_id,
            markdown[:500] if markdown else "(empty)",
        )

        # Phase 4 will replace this with ollama_extractor → save_result
        update_job(job_id, JobStatus.completed)
        logger.info("Job %s completed (Docling done; LLM extraction pending Phase 4)", job_id)

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        update_job(job_id, JobStatus.failed, error=str(exc))

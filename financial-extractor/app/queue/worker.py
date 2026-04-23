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

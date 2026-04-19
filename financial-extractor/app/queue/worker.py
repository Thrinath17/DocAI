import logging

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
        kind = detect(job.file_path)
        logger.info("Job %s: document kind=%s", job_id, kind)

        markdown = to_markdown(job.file_path, use_ocr=(kind == DocumentKind.scanned))

        result = extract(markdown)

        result_path = save_result(job_id, result)
        update_job(job_id, JobStatus.completed, result_path=result_path)
        logger.info("Job %s completed → %s", job_id, result_path)

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        update_job(job_id, JobStatus.failed, error=str(exc))

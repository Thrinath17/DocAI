import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from redis import Redis
from rq import Queue

from app.config import settings
from app.models.job import JobResponse
from app.queue.job_store import create_job
from app.storage.file_store import save_upload
from app.storage.paths import ensure_dirs

router = APIRouter()

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}


@router.post("/upload", response_model=JobResponse, status_code=202)
async def upload_document(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: PDF, JPEG, PNG.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")
    if len(content) > settings.max_upload_bytes:
        max_mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {max_mb} MB size limit.",
        )

    ensure_dirs()
    job_id = str(uuid.uuid4())
    file_path = await save_upload(job_id, file.filename or f"{job_id}.bin", content)

    job = create_job(job_id, file_path)

    redis_conn = Redis.from_url(settings.redis_url)
    q = Queue("extraction", connection=redis_conn)
    q.enqueue("app.queue.worker.process_job", job_id, job_timeout=600)

    return JobResponse(job_id=job.id, status=job.status)

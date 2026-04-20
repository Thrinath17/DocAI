from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from redis import Redis
from rq import Queue
from typing import Optional

from app.config import settings
from app.models.job import JobResponse, JobStatus
from app.queue.job_store import get_job, list_jobs, update_job

router = APIRouter()


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    error: Optional[str] = None
    created_at: str
    updated_at: str


@router.get("/jobs", response_model=list[JobStatusResponse])
def list_all_jobs():
    jobs = list_jobs()
    return [
        JobStatusResponse(
            job_id=job.id,
            status=job.status,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
        for job in jobs
    ]


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        error=job.error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.post("/jobs/{job_id}/reprocess", response_model=JobResponse, status_code=202)
def reprocess_job(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    update_job(job_id, status=JobStatus.queued, result_path=None, error=None)
    redis_conn = Redis.from_url(settings.redis_url)
    q = Queue("extraction", connection=redis_conn)
    q.enqueue("app.queue.worker.process_job", job_id, job_timeout=600)
    return JobResponse(job_id=job_id, status=JobStatus.queued)

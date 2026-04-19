from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.models.job import JobStatus
from app.queue.job_store import get_job

router = APIRouter()


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    error: Optional[str] = None
    created_at: str
    updated_at: str


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

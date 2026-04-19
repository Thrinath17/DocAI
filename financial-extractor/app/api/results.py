from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.queue.job_store import get_job
from app.models.job import JobStatus
from app.storage.file_store import load_result, result_exists

router = APIRouter()


@router.get("/results/{job_id}")
def get_result(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    if job.status == JobStatus.failed:
        raise HTTPException(status_code=422, detail=f"Job failed: {job.error}")
    if job.status != JobStatus.completed:
        raise HTTPException(
            status_code=202,
            detail=f"Job is not complete yet. Current status: {job.status}",
        )
    if not result_exists(job_id):
        raise HTTPException(status_code=404, detail="Result file not found.")
    return JSONResponse(content=load_result(job_id))

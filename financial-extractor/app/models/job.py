from enum import Enum
from typing import Optional
from pydantic import BaseModel


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobRecord(BaseModel):
    id: str
    status: JobStatus
    file_path: str
    result_path: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus

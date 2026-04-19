import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.models.job import JobRecord, JobStatus


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _db():
    conn = sqlite3.connect(settings.database_url)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id          TEXT PRIMARY KEY,
                status      TEXT NOT NULL DEFAULT 'queued',
                file_path   TEXT NOT NULL,
                result_path TEXT,
                error       TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)


def create_job(job_id: str, file_path: str) -> JobRecord:
    now = _now()
    with _db() as conn:
        conn.execute(
            "INSERT INTO jobs (id, status, file_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (job_id, JobStatus.queued, file_path, now, now),
        )
    return JobRecord(
        id=job_id,
        status=JobStatus.queued,
        file_path=file_path,
        created_at=now,
        updated_at=now,
    )


def get_job(job_id: str) -> Optional[JobRecord]:
    with _db() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if row is None:
        return None
    return JobRecord(**dict(row))


def update_job(
    job_id: str,
    status: JobStatus,
    result_path: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    with _db() as conn:
        conn.execute(
            "UPDATE jobs SET status = ?, result_path = ?, error = ?, updated_at = ? WHERE id = ?",
            (status, result_path, error, _now(), job_id),
        )

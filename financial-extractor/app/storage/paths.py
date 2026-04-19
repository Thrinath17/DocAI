import os
from app.config import settings


def ensure_dirs() -> None:
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.results_dir, exist_ok=True)


def upload_path(filename: str) -> str:
    return os.path.join(settings.upload_dir, filename)


def result_path(job_id: str) -> str:
    return os.path.join(settings.results_dir, f"{job_id}.json")

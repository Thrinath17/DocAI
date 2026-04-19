import json
import shutil
from pathlib import Path

from app.storage.paths import upload_path, result_path


async def save_upload(job_id: str, original_filename: str, content: bytes) -> str:
    suffix = Path(original_filename).suffix.lower()
    dest = upload_path(f"{job_id}{suffix}")
    with open(dest, "wb") as out:
        out.write(content)
    return dest


def save_result(job_id: str, data: dict) -> str:
    dest = result_path(job_id)
    with open(dest, "w", encoding="utf-8") as out:
        json.dump(data, out, indent=2, ensure_ascii=False)
    return dest


def load_result(job_id: str) -> dict:
    path = result_path(job_id)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def result_exists(job_id: str) -> bool:
    return Path(result_path(job_id)).exists()

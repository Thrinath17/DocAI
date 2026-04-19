"""
Integration tests for the FastAPI layer.

These tests spin up the real FastAPI app with:
- A temp SQLite database (no shared state between tests)
- A temp upload/results directory
- Redis/RQ enqueue mocked so tests don't need a running Redis
- worker.process_job mocked so the pipeline doesn't actually run
"""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

FIXTURES = Path(__file__).parent.parent / "fixtures"


@pytest.fixture()
def client(tmp_path):
    """TestClient with isolated storage and DB, Redis mocked out."""
    db_path = str(tmp_path / "test.db")
    upload_dir = str(tmp_path / "uploads")
    results_dir = str(tmp_path / "results")

    env_overrides = {
        "DATABASE_URL": db_path,
        "UPLOAD_DIR": upload_dir,
        "RESULTS_DIR": results_dir,
        "REDIS_URL": "redis://localhost:6379/0",
    }

    with patch.dict(os.environ, env_overrides):
        # Re-import settings and app with overridden env
        import importlib
        import app.config as config_mod
        import app.storage.paths as paths_mod

        config_mod.settings = config_mod.Settings()
        paths_mod.ensure_dirs()

        import app.main as main_mod
        importlib.reload(main_mod)

        mock_queue = MagicMock()

        with patch("app.api.upload.Redis"), patch("app.api.upload.Queue", return_value=mock_queue):
            with TestClient(main_mod.app) as c:
                yield c


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Upload — happy paths
# ---------------------------------------------------------------------------

def test_upload_pdf_returns_job_id(client):
    pdf_path = FIXTURES / "xyz-balance-sheet-digital.pdf"
    with open(pdf_path, "rb") as f:
        resp = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})
    assert resp.status_code == 202
    body = resp.json()
    assert "job_id" in body
    assert body["status"] == "queued"


def test_upload_png_returns_job_id(client):
    png_path = FIXTURES / "balance-sheet-31dec20.png"
    with open(png_path, "rb") as f:
        resp = client.post("/upload", files={"file": ("test.png", f, "image/png")})
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"


# ---------------------------------------------------------------------------
# Upload — error paths
# ---------------------------------------------------------------------------

def test_upload_unsupported_mime_type(client):
    resp = client.post(
        "/upload",
        files={"file": ("doc.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 415


def test_upload_empty_file(client):
    resp = client.post(
        "/upload",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert resp.status_code == 422


def test_upload_oversized_file(client):
    big_content = b"x" * (51 * 1024 * 1024)  # 51 MB
    resp = client.post(
        "/upload",
        files={"file": ("big.pdf", big_content, "application/pdf")},
    )
    assert resp.status_code == 413


# ---------------------------------------------------------------------------
# Jobs endpoint
# ---------------------------------------------------------------------------

def test_get_job_status(client):
    pdf_path = FIXTURES / "xyz-balance-sheet-digital.pdf"
    with open(pdf_path, "rb") as f:
        upload_resp = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})
    job_id = upload_resp.json()["job_id"]

    resp = client.get(f"/jobs/{job_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "queued"


def test_get_job_not_found(client):
    resp = client.get("/jobs/nonexistent-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Results endpoint
# ---------------------------------------------------------------------------

def test_get_result_not_ready(client):
    pdf_path = FIXTURES / "xyz-balance-sheet-digital.pdf"
    with open(pdf_path, "rb") as f:
        upload_resp = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})
    job_id = upload_resp.json()["job_id"]

    resp = client.get(f"/results/{job_id}")
    # Job is still queued — API signals "not ready yet" with 202
    assert resp.status_code == 202


def test_get_result_completed(client, tmp_path):
    """Simulate a completed job by writing a result file and updating the DB."""
    pdf_path = FIXTURES / "xyz-balance-sheet-digital.pdf"
    with open(pdf_path, "rb") as f:
        upload_resp = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})
    job_id = upload_resp.json()["job_id"]

    # Simulate worker completing the job
    from app.config import settings
    from app.queue.job_store import update_job
    from app.models.job import JobStatus
    from app.storage.file_store import save_result

    result_data = {"company_name": "XYZ Inc.", "total_assets": 6858029}
    result_path = save_result(job_id, result_data)
    update_job(job_id, JobStatus.completed, result_path=result_path)

    resp = client.get(f"/results/{job_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["company_name"] == "XYZ Inc."

from unittest.mock import patch, MagicMock
from app.queue.worker import process_job


def test_process_job_logs_timing(caplog):
    job = MagicMock()
    job.file_path = "/fake/doc.pdf"

    with patch("app.queue.worker.get_job", return_value=job), \
         patch("app.queue.worker.update_job"), \
         patch("app.queue.worker.detect", return_value="digital"), \
         patch("app.queue.worker.to_markdown", return_value="## Balance Sheet\n\n| A | B |\n| 1 | 2 |"), \
         patch("app.queue.worker.extract", return_value={"test": 1}), \
         patch("app.queue.worker.save_result", return_value="/fake/result.json"), \
         caplog.at_level("INFO"):
        process_job("test-job-123")

    timing_logs = [r.message for r in caplog.records if "TIMING" in r.message]
    assert any("stage=detect" in log for log in timing_logs)
    assert any("stage=docling" in log for log in timing_logs)
    assert any("stage=ollama" in log for log in timing_logs)
    assert any("stage=total" in log for log in timing_logs)

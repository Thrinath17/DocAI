from app.config import Settings


def test_ollama_perf_defaults():
    s = Settings()
    assert s.ollama_num_ctx == 8192
    assert s.ollama_num_predict == 2048
    assert s.max_markdown_chars == 40_000


def test_ollama_perf_from_env(monkeypatch):
    monkeypatch.setenv("OLLAMA_NUM_CTX", "4096")
    monkeypatch.setenv("OLLAMA_NUM_PREDICT", "1024")
    monkeypatch.setenv("MAX_MARKDOWN_CHARS", "20000")
    s = Settings()
    assert s.ollama_num_ctx == 4096
    assert s.ollama_num_predict == 1024
    assert s.max_markdown_chars == 20000

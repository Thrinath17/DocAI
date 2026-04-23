from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    ollama_model: str = "qwen3.5:4b"
    ollama_base_url: str = "http://localhost:11434"
    ollama_num_ctx: int = 8192      # context window tokens — smaller = faster KV cache prefill
    ollama_num_predict: int = 2048  # max output tokens — financial JSON rarely exceeds this

    redis_url: str = "redis://localhost:6379/0"

    upload_dir: str = "./uploads"
    results_dir: str = "./results"

    database_url: str = "./jobs.db"

    # Max upload size: 50 MB
    max_upload_bytes: int = 50 * 1024 * 1024
    max_markdown_chars: int = 40_000  # truncate before LLM if markdown is larger than this


settings = Settings()

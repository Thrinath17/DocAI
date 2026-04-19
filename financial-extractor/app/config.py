from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    ollama_model: str = "qwen3.5:4b"
    ollama_base_url: str = "http://localhost:11434"

    redis_url: str = "redis://localhost:6379/0"

    upload_dir: str = "./uploads"
    results_dir: str = "./results"

    database_url: str = "./jobs.db"

    # Max upload size: 50 MB
    max_upload_bytes: int = 50 * 1024 * 1024


settings = Settings()

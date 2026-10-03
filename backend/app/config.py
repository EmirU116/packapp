from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory – the .env file and the local database live relative to it
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """
    Application settings.

    Every value has a default that works for local use and can be overridden
    by an environment variable or a line in backend/.env (see .env.example).
    """

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    secret_key: str = "packapp-local-development-secret-change-me"
    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'packapp.db').as_posix()}"
    token_expire_minutes: int = 720


settings = Settings()

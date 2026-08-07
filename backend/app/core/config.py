from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "SolenOS"
    debug: bool = True
    database_url: str = "sqlite:///./solenos.db"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    files_root: Path = Field(default=Path("./storage"))
    max_upload_size_mb: int = Field(default=1024, ge=1)
    static_dir: Optional[Path] = Field(default=None)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("files_root", mode="before")
    @classmethod
    def _expand_files_root(cls, value: Path) -> Path:
        path = Path(value).expanduser().resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    @field_validator("static_dir", mode="before")
    @classmethod
    def _expand_static_dir(cls, value: Optional[Path]) -> Optional[Path]:
        if value is None or value == "":
            return None
        path = Path(value).expanduser().resolve()
        return path if path.exists() else None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


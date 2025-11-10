from typing import Generator

from .settings import Settings, get_settings


def settings_dependency() -> Generator[Settings, None, None]:
    """FastAPI dependency that yields the singleton settings object."""
    yield get_settings()


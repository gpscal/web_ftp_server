from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .dependencies import settings_dependency
from .routers import files
from .settings import Settings, get_settings

app = FastAPI(title="Web File Manager", version="0.1.0")

# Allow all origins for internal use; tighten if exposing externally.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)


@app.get("/api/health")
def health(settings: Settings = Depends(settings_dependency)) -> dict:
    """Simple health check endpoint."""
    return {"status": "ok", "files_root": str(settings.files_root)}


settings = get_settings()
if settings.static_dir:
    app.mount(
        "/",
        StaticFiles(directory=str(settings.static_dir), html=True),
        name="static",
    )


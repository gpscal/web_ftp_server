import mimetypes
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from ..dependencies import settings_dependency
from ..schemas import CreateFolderRequest, DirectoryListing, FileItem, RenameRequest
from ..settings import Settings

router = APIRouter(prefix="/api/files", tags=["files"])


def _normalize_subpath(path: Optional[str]) -> str:
    if not path:
        return ""
    # Prevent attempts to supply absolute paths or traversal patterns.
    normalized = Path("/" + path).as_posix()
    return normalized.lstrip("/")


def _resolve_path(root: Path, subpath: Optional[str]) -> Path:
    normalized = _normalize_subpath(subpath)
    candidate = (root / normalized).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested path is outside of the storage root.",
        )
    return candidate


def _parent_path(subpath: str) -> Optional[str]:
    if not subpath or subpath.strip("/") == "":
        return None
    parent = str(Path(subpath).parent).strip(".")
    if parent in ("", "."):
        return ""
    return parent.replace("\\", "/")


@router.get("", response_model=DirectoryListing)
def list_directory(
    path: str = Query(default=""),
    settings: Settings = Depends(settings_dependency),
) -> DirectoryListing:
    target_dir = _resolve_path(settings.files_root, path)
    if not target_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Directory not found.")
    if not target_dir.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is not a directory.")

    items: List[FileItem] = []
    for entry in sorted(target_dir.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        stat_info = entry.stat()
        mime_type, _ = mimetypes.guess_type(entry.name)
        items.append(
            FileItem(
                name=entry.name,
                path=_normalize_subpath(str(Path(path) / entry.name)),
                is_dir=entry.is_dir(),
                size=stat_info.st_size if entry.is_file() else 0,
                modified=datetime.fromtimestamp(stat_info.st_mtime, tz=timezone.utc),
                mime_type=mime_type,
            )
        )

    return DirectoryListing(path=path, parent=_parent_path(path), items=items)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_files(
    files: List[UploadFile] = File(...),
    destination: str = Form(default=""),
    settings: Settings = Depends(settings_dependency),
) -> dict:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided.")

    dest_dir = _resolve_path(settings.files_root, destination)
    if dest_dir.exists() and not dest_dir.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destination is not a directory.")
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    for upload in files:
        target = dest_dir / upload.filename
        total_written = 0
        try:
            with target.open("wb") as buffer:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break
                    total_written += len(chunk)
                    if total_written > max_bytes:
                        buffer.close()
                        target.unlink(missing_ok=True)
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File '{upload.filename}' exceeds max size of {settings.max_upload_size_mb} MB.",
                        )
                    buffer.write(chunk)
        finally:
            await upload.close()
        saved_files.append(upload.filename)

    return {"uploaded": saved_files}


@router.get("/download")
def download_file(
    path: str = Query(...),
    settings: Settings = Depends(settings_dependency),
) -> FileResponse:
    target = _resolve_path(settings.files_root, path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")
    return FileResponse(
        target,
        media_type=mimetypes.guess_type(target.name)[0] or "application/octet-stream",
        filename=target.name,
    )


@router.post("/folder", status_code=status.HTTP_201_CREATED)
def create_folder(
    payload: CreateFolderRequest,
    settings: Settings = Depends(settings_dependency),
) -> dict:
    parent_dir = _resolve_path(settings.files_root, payload.parent)
    if parent_dir.exists() and not parent_dir.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent is not a directory.")
    parent_dir.mkdir(parents=True, exist_ok=True)

    new_dir = parent_dir / payload.name
    if new_dir.exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Folder already exists.")
    new_dir.mkdir()
    return {"created": str(Path(payload.parent) / payload.name).lstrip("./")}


@router.patch("/rename")
def rename(
    payload: RenameRequest,
    settings: Settings = Depends(settings_dependency),
) -> dict:
    src = _resolve_path(settings.files_root, payload.current_path)
    dst = _resolve_path(settings.files_root, payload.new_path)

    if not src.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source path not found.")

    dst_parent = dst.parent
    dst_parent.mkdir(parents=True, exist_ok=True)

    if dst.exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Target already exists.")

    src.rename(dst)
    return {"renamed": payload.new_path}


@router.delete("")
def delete_path(
    path: str = Query(...),
    settings: Settings = Depends(settings_dependency),
) -> dict:
    target = _resolve_path(settings.files_root, path)
    if not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Path not found.")

    if target.is_dir():
        if not any(target.iterdir()):
            target.rmdir()
        else:
            shutil.rmtree(target)
    else:
        target.unlink()

    return {"deleted": path}


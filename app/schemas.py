from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int
    modified: datetime
    mime_type: Optional[str] = None


class DirectoryListing(BaseModel):
    path: str
    parent: Optional[str]
    items: List[FileItem]


class CreateFolderRequest(BaseModel):
    parent: str
    name: str


class RenameRequest(BaseModel):
    current_path: str
    new_path: str


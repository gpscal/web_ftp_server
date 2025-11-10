# Web File Manager (HTTP)

## Overview

A lightweight, self-hosted web application for uploading, downloading, and organizing files over HTTPS. Instead of exposing FTP, the system exposes a minimal REST API plus a single-page React interface with drag-and-drop support. The tighter scope keeps the stack small, easier to deploy, and friendlier to lock down.

## Core Features

- Drag-and-drop and multi-select uploads with progress feedback.
- Download via direct HTTPS links (single files and zipped folders).
- Basic file management: list, search/filter, rename, delete, create folders.
- Optional per-user authentication using JWT sessions.
- Configurable root directory with disk quota and storage usage indicators.
- Works fully in a single Docker container (or two if proxying through Nginx for TLS).

## High-Level Architecture

```
┌────────────┐     HTTPS      ┌──────────────────────┐
│  Browser   │  ◀──────────▶  │  FastAPI Application │
│  (React)   │                │  - REST API          │
│            │  WebSocket     │  - Static Frontend   │
│            │  (optional)    │  - File I/O          │
└────────────┘                └──────────────────────┘
                                   │
                                   ▼
                              Host Filesystem
```

- **Frontend**: React + Vite, TypeScript, Tailwind or Chakra UI. Drag-and-drop uses the native browser API; uploads streamed via Fetch with `FormData`. Download links returned as signed URLs or direct paths.
- **Backend**: FastAPI (Uvicorn) serving JSON endpoints and static assets. Handles authentication, directory traversal, file streaming. Stores metadata in the filesystem; optional SQLite for user accounts.
- **Storage**: Local directory mounted into the container (`/data`). Quotas enforced via periodic disk usage checks.
- **Notifications**: Simple polling for upload progress; optional WebSocket push channel using `fastapi-websocket`.

## Minimal Directory Layout

```
ftp_server/
├── README.md
├── docker-compose.yml           # optional convenience
├── app/
│   ├── main.py                  # FastAPI entrypoint
│   ├── auth.py                  # JWT helpers (optional)
│   ├── dependencies.py
│   ├── routers/
│   │   ├── files.py             # CRUD endpoints
│   │   └── auth.py
│   ├── schemas.py
│   ├── settings.py
│   └── static/                  # built frontend assets (if served by FastAPI)
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/client.ts
│       ├── components/
│       │   ├── FileList.tsx
│       │   ├── UploadDropzone.tsx
│       │   └── Toolbar.tsx
│       └── hooks/
│           └── useUpload.ts
└── tests/
    ├── backend/
    │   └── test_files.py
    └── frontend/
        └── fileManager.spec.ts
```

## Implementation Guide

### 1. Backend (FastAPI)

1. **Project setup**
   - Create virtual environment; add `fastapi`, `uvicorn[standard]`, `python-multipart` (file uploads), and `python-jose`/`passlib` if auth required.
   - Define `Settings` class (e.g., with `pydantic-settings`) for `FILES_ROOT`, `MAX_UPLOAD_MB`, `ALLOWED_EXTENSIONS`, `JWT_SECRET`.

2. **Routing**
   - `GET /api/files?path=/subdir`: return directory listing (names, sizes, mime type, modified time).
   - `POST /api/files/upload`: accept `FormData` with target path and file(s); stream writes using `SpooledTemporaryFile`.
   - `GET /api/files/download?path=/file`: stream file with `StreamingResponse`.
   - `POST /api/files/folder`: create folder.
   - `PATCH /api/files/rename`: rename/move.
   - `DELETE /api/files?path=/file`: delete file/folder recursively.
   - Optional `GET /api/status`: expose disk usage numbers.

3. **Security (optional but recommended)**
   - Simple `User` table in SQLite using SQLModel.
   - `POST /api/auth/login`: verify password, issue JWT.
   - Dependency that checks `Authorization: Bearer` tokens for protected routes.

4. **Static asset serving**
   - In production, serve built frontend from `app/static` via `StaticFiles(directory="app/static", html=True)`.

5. **Testing**
   - Use `pytest` with `httpx.AsyncClient` for API tests (`test_upload_download`, `test_list_directory`).
   - Mock filesystem with `tmp_path` fixture to keep tests isolated.

### 2. Frontend (React)

1. **Scaffold**
   - `npm create vite@latest web -- --template react-ts`.
   - Install dependencies: `axios` or `ky`, `react-query` for data fetching, UI library if desired, `react-dropzone` (optional: browser API alone works).

2. **State Management**
   - Keep it simple: `react-query` handles cache + requests. Store auth tokens in `localStorage`.

3. **Components**
   - `FileList`: table or grid showing current directory; actions for download/rename/delete.
   - `UploadDropzone`: handles drag/drop events; uses `fetch` to POST files; supports multiple uploads with progress via `XMLHttpRequest` events or `axios`.
   - `Breadcrumbs`: navigate directories by splitting the path.
   - `Toolbar`: buttons for new folder, refresh, upload fallback (file picker).

4. **Routing & Auth**
   - Minimal login page posting to `/api/auth/login`; store token; wrap protected routes with context.

5. **Build & Deploy**
   - `npm run build` outputs to `web/dist`. Copy to `app/static` during container build (see below).

### 3. Deployment Options

- **Single Docker Image**: Multi-stage Dockerfile that builds frontend, copies assets, installs backend deps, and runs `uvicorn app.main:app`. Mount host directory to `/data`.
- **Docker Compose**: Optional `docker-compose.yml` with a reverse proxy (Caddy or Nginx) to handle TLS certifications via Let’s Encrypt.
- **Bare metal / Systemd**: For simple setups, run `uvicorn` with `--root-path /files` behind Nginx serving HTTPS.

### 4. Enhancements (Optional)

- Zip archives for multi-file downloads (`shutil.make_archive` on the fly).
- File previews for common types (text, markdown, images) fetched through the same API.
- Role-based access (read-only vs. read/write).
- Background virus scan hook (invoke command post-upload).
- Audit log stored in SQLite for who modified what.

## Quickstart (No Docker)

1. **Python environment**
   ```
   python -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
2. **Configure storage**
   ```
   cp .env.example .env
   # Optionally edit .env to point FILES_ROOT to another directory
   ```
3. **Run the API**
   ```
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
4. **Frontend development server**
   ```
   cd web
   npm install
   npm run dev
   ```
   Access the UI at `http://localhost:5173` (proxied to the API).
5. **Optional: serve built assets from FastAPI**
   ```
   npm run build
   # copy the output directory so FastAPI can serve it
   cp -r dist ../app/static
   # then set STATIC_DIR=app/static in .env and restart uvicorn
   ```

## Why This Approach

- **Simplicity**: Avoids FTP passive ports, legacy protocol quirks, and extra services like Redis.
- **Security**: HTTPS-only traffic, easier to integrate with reverse proxies, WAFs, and OAuth providers.
- **Maintainability**: Fewer moving parts make it easier to host on modest hardware or a small VM.

## License

Pick the license that matches your deployment needs (MIT by default is common). Update this section when finalized.


# web_ftp_server

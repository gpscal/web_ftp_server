#!/usr/bin/env bash
set -euo pipefail

FRONTEND_MODE="static"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --frontend)
            shift
            FRONTEND_MODE="${1:-static}"
            ;;
        --frontend=*)
            FRONTEND_MODE="${1#*=}"
            ;;
        --help|-h)
            cat <<'EOF'
Usage: sudo ./scripts/install_services.sh [--frontend static|dev]

Installs and starts systemd services for the FTP web backend and (optionally)
the frontend dev server. Run with sudo.
EOF
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
    shift || true
done

if [[ $EUID -ne 0 ]]; then
    echo "Please run this script with sudo or as root." >&2
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    cat <<'EOF' >&2
npm not found. Please install Node.js and npm before running this script.
On Ubuntu, you can install Node.js 18 via:
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
EOF
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(realpath "$SCRIPT_DIR/..")"
SERVICE_USER="${SUDO_USER:-$(id -un)}"
VENV_PATH="$PROJECT_ROOT/.venv/bin"
UVICORN_BIN="$VENV_PATH/uvicorn"

if [[ ! -x "$UVICORN_BIN" ]]; then
    cat <<EOF >&2
uvicorn not found at $UVICORN_BIN
Create the virtual environment and install dependencies first:
  python -m venv $PROJECT_ROOT/.venv
  source $PROJECT_ROOT/.venv/bin/activate
  pip install -r $PROJECT_ROOT/requirements.txt
EOF
    exit 1
fi

# Install Node.js dependencies for the web frontend if they don't exist
if [[ ! -d "$PROJECT_ROOT/web/node_modules" ]]; then
    echo "Installing Node.js dependencies..."
    cd "$PROJECT_ROOT/web"
    sudo -u "$SERVICE_USER" npm install
    cd "$PROJECT_ROOT"
fi

BACKEND_SERVICE_PATH="/etc/systemd/system/ftp-server-backend.service"
mkdir -p "$(dirname "$BACKEND_SERVICE_PATH")"
cat <<EOF >"$BACKEND_SERVICE_PATH"
[Unit]
Description=FTP Web Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_ROOT
Environment="PATH=$VENV_PATH"
ExecStart=$UVICORN_BIN app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

FRONTEND_MODE_LOWER="$(echo "$FRONTEND_MODE" | tr '[:upper:]' '[:lower:]')"
FRONTEND_SERVICE_PATH="/etc/systemd/system/ftp-server-frontend-dev.service"
case "$FRONTEND_MODE_LOWER" in
    static)
        if ! grep -q '^STATIC_DIR=' "$PROJECT_ROOT/.env"; then
            echo "STATIC_DIR=app/static" >>"$PROJECT_ROOT/.env"
        fi
        if ! grep -q '^STATIC_DIR=app/static' "$PROJECT_ROOT/.env"; then
            echo "Warning: STATIC_DIR in .env is not set to app/static. Update it if you want FastAPI to serve the built UI." >&2
        fi
        rm -f "$FRONTEND_SERVICE_PATH"
        ;;
    dev)
        mkdir -p "$(dirname "$FRONTEND_SERVICE_PATH")"
        cat <<EOF >"$FRONTEND_SERVICE_PATH"
[Unit]
Description=FTP Web Frontend (Vite Dev Server)
After=network.target
Requires=ftp-server-backend.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_ROOT/web
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
Environment="NODE_ENV=development"
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0 --port 5173
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        ;;
    none|"")
        FRONTEND_MODE_LOWER="none"
        rm -f "$FRONTEND_SERVICE_PATH"
        ;;
    *)
        echo "Unsupported frontend mode: $FRONTEND_MODE" >&2
        exit 1
        ;;
esac

systemctl daemon-reload
systemctl enable --now ftp-server-backend.service

if [[ "$FRONTEND_MODE_LOWER" == "dev" ]]; then
    systemctl enable --now ftp-server-frontend-dev.service
else
    systemctl disable ftp-server-frontend-dev.service >/dev/null 2>&1 || true
fi

sleep 2

if curl -fsS "http://127.0.0.1:8000/api/health" >/dev/null; then
    echo "Backend health check succeeded."
else
    echo "Warning: Backend did not respond to health check." >&2
fi

if [[ "$FRONTEND_MODE_LOWER" == "dev" ]]; then
    if curl -fsS "http://127.0.0.1:5173" >/dev/null; then
        echo "Frontend dev server responded successfully."
    else
        echo "Warning: Frontend dev server did not respond on port 5173." >&2
    fi
fi

echo "Installation complete."

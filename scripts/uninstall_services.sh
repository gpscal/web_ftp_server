#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Please run this script with sudo or as root." >&2
    exit 1
fi

SERVICES=(
    ftp-server-frontend-dev.service
    ftp-server-backend.service
)

for svc in "${SERVICES[@]}"; do
    if systemctl list-units --full --all | grep -Fq "$svc"; then
        systemctl disable --now "$svc" >/dev/null 2>&1 || true
        rm -f "/etc/systemd/system/$svc"
    fi
done

systemctl daemon-reload
systemctl reset-failed

echo "Services removed."

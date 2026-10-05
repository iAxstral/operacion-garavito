#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Backend (Maven)"
cd "$ROOT/backend"
./mvnw -B clean package

echo "==> Frontend (Vite)"
cd "$ROOT/frontend"
npm ci
npm run build

LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") print $(i + 1)}')"
[ -n "$LAN_IP" ] || LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "==> Iniciando backend (puerto 8080) y frontend (puerto 4173). Ctrl+C para detener."
echo "    Tú:       http://localhost:4173"
if systemctl is-active --quiet ufw 2>/dev/null; then
  echo "    Aviso: ufw está activo y bloquea a los demás. Ábrelo una vez con:"
  echo "           sudo ufw allow 4173/tcp && sudo ufw allow 8080/tcp"
fi
echo "    Equipo:   http://${LAN_IP:-<tu-ip>}:4173  (misma red Wi-Fi, también desde iPhone/Safari)"
java -Dspring.profiles.active=dev -jar "$ROOT"/backend/target/operacion-garavito-0.0.1-SNAPSHOT.jar &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT INT TERM
npm run preview -- --host --port 4173 --strictPort

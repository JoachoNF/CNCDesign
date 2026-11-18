#!/usr/bin/env bash
# ============================================================================
# acceso-web.sh — Acceso remoto a la compilación FINAL de CNCDesign
#
# Levanta un escritorio virtual (Xvfb + Fluxbox), un servidor VNC (x11vnc) y
# el puente noVNC (websockify) para poder usar la app de escritorio desde un
# navegador, dentro de un contenedor Docker o servidor sin pantalla.
#
# Se usa SIEMPRE la build de producción (dist/electron/main.js + dist/index.html):
#   · NODE_ENV=production  → el main carga dist/index.html (no el Vite de :5123)
#   · Sin variables CAPTURA_UI* (no se activa el runner de capturas)
#   · Sin el hook window.__CNC (solo se expone con NODE_ENV=development)
#   · No se inyectan claves API: la app queda limpia y se configuran desde el ⚙
#
# Variables configurables (valores por defecto entre paréntesis):
#   DISPLAY_NUM (:99) · RESOLUTION (1280x800x24) · VNC_PORT (5900)
#   WEB_PORT (6080) · LOG_DIR (/tmp/opencode)
#
# Uso:
#   bash scripts/acceso-web.sh
#   WEB_PORT=8080 bash scripts/acceso-web.sh
#
# Acceso: http://<host>:${WEB_PORT}/vnc.html?autoconnect=1
# ============================================================================
set -euo pipefail

# --- Configuración (sobrescribible por entorno) -----------------------------
DISPLAY_NUM="${DISPLAY_NUM:-:99}"
RESOLUTION="${RESOLUTION:-1280x800x24}"
VNC_PORT="${VNC_PORT:-5900}"
WEB_PORT="${WEB_PORT:-6080}"
LOG_DIR="${LOG_DIR:-/tmp/opencode}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$LOG_DIR"
cd "$APP_DIR"

# --- Parámetros de lanzamiento: build final, sin configs de desarrollo ------
export NODE_ENV=production
export DISPLAY="$DISPLAY_NUM"
unset CAPTURA_UI CAPTURA_UI_DXF CAPTURA_UI_VISTA CAPTURA_UI_JS || true

# Comprobaciones previas
for bin in Xvfb fluxbox x11vnc websockify; do
  command -v "$bin" >/dev/null 2>&1 || { echo "✖ Falta '$bin' en el PATH"; exit 1; }
done
[[ -f dist/electron/main.js ]] || { echo "✖ No hay build: ejecuta 'npm run build' primero"; exit 1; }
[[ -d /usr/share/novnc ]] || { echo "✖ Falta noVNC en /usr/share/novnc"; exit 1; }

echo "▶ [1/5] Escritorio virtual Xvfb ($DISPLAY_NUM · $RESOLUTION)"
Xvfb "$DISPLAY_NUM" -screen 0 "$RESOLUTION" -nolisten tcp >"$LOG_DIR/xvfb.log" 2>&1 &
XVFB_PID=$!
sleep 1

echo "▶ [2/5] Gestor de ventanas Fluxbox"
fluxbox >"$LOG_DIR/fluxbox.log" 2>&1 &
FLUXBOX_PID=$!
sleep 1

echo "▶ [3/5] Servidor VNC (puerto $VNC_PORT)"
x11vnc -display "$DISPLAY_NUM" -forever -shared -nopw -rfbport "$VNC_PORT" -quiet \
  >"$LOG_DIR/x11vnc.log" 2>&1 &
X11VNC_PID=$!
sleep 1

echo "▶ [4/5] Puente noVNC (puerto HTTP $WEB_PORT)"
websockify --web=/usr/share/novnc "$WEB_PORT" "localhost:$VNC_PORT" \
  >"$LOG_DIR/websockify.log" 2>&1 &
WEBSOCKIFY_PID=$!
sleep 1

echo "▶ [5/5] Lanzando CNCDesign (build final de producción)"
node_modules/.bin/electron dist/electron/main.js \
  --no-sandbox --disable-gpu --disable-dev-shm-usage \
  >"$LOG_DIR/electron.log" 2>&1 &
ELECTRON_PID=$!

# --- Limpieza al salir -------------------------------------------------------
limpiar() {
  echo "· Deteniendo servicios de CNCDesign..."
  kill "$ELECTRON_PID" "$WEBSOCKIFY_PID" "$X11VNC_PID" "$FLUXBOX_PID" "$XVFB_PID" 2>/dev/null || true
}
trap limpiar EXIT INT TERM

cat <<EOF
============================================================
  CNCDesign está en marcha (compilación final / producción)

  Acceso web (noVNC):
    http://localhost:${WEB_PORT}/vnc.html?autoconnect=1

  Desde fuera del contenedor, sustituye 'localhost' por la IP
  o el nombre del host y publica el puerto ${WEB_PORT}:
    docker run -p ${WEB_PORT}:${WEB_PORT} ...

  VNC nativo: puerto ${VNC_PORT}
  Logs: ${LOG_DIR}/
  (Los procesos se mantienen vivos hasta Ctrl+C / SIGTERM)
============================================================
EOF

# Mantener el contenedor/proceso vivo de forma indefinida
wait

#!/usr/bin/env bash
# ============================================================================
# verificar.sh — Verificación estática de CNCDesign (typecheck + build)
#
# Comprueba que el proyecto compila antes de dar un cambio por bueno:
#   1. tsc -p tsconfig.build.json  → main de Electron + núcleo a dist/
#   2. vite build                  → bundle del renderer
#
# Uso:
#   bash verificar.sh [ruta-al-repo]
#
# Si no se indica ruta, se usa el root del repositorio git actual (o el
# directorio de trabajo si no hay git). Debe ejecutarse sobre un checkout
# de CNCDesign con `npm install` hecho.
# ============================================================================
set -euo pipefail

RAIZ="${1:-}"
if [[ -z "$RAIZ" ]]; then
  RAIZ="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

cd "$RAIZ"
[[ -f package.json ]] || { echo "✖ No hay package.json en $RAIZ (¿es un checkout de CNCDesign?)"; exit 1; }
[[ -x node_modules/.bin/tsc ]] || { echo "✖ Falta node_modules — ejecuta 'npm install' primero"; exit 1; }

echo "▶ [1/2] tsc -p tsconfig.build.json  (Electron + núcleo → dist/)"
node_modules/.bin/tsc -p tsconfig.build.json

echo "▶ [2/2] vite build                   (bundle del renderer)"
node_modules/.bin/vite build

echo "✔ Verificación completada sin errores"

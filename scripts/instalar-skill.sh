#!/usr/bin/env bash
# ============================================================================
# instalar-skill.sh — Instala la skill de desarrollo de CNCDesign en el
# directorio global de skills de OpenCode, para poder usarla desde cualquier
# entorno/proyecto (no solo dentro de este repositorio).
#
# Uso:
#   bash scripts/instalar-skill.sh                # instala (o actualiza)
#   bash scripts/instalar-skill.sh --desinstalar  # elimina la instalación
#
# Destino por defecto: ${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills/
# (puede cambiarse con la variable OPENCODE_SKILLS_DIR)
# ============================================================================
set -euo pipefail

ORIGEN="$(cd "$(dirname "$0")/.." && pwd)/.opencode/skills/cnc-design-dev"
BASE="${OPENCODE_SKILLS_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills}"
DESTINO="$BASE/cnc-design-dev"

if [[ "${1:-}" == "--desinstalar" ]]; then
  rm -rf "$DESTINO"
  echo "✔ Skill eliminada de $DESTINO"
  exit 0
fi

[[ -f "$ORIGEN/SKILL.md" ]] || { echo "✖ No se encontró la skill en $ORIGEN"; exit 1; }

mkdir -p "$BASE"
rm -rf "$DESTINO"          # instalación idempotente: siempre refresca la copia
cp -R "$ORIGEN" "$DESTINO"

echo "✔ Skill 'cnc-design-dev' instalada en:"
echo "  $DESTINO"
echo
echo "  · OpenCode la descubrirá en todos tus proyectos."
echo "  · También puedes mencionarla como @cnc-design-dev."
echo "  · Para desinstalar: bash scripts/instalar-skill.sh --desinstalar"

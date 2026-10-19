---
name: CNC Design Dev
description: Desarrollo y mantenimiento de CNCDesign, la app de escritorio (Electron + React + TypeScript) para diseño 3D/2D y pedidos .dxf de CNC. Úsala al retomar el proyecto en cualquier entorno de ejecución, al modificar visor/terminal IA/router/edición, o al verificar cambios con compilación estática y capturas headless.
---

# Skill: Desarrollo de CNCDesign

Aplicación de escritorio que combina **visor CAD** (Three.js + `dxf-render`), **terminal IA multi-proveedor** (Anthropic / OpenAI / Ollama) y **edición manual de DXF** (mover · rotar · escalar · espejar, con deshacer).

## Cuándo usarla

- Al **retomar la sesión** de desarrollo de CNCDesign en cualquier entorno de ejecución.
- Al **modificar** el visor, la terminal IA, el router, el núcleo CAD o las herramientas de edición.
- Al **verificar cambios**: compilación estática y capturas automatizadas de la UI.

## Puesta a punto (5 minutos)

1. Instala dependencias: `npm install` — requisitos completos en `references/entorno-desarrollo.md`.
2. Sin claves de pago la app funciona igual: la IA cae a **Ollama local** (`ollama pull qwen2.5-coder:7b`).
3. Arranca en desarrollo: `npm run dev` (Vite en el puerto 5123 + ventana Electron).

## Reglas de oro del proyecto

1. **Idioma**: UI, comentarios y nombres de dominio en español (no se traducen identificadores de librerías ajenas).
2. **Tema oscuro fijo** con Tailwind v4 CSS-first: el tema vive en `@theme` dentro de `src/index.css`; no existe `tailwind.config`.
3. **`dxf-render/parser` es solo-ESM**: nunca importarlo desde módulos que deban correr en Node (`require` lanza `ERR_PACKAGE_PATH_NOT_EXPORTED`). El núcleo `src/cad/` debe permanecer libre del renderer.
4. **Sin `import.meta`** en código compartido: `tsconfig.build.json` compila a CommonJS; detecta desarrollo con `process.env.NODE_ENV === 'development'`.
5. **Verificación por capturas**: no hay tests E2E; tras cada cambio de UI, captura con `CAPTURA_UI` y revisa el PNG (flujo en `references/verificacion.md`).
6. **Git**: ramas `main` (estable) y `develop` (integración); commits temáticos en español.

## Flujo de trabajo típico

1. Oriéntate con el mapa de módulos: `references/arquitectura.md`.
2. Implementa el cambio siguiendo la estructura existente y comentando en español (máximo detalle).
3. Verifica la compilación: `bash scripts/verificar.sh <ruta-al-repo>` (typecheck + build de Vite).
4. Verifica la UI: `CAPTURA_UI=/tmp/ui.png ... npm run dev` y revisa la captura (`references/verificacion.md`).
5. Para tocar la capa de IA: `references/configuracion-ia.md` (claves, precedencia, enrutamiento, Ollama).

## Recursos

| Recurso | Contenido |
|---|---|
| `references/arquitectura.md` | Mapa de módulos, flujo de datos, tipos clave y mapeo de entidades DXF |
| `references/entorno-desarrollo.md` | Requisitos, instalación, comandos, empaquetado y problemas comunes |
| `references/verificacion.md` | typecheck/build, flujo CAPTURA_UI, hook `__CNC` y notas headless |
| `references/configuracion-ia.md` | Claves API, precedencia, enrutamiento por tarea y ajustes finos de Ollama |
| `references/agentes-desarrollo.md` | Lineup de los 6 agentes de desarrollo (roles y system prompts) |
| `scripts/verificar.sh` | Verificación estática (tsc + vite build) sobre un checkout |

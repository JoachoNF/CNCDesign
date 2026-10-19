# CNCDesign — Inicio rápido

Guía de 5 minutos para levantar el proyecto en desarrollo. Para el panorama completo (arquitectura, características, capturas) ver [README.md](README.md).

## Requisitos

- **Node.js 22** + npm
- *(Opcional)* **Ollama** para IA local gratuita: `ollama pull qwen2.5-coder:7b`
- *(Opcional)* Claves `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` para IA en la nube
- *En servidores sin pantalla:* `xvfb-run` (Electron necesita display virtual)

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar IA (opcional)

Dos vías equivalentes (la guardada desde la UI tiene prioridad):

```bash
# a) Variables de entorno
cp .env.example .env
#    Edita .env con tus claves

# b) Desde la app: icono ⚙ en la Terminal IA → modal "Configuración IA"
```

Sin claves, la app funciona igual con **Ollama local** como fallback, y todas las herramientas de edición manual están disponibles.

## 3. Desarrollo

```bash
npm run dev
```

Esto compila Electron (`tsc`) y levanta Vite (puerto 5123) + la ventana de Electron con recarga del renderer.

## 4. Verificación con capturas (útil en headless)

```bash
# Captura de la UI tal cual arranca
CAPTURA_UI=/tmp/ui.png npm run dev

# Con un .dxf cargado y en modo visor
CAPTURA_UI=/tmp/ui.png CAPTURA_UI_DXF=demo.dxf CAPTURA_UI_VISTA=fullVisor npm run dev
```

La app se cierra sola tras guardar la captura. En desarrollo también está disponible el hook `window.__CNC` (store, edición, transformaciones) y la variable `CAPTURA_UI_JS` para ejecutar código antes de capturar.

## 5. Build de producción

```bash
npm run build      # vite build + tsc + electron-builder → release/
npm run start      # lanzar la compilación sin empaquetar
```

## Flujo de uso básico

1. En la **Terminal IA** escribe, por ejemplo: `placa de 100×60 mm con 4 agujeros de 8 mm en las esquinas`.
2. El router elige el modelo (o usa el del selector). Pulsa **Aplicar al visor**.
3. Retoca con las **herramientas de edición** del visor si hace falta (mover/rotar/escalar/espejar, con deshacer).
4. **Exportar .dxf** → archivo listo para el CAM.

Atajos del visor: `1-4` vistas rápidas · `F` encuadrar · `R` restablecer · `G` cuadrícula · flechas desplazar · `Esc` salir de pantalla completa.

## Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| `ERR_PACKAGE_PATH_NOT_EXPORTED` con `dxf-render/parser` | Es un módulo solo-ESM; úsalo únicamente desde el renderer (Vite), no desde Node |
| Electron no abre en un contenedor | Añade `--no-sandbox --disable-gpu` y usa `xvfb-run` (los scripts ya incluyen los flags) |
| Ollama tarda muchísimo | En CPU un 7B en frío puede tardar minutos; el timeout del proveedor es de 15 min |
| La IA de pago no responde | Revisa claves en el modal ⚙; las claves guardadas en la app tienen prioridad sobre `.env` |

## Skill de desarrollo (OpenCode)

El repo trae una skill con todo el contexto del proyecto: `.opencode/skills/cnc-design-dev/`. Se activa sola al trabajar en este repositorio. Para instalarla globalmente (usarla desde cualquier proyecto):

```bash
bash scripts/instalar-skill.sh
```

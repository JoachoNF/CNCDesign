# Entorno de desarrollo

## Requisitos

| Componente | Versión / notas |
|---|---|
| Node.js | 22.x (probado con v22.22.1) |
| npm | 10+ (cualquiera moderno; con corepack basta el shim estándar) |
| Linux con display | o `xvfb-run` en headless/CI |
| Ollama | *(opcional)* IA local gratuita: `ollama pull qwen2.5-coder:7b` |
| Claves de IA | *(opcional)* `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` |

## Instalación

```bash
npm install
cp .env.example .env    # opcional: claves y URL de Ollama
npm run dev             # Vite :5123 + Electron con recarga del renderer
```

El script `dev` ejecuta antes `tsc -p tsconfig.build.json` (hook `predev`) porque Electron carga `dist/electron/main.js` desde disco.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo completo (predev tsc + Vite + Electron) |
| `npm run build` | `vite build` → `tsc -p tsconfig.build.json` → `electron-builder` (→ `release/`) |
| `npm run start` | Lanza la compilación existente (`electron dist/electron/main.js`) |
| `npm run typecheck` | `tsc --noEmit` sobre `src` + `electron` |
| `npm run lint` | ESLint sobre `src/` |

## Variables de entorno

(ver también `configuracion-ia.md`)

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de Claude |
| `OPENAI_API_KEY` | Clave de GPT |
| `OLLAMA_URL` | URL del servidor Ollama (def. `http://localhost:11434`) |
| `OLLAMA_MODEL` | Modelo por defecto (def. `qwen2.5-coder:7b`) |
| `NODE_ENV` | `development` → DevTools + hook `window.__CNC` |
| `CAPTURA_UI` y familia | Capturas automatizadas (ver `verificacion.md`) |

Precedencia: lo guardado desde la UI (`config-ia.json` dentro de `userData`) pisa a las variables de entorno.

## Headless / contenedores

- Electron necesita display: usa `xvfb-run -a <comando>`.
- Flags obligatorios en CI/contenedores: `--no-sandbox --disable-gpu` (ya incluidos en `dev`/`start`).
- En pantallas pequeñas, Xvfb puede recortar la ventana (~847 px); algunas tarjetas (p. ej. la de atajos) solo se ven completas en pantallas reales o forzando su apertura desde `CAPTURA_UI_JS`.
- WebGL por software funciona (SwiftShader); la primera carga del visor puede tardar un instante.

## Empaquetado

`electron-builder.json` genera AppImage (Linux), NSIS (Windows) y app (macOS).

> **Pendiente:** los iconos en `assets/` (`icon.png`, `icon.ico`). Añadirlos antes de publicar instaladores.

## Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| `ERR_PACKAGE_PATH_NOT_EXPORTED` con `dxf-render/parser` | Import ESM desde CJS: solo debe usarse desde el renderer (Vite) |
| `import.meta` es `undefined` | El código compartido compila a CommonJS: usar `process.env` |
| Electron no arranca sin display | `xvfb-run -a` + `--no-sandbox --disable-gpu` |
| Vite «port already in use» | El puerto 5123 es `strictPort`: cierra el proceso anterior |
| Ollama tarda muchísimo | Normal en CPU en frío (~5 min para un 7B); el timeout del cliente es de 15 min |

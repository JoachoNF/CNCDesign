# Acceso remoto y empaquetado final

Este documento resume cómo acceder a la **compilación final** de CNCDesign desde
fuera del entorno (contenedor Docker / servidor sin pantalla) y cómo generar el
instalador de Windows.

## 1. Acceso web a la build final (noVNC)

El escritorio de Electron se ejecuta dentro de un `Xvfb` y se publica por VNC,
con `websockify` sirviendo el cliente noVNC por HTTP. No es un "modo web" de la
app: es la app de escritorio real, con todos sus IPC (importar/exportar `.dxf`,
IA, etc.).

```bash
# En el contenedor / servidor (requiere Xvfb, fluxbox, x11vnc, websockify,
# /usr/share/novnc y la build ya compilada):
bash scripts/acceso-web.sh

# Parámetros configurables:
WEB_PORT=8080 RESOLUTION=1600x900x24 bash scripts/acceso-web.sh
```

Abrir en el navegador:

```
http://<IP_DEL_HOST>:6080/vnc.html?autoconnect=1
```

Si el contenedor publica otro puerto, ajusta el mapeo (ej. `-p 8080:6080`) y usa
ese puerto en la URL. El puerto VNC nativo es el `5900`.

> **Seguridad:** el VNC se levanta sin contraseña (`-nopw`). Publica el puerto
> solo en una red de confianza o detrás de un proxy con autenticación / VPN.

### Parámetros de lanzamiento aplicados (build limpia)

| Parámetro / variable | Valor | Motivo |
|---|---|---|
| `NODE_ENV` | `production` | Carga `dist/index.html`; evita el Vite de desarrollo y el hook `window.__CNC`. |
| `CAPTURA_UI*` | sin definir | No se activa el runner de capturas automáticas. |
| Claves API | no se inyectan | La app arranca sin secretos; se configuran desde el modal ⚙ (`config-ia.json` en `userData`, jamás en el repo ni en el paquete). |
| `--no-sandbox` | sí | Necesario para ejecutar Electron como root dentro de Docker. |
| `--disable-gpu` | sí | WebGL por software (SwiftShader) en headless. |
| `--disable-dev-shm-usage` | sí | Evita límites de `/dev/shm` en contenedores. |

> Estos flags son **específicos del contenedor**. El instalador de Windows no los
> necesita y no los incorpora: el `electron-builder` genera un ejecutable limpio.

### Imagen Docker reproducible

```bash
docker build -t cncdesign:latest .
docker run -d --name cncdesign -p 6080:6080 cncdesign:latest
```

El `.dockerignore` excluye `.env`, `node_modules`, `dist`, `release` y `.git`
para que no se filtre configuración no deseada a la imagen.

## 2. Instalador de Windows (NSIS)

En este entorno Linux se generó el instalador con `electron-builder` (no se
necesita Windows para compilarlo):

```bash
npm run build                 # AppImage + NSIS
# o solo Windows:
./node_modules/.bin/electron-builder --win --x64
```

El resultado queda en `release/`:

- `CNCDesign Setup 1.0.0.exe` — instalador NSIS para Windows x64.

Cópialo al equipo Windows y ejecútalo. No requiere Node.js ni dependencias
adicionales. Las claves API se introducen desde el modal ⚙ dentro de la app.

También se sirve un listado descargable de `release/` en:

```
http://<IP_DEL_HOST>:8080/
```

## 3. Nota crítica sobre el bundle de producción

`vite.config.mts` **no debe marcar `three/addons/*` como externos**. `dxf-render`
importa addons de Three.js y, si Rollup los deja como specifiers desnudos, la app
empaquetada (cargada por `file://`) queda en pantalla negra con:

```
Failed to resolve module specifier "three/addons/curves/NURBSCurve.js"
```

Los addons se empaquetan y el único ausente (`FXAAPass`) se sustituye por el stub
de `src/renderer/components/stubs/`. Verificar siempre con una captura en modo
producción (`NODE_ENV=production CAPTURA_UI=... npm run start`).

## 4. Verificación

```bash
bash .opencode/skills/cnc-design-dev/scripts/verificar.sh $(pwd)
```

Comprueba `tsc` (main + núcleo) y el bundle del renderer. El script ejecuta
primero `vite build` y después `tsc` (Vite vacía `dist/`, así que el orden
inverso borraría el main compilado). Para una comprobación visual, usar el flujo
`CAPTURA_UI` descrito en la skill.

### Artefactos generados y verificados

| Artefacto | Ruta | Verificación |
|---|---|---|
| Instalador Windows (NSIS, x64) | `release/CNCDesign Setup 1.0.0.exe` | Compilado con Wine 10.0; 80 MB |
| AppImage Linux | `release/CNCDesign-1.0.0.AppImage` | Ejecutado bajo Xvfb + `CAPTURA_UI`: UI correcta |
| Acceso web (noVNC) | `http://<host>:6080/vnc.html?autoconnect=1` | HTTP 200, Electron en producción |
| Descarga de artefactos | `http://<host>:8080/` | HTTP 200 |

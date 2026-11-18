# ============================================================================
# Dockerfile — CNCDesign accesible por web (noVNC) desde cualquier host
#
# Construye la compilación FINAL (renderer + main de Electron) y expone un
# escritorio virtual con noVNC para usar la app desde un navegador.
#
#   docker build -t cncdesign:latest .
#   docker run -d --name cncdesign -p 6080:6080 cncdesign:latest
#   # Abrir http://<IP_DEL_HOST>:6080/vnc.html?autoconnect=1
#
# No se incluyen claves API ni .env (ver .dockerignore): la app arranca limpia
# y las claves se introducen desde el modal ⚙ si se desean.
# ============================================================================
FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Dependencias de Electron (GTK/NSS/etc.), escritorio virtual, VNC y noVNC
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb fluxbox x11vnc novnc websockify \
      libgtk-3-0 libnss3 libxss1 libgbm1 libdrm2 libxdamage1 libxshmfence1 \
      libatk-bridge2.0-0 libxkbcommon0 libatspi2.0-0 libx11-xcb1 \
      libxcomposite1 libxcursor1 libxrandr2 libxi2 libxtst6 libcups2 \
      libpango-1.0-0 libcairo2 libxext6 libxrender1 libasound2 \
      fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias primero (mejor aprovechamiento de la caché de Docker)
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el resto del proyecto y compilar la versión de producción
COPY . .
RUN ./node_modules/.bin/vite build \
    && ./node_modules/.bin/tsc -p tsconfig.build.json

ENV NODE_ENV=production \
    DISPLAY=:99 \
    VNC_PORT=5900 \
    WEB_PORT=6080

EXPOSE 6080 5900

CMD ["bash", "scripts/acceso-web.sh"]

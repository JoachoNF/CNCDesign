/**
 * main.ts — Proceso principal de Electron
 *
 * Responsabilidades:
 *   · Crear la ventana (Vite en :5123 en desarrollo, dist/index.html en
 *     producción) y gestionar la pantalla completa (IPC ventana:*).
 *   · Servir de backend a la UI: generación con IA (cad:generar), validación,
 *     importación/exportación de .dxf y listado de modelos de Ollama.
 *   · Persistir la configuración de claves de IA en config-ia.json
 *     (app.getPath('userData')) con prioridad sobre las variables de entorno,
 *     recargando los proveedores del router al guardar.
 *   · Utilidad de captura automatizada de UI (CAPTURA_UI y familia) para
 *     verificación visual en entornos headless.
 */
import { app, BrowserWindow, ipcMain, dialog, nativeTheme } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'

// Nota: __dirname está disponible nativamente porque el main se compila a CommonJS (ver tsconfig.build.json)

let mainWindow: BrowserWindow | null = null

// ===================== CONFIGURACIÓN DE IA =====================

interface ConfigIA {
  anthropicApiKey?: string
  openaiApiKey?: string
  ollamaUrl?: string
}

const rutaConfigIA = () => path.join(app.getPath('userData'), 'config-ia.json')

async function leerConfigIA(): Promise<ConfigIA> {
  try {
    const contenido = await fs.readFile(rutaConfigIA(), 'utf8')
    return JSON.parse(contenido) as ConfigIA
  } catch {
    return {}
  }
}

/**
 * Aplica la configuración guardada a las variables de entorno del proceso.
 * Lo guardado en la app tiene prioridad; si no hay valor, se respetan las
 * variables de entorno ya existentes (por ejemplo un archivo .env).
 */
async function aplicarConfigIA(): Promise<ConfigIA> {
  const config = await leerConfigIA()
  if (config.anthropicApiKey) process.env.ANTHROPIC_API_KEY = config.anthropicApiKey
  if (config.openaiApiKey) process.env.OPENAI_API_KEY = config.openaiApiKey
  if (config.ollamaUrl) process.env.OLLAMA_URL = config.ollamaUrl
  return config
}

/**
 * Verifica si un servidor HTTP responde en una URL dada
 */
async function puertoResponde(url: string, timeout = 2000): Promise<boolean> {
  try {
    const controlador = new AbortController()
    const temporizador = setTimeout(() => controlador.abort(), timeout)
    const respuesta = await fetch(url, { signal: controlador.signal })
    clearTimeout(temporizador)
    return respuesta.ok
  } catch {
    return false
  }
}

/**
 * Carga la URL de Vite en dev con reintentos, y si no responde,
 * hace fallback a los archivos estáticos de dist/ (modo producción embebido).
 */
async function cargarPagina(window: BrowserWindow) {
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    const viteUrl = 'http://localhost:5123'

    // Esperar a que Vite esté listo (máximo 30 segundos)
    for (let i = 0; i < 30; i++) {
      const listo = await puertoResponde(viteUrl)
      if (listo) {
        await window.loadURL(viteUrl)
        console.log('[Electron] Página cargada desde Vite:', viteUrl)
        return
      }
      console.log(`[Electron] Esperando a Vite... intento ${i + 1}/30`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // Fallback: servir archivos estáticos de dist/ si Vite no responde
    console.warn('[Electron] Vite no respondió. Usando fallback a dist/index.html')
    await window.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    await window.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0a0a0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  // Abrir DevTools solo en dev
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  cargarPagina(mainWindow)

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  // Sincronizar el estado de pantalla completa con el renderer
  mainWindow.on('enter-full-screen', () =>
    mainWindow?.webContents.send('ventana:pantallaCompleta', true)
  )
  mainWindow.on('leave-full-screen', () =>
    mainWindow?.webContents.send('ventana:pantallaCompleta', false)
  )

  // Utilidad de desarrollo: capturar una imagen de la UI y salir
  // (ej: CAPTURA_UI=/tmp/opencode/ui.png CAPTURA_UI_DXF=./demo.dxf CAPTURA_UI_VISTA=fullVisor npm run dev)
  if (process.env.CAPTURA_UI) {
    let fase = 0
    mainWindow.webContents.on('did-finish-load', () => {
      fase++
      void (async () => {
        try {
          if (fase === 1 && process.env.CAPTURA_UI_DXF) {
            // Sembrar un modelo de prueba en el almacén persistente y recargar
            const dxfTexto = await fs.readFile(process.env.CAPTURA_UI_DXF, 'utf8')
            const estado = {
              state: {
                modeloActual: {
                  id: 'captura-demo',
                  nombre: 'placa-demo',
                  tipo: '2d',
                  unidades: 'mm',
                  entidades: [],
                  dxfTexto,
                  ultimaModificacion: new Date().toISOString(),
                  version: 1,
                },
                pedidos: [],
                historial: [],
              },
              version: 0,
            }
            await mainWindow!.webContents.executeJavaScript(
              `localStorage.setItem('cnc-design-storage', ${JSON.stringify(JSON.stringify(estado))})`
            )
            mainWindow!.webContents.reload()
            return
          }

          // Opcional: cambiar de pestaña antes de capturar
          const vista = process.env.CAPTURA_UI_VISTA
          if (vista) {
            const etiqueta =
              vista === 'fullVisor' ? 'Visor' : vista === 'fullTerminal' ? 'Terminal' : 'Dividida'
            await mainWindow!.webContents.executeJavaScript(
              `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(
                etiqueta
              )}); b && b.click() })()`
            )
          }

          // Opcional: ejecutar JS arbitrario antes de capturar (para inspecciones)
          if (process.env.CAPTURA_UI_JS) {
            await mainWindow!.webContents.executeJavaScript(process.env.CAPTURA_UI_JS)
          }

          await new Promise((r) => setTimeout(r, 5000))
          const imagen = await mainWindow!.webContents.capturePage()
          await fs.writeFile(process.env.CAPTURA_UI!, imagen.toPNG())
          console.log('[Captura] Guardada en', process.env.CAPTURA_UI)
        } catch (error) {
          console.error('[Captura] Error:', error)
        }
        app.quit()
      })()
    })
  }

  // Diagnóstico de pantalla en blanco
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc, validatedURL) => {
    console.error('[Electron] Falló la carga de la página:', validatedURL, errorCode, errorDesc)
  })

  mainWindow.webContents.on('crashed', () => {
    console.error('[Electron] El proceso del renderer se cerró inesperadamente')
  })
}

app.whenReady().then(async () => {
  // Apariencia oscura para diálogos nativos y menús del sistema
  nativeTheme.themeSource = 'dark'

  // Cargar claves API guardadas antes de crear la ventana
  await aplicarConfigIA()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ===================== CANALES IPC =====================

// cad:generar — solicita al router IA generar/modificar un modelo y devuelve DXF
ipcMain.handle(
  'cad:generar',
  async (_event, { prompt, modeloActual, tipo, proveedorPreferido, ollamaModelo }) => {
    const { cadRouter } = await import('../src/ai/router')
    return cadRouter.generar({ prompt, modeloActual, tipo, proveedorPreferido, ollamaModelo })
  }
)

// cad:validar — valida manufacturabilidad CNC de un DXF
ipcMain.handle('cad:validar', async (_event, { dxfTexto }) => {
  const { validarDXF } = await import('../src/cad/validator')
  return validarDXF(dxfTexto)
})

// cad:exportar — guarda un archivo .dxf en el sistema
ipcMain.handle('cad:exportar', async (_event, { contenido, nombre }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Exportar modelo .dxf',
    defaultPath: path.join(app.getPath('documents'), `${nombre || 'modelo'}.dxf`),
    filters: [{ name: 'DXF', extensions: ['dxf'] }],
  })

  if (canceled || !filePath) return { ok: false, motivo: 'cancelado' }

  await fs.writeFile(filePath, contenido, 'utf8')
  return { ok: true, path: filePath }
})

// cad:importar — abre un archivo .dxf y devuelve su texto
ipcMain.handle('cad:importar', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Importar modelo .dxf',
    filters: [{ name: 'DXF', extensions: ['dxf'] }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) return { ok: false, motivo: 'cancelado' }

  const texto = await fs.readFile(filePaths[0], 'utf8')
  return { ok: true, texto, path: filePaths[0] }
})

// ventana:* — control de pantalla completa
ipcMain.handle('ventana:alternarPantallaCompleta', () => {
  if (!mainWindow) return false
  const nuevo = !mainWindow.isFullScreen()
  mainWindow.setFullScreen(nuevo)
  return nuevo
})

ipcMain.handle('ventana:salirPantallaCompleta', () => {
  mainWindow?.setFullScreen(false)
  return false
})

ipcMain.handle('ventana:estaPantallaCompleta', () => Boolean(mainWindow?.isFullScreen()))

// ia:obtener-config — claves API y URL de Ollama guardadas en disco
ipcMain.handle('ia:obtener-config', async () => {
  const config = await leerConfigIA()
  return {
    anthropicApiKey: config.anthropicApiKey || '',
    openaiApiKey: config.openaiApiKey || '',
    ollamaUrl: config.ollamaUrl || 'http://localhost:11434',
    entorno: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
  }
})

// ia:guardar-config — persiste las claves y recarga los proveedores del router
ipcMain.handle('ia:guardar-config', async (_event, config: ConfigIA) => {
  await fs.writeFile(rutaConfigIA(), JSON.stringify(config, null, 2), 'utf8')
  await aplicarConfigIA()
  const { cadRouter } = await import('../src/ai/router')
  cadRouter.recargarProveedores()
  return { ok: true }
})

// cad:modelos-ollama — lista los modelos instalados en el servidor Ollama
ipcMain.handle('cad:modelos-ollama', async () => {
  const config = await leerConfigIA()
  const url = config.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434'
  try {
    const respuesta = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!respuesta.ok) return { ok: false, modelos: [] as string[] }
    const data: any = await respuesta.json()
    const modelos = (data.models || [])
      .map((m: any) => String(m.name || m.model || ''))
      .filter(Boolean)
    return { ok: true, modelos }
  } catch {
    return { ok: false, modelos: [] as string[] }
  }
})

console.log('[CNCDesign] Electron main listo')

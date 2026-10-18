/**
 * preload.ts — Puente seguro entre el renderer y el proceso principal
 *
 * Expone `window.apiCAD` mediante contextBridge con tres APIs:
 *   · cad      → generar, validar, exportar, importar y listar modelos de Ollama
 *   · ventana  → pantalla completa (alternar, salir, consultar y escuchar eventos)
 *   · ia       → leer y guardar la configuración de claves (config-ia.json)
 *
 * El contrato completo de canales está documentado en electron/ipc/canales.ts;
 * aquí se usan los nombres literales para mantener el runtime simple.
 */
import { contextBridge, ipcRenderer } from 'electron'

export interface ConfigIAVista {
  anthropicApiKey: string
  openaiApiKey: string
  ollamaUrl: string
  entorno: { anthropic: boolean; openai: boolean }
}

export interface CanalCAD {
  generar: (args: {
    prompt: string
    modeloActual?: string
    tipo?: string
    proveedorPreferido?: string
    ollamaModelo?: string
  }) => Promise<any>
  validar: (args: { dxfTexto: string }) => Promise<any>
  exportar: (args: { contenido: string; nombre?: string }) => Promise<any>
  importar: () => Promise<any>
  ventana: {
    alternarPantallaCompleta: () => Promise<boolean>
    salirPantallaCompleta: () => Promise<boolean>
    estaPantallaCompleta: () => Promise<boolean>
    onPantallaCompleta: (callback: (activa: boolean) => void) => void
  }
  ia: {
    obtenerConfig: () => Promise<ConfigIAVista>
    guardarConfig: (config: {
      anthropicApiKey?: string
      openaiApiKey?: string
      ollamaUrl?: string
    }) => Promise<{ ok: boolean }>
    modelosOllama: () => Promise<{ ok: boolean; modelos: string[] }>
  }
}

// Exponer la API de CAD al renderer (contexto aislado)
contextBridge.exposeInMainWorld('apiCAD', {
  generar: (args) => ipcRenderer.invoke('cad:generar', args),
  validar: (args) => ipcRenderer.invoke('cad:validar', args),
  exportar: (args) => ipcRenderer.invoke('cad:exportar', args),
  importar: () => ipcRenderer.invoke('cad:importar'),
  ventana: {
    alternarPantallaCompleta: () => ipcRenderer.invoke('ventana:alternarPantallaCompleta'),
    salirPantallaCompleta: () => ipcRenderer.invoke('ventana:salirPantallaCompleta'),
    estaPantallaCompleta: () => ipcRenderer.invoke('ventana:estaPantallaCompleta'),
    onPantallaCompleta: (callback) =>
      ipcRenderer.on('ventana:pantallaCompleta', (_evento, activa: boolean) => callback(activa)),
  },
  ia: {
    obtenerConfig: () => ipcRenderer.invoke('ia:obtener-config'),
    guardarConfig: (config) => ipcRenderer.invoke('ia:guardar-config', config),
    modelosOllama: () => ipcRenderer.invoke('cad:modelos-ollama'),
  },
} as CanalCAD)

declare global {
  interface Window {
    apiCAD?: CanalCAD
  }
}

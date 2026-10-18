/**
 * canales.ts — Contrato documental de los canales IPC de CNCDesign
 *
 * Este archivo es la REFERENCIA COMPLETA de todo lo que cruza el puente
 * preload ↔ main. El runtime usa los nombres literales dentro de
 * `electron/main.ts` (ipcMain.handle) y `electron/preload.ts`
 * (ipcRenderer.invoke); mantener ambos sincronizados con esta lista.
 *
 * Renderer → Main (invoke/handle):
 *   · cad:generar                    → genera/modifica un modelo con el router IA
 *   · cad:validar                    → valida un texto DXF (reglas CNC)
 *   · cad:exportar                   → diálogo nativo de guardado + escribir .dxf
 *   · cad:importar                   → diálogo nativo de apertura + leer .dxf
 *   · cad:modelos-ollama             → lista los modelos instalados en Ollama (/api/tags)
 *   · ventana:alternarPantallaCompleta
 *   · ventana:salirPantallaCompleta
 *   · ventana:estaPantallaCompleta
 *   · ia:obtener-config              → lee config-ia.json (+ presencia en el entorno)
 *   · ia:guardar-config              → escribe config-ia.json y recarga proveedores
 *
 * Main → Renderer (send/on):
 *   · ventana:pantallaCompleta       → notifica cambios de pantalla completa
 */

/** Nombres canónicos de los canales IPC, agrupados por dominio. */
export const CANALES = {
  /** Genera o modifica un modelo mediante el router multi-IA. */
  GENERAR: 'cad:generar',
  /** Valida la manufacturabilidad CNC de un texto DXF. */
  VALIDAR: 'cad:validar',
  /** Exporta el DXF vigente mediante el diálogo nativo de guardado. */
  EXPORTAR: 'cad:exportar',
  /** Importa un .dxf desde el disco mediante el diálogo nativo. */
  IMPORTAR: 'cad:importar',
  /** Lista los modelos instalados en el servidor Ollama. */
  MODELOS_OLLAMA: 'cad:modelos-ollama',

  /** Alterna la pantalla completa de la ventana (devuelve el estado nuevo). */
  VENTANA_ALTERNAR: 'ventana:alternarPantallaCompleta',
  /** Fuerza la salida de pantalla completa. */
  VENTANA_SALIR: 'ventana:salirPantallaCompleta',
  /** Consulta si la ventana está en pantalla completa. */
  VENTANA_ESTADO: 'ventana:estaPantallaCompleta',
  /** Evento main→renderer con el estado de pantalla completa. */
  VENTANA_EVENTO: 'ventana:pantallaCompleta',

  /** Lee la configuración de claves de IA guardada en disco. */
  IA_OBTENER_CONFIG: 'ia:obtener-config',
  /** Persiste la configuración de claves y recarga los proveedores. */
  IA_GUARDAR_CONFIG: 'ia:guardar-config',
} as const

/** Argumentos de `cad:generar` (misma forma que ContextoGenerar del router). */
export interface PedidoGenerar {
  prompt: string
  /** Texto DXF del modelo actual (para tareas de edición). */
  modeloActual?: string
  /** 'crear' | 'editar' | 'imagen' | 'corregir' | 'desconocido'. */
  tipo?: string
  /** 'auto' | 'anthropic' | 'openai' | 'ollama'. */
  proveedorPreferido?: string
  /** Modelo concreto de Ollama (p. ej. 'qwen2.5-coder:7b'). */
  ollamaModelo?: string
}

/** Respuesta de `cad:generar` (misma forma que RespuestaRouter). */
export interface RespuestaGenerar {
  ok: boolean
  dxf?: string
  preview?: string
  errores?: string[]
  /** Modelo que resolvió la petición (p. ej. 'claude-…', 'qwen2.5-coder:7b'). */
  modeloIA?: string
  /** Proveedor finalmente usado tras la cascada de fallbacks. */
  proveedorUsado?: string
  /** Tarea detectada por el clasificador del router. */
  tareaDetectada?: string
  costo?: number
}

/** Respuesta de `cad:validar` (misma forma que ResultadoValidacion). */
export interface RespuestaValidar {
  valido: boolean
  advertencias: string[]
  errores: string[]
  sugerencias: string[]
}

/** Respuesta de `cad:exportar`. */
export type RespuestaExportar = { ok: true; path: string } | { ok: false; motivo: 'cancelado' | string }

/** Respuesta de `cad:importar`. */
export type RespuestaImportar = { ok: true; texto: string; path: string } | { ok: false; motivo: 'cancelado' | string }

/** Respuesta de `cad:modelos-ollama`. */
export interface RespuestaModelosOllama {
  ok: boolean
  modelos: string[]
}

/** Configuración de IA tal como la devuelve `ia:obtener-config`. */
export interface ConfigIAVista {
  anthropicApiKey: string
  openaiApiKey: string
  ollamaUrl: string
  /** Indica si las claves también existen como variables de entorno. */
  entorno: { anthropic: boolean; openai: boolean }
}

/** Payload de `ia:guardar-config`. */
export interface ConfigIAGuardar {
  anthropicApiKey?: string
  openaiApiKey?: string
  ollamaUrl?: string
}

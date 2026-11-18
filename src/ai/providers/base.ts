/**
 * base.ts — Interfaz común de los proveedores de IA
 *
 * Define el contrato que implementan Anthropic, OpenAI y Ollama:
 *   · `OpcionesIA`  — parámetros de una generación (clave, modelo, temperatura…)
 *   · `RespuestaIA` — resultado normalizado (texto, modelo usado, costo)
 *   · `ProveedorIA` — clase abstracta con `generar()` y `disponible()`
 *
 * El router (src/ai/router.ts) trabaja contra esta interfaz, no contra las
 * implementaciones concretas, de modo que añadir un proveedor nuevo no
 * requiere tocar la lógica de enrutamiento.
 */
/** Fases que se pueden notificar al renderer mientras la IA está trabajando. */
export type FaseProgresoIA =
  | 'conectando'
  | 'pensando'
  | 'generando'
  | 'latido'
  | 'error'
  | 'info'

/** Evento de progreso enviado del main al renderer (vía IPC `ia:progreso`). */
export interface ProgresoIA {
  fase: FaseProgresoIA
  proveedor: string
  modelo: string
  /** Fragmento nuevo recibido en este evento (puede ser pensamiento o texto). */
  texto: string
  /** Todo el texto acumulado hasta ahora. */
  acumulado: string
  /** Milisegundos transcurridos desde el inicio de la petición. */
  tiempoMs: number
  /** Milisegundos hasta el primer fragmento (0 si todavía no llegó). */
  tiempoPrimerTokenMs: number
  /** Identificador de la solicitud, para descartar eventos tardíos. */
  abortId?: string
}

/** Callback que los proveedores usan para informar de su avance. */
export type CallbackProgresoIA = (progreso: ProgresoIA) => void

export interface OpcionesIA {
  apiKey?: string
  modelo?: string
  temperatura?: number
  maxTokens?: number
  baseURL?: string
  systemPrompt?: string
  /** Señal de cancelación (abort) para detener la generación activa */
  signal?: AbortSignal
  /** Notifica fragmentos de razonamiento/texto y cambios de fase al renderer */
  progreso?: CallbackProgresoIA
  /** Identificador de la solicitud (para correlacionar los eventos) */
  abortId?: string
}

export interface RespuestaIA {
  texto: string
  modeloUsado: string
  tokens?: number
  costo?: number
  /** Texto de razonamiento intermedio (cuando el proveedor lo expone). */
  pensamiento?: string
  /** Tiempo hasta el primer token, en milisegundos. */
  tiempoPrimerTokenMs?: number
}

export abstract class ProveedorIA {
  abstract nombre: string
  abstract generar(prompt: string, opciones?: OpcionesIA): Promise<RespuestaIA>
  abstract disponible(): Promise<boolean>
}

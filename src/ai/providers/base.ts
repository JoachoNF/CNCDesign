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
export interface OpcionesIA {
  apiKey?: string
  modelo?: string
  temperatura?: number
  maxTokens?: number
  baseURL?: string
  systemPrompt?: string
}

export interface RespuestaIA {
  texto: string
  modeloUsado: string
  tokens?: number
  costo?: number
}

export abstract class ProveedorIA {
  abstract nombre: string
  abstract generar(prompt: string, opciones?: OpcionesIA): Promise<RespuestaIA>
  abstract disponible(): Promise<boolean>
}

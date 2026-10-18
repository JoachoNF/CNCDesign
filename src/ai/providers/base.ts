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

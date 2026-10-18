import { ProveedorIA, type RespuestaIA, type OpcionesIA } from './base'

/**
 * Proveedor Ollama local (modelos gratuitos, sin costo de API)
 * Útil como fallback y para bocetos rápidos sin depender de claves de pago.
 */
export class OllamaProvider extends ProveedorIA {
  nombre = 'ollama'
  private baseURL: string

  constructor(baseURL = 'http://localhost:11434') {
    super()
    this.baseURL = baseURL
  }

  async disponible(): Promise<boolean> {
    try {
      const respuesta = await fetch(`${this.baseURL}/api/tags`, { signal: AbortSignal.timeout(2000) })
      return respuesta.ok
    } catch {
      return false
    }
  }

  async generar(prompt: string, opciones: OpcionesIA = {}): Promise<RespuestaIA> {
    const modelo = opciones.modelo || process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b'
    const temperatura = opciones.temperatura ?? 0.3

    const respuesta = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Tiempo máximo generoso (los modelos locales en CPU pueden tardar);
      // evita que la petición quede colgada indefinidamente
      signal: AbortSignal.timeout(15 * 60 * 1000),
      body: JSON.stringify({
        model: modelo,
        prompt,
        stream: false,
        system: opciones.systemPrompt || '',
        // Ollama espera los parámetros de muestreo dentro de `options`
        options: {
          temperature: temperatura,
          ...(opciones.maxTokens ? { num_predict: opciones.maxTokens } : {}),
        },
        // Mantiene el modelo cargado en memoria entre peticiones
        keep_alive: '5m',
      }),
    })

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      throw new Error(`Ollama error ${respuesta.status}: ${errorTexto}`)
    }

    const data: any = await respuesta.json()

    return {
      texto: data.response || '',
      modeloUsado: `ollama:${modelo}`,
    }
  }
}

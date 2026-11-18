/**
 * Proveedor Ollama local (modelos gratuitos, sin costo de API)
 * Útil como fallback y para bocetos rápidos sin depender de claves de pago.
 *
 * Streaming NDJSON: cada línea puede traer `thinking` (modelos con razonamiento)
 * y `response` (texto visible), además de un objeto final con `done: true` y
 * estadísticas. Así se puede ver si el modelo está cargando, pensando o ya
 * escribiendo el DXF.
 */
import { ProveedorIA, type RespuestaIA, type OpcionesIA } from './base'
import { crearEmisor, leerFlujo } from './stream'

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
    const emisor = crearEmisor(this.nombre, opciones)
    emisor.setModelo(modelo)
    emisor.fase('conectando', `Conectando con Ollama (${modelo}). Si el modelo está en frío puede tardar unos minutos…`)

    const respuesta = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Tiempo máximo generoso (los modelos locales en CPU pueden tardar);
      // evita que la petición quede colgada indefinidamente
      signal: opciones.signal ?? AbortSignal.timeout(15 * 60 * 1000),
      body: JSON.stringify({
        model: modelo,
        prompt,
        system: opciones.systemPrompt || '',
        stream: true,
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
      emisor.fase('error', errorTexto.slice(0, 200))
      throw new Error(`Ollama error ${respuesta.status}: ${errorTexto}`)
    }

    let texto = ''
    let pensamiento = ''
    let tokens: number | undefined

    await leerFlujo(
      respuesta,
      (dato: any) => {
        if (dato.thinking) {
          pensamiento += String(dato.thinking)
          emisor.fragmento('pensando', String(dato.thinking), pensamiento)
        }
        if (dato.response) {
          texto += String(dato.response)
          emisor.fragmento('generando', String(dato.response), texto)
        }
        if (dato.eval_count !== undefined) {
          tokens = (dato.prompt_eval_count || 0) + dato.eval_count
        }
      },
      opciones.signal
    )

    if (!texto.trim()) throw new Error('Ollama no devolvió texto en el flujo')

    emisor.fase('generando', 'Respuesta recibida', texto)
    return {
      texto,
      modeloUsado: `ollama:${modelo}`,
      tokens,
      pensamiento: pensamiento || undefined,
      tiempoPrimerTokenMs: emisor.tiempoPrimerTokenMs() || undefined,
    }
  }
}

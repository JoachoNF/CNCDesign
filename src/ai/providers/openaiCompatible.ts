/**
 * openaiCompatible.ts — Proveedor genérico para APIs OpenAI-compatible
 *
 * Cubre proveedores que exponen el mismo formato `/chat/completions`:
 *   · Groq        → https://api.groq.com/openai/v1
 *   · Mistral     → https://api.mistral.ai/v1
 *   · OpenRouter  → https://openrouter.ai/api/v1
 *
 * Son opciones gratuitas (con API key) que corren en la nube, fuera de local.
 * Streaming SSE con separación de razonamiento (cuando el proveedor lo expone).
 */
import { ProveedorIA, type OpcionesIA, type RespuestaIA } from './base'
import { crearEmisor, leerFlujo, razonamientoDe } from './stream'

export class ProveedorOpenAICompatible extends ProveedorIA {
  nombre: string
  private apiKey: string
  private baseURL: string
  private modelo: string

  constructor(nombre: string, apiKey: string, baseURL: string, modelo: string) {
    super()
    this.nombre = nombre
    this.apiKey = apiKey
    this.baseURL = baseURL
    this.modelo = modelo
  }

  async disponible(): Promise<boolean> {
    return Boolean(this.apiKey)
  }

  async generar(prompt: string, opciones: OpcionesIA = {}): Promise<RespuestaIA> {
    const temperatura = opciones.temperatura ?? 0.2
    const maxTokens = opciones.maxTokens ?? 4000
    const emisor = crearEmisor(this.nombre, opciones)
    emisor.setModelo(this.modelo)
    emisor.fase('conectando', `Conectando con ${this.modelo}…`)

    let respuesta: Response
    try {
      respuesta = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelo,
          temperature: temperatura,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: opciones.systemPrompt || '' },
            { role: 'user', content: prompt },
          ],
          stream: true,
        }),
        signal: opciones.signal,
      })
    } catch (error: any) {
      emisor.fase('error', error?.message || 'No se pudo conectar')
      throw error
    }

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      emisor.fase('error', errorTexto.slice(0, 200))
      throw new Error(`${this.nombre} error ${respuesta.status}: ${errorTexto}`)
    }

    let texto = ''
    let pensamiento = ''
    let tokens: number | undefined

    await leerFlujo(
      respuesta,
      (dato: any) => {
        if (dato.usage?.total_tokens !== undefined) tokens = dato.usage.total_tokens
        const delta = dato.choices?.[0]?.delta
        if (!delta) return

        const razonamiento = razonamientoDe(delta)
        if (razonamiento) {
          pensamiento += razonamiento
          emisor.fragmento('pensando', razonamiento, pensamiento)
        }
        if (delta.content) {
          texto += String(delta.content)
          emisor.fragmento('generando', String(delta.content), texto)
        }
      },
      opciones.signal
    )

    if (!texto.trim()) throw new Error(`${this.nombre} no devolvió texto en el flujo`)

    emisor.fase('generando', 'Respuesta recibida', texto)
    return {
      texto,
      modeloUsado: `${this.nombre}:${this.modelo}`,
      tokens,
      pensamiento: pensamiento || undefined,
      tiempoPrimerTokenMs: emisor.tiempoPrimerTokenMs() || undefined,
    }
  }
}

/**
 * openaiCompatible.ts — Proveedor genérico para APIs OpenAI-compatible
 *
 * Cubre proveedores que exponen el mismo formato `/chat/completions`:
 *   · Groq        → https://api.groq.com/openai/v1
 *   · Mistral     → https://api.mistral.ai/v1
 *   · OpenRouter  → https://openrouter.ai/api/v1
 *
 * Son opciones gratuitas (con API key) que corren en la nube, fuera de local.
 */
import { ProveedorIA, type OpcionesIA, type RespuestaIA } from './base'

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

    const respuesta = await fetch(`${this.baseURL}/chat/completions`, {
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
      }),
        signal: opciones.signal,
    })

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      throw new Error(`${this.nombre} error ${respuesta.status}: ${errorTexto}`)
    }

    const data: any = await respuesta.json()
    const texto = data.choices?.[0]?.message?.content || ''

    return {
      texto,
      modeloUsado: `${this.nombre}:${this.modelo}`,
      tokens: data.usage?.total_tokens,
    }
  }
}

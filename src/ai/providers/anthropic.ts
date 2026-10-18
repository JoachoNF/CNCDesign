import { ProveedorIA, type RespuestaIA, type OpcionesIA } from './base'

/**
 * Proveedor Anthropic (Claude Opus 5.5, Claude Fable 5.1, etc.)
 * Líder en image-to-CAD y creación general según Parametric CAD Bench v3.
 */
export class AnthropicProvider extends ProveedorIA {
  nombre = 'anthropic'
  private apiKey: string
  private baseURL: string

  constructor(apiKey: string, baseURL = 'https://api.anthropic.com/v1') {
    super()
    this.apiKey = apiKey
    this.baseURL = baseURL
  }

  async disponible(): Promise<boolean> {
    return Boolean(this.apiKey)
  }

  async generar(prompt: string, opciones: OpcionesIA = {}): Promise<RespuestaIA> {
    const modelo = opciones.modelo || 'claude-opus-5.5-20260922'
    const temperatura = opciones.temperatura ?? 0.2
    const maxTokens = opciones.maxTokens ?? 4000

    const respuesta = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: maxTokens,
        temperature: temperatura,
        system: opciones.systemPrompt || '',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      throw new Error(`Anthropic error ${respuesta.status}: ${errorTexto}`)
    }

    const data: any = await respuesta.json()
    const texto = data.content?.[0]?.text || ''

    return {
      texto,
      modeloUsado: modelo,
      tokens: data.usage?.input_tokens + data.usage?.output_tokens,
    }
  }
}

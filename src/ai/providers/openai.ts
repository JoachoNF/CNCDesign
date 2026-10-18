import { ProveedorIA, type RespuestaIA, type OpcionesIA } from './base'

/**
 * Proveedor OpenAI (GPT-6 Astra, GPT-5.6, etc.)
 * Líder en create-and-edit según Parametric CAD Bench v3.
 */
export class OpenAIProvider extends ProveedorIA {
  nombre = 'openai'
  private apiKey: string
  private baseURL: string

  constructor(apiKey: string, baseURL = 'https://api.openai.com/v1') {
    super()
    this.apiKey = apiKey
    this.baseURL = baseURL
  }

  async disponible(): Promise<boolean> {
    return Boolean(this.apiKey)
  }

  async generar(prompt: string, opciones: OpcionesIA = {}): Promise<RespuestaIA> {
    const modelo = opciones.modelo || 'gpt-6-astra-202609'
    const temperatura = opciones.temperatura ?? 0.2
    const maxTokens = opciones.maxTokens ?? 4000

    const respuesta = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelo,
        temperature: temperatura,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: opciones.systemPrompt || '' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      throw new Error(`OpenAI error ${respuesta.status}: ${errorTexto}`)
    }

    const data: any = await respuesta.json()
    const texto = data.choices?.[0]?.message?.content || ''

    return {
      texto,
      modeloUsado: modelo,
      tokens: data.usage?.total_tokens,
    }
  }
}

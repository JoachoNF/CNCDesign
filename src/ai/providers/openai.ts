import { ProveedorIA, type RespuestaIA, type OpcionesIA } from './base'
import { crearEmisor, leerFlujo, razonamientoDe } from './stream'

/**
 * Proveedor OpenAI (GPT-6 Astra, GPT-5.6, etc.)
 * Líder en create-and-edit según Parametric CAD Bench v3.
 *
 * Streaming con `/chat/completions`: se separa el razonamiento (`reasoning` /
 * `reasoning_content`) del texto visible (`content`), y se pide el uso de
 * tokens al final con `stream_options`.
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
    const emisor = crearEmisor(this.nombre, opciones)
    emisor.setModelo(modelo)
    emisor.fase('conectando', `Conectando con ${modelo}…`)

    let respuesta: Response
    try {
      respuesta = await fetch(`${this.baseURL}/chat/completions`, {
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
          stream: true,
          stream_options: { include_usage: true },
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
      throw new Error(`OpenAI error ${respuesta.status}: ${errorTexto}`)
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

    if (!texto.trim()) throw new Error('OpenAI no devolvió texto en el flujo')

    emisor.fase('generando', 'Respuesta recibida', texto)
    return {
      texto,
      modeloUsado: emisor.modelo(),
      tokens,
      pensamiento: pensamiento || undefined,
      tiempoPrimerTokenMs: emisor.tiempoPrimerTokenMs() || undefined,
    }
  }
}

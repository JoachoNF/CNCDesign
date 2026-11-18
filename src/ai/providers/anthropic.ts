import { ProveedorIA, type RespuestaIA, type OpcionesIA } from './base'
import { crearEmisor, leerFlujo } from './stream'

/**
 * Proveedor Anthropic (Claude Opus 5.5, Claude Fable 5.1, etc.)
 * Líder en image-to-CAD y creación general según Parametric CAD Bench v3.
 *
 * Usa la API de mensajes en modo streaming: expone tanto los bloques de
 * `text_delta` como los de `thinking_delta` (pensamiento extendido), de modo
 * que la terminal puede distinguir "está pensando" de "está escribiendo".
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
    const emisor = crearEmisor(this.nombre, opciones)
    emisor.setModelo(modelo)
    emisor.fase('conectando', `Conectando con ${modelo}…`)

    let respuesta: Response
    try {
      respuesta = await fetch(`${this.baseURL}/messages`, {
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
      throw new Error(`Anthropic error ${respuesta.status}: ${errorTexto}`)
    }

    let texto = ''
    let pensamiento = ''
    let tokens: number | undefined
    let errorFlujo = ''

    await leerFlujo(
      respuesta,
      (dato: any) => {
        switch (dato.type) {
          case 'message_start':
            if (dato.message?.model) emisor.setModelo(dato.message.model)
            emisor.fase('pensando', 'Conectado. El modelo está valorando la petición…', pensamiento)
            break
          case 'content_block_start':
            if (dato.content_block?.type === 'thinking') {
              emisor.fase('pensando', 'Razonamiento en curso…', pensamiento)
            }
            break
          case 'content_block_delta': {
            const delta = dato.delta || {}
            if (delta.type === 'thinking_delta') {
              const fragmento = String(delta.thinking || '')
              pensamiento += fragmento
              emisor.fragmento('pensando', fragmento, pensamiento)
            } else if (delta.type === 'text_delta') {
              const fragmento = String(delta.text || '')
              texto += fragmento
              emisor.fragmento('generando', fragmento, texto)
            }
            break
          }
          case 'message_delta':
            if (dato.usage?.output_tokens !== undefined) {
              tokens = (dato.usage.input_tokens || 0) + dato.usage.output_tokens
            }
            break
          case 'error':
            errorFlujo = dato.error?.message || 'Error en el flujo de Anthropic'
            break
        }
      },
      opciones.signal
    )

    if (errorFlujo) throw new Error(`Anthropic error: ${errorFlujo}`)
    if (!texto.trim()) throw new Error('Anthropic no devolvió texto en el flujo')

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

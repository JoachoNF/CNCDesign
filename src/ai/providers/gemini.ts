/**
 * gemini.ts — Proveedor Google Gemini (API gratuita con API key, tier free)
 *
 * Usa el endpoint en streaming `streamGenerateContent?alt=sse`. Las partes con
 * `thought: true` se muestran como razonamiento intermedio y el resto como
 * texto generado. Si el modelo configurado ya no existe (Google retira
 * modelos), se reintenta una vez con el Flash vigente.
 */
import { ProveedorIA, type OpcionesIA, type RespuestaIA } from './base'
import { crearEmisor, leerFlujo } from './stream'

/** Modelo Flash vigente (gemini-2.0-flash fue dado de baja por Google). */
export const MODELO_GEMINI_POR_DEFECTO = 'gemini-3.8-flash'

export class GeminiProvider extends ProveedorIA {
  nombre = 'gemini'
  private apiKey: string
  private modelo: string

  constructor(apiKey = '', modelo = process.env.GEMINI_MODEL || MODELO_GEMINI_POR_DEFECTO) {
    super()
    this.apiKey = apiKey
    this.modelo = modelo
  }

  async disponible(): Promise<boolean> {
    return Boolean(this.apiKey)
  }

  /** Abre el flujo SSE para un modelo concreto. */
  private abrirFlujo(modelo: string, prompt: string, opciones: OpcionesIA): Promise<Response> {
    const temperatura = opciones.temperatura ?? 0.2
    const maxTokens = opciones.maxTokens ?? 4000

    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: opciones.systemPrompt || '' }],
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: temperatura,
            maxOutputTokens: maxTokens,
          },
        }),
        signal: opciones.signal,
      }
    )
  }

  async generar(prompt: string, opciones: OpcionesIA = {}): Promise<RespuestaIA> {
    let modelo = this.modelo
    const emisor = crearEmisor(this.nombre, opciones)
    emisor.setModelo(modelo)
    emisor.fase('conectando', `Conectando con ${modelo}…`)

    let respuesta = await this.abrirFlujo(modelo, prompt, opciones)

    if (respuesta.status === 404 && modelo !== MODELO_GEMINI_POR_DEFECTO) {
      console.warn(`[Gemini] Modelo ${modelo} no disponible; reintentando con ${MODELO_GEMINI_POR_DEFECTO}`)
      emisor.fase('info', `Modelo ${modelo} retirado; reintentando con ${MODELO_GEMINI_POR_DEFECTO}`)
      modelo = MODELO_GEMINI_POR_DEFECTO
      emisor.setModelo(modelo)
      respuesta = await this.abrirFlujo(modelo, prompt, opciones)
    }

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      emisor.fase('error', errorTexto.slice(0, 200))
      throw new Error(`Gemini error ${respuesta.status}: ${errorTexto}`)
    }

    let texto = ''
    let pensamiento = ''
    let tokens: number | undefined

    await leerFlujo(
      respuesta,
      (dato: any) => {
        const partes = dato.candidates?.[0]?.content?.parts || []
        for (const parte of partes) {
          const fragmento = String(parte.text || '')
          if (!fragmento) continue
          if (parte.thought) {
            pensamiento += fragmento
            emisor.fragmento('pensando', fragmento, pensamiento)
          } else {
            texto += fragmento
            emisor.fragmento('generando', fragmento, texto)
          }
        }
        if (dato.usageMetadata?.totalTokenCount !== undefined) {
          tokens = dato.usageMetadata.totalTokenCount
        }
      },
      opciones.signal
    )

    if (!texto.trim()) throw new Error('Gemini no devolvió texto en el flujo')

    emisor.fase('generando', 'Respuesta recibida', texto)
    return {
      texto,
      modeloUsado: `gemini:${modelo}`,
      tokens,
      pensamiento: pensamiento || undefined,
      tiempoPrimerTokenMs: emisor.tiempoPrimerTokenMs() || undefined,
    }
  }
}

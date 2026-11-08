/**
 * gemini.ts — Proveedor Google Gemini (API gratuita con API key, tier free)
 *
 * Usa el endpoint generateContent de Google AI Studio. Soporta instructions de
 * sistema y generación de texto (DXF) — opción gratuita en la nube.
 */
import { ProveedorIA, type OpcionesIA, type RespuestaIA } from './base'

export class GeminiProvider extends ProveedorIA {
  nombre = 'gemini'
  private apiKey: string
  private modelo: string

  constructor(apiKey = '', modelo = process.env.GEMINI_MODEL || 'gemini-2.0-flash') {
    super()
    this.apiKey = apiKey
    this.modelo = modelo
  }

  async disponible(): Promise<boolean> {
    return Boolean(this.apiKey)
  }

  async generar(prompt: string, opciones: OpcionesIA = {}): Promise<RespuestaIA> {
    const temperatura = opciones.temperatura ?? 0.2
    const maxTokens = opciones.maxTokens ?? 4000

    const respuesta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelo}:generateContent?key=${this.apiKey}`,
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

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      throw new Error(`Gemini error ${respuesta.status}: ${errorTexto}`)
    }

    const data: any = await respuesta.json()
    const texto = (data.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p?.text || '')
      .join('')
      .trim()

    return {
      texto,
      modeloUsado: `gemini:${this.modelo}`,
      tokens: data.usageMetadata?.totalTokenCount,
    }
  }
}

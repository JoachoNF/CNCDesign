/**
 * groq.ts — Proveedor Groq (API gratuita, OpenAI-compatible, modelo Llama en la nube)
 *
 * Groq ofrece modelos Llama (ej. llama-3.3-70b-versatile) con tier gratuito,
 * accesibles por API (no local). Se usa como opción gratuita de la nube.
 */
import { ProveedorOpenAICompatible } from './openaiCompatible'

export class GroqProvider extends ProveedorOpenAICompatible {
  constructor(apiKey = '', modelo = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') {
    super('groq', apiKey, 'https://api.groq.com/openai/v1', modelo)
  }
}

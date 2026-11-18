/**
 * stream.ts — Utilidades compartidas de streaming para todos los proveedores
 *
 * Unifica el consumo de SSE (Anthropic, OpenAI, Gemini, OpenAI-compatible) y
 * NDJSON (Ollama) y proporciona un emisor de progreso con throttling para que
 * el renderer pueda mostrar el razonamiento en vivo sin saturarse de eventos.
 */
import type { CallbackProgresoIA, FaseProgresoIA, OpcionesIA, ProgresoIA } from './base'

/** Lee el cuerpo de una respuesta en streaming y entrega cada objeto JSON. */
export async function leerFlujo(
  respuesta: Response,
  alDato: (dato: any) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!respuesta.body) throw new Error('El proveedor no devolvió cuerpo de streaming')

  const lector = respuesta.body.getReader()
  const decodificador = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Generación detenida', 'AbortError')
      const { value, done } = await lector.read()
      if (done) break
      buffer += decodificador.decode(value, { stream: true })

      let salto: number
      while ((salto = buffer.indexOf('\n')) >= 0) {
        const linea = buffer.slice(0, salto).trim()
        buffer = buffer.slice(salto + 1)
        if (!linea) continue

        // SSE: "data: {...}". NDJSON (Ollama): "{...}" directamente.
        const contenido = linea.startsWith('data:') ? linea.slice(5).trim() : linea
        if (!contenido || contenido === '[DONE]') continue
        if (!contenido.startsWith('{')) continue
        try {
          alDato(JSON.parse(contenido))
        } catch {
          // Fragmento parcial o no-JSON: se ignora sin interrumpir el flujo.
        }
      }
    }
  } finally {
    lector.releaseLock()
  }
}

export interface EmisorProgreso {
  /** Cambia el modelo informado (útil cuando el proveedor lo devuelve en el flujo). */
  setModelo(modelo: string): void
  modelo(): string
  /** Emite un cambio de fase (siempre se envía, sin throttling). */
  fase(fase: FaseProgresoIA, texto?: string, acumulado?: string): void
  /** Emite un fragmento de texto; se limita a ~6 eventos/segundo. */
  fragmento(fase: FaseProgresoIA, texto: string, acumulado: string): void
  /** Tiempo transcurrido hasta el primer fragmento (0 si no hubo ninguno). */
  tiempoPrimerTokenMs(): number
}

/** Construye un emisor de progreso ligado a una petición concreta. */
export function crearEmisor(
  proveedor: string,
  opciones: OpcionesIA,
  inicio = Date.now()
): EmisorProgreso {
  let modelo = opciones.modelo || ''
  let ultimoEnvio = 0
  let primerToken = 0

  function emitir(fase: FaseProgresoIA, texto: string, acumulado: string, forzar: boolean): void {
    const ahora = Date.now()
    const esFragmento = fase === 'pensando' || fase === 'generando'
    if (esFragmento && primerToken === 0) primerToken = ahora - inicio
    if (esFragmento && !forzar && ahora - ultimoEnvio < 160) return
    ultimoEnvio = ahora

    const evento: ProgresoIA = {
      fase,
      proveedor,
      modelo,
      texto: texto.slice(0, 600),
      acumulado: acumulado.slice(-4000),
      tiempoMs: ahora - inicio,
      tiempoPrimerTokenMs: primerToken,
      abortId: opciones.abortId,
    }
    opciones.progreso?.(evento)
  }

  return {
    setModelo(nuevo) {
      modelo = nuevo
    },
    modelo() {
      return modelo
    },
    fase(fase, texto = '', acumulado = '') {
      emitir(fase, texto, acumulado, true)
    },
    fragmento(fase, texto, acumulado) {
      emitir(fase, texto, acumulado, false)
    },
    tiempoPrimerTokenMs() {
      return primerToken
    },
  }
}

/** Extrae razonamiento de los distintos nombres de campo usados por cada API. */
export function razonamientoDe(delta: any): string {
  if (!delta) return ''
  return String(delta.reasoning || delta.reasoning_content || delta.thinking || '')
}

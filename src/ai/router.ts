/**
 * router.ts — Enrutador multi-IA para modelado CAD
 *
 * Analiza la intención del usuario y selecciona automáticamente el mejor modelo
 * según el tipo de tarea (creación, edición, imagen, fallback local).
 *
 * Referencia: Parametric CAD Bench v3 (septiembre 2026)
 * - Claude Opus 5.5: mejor en image-to-CAD (84.66) y general (61.03)
 * - Claude Fable 5.1: mejor en create (55.48), image-to-CAD (72.71)
 * - GPT-6 Astra (Codex): mejor en create-and-edit (44.37)
 */

import { ProveedorIA, type CallbackProgresoIA, type ProgresoIA } from './providers/base'
import { AnthropicProvider } from './providers/anthropic'
import { OpenAIProvider } from './providers/openai'
import { OllamaProvider } from './providers/ollama'
import { GeminiProvider } from './providers/gemini'
import { ProveedorOpenAICompatible } from './providers/openaiCompatible'
import { resolverConsultaLocal } from '../cad/interpretador'

export type TipoTarea = 'crear' | 'editar' | 'imagen' | 'corregir' | 'desconocido'

/** Identificadores de proveedores soportados por el router */
export type ProveedorId =
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'gemini'
  | 'mistral'
  | 'openrouter'
  | 'ollama'
  | 'auto'

export interface ContextoGenerar {
  prompt: string
  modeloActual?: string
  tipo?: TipoTarea
  /** Proveedor elegido por el usuario en la GUI ('auto' = router decide) */
  proveedorPreferido?: string
  /** Modelo concreto de Ollama (p. ej. 'qwen2.5-coder:7b') */
  ollamaModelo?: string
  /** Identificador de la solicitud (para cancelar vía IPC) */
  abortId?: string
  /** Señal de cancelación del proceso de generación */
  signal?: AbortSignal
  /** Recibe el razonamiento/texto parcial y los cambios de fase */
  progreso?: CallbackProgresoIA
}

export interface RespuestaRouter {
  ok: boolean
  dxf?: string
  preview?: string
  errores?: string[]
  modeloIA?: string
  costo?: number
  tareaDetectada?: TipoTarea
  proveedorUsado?: string
  /** Qué se generó/editó (lo informa el generador local) */
  descripcion?: string
  /** Advertencias de manufacturabilidad o del intérprete local */
  advertencias?: string[]
  /** Razonamiento intermedio devuelto por el proveedor (si lo expone) */
  pensamiento?: string
  /** Duración total de la petición en milisegundos */
  duracionMs?: number
  /** Tiempo hasta el primer token en milisegundos */
  tiempoPrimerTokenMs?: number
}

export class CADRouter {
  private anthropic!: AnthropicProvider
  private openai!: OpenAIProvider
  private groq!: ProveedorOpenAICompatible
  private gemini!: GeminiProvider
  private mistral!: ProveedorOpenAICompatible
  private openrouter!: ProveedorOpenAICompatible
  private ollama!: OllamaProvider

  constructor() {
    this.recargarProveedores()
  }

  /**
   * (Re)crea los proveedores con las claves/modelos actuales del entorno.
   * Se llama al guardar la configuración de IA desde la app.
   */
  recargarProveedores() {
    this.anthropic = new AnthropicProvider(process.env.ANTHROPIC_API_KEY || '')
    this.openai = new OpenAIProvider(process.env.OPENAI_API_KEY || '')
    this.groq = new ProveedorOpenAICompatible(
      'groq',
      process.env.GROQ_API_KEY || '',
      'https://api.groq.com/openai/v1',
      process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    )
    this.gemini = new GeminiProvider(process.env.GEMINI_API_KEY || '')
    this.mistral = new ProveedorOpenAICompatible(
      'mistral',
      process.env.MISTRAL_API_KEY || '',
      'https://api.mistral.ai/v1',
      process.env.MISTRAL_MODEL || 'mistral-small-latest'
    )
    this.openrouter = new ProveedorOpenAICompatible(
      'openrouter',
      process.env.OPENROUTER_API_KEY || '',
      'https://openrouter.ai/api/v1',
      process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
    )
    this.ollama = new OllamaProvider(process.env.OLLAMA_URL || 'http://localhost:11434')
  }

  /**
   * Punto de entrada principal desde el frontend (Electron IPC)
   */
  async generar({
    prompt,
    modeloActual,
    tipo = 'crear',
    proveedorPreferido,
    ollamaModelo,
    signal,
    progreso,
    abortId,
  }: ContextoGenerar): Promise<RespuestaRouter> {
    const inicio = Date.now()
    const tareaDetectada = this.clasificarTarea(prompt, tipo)
    const opciones = { ollamaModelo, signal, progreso, abortId }

    /** Notifica un cambio de fase al renderer con el tiempo transcurrido. */
    const notificar = (fase: ProgresoIA['fase'], proveedor: string, modelo: string, texto: string) => {
      progreso?.({
        fase,
        proveedor,
        modelo,
        texto,
        acumulado: '',
        tiempoMs: Date.now() - inicio,
        tiempoPrimerTokenMs: 0,
        abortId,
      })
    }
    /** Añade la duración total a cualquier respuesta final. */
    const finalizar = (respuesta: RespuestaRouter): RespuestaRouter => ({
      ...respuesta,
      duracionMs: Date.now() - inicio,
    })

    notificar('info', 'router', '', `Tarea detectada: ${tareaDetectada}. Buscando proveedor…`)

    // Proveedor elegido a mano por el usuario (si no es 'auto')
    const preferido = this.proveedorPorId(proveedorPreferido)
    // Cadena de proveedores candidatos para la tarea detectada. Si no hay preferido
    // explicito se usa la cadena de la tarea (priorizando opciones gratuitas en la nube).
    const cadena = preferido ? [preferido] : this.cadenaPorTarea(tareaDetectada)

    let proveedor: ProveedorIA | null = null
    for (const candidato of cadena) {
      notificar('info', candidato.nombre, '', `Comprobando ${candidato.nombre}…`)
      if (await candidato.disponible()) {
        proveedor = candidato
        break
      }
    }

    if (proveedor) {
      notificar('info', proveedor.nombre, '', `Usando ${proveedor.nombre}`)
      try {
        const resultado = await this.ejecutarConProveedor(proveedor, prompt, modeloActual, tareaDetectada, opciones)
        if (!resultado.ok && proveedor.nombre !== 'ollama') {
          // Respondió pero sin bloque DXF válido: probar Ollama y, si tampoco,
          // resolver en local en lugar de dejar la terminal sin modelo.
          if (await this.ollama.disponible()) {
            notificar('info', 'ollama', '', 'El proveedor principal no devolvió DXF; probando Ollama…')
            const alternativo = await this.ejecutarConProveedor(
              this.ollama,
              prompt,
              modeloActual,
              tareaDetectada,
              opciones
            )
            if (alternativo.ok) {
              return finalizar({ ...alternativo, tareaDetectada, proveedorUsado: 'ollama' })
            }
          }
          return finalizar(this.resolverLocal(prompt, modeloActual, tareaDetectada, resultado.errores || []))
        }
        return finalizar({
          ...resultado,
          tareaDetectada,
          proveedorUsado: proveedor.nombre,
        })
      } catch (error: any) {
        console.error(`[Router] Falló ${proveedor.nombre}:`, error.message)
        // 2. Fallback a Ollama si está disponible
        if (proveedor.nombre !== 'ollama' && (await this.ollama.disponible())) {
          console.log('[Router] Usando fallback Ollama')
          notificar('info', 'ollama', '', `Fallo ${proveedor.nombre}; usando Ollama como respaldo…`)
          const resultado = await this.ejecutarConProveedor(this.ollama, prompt, modeloActual, tareaDetectada, opciones)
          if (resultado.ok) return finalizar({ ...resultado, tareaDetectada, proveedorUsado: 'ollama' })
        }
        // Sin Ollama (o también falló): el intérprete local resuelve la consulta.
        return finalizar(
          this.resolverLocal(prompt, modeloActual, tareaDetectada, [
            `${proveedor.nombre} no respondió: ${error.message || 'error desconocido'}`,
          ])
        )
      }
    }

    // 3. Ningún proveedor disponible en la cadena: probar Ollama local
    if (await this.ollama.disponible()) {
      console.log('[Router] Usando fallback Ollama')
      notificar('info', 'ollama', '', 'Ningún proveedor remoto disponible; usando Ollama local…')
      const resultado = await this.ejecutarConProveedor(this.ollama, prompt, modeloActual, tareaDetectada, opciones)
      return finalizar({ ...resultado, tareaDetectada, proveedorUsado: 'ollama' })
    }

    // Ningún proveedor disponible: el intérprete local genera/edita la geometría
    // pidiendo lo que el usuario pidió (ya no devuelve la placa de ejemplo).
    notificar('info', 'local', '', 'Sin IA disponible; usando el generador local')
    return finalizar(this.resolverLocal(prompt, modeloActual, tareaDetectada))
  }

  /** Resuelve la consulta con el generador/editor paramétrico local. */
  private resolverLocal(
    prompt: string,
    modeloActual: string | undefined,
    tarea: TipoTarea,
    erroresPrevios: string[] = []
  ): RespuestaRouter {
    console.log('[Router] Usando intérprete local (sin IA externa disponible)')
    const resultado = resolverConsultaLocal(prompt, modeloActual, tarea)
    const partes: string[] = [resultado.descripcion]
    if (resultado.modo === 'editar') partes.unshift('Modelo destino modificado:')
    return {
      ok: true,
      dxf: resultado.dxf,
      modeloIA: 'generador-local',
      tareaDetectada: tarea,
      proveedorUsado: 'local',
      descripcion: partes.join(' '),
      advertencias: [...erroresPrevios, ...resultado.advertencias],
    }
  }

  /** Devuelve el proveedor elegido por el usuario, o null si es 'auto'/desconocido */
  private proveedorPorId(id?: string): ProveedorIA | null {
    switch (id) {
      case 'anthropic':
        return this.anthropic
      case 'openai':
        return this.openai
      case 'groq':
        return this.groq
      case 'gemini':
        return this.gemini
      case 'mistral':
        return this.mistral
      case 'openrouter':
        return this.openrouter
      case 'ollama':
        return this.ollama
      default:
        return null
    }
  }

  private clasificarTarea(prompt: string, tipoForzado?: TipoTarea): TipoTarea {
    if (tipoForzado && tipoForzado !== 'desconocido') return tipoForzado

    const minus = prompt.toLowerCase()

    // Palabras clave de edición
    const palabrasEdicion = ['modifica', 'edita', 'cambia', 'actualiza', 'ajusta', 'corrige', 'editar']
    // Palabras clave de imagen
    const palabrasImagen = ['imagen', 'dibujo', 'plano', 'foto', 'escanea', 'desde imagen', 'partir de']
    // Palabras clave de corrección
    const palabrasCorregir = ['error', 'fallo', 'repara', 'arregla', 'soluciona', 'valida']

    if (palabrasEdicion.some((p) => minus.includes(p))) return 'editar'
    if (palabrasImagen.some((p) => minus.includes(p))) return 'imagen'
    if (palabrasCorregir.some((p) => minus.includes(p))) return 'corregir'
    return 'crear'
  }

  private cadenaPorTarea(tarea: TipoTarea): ProveedorIA[] {
    // Mejor modelo por tarea según benchmarks CAD
    switch (tarea) {
      case 'crear':
        return [this.groq, this.gemini, this.anthropic, this.openai]
      case 'editar':
        return [this.groq, this.openai, this.anthropic]
      case 'imagen':
        return [this.gemini, this.anthropic, this.openai]
      case 'corregir':
        return [this.groq, this.openai, this.anthropic]
      default:
        return [this.groq, this.gemini, this.anthropic, this.openai]
    }
  }

  private buildSystemPrompt(tarea: TipoTarea): string {
    const base = `Eres un experto en diseño CAD y fabricación CNC. Tu trabajo es generar archivos .dxf válidos (ASCII, R2010) a partir de instrucciones en lenguaje natural.

REGLAS DE SALIDA:
1. Debes responder SIEMPRE con un bloque de código marcado como \`\`\`dxf ... \`\`\` que contenga el archivo DXF completo.
2. El DXF debe ser ASCII válido, comenzar con sección HEADER y terminar con EOF.
3. Usa unidades en milímetros (INSUNITS = 4).
4. Incluye al menos una entidad LWPOLYLINE (contorno) o CIRCLE.
5. No inventes códigos de grupo DXF que no existan.
6. Si el usuario pide algo imposible de fabricar, advierte en el texto antes del bloque DXF.

FORMATO DE RESPUESTA:
- Texto explicativo breve (opcional).
- Bloque \`\`\`dxf con el archivo .dxf completo.
- Texto breve posterior con advertencias de manufacturabilidad (opcional).`

    const especifico: Record<TipoTarea, string> = {
      crear: `
TAREA: Crear una pieza nueva desde cero. Genera el contorno y características solicitadas.

REGLAS DE PRECISIÓN (especialmente para placas 2D):
- Las medidas indicadas por el usuario son EXACTAS y se expresan en milímetros. Deben respetarse fielmente, sin redondear.
- Si se pide una placa de L x A, el contorno debe medir exactamente L x A en milímetros.
- Los radios de esquina redondeada y los agujeros se calculan sobre las medidas exactas proporcionadas.
- No inventes ni infles dimensiones. Si faltan datos de fabricación (grosor, acabado), usa valores estándar y respáldalos en el texto.`,
      editar: `
TAREA: Editar un modelo existente. Respetar la geometría original y aplicar solo los cambios solicitados.

REGLAS DE EDICIÓN (CRÍTICAS):
- Recibirás el DXF completo del modelo actual en el prompt del usuario.
- DEBES responder con el DXF COMPLETO modificado: conserva TODAS las entidades, capas, bloques y valores originales, y solo cambia lo pedido.
- No generes fragmentos: el bloque debe incluir las secciones HEADER, TABLES y ENTITIES completas más EOF.
- Aplica ÚNICAMENTE los cambios solicitados. No re-diseñes lo que no se pidió.
- Al cambiar una medida, recalcula agujeros, radios y demás entidades afectadas sobre las nuevas coordenadas exactas.`,
      imagen: "\nTAREA: Crear modelo a partir de una imagen/dibujo. Asume dimensiones razonables y avisa que son estimadas.",
      corregir: "\nTAREA: Corregir errores en un modelo DXF previo. Revisa geometría, capas y válidez del archivo.",
      desconocido: '\nTAREA: Tarea no especificada. Asume creación de una pieza simple y pide aclaración si es necesario.',
    }

    return base + (especifico[tarea] ?? especifico.desconocido)
  }

  private async ejecutarConProveedor(
    proveedor: ProveedorIA,
    prompt: string,
    modeloActual: string | undefined,
    tarea: TipoTarea,
    opciones: {
      ollamaModelo?: string
      signal?: AbortSignal
      progreso?: CallbackProgresoIA
      abortId?: string
    } = {}
  ): Promise<
    Pick<
      RespuestaRouter,
      'ok' | 'dxf' | 'errores' | 'modeloIA' | 'pensamiento' | 'tiempoPrimerTokenMs'
    >
  > {
    const systemPrompt = this.buildSystemPrompt(tarea)
    const promptCompleto = this.buildUserPrompt(prompt, modeloActual, tarea)

    // Solo Ollama usa modelo elegido por el usuario; los pagos usan su default
    const modelo = proveedor.nombre === 'ollama' ? opciones.ollamaModelo : undefined

    const respuesta = await proveedor.generar(promptCompleto, {
      systemPrompt,
      temperatura: 0.2,
      maxTokens: 4000,
      modelo,
      signal: opciones.signal,
      progreso: opciones.progreso,
      abortId: opciones.abortId,
    })

    const dxfExtraido = this.extraerDXF(respuesta.texto)

    if (!dxfExtraido) {
      return {
        ok: false,
        errores: [
          'La IA no devolvió un bloque .dxf válido. Asegúrate de pedir explícitamente un modelo CAD.',
          'Respuesta cruda (primeros 500 chars): ' + respuesta.texto.slice(0, 500),
        ],
      }
    }

    return {
      ok: true,
      dxf: dxfExtraido,
      modeloIA: respuesta.modeloUsado,
      pensamiento: respuesta.pensamiento,
      tiempoPrimerTokenMs: respuesta.tiempoPrimerTokenMs,
    }
  }

  private buildUserPrompt(prompt: string, modeloActual?: string, tarea: TipoTarea = 'crear'): string {
    const partes: string[] = []

    // Contexto completo del modelo actual. Para modificaciones se incluye TODO el
    // DXF (sin truncar) para que la IA tenga el contexto completo y aplique los cambios
    // con exactitud sobre la geometría real.
    if (modeloActual) {
      partes.push(
        [
          'MODELO ACTUAL — DXF COMPLETO (conservar salvo lo que la instrucción indique cambiar):',
          '<<<INICIO DXF>>>',
          modeloActual,
          '<<<FIN DXF>>>',
        ].join('\n')
      )
    }

    partes.push(`INSTRUCCIÓN DEL USUARIO:\n${prompt}`)

    if (tarea === 'editar') {
      partes.push('TAREA: MODIFICACIÓN — generar el DXF completo con los cambios aplicados al modelo actual.')
    }

    return [...partes, 'Genera ahora el archivo .dxf correspondiente.'].join('\n\n')
  }

  /**
   * Extrae el contenido DXF de un bloque markdown ```dxf ... ```
   */
  private extraerDXF(texto: string): string | null {
    const match = texto.match(/```dxf\s*\n([\s\S]*?)\s*\n```/i)
    if (match) return match[1].trim()

    // Fallback: buscar entre ``` y ```
    const match2 = texto.match(/```\s*\n([\s\S]*?)\s*\n```/i)
    if (match2) {
      const contenido = match2[1].trim()
      if (contenido.includes('SECTION') && contenido.includes('EOF')) return contenido
    }

    return null
  }
}

export const cadRouter = new CADRouter()

/**
 * TerminalIA.tsx — Terminal de chat con el router multi-IA
 *
 * Envía las peticiones al router (incluyendo el DXF actual como contexto para
 * las tareas de edición), muestra la conversación y los resultados, y ofrece
 * «Aplicar al visor» / «Exportar .dxf». Integra el selector de modelo, el
 * acceso a la configuración de claves y el registro de pedidos del store.
 *
 * Nota: envía `tipo: 'desconocido'` a propósito para que sea el router quien
 * clasifique la tarea (crear/editar/imagen/corregir) por palabras clave.
 */
import { useState, useEffect, useRef } from 'react'
import { useModelStore } from '../store/modelStore'
import { Panel, SectionHeader, Button, Badge } from './ui'
import { SelectorModeloIA } from './SelectorModeloIA'
import { cn } from './utils'
import type { ProgresoIA } from '../../ai/providers/base'
import { Send, FileText, Zap, Loader2, Sparkles, RotateCw, Settings, Square, Activity, Brain } from 'lucide-react'

export interface Mensaje {
  id: string
  remitente: 'usuario' | 'ia' | 'sistema'
  texto: string
  timestamp: Date
  dxf?: string
  valido?: boolean
  /** Razonamiento intermedio plegable, cuando el proveedor lo expone. */
  detalle?: string
}

export function TerminalIA({ className }: { className?: string }) {
  const {
    agregarPedido,
    actualizarPedido,
    pedidos,
    modeloActual,
    proveedorIA,
    ollamaModelo,
    setModalConfigIA,
    autoAplicarIA,
    setAutoAplicarIA,
    aplicarGeneracionIA,
  } = useModelStore()
  const [input, setInput] = useState('')
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '1',
      remitente: 'ia',
      texto:
        'Hola. Soy tu asistente de modelado CNC. Pídeme que cree o modifique un modelo .dxf (2D o 3D). Ejemplo: "placa de 100x60 mm con 4 agujeros de 8 mm en las esquinas".',
      timestamp: new Date(),
    },
  ])
  const [procesando, setProcesando] = useState(false)
  const [conectadoElectron, setConectadoElectron] = useState<boolean | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const idSolicitudRef = useRef<string | null>(null)
  const inicioRef = useRef<number>(0)
  const [progreso, setProgreso] = useState<ProgresoIA | null>(null)
  const [trazas, setTrazas] = useState<ProgresoIA[]>([])
  const [segundos, setSegundos] = useState(0)

  const scrollAbajo = () => endRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    // Detectar si estamos ejecutando dentro de Electron (window.apiCAD expuesto por preload)
    const electronDisponible = typeof window !== 'undefined' && Boolean(window.apiCAD)
    setConectadoElectron(electronDisponible)

    if (!electronDisponible) {
      setMensajes((prev) => [
        ...prev,
        {
          id: 'sistema-electron',
          remitente: 'sistema',
          texto:
            '⚠️ Modo navegador detectado. La IA de modelado requiere la app de escritorio (Electron). Ejecuta: npm run dev',
          timestamp: new Date(),
        },
      ])
    }
  }, [])

  // Fragmentos de pensamiento/texto y latidos enviados por el proceso principal.
  useEffect(() => {
    const cancelar = window.apiCAD?.onProgresoIA?.((evento) => {
      // Ignorar eventos tardíos de una consulta anterior/cancelada.
      if (idSolicitudRef.current && evento.abortId && evento.abortId !== idSolicitudRef.current) return
      setProgreso(evento)
      setTrazas((prev) => [...prev.filter((t) => t.fase !== 'latido'), evento].slice(-30))
    })
    return () => cancelar?.()
  }, [])

  // Reloj independiente: sigue corriendo aunque el proveedor no emita tokens.
  useEffect(() => {
    if (!procesando) {
      setSegundos(0)
      return
    }
    const temporizador = setInterval(() => {
      if (inicioRef.current) setSegundos(Math.floor((Date.now() - inicioRef.current) / 1000))
    }, 500)
    return () => clearInterval(temporizador)
  }, [procesando])

  useEffect(() => scrollAbajo(), [mensajes, procesando, progreso])

  /** Detiene la consulta IA en curso (envía el id al proceso principal para abortar) */
  function detenerConsulta() {
    const id = idSolicitudRef.current
    if (id) void window.apiCAD?.detenerGeneracion(id)
  }

  async function enviar() {
    if (!input.trim() || procesando) return
    const textoUsuario = input.trim()
    setInput('')
    const idSolicitud = crypto.randomUUID()
    idSolicitudRef.current = idSolicitud
    inicioRef.current = Date.now()
    setProgreso(null)
    setTrazas([])

    const idPedido = agregarPedido(textoUsuario)
    const etiquetaProveedor =
      proveedorIA === 'auto'
        ? 'el router de IA'
        : proveedorIA === 'anthropic'
          ? 'Claude (Anthropic)'
          : proveedorIA === 'openai'
            ? 'GPT (OpenAI)'
            : proveedorIA === 'groq'
              ? 'Groq (gratis · nube)'
              : proveedorIA === 'gemini'
                ? 'Gemini (gratis · nube)'
                : proveedorIA === 'mistral'
                  ? 'Mistral (gratis · nube)'
                  : proveedorIA === 'openrouter'
                    ? 'OpenRouter (gratis · nube)'
                    : `Ollama (${ollamaModelo})`
    setMensajes((prev) => [
      ...prev,
      { id: `u-${idPedido}`, remitente: 'usuario', texto: textoUsuario, timestamp: new Date() },
      {
        id: `s-${idPedido}`,
        remitente: 'sistema',
        texto: `Procesando con ${etiquetaProveedor}...`,
        timestamp: new Date(),
      },
    ])
    setProcesando(true)

    // Si no hay Electron, no intentar llamar a la API
    if (!conectadoElectron || !window.apiCAD) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `err-${idPedido}`,
          remitente: 'sistema',
          texto:
            '❌ No hay conexión con Electron. La terminal IA solo funciona en la app de escritorio. Ejecuta: npm run dev',
          timestamp: new Date(),
        },
      ])
      setProcesando(false)
      return
    }

    try {
      const respuesta = await window.apiCAD.generar({
        prompt: textoUsuario,
        modeloActual: modeloActual?.dxfTexto,
        tipo: 'desconocido',
        proveedorPreferido: proveedorIA,
        ollamaModelo,
        abortId: idSolicitud,
      })

      actualizarPedido(idPedido, {
        estado: respuesta?.ok ? 'completado' : 'rechazado',
        modeloIA: respuesta?.modeloIA,
        dxf: respuesta?.dxf,
        valido: respuesta?.valido,
      })

      const descripcion = respuesta?.descripcion || ''
      const advertencias: string[] = respuesta?.advertencias || []

      setMensajes((prev) =>
        prev.map((m) =>
          m.id === `s-${idPedido}`
            ? {
                ...m,
                texto: respuesta?.ok
                  ? `✅ ${descripcion || 'Modelo generado'} · ${respuesta.modeloIA}${autoAplicarIA ? ' · aplicado al visor' : ''}`
                  : `❌ Error: ${respuesta?.errores?.join(', ') || 'no se pudo generar el modelo'}`,
              }
            : m
        )
      )

      if (respuesta?.cancelado) {
        setMensajes((prev) => [
          ...prev,
          {
            id: `stop-${idPedido}`,
            remitente: 'sistema',
            texto: '⏹ Consulta detenida por el usuario.',
            timestamp: new Date(),
          },
        ])
      }

      if (respuesta?.ok && respuesta.dxf) {
        // Aplicar al archivo destino (modelo actual) sin esperar a un clic.
        if (autoAplicarIA) {
          aplicarGeneracionIA(respuesta.dxf, textoUsuario.slice(0, 40) || 'modelo-ia')
        }

        setMensajes((prev) => [
          ...prev,
          {
            id: `dxf-${idPedido}`,
            remitente: 'ia',
            texto:
              advertencias.length > 0
                ? `Modelo listo. ${advertencias.join(' ')}`
                : 'Modelo listo. Ya puedes verlo en el visor o exportarlo para fabricar.',
            timestamp: new Date(),
            dxf: respuesta.dxf,
            valido: respuesta.valido,
            detalle: respuesta.pensamiento,
          },
        ])
      }

      // Diagnóstico: permite distinguir "pensando" de "colgado".
      const duracion = respuesta?.duracionMs ?? Date.now() - inicioRef.current
      const primerToken = respuesta?.tiempoPrimerTokenMs ?? progreso?.tiempoPrimerTokenMs
      setMensajes((prev) => [
        ...prev,
        {
          id: `diag-${idPedido}`,
          remitente: 'sistema',
          texto: `⏱ ${(duracion / 1000).toFixed(1)}s · ${respuesta?.proveedorUsado || 'desconocido'} · ${respuesta?.modeloIA || '?'}${
            primerToken ? ` · primer token a los ${(primerToken / 1000).toFixed(1)}s` : ' · sin token recibido'
          }`,
          timestamp: new Date(),
        },
      ])
    } catch (error: any) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `err-${idPedido}`,
          remitente: 'sistema',
          texto: `❌ Error inesperado: ${error?.message || String(error)}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setProcesando(false)
    }
  }

  /** Recupera el ÚLTIMO DXF generado (no el primero) y su nombre de pedido */
  function datosDXFGenerado(): { dxf?: string; nombre: string } {
    const generados = mensajes.filter((m) => m.id?.startsWith('dxf-') && m.dxf)
    const msg = generados[generados.length - 1]
    if (!msg?.dxf) return { nombre: 'modelo-ia' }
    const idPedido = msg.id.slice(4)
    const pedido = pedidos.find((p) => p.id === idPedido)
    const nombre = (pedido?.prompt || 'modelo-ia').trim().slice(0, 40) || 'modelo-ia'
    return { dxf: msg.dxf, nombre }
  }

  const hora = (d: Date) =>
    new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  // El latido no debe tapar la fase real: se prioriza el último evento útil.
  const fasesVisibles = ['pensando', 'generando', 'conectando', 'error']
  const faseVisible = [...trazas].reverse().find((t) => fasesVisibles.includes(t.fase))?.fase ?? progreso?.fase
  const ultimoPensamiento = [...trazas].reverse().find((t) => t.fase === 'pensando')
  const huboToken = trazas.some((t) => t.fase === 'pensando' || t.fase === 'generando')

  return (
    <Panel className={cn('flex flex-col overflow-hidden', className)}>
      <SectionHeader
        acento="violeta"
        icono={<Sparkles />}
        titulo="Terminal IA"
        subtitulo="Modelado por lenguaje natural"
        acciones={
          procesando ? (
            <Badge variant="default">
              <Loader2 className="h-3 w-3 animate-spin" /> Generando…
            </Badge>
          ) : conectadoElectron === null ? (
            <Badge variant="outline">Verificando…</Badge>
          ) : conectadoElectron ? (
            <Badge variant="success">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 latido" /> Electron conectado
            </Badge>
          ) : (
            <>
              <Badge variant="warning">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 latido" /> Modo navegador
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Recargar"
                onClick={() => window.location.reload()}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </>
          )
        }
      />

      {/* Hilo de mensajes */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-black/10 p-3">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={cn(
              'animar-entrada flex flex-col gap-1',
              m.remitente === 'usuario' ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'max-w-[88%] break-words rounded-2xl border px-3.5 py-2.5 text-[13px] leading-relaxed',
                m.remitente === 'usuario'
                  ? 'rounded-br-md border-transparent bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.8)]'
                  : m.remitente === 'sistema'
                    ? 'rounded-bl-md border-dashed border-white/[0.08] bg-transparent text-[11.5px] italic text-zinc-500'
                    : 'rounded-bl-md border-white/[0.08] bg-white/[0.05] text-zinc-200'
              )}
            >
              {m.texto}
              {m.detalle && (
                <details className="mt-2 w-full border-t border-white/10 pt-2 text-left">
                  <summary className="cursor-pointer text-[11px] text-zinc-400">
                    Ver razonamiento intermedio
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-500">
                    {m.detalle}
                  </pre>
                </details>
              )}
            </div>
            <span className="px-1 text-[9.5px] font-medium uppercase tracking-[0.14em] text-zinc-600">
              {m.remitente === 'usuario' ? 'Tú' : m.remitente === 'ia' ? 'IA' : 'Sistema'} ·{' '}
              {hora(m.timestamp)}
            </span>
          </div>
        ))}

        {/* Panel en vivo: razonamiento, fase, tiempo y latido de conexión */}
        {procesando && (
          <div className="animar-entrada rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-3">
            <div className="flex items-center gap-2 text-[12px] font-medium text-cyan-200">
              {faseVisible === 'pensando' ? (
                <Brain className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <Activity className="h-3.5 w-3.5 animate-pulse" />
              )}
              {faseVisible === 'pensando'
                ? 'Pensando…'
                : faseVisible === 'generando'
                  ? 'Escribiendo DXF…'
                  : faseVisible === 'error'
                    ? 'Error del proveedor'
                    : huboToken
                      ? 'Esperando más fragmentos…'
                      : 'Conectando…'}
              <span className="ml-auto tabular-nums text-cyan-300/70">{segundos}s</span>
            </div>
            {(progreso?.proveedor || progreso?.modelo) && (
              <p className="mt-1 truncate text-[10.5px] text-zinc-500">
                {progreso!.proveedor}
                {progreso!.modelo ? ` · ${progreso!.modelo}` : ''}
                {progreso!.tiempoPrimerTokenMs
                  ? ` · primer token ${(progreso!.tiempoPrimerTokenMs / 1000).toFixed(1)}s`
                  : ''}
              </p>
            )}
            {faseVisible === 'pensando' && (
              <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed text-zinc-400">
                {ultimoPensamiento?.acumulado ||
                  ultimoPensamiento?.texto ||
                  'El modelo está razonando…'}
              </pre>
            )}
            {faseVisible === 'generando' && (
              <p className="mt-2 line-clamp-2 text-[11px] text-zinc-500">
                {(progreso?.acumulado || '').slice(0, 180) || 'Recibiendo texto…'}
              </p>
            )}
            {progreso?.fase === 'latido' && (
              <p className="mt-1 text-[10.5px] italic text-zinc-500">
                {huboToken
                  ? 'Conexión viva: esperando los siguientes fragmentos.'
                  : 'Conexión viva: aún no llegan tokens (carga del modelo o espera de la API).'}
              </p>
            )}
            {trazas.length > 1 && (
              <div className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2">
                {trazas.slice(-4).map((traza, indice) => (
                  <p key={`${traza.tiempoMs}-${indice}`} className="truncate text-[10px] text-zinc-600">
                    · {(traza.tiempoMs / 1000).toFixed(1)}s {traza.fase}
                    {traza.proveedor ? ` · ${traza.proveedor}` : ''}
                    {traza.texto ? ` · ${traza.texto.slice(0, 60)}` : ''}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tarjeta de acciones cuando hay un DXF nuevo */}
        {mensajes.some((m) => m.id?.startsWith('dxf-')) && (
          <div className="animar-entrada rounded-2xl border border-violet-400/20 bg-violet-500/[0.08] p-3">
            <p className="mb-2.5 flex items-center gap-2 text-[12.5px] font-medium text-violet-200">
              <Zap className="h-3.5 w-3.5" />
              {autoAplicarIA ? 'Modelo .dxf aplicado al visor' : 'Modelo .dxf listo — aplicar al visor'}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const { dxf, nombre } = datosDXFGenerado()
                  if (dxf) aplicarGeneracionIA(dxf, nombre)
                }}
              >
                <Zap className="h-3.5 w-3.5" /> Aplicar de nuevo
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const { dxf, nombre } = datosDXFGenerado()
                  if (dxf) window.apiCAD?.exportar({ contenido: dxf, nombre })
                }}
              >
                <FileText className="h-3.5 w-3.5" /> Exportar .dxf
              </Button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Compositor de entrada */}
      <div className="border-t border-white/[0.06] bg-zinc-950/40 p-3">
        {/* Selector de modelo de IA + acceso a configuración */}
        <div className="mb-2 flex items-center gap-2 px-0.5">
          <SelectorModeloIA />
          <label
            className="ml-auto flex cursor-pointer items-center gap-1.5 text-[10.5px] text-zinc-400"
            title="Aplicar automáticamente el DXF generado al modelo del visor"
          >
            <input
              type="checkbox"
              checked={autoAplicarIA}
              onChange={(e) => setAutoAplicarIA(e.target.checked)}
              className="h-3 w-3 accent-violet-500"
            />
            Auto-aplicar
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Configurar claves de API"
            aria-label="Configurar claves de API"
            onClick={() => setModalConfigIA(true)}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04]
                     py-1.5 pl-4 pr-1.5 transition-all
                     focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-500/20"
        >
          <input
            className="h-8 flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-40"
            placeholder={
              conectadoElectron === false
                ? 'Conecta a Electron para usar la IA...'
                : 'Pídele a la IA que cree o modifique el modelo...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviar()}
            disabled={procesando || !conectadoElectron}
          />
          {procesando ? (
            <Button
              size="icon-sm"
              onClick={detenerConsulta}
              aria-label="Detener consulta"
              title="Detener consulta"
              className="border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              onClick={enviar}
              disabled={!conectadoElectron || !input.trim()}
              aria-label="Enviar"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Panel>
  )
}

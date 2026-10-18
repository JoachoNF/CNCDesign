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
import { Send, FileText, Zap, Loader2, Sparkles, RotateCw, Settings } from 'lucide-react'

export interface Mensaje {
  id: string
  remitente: 'usuario' | 'ia' | 'sistema'
  texto: string
  timestamp: Date
  dxf?: string
  valido?: boolean
}

export function TerminalIA({ className }: { className?: string }) {
  const {
    agregarPedido,
    actualizarPedido,
    pedidos,
    modeloActual,
    setModelo,
    actualizarDXF,
    proveedorIA,
    ollamaModelo,
    setModalConfigIA,
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

  useEffect(() => scrollAbajo(), [mensajes, procesando])

  async function enviar() {
    if (!input.trim() || procesando) return
    const textoUsuario = input.trim()
    setInput('')

    const idPedido = agregarPedido(textoUsuario)
    const etiquetaProveedor =
      proveedorIA === 'auto'
        ? 'el router de IA'
        : proveedorIA === 'anthropic'
          ? 'Claude (Anthropic)'
          : proveedorIA === 'openai'
            ? 'GPT (OpenAI)'
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
      })

      actualizarPedido(idPedido, {
        estado: respuesta?.ok ? 'completado' : 'rechazado',
        modeloIA: respuesta?.modeloIA,
        dxf: respuesta?.dxf,
        valido: respuesta?.valido,
      })

      setMensajes((prev) =>
        prev.map((m) =>
          m.id === `s-${idPedido}`
            ? {
                ...m,
                texto: respuesta?.ok
                  ? `✅ Modelo generado con ${respuesta.modeloIA}. ¿Quieres aplicar los cambios al visor?`
                  : `❌ Error: ${respuesta?.errores?.join(', ') || 'no se pudo generar el modelo'}`,
              }
            : m
        )
      )

      if (respuesta?.ok && respuesta.dxf) {
        setMensajes((prev) => [
          ...prev,
          {
            id: `dxf-${idPedido}`,
            remitente: 'ia',
            texto:
              'Modelo listo. He generado un archivo .dxf. Puedes aplicarlo al visor o exportarlo para fabricar.',
            timestamp: new Date(),
            dxf: respuesta.dxf,
            valido: respuesta.valido,
          },
        ])
      }
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

  /** Recupera el último DXF generado y un nombre derivado del pedido original */
  function datosDXFGenerado(): { dxf?: string; nombre: string } {
    const msg = mensajes.find((m) => m.id?.startsWith('dxf-'))
    if (!msg?.dxf) return { nombre: 'modelo-ia' }
    const idPedido = msg.id.slice(4)
    const pedido = pedidos.find((p) => p.id === idPedido)
    const nombre = (pedido?.prompt || 'modelo-ia').trim().slice(0, 40) || 'modelo-ia'
    return { dxf: msg.dxf, nombre }
  }

  function aplicarDXF(dxfTexto: string, nombre = 'modelo-ia') {
    // Si no hay modelo aún, se crea uno nuevo con lo generado por la IA
    if (!modeloActual) {
      const es3d = /3DFACE|3DSOLID/i.test(dxfTexto)
      setModelo({
        id: crypto.randomUUID(),
        nombre,
        tipo: es3d ? '3d' : '2d',
        unidades: 'mm',
        entidades: [],
        dxfTexto,
        ultimaModificacion: new Date(),
        version: 1,
      })
      return
    }

    const nuevo = {
      ...modeloActual,
      dxfTexto,
      ultimaModificacion: new Date(),
      version: modeloActual.version + 1,
    }
    setModelo(nuevo)
    actualizarDXF(dxfTexto)
  }

  const hora = (d: Date) =>
    new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

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
            </div>
            <span className="px-1 text-[9.5px] font-medium uppercase tracking-[0.14em] text-zinc-600">
              {m.remitente === 'usuario' ? 'Tú' : m.remitente === 'ia' ? 'IA' : 'Sistema'} ·{' '}
              {hora(m.timestamp)}
            </span>
          </div>
        ))}

        {/* Tarjeta de acciones cuando hay un DXF nuevo */}
        {mensajes.some((m) => m.id?.startsWith('dxf-')) && (
          <div className="animar-entrada rounded-2xl border border-violet-400/20 bg-violet-500/[0.08] p-3">
            <p className="mb-2.5 flex items-center gap-2 text-[12.5px] font-medium text-violet-200">
              <Zap className="h-3.5 w-3.5" /> Modelo .dxf listo — ¿aplicar al visor?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const { dxf, nombre } = datosDXFGenerado()
                  if (dxf) aplicarDXF(dxf, nombre)
                }}
              >
                <Zap className="h-3.5 w-3.5" /> Aplicar al visor
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
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <SelectorModeloIA />
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
          <Button
            size="icon-sm"
            onClick={enviar}
            disabled={procesando || !conectadoElectron || !input.trim()}
            aria-label="Enviar"
          >
            {procesando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </Panel>
  )
}

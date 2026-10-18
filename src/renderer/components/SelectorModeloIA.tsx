import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useModelStore } from '../store/modelStore'
import { Badge, acentos } from './ui'
import { cn } from './utils'
import {
  Bot,
  Check,
  ChevronDown,
  KeyRound,
  Loader2,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react'

interface EstadoConfig {
  anthropicApiKey: string
  openaiApiKey: string
  ollamaUrl: string
  entorno: { anthropic: boolean; openai: boolean }
}

/**
 * Selector de modelo de IA para la terminal de peticiones.
 * Permite elegir entre el router automático, los proveedores de pago
 * (con clave configurada) o los modelos locales de Ollama.
 */
export function SelectorModeloIA({ className }: { className?: string }) {
  const { proveedorIA, setProveedorIA, ollamaModelo, setOllamaModelo, setModalConfigIA } =
    useModelStore()

  const [abierto, setAbierto] = useState(false)
  const [config, setConfig] = useState<EstadoConfig | null>(null)
  const [modelos, setModelos] = useState<string[] | null>(null)
  const [cargandoModelos, setCargandoModelos] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Al abrir: refrescar estado de claves y modelos locales
  useEffect(() => {
    if (!abierto) return
    window.apiCAD?.ia
      ?.obtenerConfig()
      .then(setConfig)
      .catch(() => undefined)
    void cargarModelos()
  }, [abierto])

  // Cerrar al hacer clic afuera
  useEffect(() => {
    if (!abierto) return
    const alClicFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    window.addEventListener('mousedown', alClicFuera)
    return () => window.removeEventListener('mousedown', alClicFuera)
  }, [abierto])

  async function cargarModelos() {
    setCargandoModelos(true)
    try {
      const respuesta = await window.apiCAD?.ia?.modelosOllama()
      setModelos(respuesta?.modelos || [])
    } catch {
      setModelos([])
    } finally {
      setCargandoModelos(false)
    }
  }

  const claveClaude = Boolean(config?.anthropicApiKey)
  const claveGPT = Boolean(config?.openaiApiKey)

  const etiqueta =
    proveedorIA === 'auto'
      ? 'Auto · router'
      : proveedorIA === 'anthropic'
        ? 'Claude (Anthropic)'
        : proveedorIA === 'openai'
          ? 'GPT (OpenAI)'
          : `Ollama · ${modelosOcultar(ollamaModelo)}`

  const opciones: Array<{
    id: 'auto' | 'anthropic' | 'openai' | 'ollama'
    icono: ReactNode
    tile: string
    titulo: string
    desc: string
    badge?: ReactNode
  }> = [
    {
      id: 'auto',
      icono: <Sparkles />,
      tile: acentos.violeta.tile,
      titulo: 'Automático',
      desc: 'El router elige el mejor modelo por tarea',
    },
    {
      id: 'anthropic',
      icono: <Bot />,
      tile: acentos.ambar.tile,
      titulo: 'Claude (Anthropic)',
      desc: 'API paga · mejor en crear y leer imágenes',
      badge: config ? (
        claveClaude ? (
          <Badge variant="success" className="shrink-0">
            key ✓
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            sin key
          </Badge>
        )
      ) : null,
    },
    {
      id: 'openai',
      icono: <Bot />,
      tile: acentos.esmeralda.tile,
      titulo: 'GPT (OpenAI)',
      desc: 'API paga · mejor editando modelos',
      badge: config ? (
        claveGPT ? (
          <Badge variant="success" className="shrink-0">
            key ✓
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            sin key
          </Badge>
        )
      ) : null,
    },
    {
      id: 'ollama',
      icono: <Server />,
      tile: acentos.cian.tile,
      titulo: 'Ollama (local)',
      desc: 'Gratis · corre en tu equipo, sin internet',
    },
  ]

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        title="Elegir modelo de IA para las peticiones"
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          'inline-flex h-8 max-w-[230px] items-center gap-1.5 rounded-full border px-3 text-xs',
          'transition-colors',
          abierto
            ? 'border-violet-400/40 bg-violet-500/10 text-zinc-100'
            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white'
        )}
      >
        <Bot className="h-3.5 w-3.5 shrink-0 text-violet-300" />
        <span className="truncate">{etiqueta}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div
          className="animar-entrada absolute bottom-full left-0 z-40 mb-2 w-[300px] overflow-hidden
                     rounded-2xl border border-white/10 bg-zinc-900/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)]
                     backdrop-blur-xl"
        >
          <p className="px-3.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Modelo de IA para peticiones
          </p>

          <div className="p-1.5">
            {opciones.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setProveedorIA(o.id)
                  if (o.id !== 'ollama') setAbierto(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                  proveedorIA === o.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10',
                    'bg-gradient-to-br [&>svg]:h-3.5 [&>svg]:w-3.5',
                    o.tile
                  )}
                >
                  {o.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-zinc-200">{o.titulo}</span>
                  <span className="block truncate text-[10.5px] text-zinc-500">{o.desc}</span>
                </span>
                {o.badge}
                {proveedorIA === o.id && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                )}
              </button>
            ))}
          </div>

          {/* Modelos instalados de Ollama (solo al estar seleccionado) */}
          {proveedorIA === 'ollama' && (
            <div className="border-t border-white/[0.06] px-1.5 py-1.5">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  Modelos instalados
                </p>
                <button
                  type="button"
                  title="Buscar modelos de nuevo"
                  onClick={() => void cargarModelos()}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.08] hover:text-zinc-200"
                >
                  <RefreshCw className={cn('h-3 w-3', cargandoModelos && 'animate-spin')} />
                </button>
              </div>

              {cargandoModelos ? (
                <p className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando en Ollama…
                </p>
              ) : modelos && modelos.length > 0 ? (
                <div className="max-h-[150px] overflow-y-auto">
                  {modelos.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOllamaModelo(m)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] transition-colors',
                        ollamaModelo === m
                          ? 'bg-white/[0.08] text-zinc-100'
                          : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                      )}
                    >
                      <Server className="h-3 w-3 shrink-0 text-cyan-300/80" />
                      <span className="min-w-0 flex-1 truncate">{m}</span>
                      {ollamaModelo === m && <Check className="h-3 w-3 shrink-0 text-violet-300" />}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-1.5 text-[11px] leading-relaxed text-amber-300/90">
                  Ollama no está disponible. Inicia el servicio con <code>ollama serve</code>.
                </p>
              )}
            </div>
          )}

          <div className="border-t border-white/[0.06] p-1.5">
            <button
              type="button"
              onClick={() => {
                setAbierto(false)
                setModalConfigIA(true)
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] text-zinc-400
                         transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-300" /> Configurar API keys…
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Recorta nombres de modelo largos (p. ej. con sufijo :tag) */
function modelosOcultar(nombre: string): string {
  return nombre.length > 18 ? `${nombre.slice(0, 16)}…` : nombre
}

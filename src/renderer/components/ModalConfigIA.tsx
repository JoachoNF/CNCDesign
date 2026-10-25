import { useEffect, useState } from 'react'
import { useModelStore } from '../store/modelStore'
import { Button, Panel, SectionIcon } from './ui'
import { Check, Eye, EyeOff, KeyRound, Loader2, Save, Server, X } from 'lucide-react'

/**
 * Modal de configuración de IA: claves API de proveedores pagos y
 * dirección del servidor Ollama local. Las claves se guardan en disco
 * (config-ia.json dentro de userData) y nunca salen del equipo.
 */
export function ModalConfigIA() {
  const { modalConfigIA, setModalConfigIA } = useModelStore()

  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [groqApiKey, setGroqApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [mistralApiKey, setMistralApiKey] = useState('')
  const [openrouterApiKey, setOpenrouterApiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [entorno, setEntorno] = useState({
    anthropic: false,
    openai: false,
    groq: false,
    gemini: false,
    mistral: false,
    openrouter: false,
  })
  const [verClaude, setVerClaude] = useState(false)
  const [verGPT, setVerGPT] = useState(false)
  const [verGroq, setVerGroq] = useState(false)
  const [verGemini, setVerGemini] = useState(false)
  const [verMistral, setVerMistral] = useState(false)
  const [verOpenRouter, setVerOpenRouter] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  // Cargar la configuración actual al abrir
  useEffect(() => {
    if (!modalConfigIA) return
    setGuardado(false)
    window.apiCAD?.ia
      ?.obtenerConfig()
      .then((c) => {
        if (!c) return
        setAnthropicApiKey(c.anthropicApiKey || '')
        setOpenaiApiKey(c.openaiApiKey || '')
        setGroqApiKey(c.groqApiKey || '')
        setGeminiApiKey(c.geminiApiKey || '')
        setMistralApiKey(c.mistralApiKey || '')
        setOpenrouterApiKey(c.openrouterApiKey || '')
        setOllamaUrl(c.ollamaUrl || 'http://localhost:11434')
        setEntorno(
          c.entorno || {
            anthropic: false,
            openai: false,
            groq: false,
            gemini: false,
            mistral: false,
            openrouter: false,
          }
        )
      })
      .catch(() => undefined)
  }, [modalConfigIA])

  // Esc cierra el modal
  useEffect(() => {
    if (!modalConfigIA) return
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalConfigIA(false)
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [modalConfigIA, setModalConfigIA])

  if (!modalConfigIA) return null

  async function guardar() {
    setGuardando(true)
    try {
      await window.apiCAD?.ia?.guardarConfig({
        anthropicApiKey,
        openaiApiKey,
        groqApiKey,
        geminiApiKey,
        mistralApiKey,
        openrouterApiKey,
        ollamaUrl,
      })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Fondo */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setModalConfigIA(false)}
      />

      <Panel className="animar-entrada relative z-10 w-full max-w-[480px] p-5">
        {/* Encabezado */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SectionIcon icono={<KeyRound />} acento="ambar" />
            <div>
              <h2 className="text-[14px] font-semibold tracking-tight text-zinc-100">
                Configuración de IA
              </h2>
              <p className="text-[11px] text-zinc-500">
                Claves de API y servidor local · se guardan en tu equipo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalConfigIA(false)}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500
                       transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Claude */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Claude — API key (Anthropic)
              </label>
              {entorno.anthropic && (
                <span className="text-[10px] text-zinc-500">definida en el entorno</span>
              )}
            </div>
            <div className="relative">
              <input
                type={verClaude ? 'text' : 'password'}
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-…"
                spellCheck={false}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-3 pr-10
                           text-[12.5px] text-zinc-200 outline-none transition-all
                           placeholder:text-zinc-600 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                title={verClaude ? 'Ocultar' : 'Mostrar'}
                onClick={() => setVerClaude((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500
                           transition-colors hover:text-zinc-300"
              >
                {verClaude ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              Se obtiene en console.anthropic.com → API Keys
            </p>
          </section>

          {/* OpenAI */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> GPT — API key (OpenAI)
              </label>
              {entorno.openai && (
                <span className="text-[10px] text-zinc-500">definida en el entorno</span>
              )}
            </div>
            <div className="relative">
              <input
                type={verGPT ? 'text' : 'password'}
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-…"
                spellCheck={false}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-3 pr-10
                           text-[12.5px] text-zinc-200 outline-none transition-all
                           placeholder:text-zinc-600 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                title={verGPT ? 'Ocultar' : 'Mostrar'}
                onClick={() => setVerGPT((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500
                           transition-colors hover:text-zinc-300"
              >
                {verGPT ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              Se obtiene en platform.openai.com → API keys
            </p>
          </section>

          {/* Groq — API gratuita (nube) */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Groq — API key (gratuita · nube)
              </label>
              {entorno.groq && (
                <span className="text-[10px] text-zinc-500">definida en el entorno</span>
              )}
            </div>
            <div className="relative">
              <input
                type={verGroq ? 'text' : 'password'}
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                placeholder="gsk_…"
                spellCheck={false}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-3 pr-10
                           text-[12.5px] text-zinc-200 outline-none transition-all
                           placeholder:text-zinc-600 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                title={verGroq ? 'Ocultar' : 'Mostrar'}
                onClick={() => setVerGroq((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500
                           transition-colors hover:text-zinc-300"
              >
                {verGroq ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              API key gratuita en console.groq.com → API Keys
            </p>
          </section>

          {/* Gemini — API gratuita (nube) */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Gemini — API key (gratuita · nube)
              </label>
              {entorno.gemini && (
                <span className="text-[10px] text-zinc-500">definida en el entorno</span>
              )}
            </div>
            <div className="relative">
              <input
                type={verGemini ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza…"
                spellCheck={false}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-3 pr-10
                           text-[12.5px] text-zinc-200 outline-none transition-all
                           placeholder:text-zinc-600 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                title={verGemini ? 'Ocultar' : 'Mostrar'}
                onClick={() => setVerGemini((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500
                           transition-colors hover:text-zinc-300"
              >
                {verGemini ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              API key gratuita en aistudio.google.com → API Keys
            </p>
          </section>

          {/* Mistral — API gratuita (nube) */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Mistral — API key (gratuita · nube)
              </label>
              {entorno.mistral && (
                <span className="text-[10px] text-zinc-500">definida en el entorno</span>
              )}
            </div>
            <div className="relative">
              <input
                type={verMistral ? 'text' : 'password'}
                value={mistralApiKey}
                onChange={(e) => setMistralApiKey(e.target.value)}
                placeholder="…"
                spellCheck={false}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-3 pr-10
                           text-[12.5px] text-zinc-200 outline-none transition-all
                           placeholder:text-zinc-600 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                title={verMistral ? 'Ocultar' : 'Mostrar'}
                onClick={() => setVerMistral((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500
                           transition-colors hover:text-zinc-300"
              >
                {verMistral ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              API key gratuita en mistral.ai → API Keys
            </p>
          </section>

          {/* OpenRouter — API gratuita (nube) */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> OpenRouter — API key (gratuita · nube)
              </label>
              {entorno.openrouter && (
                <span className="text-[10px] text-zinc-500">definida en el entorno</span>
              )}
            </div>
            <div className="relative">
              <input
                type={verOpenRouter ? 'text' : 'password'}
                value={openrouterApiKey}
                onChange={(e) => setOpenrouterApiKey(e.target.value)}
                placeholder="sk-or-…"
                spellCheck={false}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-3 pr-10
                           text-[12.5px] text-zinc-200 outline-none transition-all
                           placeholder:text-zinc-600 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                title={verOpenRouter ? 'Ocultar' : 'Mostrar'}
                onClick={() => setVerOpenRouter((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500
                           transition-colors hover:text-zinc-300"
              >
                {verOpenRouter ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              API key gratuita en openrouter.ai → Keys
            </p>
          </section>

          {/* Ollama */}
          <section>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Servidor Ollama (local,
              gratuito)
            </label>
            <div className="relative">
              <Server className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                spellCheck={false}
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3
                           text-[12.5px] text-zinc-200 outline-none transition-all
                           placeholder:text-zinc-600 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              No requiere clave. Instala modelos con <code>ollama pull qwen2.5-coder:7b</code>
            </p>
          </section>
        </div>

        {/* Pie */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="text-[10.5px] leading-relaxed text-zinc-600">
            Las claves se guardan solo en este equipo (config-ia.json).
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalConfigIA(false)}>
              Cerrar
            </Button>
            <Button size="sm" onClick={guardar} disabled={guardando}>
              {guardando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : guardado ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}

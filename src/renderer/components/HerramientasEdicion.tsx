import { useState } from 'react'
import type { ReactNode } from 'react'
import { useModelStore } from '../store/modelStore'
import { entidadesADXF, entidadesParaEdicion } from '../../cad/edicion'
import { escalar, espejar, rotar, trasladar } from '../../cad/transformaciones'
import type { EntidadEditable } from '../../cad/transformaciones'
import { cn } from './utils'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  Undo2,
  Wrench,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

const PASOS_MM = [1, 5, 10, 25]
const FACTOR_ESCALA = 1.5

/**
 * Herramientas de edición rápida del visor: mover, girar, escalar y
 * espejar el modelo cargado, con deshacer. Operan sobre el DXF actual
 * (parsear → transformar → reescribir) sin IA.
 */
export function HerramientasEdicion({ className }: { className?: string }) {
  const { modeloActual, aplicarEdicion, deshacerEdicion, pilaDeshacer } = useModelStore()
  const [pasoIdx, setPasoIdx] = useState(1) // 5 mm por defecto
  const [aviso, setAviso] = useState<string | null>(null)

  if (!modeloActual) return null

  const paso = PASOS_MM[pasoIdx]

  function ejecutar(
    transformar: (entidades: EntidadEditable[]) => EntidadEditable[],
    descripcion: string
  ) {
    if (!modeloActual) return
    const entidades = entidadesParaEdicion(modeloActual.dxfTexto)
    if (!entidades || entidades.length === 0) {
      setAviso(`No se pudo editar (${descripcion}): DXF no interpretable.`)
      setTimeout(() => setAviso(null), 3500)
      return
    }
    const nuevas = transformar(entidades)
    const dxf = entidadesADXF(nuevas, {
      unidades: modeloActual.unidades,
      nombreDibujo: modeloActual.nombre,
    })
    aplicarEdicion(dxf, nuevas as any)
  }

  return (
    <div className={cn('absolute right-3 top-1/2 z-10 -translate-y-1/2', className)}>
      <div
        className="flex flex-col items-center gap-1 rounded-2xl border border-white/10
                   bg-zinc-900/70 p-1.5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md"
      >
        {/* Encabezado */}
        <div
          title="Herramientas de edición"
          className="flex h-6 w-6 items-center justify-center text-zinc-500"
        >
          <Wrench className="h-3.5 w-3.5" />
        </div>

        {/* Mover (cruceta) con selector de paso */}
        <div className="grid grid-cols-3 gap-0.5">
          <span />
          <BotonMini
            titulo={`Mover arriba ${paso} mm`}
            onClick={() => ejecutar((e) => trasladar(e, 0, paso), 'mover')}
            icono={<ArrowUp />}
          />
          <span />
          <BotonMini
            titulo={`Mover izquierda ${paso} mm`}
            onClick={() => ejecutar((e) => trasladar(e, -paso, 0), 'mover')}
            icono={<ArrowLeft />}
          />
          <button
            type="button"
            title="Cambiar paso de movimiento"
            onClick={() => setPasoIdx((i) => (i + 1) % PASOS_MM.length)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[9px] font-semibold
                       text-cyan-300/90 transition-colors hover:bg-white/[0.08] hover:text-cyan-200"
          >
            {paso}
          </button>
          <BotonMini
            titulo={`Mover derecha ${paso} mm`}
            onClick={() => ejecutar((e) => trasladar(e, paso, 0), 'mover')}
            icono={<ArrowRight />}
          />
          <span />
          <BotonMini
            titulo={`Mover abajo ${paso} mm`}
            onClick={() => ejecutar((e) => trasladar(e, 0, -paso), 'mover')}
            icono={<ArrowDown />}
          />
          <span />
        </div>

        <Separador />

        {/* Girar */}
        <div className="grid grid-cols-2 gap-0.5">
          <BotonMini
            titulo="Girar 90° a la izquierda"
            onClick={() => ejecutar((e) => rotar(e, 90), 'girar')}
            icono={<RotateCcw />}
          />
          <BotonMini
            titulo="Girar 90° a la derecha"
            onClick={() => ejecutar((e) => rotar(e, -90), 'girar')}
            icono={<RotateCw />}
          />
        </div>

        {/* Escalar */}
        <div className="grid grid-cols-2 gap-0.5">
          <BotonMini
            titulo={`Reducir ÷${FACTOR_ESCALA}`}
            onClick={() => ejecutar((e) => escalar(e, 1 / FACTOR_ESCALA), 'escalar')}
            icono={<ZoomOut />}
          />
          <BotonMini
            titulo={`Ampliar ×${FACTOR_ESCALA}`}
            onClick={() => ejecutar((e) => escalar(e, FACTOR_ESCALA), 'escalar')}
            icono={<ZoomIn />}
          />
        </div>

        {/* Espejar */}
        <div className="grid grid-cols-2 gap-0.5">
          <BotonMini
            titulo="Voltear horizontal (izquierda ↔ derecha)"
            onClick={() => ejecutar((e) => espejar(e, 'x'), 'voltear')}
            icono={<FlipHorizontal />}
          />
          <BotonMini
            titulo="Voltear vertical (arriba ↔ abajo)"
            onClick={() => ejecutar((e) => espejar(e, 'y'), 'voltear')}
            icono={<FlipVertical />}
          />
        </div>

        <Separador />

        {/* Deshacer */}
        <BotonMini
          titulo="Deshacer última edición"
          onClick={deshacerEdicion}
          disabled={pilaDeshacer.length === 0}
          icono={<Undo2 />}
        />
      </div>

      {/* Aviso flotante a la izquierda de la barra */}
      {aviso && (
        <div
          className="absolute right-full top-0 mr-2 w-48 rounded-xl border border-rose-400/25
                     bg-rose-500/10 p-2.5 text-[11px] leading-relaxed text-rose-200 backdrop-blur-md"
        >
          {aviso}
        </div>
      )}
    </div>
  )
}

function BotonMini({
  icono,
  titulo,
  onClick,
  disabled,
}: {
  icono: ReactNode
  titulo: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors
                 hover:bg-white/[0.08] hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30
                 [&>svg]:h-3.5 [&>svg]:w-3.5"
    >
      {icono}
    </button>
  )
}

function Separador() {
  return <div className="my-0.5 h-px w-6 bg-white/[0.08]" />
}

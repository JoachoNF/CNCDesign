import { useModelStore } from '../store/modelStore'
import { useImportarDXF } from './useImportarDXF'
import { Button } from './ui'
import { Trash2, Upload, Download } from 'lucide-react'

/**
 * Barra flotante del visor: acciones rápidas sobre el modelo actual.
 */
export function Toolbar() {
  const { modeloActual, limpiarModelo } = useModelStore()
  const importarDXF = useImportarDXF()

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10
                   bg-zinc-900/80 p-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          title="Limpiar modelo"
          aria-label="Limpiar modelo"
          onClick={limpiarModelo}
          disabled={!modeloActual}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Importar .dxf"
          aria-label="Importar .dxf"
          onClick={() => importarDXF()}
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <Button
          size="sm"
          className="pr-4"
          disabled={!modeloActual}
          onClick={() =>
            modeloActual &&
            window.apiCAD?.exportar({ contenido: modeloActual.dxfTexto, nombre: modeloActual.nombre })
          }
        >
          <Download className="h-3.5 w-3.5" /> Exportar
        </Button>
      </div>
    </div>
  )
}

/**
 * App.tsx — Layout principal de CNCDesign
 *
 * Estructura la ventana en tres modos de vista (`dividida`, `fullVisor`,
 * `fullTerminal`), la cabecera con las acciones globales (importar, exportar,
 * pantalla completa) y monta los paneles clave: visor 3D + herramientas de
 * edición, terminal IA, pedidos y el modal de configuración de claves.
 *
 * También sincroniza el estado de pantalla completa con el proceso principal
 * (IPC ventana:*) y permite salir de ella con `Esc`.
 */
import { useEffect, useState } from 'react'
import { Viewer3D } from './Viewer3D'
import { TerminalIA } from './TerminalIA'
import { OrderPanel } from './OrderPanel'
import { Toolbar } from './Toolbar'
import { HerramientasEdicion } from './HerramientasEdicion'
import { ModalConfigIA } from './ModalConfigIA'
import { useModelStore } from '../store/modelStore'
import { useImportarDXF } from './useImportarDXF'
import { Badge, Button, LogoMark, Panel, SectionHeader, Segmented } from './ui'
import {
  Box,
  FileDown,
  FileUp,
  Layers,
  LayoutPanelLeft,
  Maximize2,
  Minimize2,
  Package,
  RefreshCw,
  Terminal,
} from 'lucide-react'

const VISTAS = [
  { id: 'dividida', etiqueta: 'Dividida', icono: <LayoutPanelLeft className="h-3.5 w-3.5" /> },
  { id: 'fullVisor', etiqueta: 'Visor', icono: <Box className="h-3.5 w-3.5" /> },
  { id: 'fullTerminal', etiqueta: 'Terminal', icono: <Terminal className="h-3.5 w-3.5" /> },
]

export default function App() {
  const { modeloActual, capaSeleccionada, setCapaSeleccionada } = useModelStore()
  const [vista, setVista] = useState<string>('dividida')
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const importarDXF = useImportarDXF()

  // Sincronizar estado de pantalla completa y atajo Esc para salir
  useEffect(() => {
    window.apiCAD?.ventana
      ?.estaPantallaCompleta()
      .then(setPantallaCompleta)
      .catch(() => undefined)
    window.apiCAD?.ventana?.onPantallaCompleta(setPantallaCompleta)

    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.apiCAD?.ventana
          ?.estaPantallaCompleta()
          .then((activa) => {
            if (activa) window.apiCAD?.ventana?.salirPantallaCompleta()
          })
          .catch(() => undefined)
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  const alternarPantallaCompleta = async () => {
    const activa = await window.apiCAD?.ventana?.alternarPantallaCompleta()
    if (typeof activa === 'boolean') setPantallaCompleta(activa)
  }

  const subtituloModelo = modeloActual
    ? `${modeloActual.nombre} · ${modeloActual.tipo.toUpperCase()} · v${modeloActual.version}`
    : 'Sin modelo — pídele uno a la Terminal IA'

  return (
    <div className="app fondo-app text-zinc-200">
      {/* ===================== Encabezado principal ===================== */}
      <header
        className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-4
                   border-b border-white/[0.06] bg-zinc-950/70 px-5 backdrop-blur-xl"
      >
        {/* Marca */}
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark />
          <div className="min-w-0 leading-tight">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[17px] font-bold tracking-tight text-white">CNC</span>
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-[17px] font-bold tracking-tight text-transparent">
                Design
              </span>
            </div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              estudio · diseño 3D y .dxf
            </p>
          </div>
        </div>

        {/* Selector de vista */}
        <Segmented opciones={VISTAS} valor={vista} onCambio={setVista} className="hidden md:inline-flex" />

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {modeloActual && (
            <Badge variant="secondary" className="hidden max-w-[230px] lg:inline-flex">
              <Package className="h-3 w-3 shrink-0 text-violet-300" />
              <span className="truncate">{modeloActual.nombre}</span>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            title={pantallaCompleta ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
            aria-label="Pantalla completa"
            onClick={alternarPantallaCompleta}
          >
            {pantallaCompleta ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => importarDXF()}>
            <FileUp className="h-3.5 w-3.5" /> Importar
          </Button>
          <Button
            size="sm"
            disabled={!modeloActual}
            onClick={() =>
              modeloActual &&
              window.apiCAD?.exportar({ contenido: modeloActual.dxfTexto, nombre: modeloActual.nombre })
            }
          >
            <FileDown className="h-3.5 w-3.5" /> Exportar .dxf
          </Button>
        </div>
      </header>

      {/* ===================== Contenido ===================== */}
      <main className="flex-1 overflow-hidden p-3">
        {vista === 'dividida' && (
          <div className="flex h-full gap-3">
            {/* Visor */}
            <Panel className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <SectionHeader
                acento="cian"
                icono={<Box />}
                titulo="Visor 3D / 2D"
                subtitulo={subtituloModelo}
                acciones={
                  <>
                    {capaSeleccionada && (
                      <Badge variant="outline">
                        <Layers className="h-3 w-3" /> {capaSeleccionada}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!capaSeleccionada}
                      onClick={() => setCapaSeleccionada(null)}
                    >
                      Todas las capas
                    </Button>
                  </>
                }
              />
              <div className="relative flex-1 overflow-hidden rounded-b-2xl">
                <Viewer3D />
                <Toolbar />
                <HerramientasEdicion />
              </div>
            </Panel>

            {/* Columna derecha: Terminal IA + Pedidos */}
            <aside className="flex w-[380px] min-h-0 shrink-0 flex-col gap-3 xl:w-[430px]">
              <TerminalIA className="min-h-0 flex-[3]" />
              <OrderPanel className="min-h-0 flex-[2]" />
            </aside>
          </div>
        )}

        {vista === 'fullVisor' && (
          <Panel className="flex h-full flex-col overflow-hidden">
            <SectionHeader
              acento="cian"
              icono={<Box />}
              titulo="Visor 3D / 2D"
              subtitulo={subtituloModelo}
              acciones={
                <Badge variant="outline">{capaSeleccionada ? `Capa: ${capaSeleccionada}` : 'Todas las capas'}</Badge>
              }
            />
            <div className="relative flex-1 overflow-hidden rounded-b-2xl">
              <Viewer3D />
              <Toolbar />
              <HerramientasEdicion />
            </div>
          </Panel>
        )}

        {vista === 'fullTerminal' && (
          <div className="mx-auto h-full max-w-3xl">
            <TerminalIA className="h-full" />
          </div>
        )}
      </main>

      {/* Modal de configuración de IA (claves API) */}
      <ModalConfigIA />

      {/* Aviso de error de carga (conservado del flujo original) */}
      {typeof window !== 'undefined' && !window.apiCAD && (
        <div
          className="pointer-events-auto fixed bottom-4 left-1/2 z-30 -translate-x-1/2
                     flex items-center gap-3 rounded-full border border-amber-400/20 bg-zinc-900/90
                     px-4 py-2 text-xs text-amber-200 shadow-xl backdrop-blur-xl"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Ejecutando en navegador sin Electron — la IA y la exportación están limitadas.
        </div>
      )}
    </div>
  )
}

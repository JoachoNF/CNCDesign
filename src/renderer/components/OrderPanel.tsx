/**
 * OrderPanel.tsx — Historial de pedidos .dxf
 *
 * Lista las peticiones hechas a la IA con su estado (pendiente, procesando,
 * completado, rechazado), el modelo que las resolvió y la hora. Permite
 * abrir el diálogo de importación y muestra un estado vacío cuando aún no
 * hay pedidos registrados.
 */
import { useModelStore } from '../store/modelStore'
import { useImportarDXF } from './useImportarDXF'
import { Panel, SectionHeader, PanelBody, Badge, EmptyState, Button } from './ui'
import { cn } from './utils'
import { Clock, CheckCircle, AlertCircle, Package, ClipboardList, FileUp } from 'lucide-react'

export function OrderPanel({ className }: { className?: string }) {
  const { pedidos } = useModelStore()
  const importarDXF = useImportarDXF()

  const estadoConfig = (estado: string) => {
    switch (estado) {
      case 'completado':
        return {
          variant: 'success' as const,
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: 'Completado',
          tile: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
        }
      case 'procesando':
        return {
          variant: 'warning' as const,
          icon: <Clock className="h-3.5 w-3.5 animate-spin" />,
          label: 'Procesando',
          tile: 'border-amber-400/20 bg-amber-500/10 text-amber-300',
        }
      case 'rechazado':
        return {
          variant: 'destructive' as const,
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          label: 'Rechazado',
          tile: 'border-rose-400/20 bg-rose-500/10 text-rose-300',
        }
      default:
        return {
          variant: 'outline' as const,
          icon: <Package className="h-3.5 w-3.5" />,
          label: 'Pendiente',
          tile: 'border-white/10 bg-white/[0.05] text-zinc-400',
        }
    }
  }

  return (
    <Panel className={cn('flex flex-col overflow-hidden', className)}>
      <SectionHeader
        acento="ambar"
        icono={<ClipboardList />}
        titulo="Pedidos .dxf"
        subtitulo="Historial de generaciones"
        acciones={<Badge variant="outline">{pedidos.length}</Badge>}
      />

      <PanelBody className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-black/10 p-3">
        {pedidos.length === 0 ? (
          <EmptyState
            acento="ambar"
            icon={<Package />}
            titulo="Sin pedidos aún"
            descripcion="Los modelos que generes con la IA aparecerán aquí, con su estado y el modelo utilizado."
            accion={
              <Button variant="outline" size="sm" onClick={() => importarDXF()}>
                <FileUp className="h-3.5 w-3.5" /> Importar .dxf
              </Button>
            }
          />
        ) : (
          pedidos.map((p) => {
            const config = estadoConfig(p.estado)
            return (
              <div
                key={p.id}
                className="animar-entrada group rounded-xl border border-white/[0.07] bg-white/[0.03] p-3
                           transition-all duration-200 hover:border-violet-400/25 hover:bg-white/[0.05]"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border',
                        config.tile
                      )}
                    >
                      {config.icon}
                    </span>
                    <span className="truncate text-[12.5px] font-medium tracking-tight text-zinc-200">
                      {p.prompt}
                    </span>
                  </div>
                  <Badge variant={config.variant} className="shrink-0">
                    {config.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                  <span className="truncate font-medium text-zinc-400">{p.modeloIA || '—'}</span>
                  {p.valido !== undefined && (
                    <span
                      className={cn(
                        'flex items-center gap-1',
                        p.valido ? 'text-emerald-400' : 'text-amber-400'
                      )}
                    >
                      {p.valido ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {p.valido ? 'Válido CNC' : 'Revisar'}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] tabular-nums text-zinc-600">
                    {new Date(p.creadoEn).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </PanelBody>
    </Panel>
  )
}

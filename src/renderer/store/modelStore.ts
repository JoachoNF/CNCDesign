/**
 * modelStore.ts — Estado global de la aplicación (Zustand + persist)
 *
 * Contiene el modelo actual y su historial, los pedidos .dxf, las
 * preferencias de IA (proveedor y modelo Ollama) y la pila de deshacer de
 * las ediciones del visor.
 *
 * Persistencia (localStorage, clave `cnc-design-storage`): solo se guardan
 * `pedidos`, `historial`, `proveedorIA` y `ollamaModelo`. El modelo actual
 * NO se persiste a propósito (el visor arranca vacío) y la pila de deshacer
 * vive solo en memoria.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TipoModelo = '2d' | '3d' | 'mixto'

/** Proveedor de IA preferido para las peticiones ('auto' = router decide) */
export type ProveedorIAId = 'auto' | 'anthropic' | 'openai' | 'ollama'

export interface EntidadDXF {
  id: string
  tipo: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE' | 'LWPOLYLINE' | 'TEXT' | '3DFACE' | 'SOLID' | 'HATCH'
  capa: string
  color?: number
  puntos: number[][]
  datos?: Record<string, any>
}

export interface ModeloCAD {
  id: string
  nombre: string
  tipo: TipoModelo
  unidades: 'mm' | 'pulgadas'
  entidades: EntidadDXF[]
  dxfTexto: string
  ultimaModificacion: Date
  version: number
}

export interface Pedido {
  id: string
  prompt: string
  estado: 'pendiente' | 'procesando' | 'completado' | 'rechazado'
  modeloIA?: string
  dxf?: string
  valido?: boolean
  advertencias?: string[]
  creadoEn: Date
}

interface ModelState {
  modeloActual: ModeloCAD | null
  historial: ModeloCAD[]
  pedidos: Pedido[]
  visorActivo: boolean
  capaSeleccionada: string | null
  /** Proveedor de IA elegido para las peticiones */
  proveedorIA: ProveedorIAId
  /** Modelo concreto de Ollama (local) */
  ollamaModelo: string
  /** Visibilidad del modal de configuración de API keys */
  modalConfigIA: boolean
  /** Pila de textos DXF anteriores (para deshacer ediciones del visor) */
  pilaDeshacer: string[]

  setModelo: (modelo: ModeloCAD) => void
  agregarEntidad: (entidad: EntidadDXF) => void
  actualizarDXF: (texto: string) => void
  agregarPedido: (prompt: string) => string
  actualizarPedido: (id: string, parcial: Partial<Pedido>) => void
  setCapaSeleccionada: (capa: string | null) => void
  limpiarModelo: () => void
  setProveedorIA: (proveedor: ProveedorIAId) => void
  setOllamaModelo: (modelo: string) => void
  setModalConfigIA: (abierta: boolean) => void
  aplicarEdicion: (dxfTexto: string, entidades?: EntidadDXF[]) => void
  deshacerEdicion: () => void
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      modeloActual: null,
      historial: [],
      pedidos: [],
      visorActivo: true,
      capaSeleccionada: null,
      proveedorIA: 'auto',
      ollamaModelo: 'qwen2.5-coder:7b',
      modalConfigIA: false,
      pilaDeshacer: [],

      setModelo: (modelo) => set({ modeloActual: modelo, historial: [...get().historial, modelo] }),

      agregarEntidad: (entidad) => {
        const modelo = get().modeloActual
        if (!modelo) return
        set({
          modeloActual: {
            ...modelo,
            entidades: [...modelo.entidades, entidad],
            ultimaModificacion: new Date(),
            version: modelo.version + 1,
          },
        })
      },

      actualizarDXF: (texto) => {
        const modelo = get().modeloActual
        if (!modelo) return
        set({
          modeloActual: {
            ...modelo,
            dxfTexto: texto,
            ultimaModificacion: new Date(),
            version: modelo.version + 1,
          },
        })
      },

      agregarPedido: (prompt) => {
        const id = crypto.randomUUID()
        const pedido: Pedido = {
          id,
          prompt,
          estado: 'pendiente',
          creadoEn: new Date(),
        }
        set({ pedidos: [...get().pedidos, pedido] })
        return id
      },

      actualizarPedido: (id, parcial) =>
        set({
          pedidos: get().pedidos.map((p) => (p.id === id ? { ...p, ...parcial } : p)),
        }),

      setCapaSeleccionada: (capa) => set({ capaSeleccionada: capa }),

      limpiarModelo: () => set({ modeloActual: null }),

      setProveedorIA: (proveedorIA) => set({ proveedorIA }),

      setOllamaModelo: (ollamaModelo) => set({ ollamaModelo }),

      setModalConfigIA: (modalConfigIA) => set({ modalConfigIA }),

      // Aplica una edición del visor: guarda el DXF anterior para deshacer
      aplicarEdicion: (dxfTexto, entidades) => {
        const modelo = get().modeloActual
        if (!modelo) return
        set({
          modeloActual: {
            ...modelo,
            dxfTexto,
            entidades: entidades ?? modelo.entidades,
            ultimaModificacion: new Date(),
            version: modelo.version + 1,
          },
          pilaDeshacer: [...get().pilaDeshacer.slice(-14), modelo.dxfTexto],
        })
      },

      deshacerEdicion: () => {
        const modelo = get().modeloActual
        const pila = get().pilaDeshacer
        if (!modelo || pila.length === 0) return
        set({
          modeloActual: {
            ...modelo,
            dxfTexto: pila[pila.length - 1],
            ultimaModificacion: new Date(),
            version: modelo.version + 1,
          },
          pilaDeshacer: pila.slice(0, -1),
        })
      },
    }),
    {
      name: 'cnc-design-storage',
      partialize: (s) => ({
        pedidos: s.pedidos,
        historial: s.historial,
        proveedorIA: s.proveedorIA,
        ollamaModelo: s.ollamaModelo,
      }),
    }
  )
)

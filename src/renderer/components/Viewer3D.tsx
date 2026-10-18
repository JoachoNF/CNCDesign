/**
 * Viewer3D.tsx — Visor CAD 2D/3D basado en Three.js + dxf-render
 *
 * Monta la escena, carga el modelo (texto DXF del store) y gestiona toda la
 * interacción: OrbitControls (orbitar/desplazar/zoom), vistas rápidas con
 * las teclas 1-4, encuadre automático, cuadrícula, pantalla completa y la
 * tarjeta de atajos. La capa seleccionada llega desde el store global.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { parseDxf, createThreeObjectsFromDXF, loadDefaultFont } from 'dxf-render'
import { useModelStore } from '../store/modelStore'
import { Panel, EmptyState } from './ui'
import { Boxes, AlertTriangle, HelpCircle, MousePointer2, X } from 'lucide-react'

const COLOR_FONDO = 0x0a0a0d

// Direcciones de cámara para las vistas rápidas (teclas 1-4)
const VISTAS: Record<string, { dir: THREE.Vector3; nombre: string }> = {
  Frontal: { dir: new THREE.Vector3(0, 0, 1), nombre: 'Frontal' },
  Superior: { dir: new THREE.Vector3(0, 1, 0.001), nombre: 'Superior' },
  Lateral: { dir: new THREE.Vector3(1, 0, 0.001), nombre: 'Lateral' },
  Isométrica: { dir: new THREE.Vector3(1, 1, 1), nombre: 'Isométrica' },
}

function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
      {children}
    </kbd>
  )
}

function Fila({ etiqueta, teclas }: { etiqueta: string; teclas: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-[11.5px] text-zinc-400">{etiqueta}</span>
      <span className="flex items-center gap-1">{teclas}</span>
    </div>
  )
}

export function Viewer3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { modeloActual } = useModelStore()
  const [error, setError] = useState<string | null>(null)
  const [ayudaVisible, setAyudaVisible] = useState(false)
  const [nombreVista, setNombreVista] = useState('Isométrica')

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let renderer: THREE.WebGLRenderer | null = null
    let groupActual: THREE.Group | null = null
    let observador: ResizeObserver | null = null
    let frameId: number | null = null
    let controls: OrbitControls | null = null

    try {
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(COLOR_FONDO)

      // Cuadrícula de referencia en el plano XY (el dibujo DXF vive en XY)
      const grid = new THREE.GridHelper(400, 40, 0x26262f, 0x16161c)
      const gridMat = grid.material as THREE.Material
      gridMat.transparent = true
      gridMat.opacity = 0.45
      grid.rotation.x = Math.PI / 2
      grid.position.z = -0.4
      scene.add(grid)

      const frustumSize = 200
      const aspect = container.clientWidth / Math.max(container.clientHeight, 1)
      const camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        2000
      )
      camera.position.set(100, 100, 100)
      camera.lookAt(0, 0, 0)

      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setClearColor(COLOR_FONDO, 1)
      container.appendChild(renderer.domElement)

      const render = () => renderer?.render(scene, camera)

      // ---- Controles de cámara (orbitar, desplazar, zoom) ----
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.screenSpacePanning = true
      controls.minZoom = 0.05
      controls.maxZoom = 50
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }
      controls.target.set(0, 0, 0)
      controls.addEventListener('start', () => setNombreVista('Libre'))

      // Centro y tamaño de referencia: el modelo si existe, si no el origen
      function centroYRadio(): { centro: THREE.Vector3; radio: number } {
        if (groupActual) {
          const box = new THREE.Box3().setFromObject(groupActual)
          const centro = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          return { centro, radio: Math.max(size.x, size.y, size.z) || 100 }
        }
        return { centro: new THREE.Vector3(0, 0, 0), radio: 70 }
      }

      function encuadrar() {
        const { centro, radio } = centroYRadio()
        const dir = new THREE.Vector3().subVectors(camera.position, controls!.target)
        if (dir.lengthSq() < 1e-6) dir.set(1, 1, 1)
        dir.normalize()
        camera.position.copy(centro.clone().add(dir.multiplyScalar(radio * 1.7)))
        camera.zoom = 1
        camera.updateProjectionMatrix()
        controls!.target.copy(centro)
        controls!.update()
        render()
      }

      function verDesde(vista: { dir: THREE.Vector3; nombre: string }) {
        const { centro, radio } = centroYRadio()
        camera.position.copy(centro.clone().add(vista.dir.clone().normalize().multiplyScalar(radio * 1.7)))
        camera.zoom = 1
        camera.updateProjectionMatrix()
        controls!.target.copy(centro)
        controls!.update()
        render()
        setNombreVista(vista.nombre)
      }

      function hacerZoom(factor: number) {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 0.05, 50)
        camera.updateProjectionMatrix()
        render()
      }

      function desplazarVista(fx: number, fy: number) {
        const ancho = (camera.right - camera.left) / camera.zoom
        const alto = (camera.top - camera.bottom) / camera.zoom
        const derecha = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
        const arriba = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1)
        const delta = new THREE.Vector3()
          .addScaledVector(derecha, fx * ancho * 0.08)
          .addScaledVector(arriba, fy * alto * 0.08)
        camera.position.add(delta)
        controls!.target.add(delta)
        controls!.update()
        render()
      }

      async function cargarModelo() {
        if (!modeloActual?.dxfTexto) return
        try {
          await loadDefaultFont()
          const dxf = parseDxf(modeloActual.dxfTexto)
          const { group } = await createThreeObjectsFromDXF(dxf, { darkTheme: true })

          if (groupActual) scene.remove(groupActual)
          groupActual = group
          scene.add(group)

          encuadrar()
          setNombreVista('Isométrica')
        } catch (errorVisor) {
          console.error('Error cargando DXF en visor:', errorVisor)
          setError('Error cargando el modelo DXF en el visor.')
        }
      }

      const ajustarTamano = () => {
        const w = container.clientWidth
        const h = Math.max(container.clientHeight, 1)
        const ar = w / h
        camera.left = (frustumSize * ar) / -2
        camera.right = (frustumSize * ar) / 2
        camera.top = frustumSize / 2
        camera.bottom = frustumSize / -2
        camera.updateProjectionMatrix()
        renderer?.setSize(w, h)
        render()
      }

      // ---- Atajos de teclado ----
      const manejarTeclas = (e: KeyboardEvent) => {
        const objetivo = e.target as HTMLElement | null
        if (
          objetivo &&
          (objetivo.tagName === 'INPUT' ||
            objetivo.tagName === 'TEXTAREA' ||
            objetivo.isContentEditable)
        ) {
          return
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return

        let manejado = true
        switch (e.key.toLowerCase()) {
          case '1':
            verDesde(VISTAS.Frontal)
            break
          case '2':
            verDesde(VISTAS.Superior)
            break
          case '3':
            verDesde(VISTAS.Lateral)
            break
          case '4':
          case 'r':
            verDesde(VISTAS.Isométrica)
            break
          case 'f':
            encuadrar()
            setNombreVista('Encuadrada')
            break
          case 'g':
            grid.visible = !grid.visible
            render()
            break
          case '+':
          case '=':
            hacerZoom(1.15)
            break
          case '-':
          case '_':
            hacerZoom(1 / 1.15)
            break
          case 'arrowleft':
            desplazarVista(-1, 0)
            break
          case 'arrowright':
            desplazarVista(1, 0)
            break
          case 'arrowup':
            desplazarVista(0, 1)
            break
          case 'arrowdown':
            desplazarVista(0, -1)
            break
          default:
            manejado = false
        }
        if (manejado) e.preventDefault()
      }

      const alDobleClic = () => encuadrar()

      render()
      void cargarModelo()
      observador = new ResizeObserver(ajustarTamano)
      observador.observe(container)
      window.addEventListener('resize', ajustarTamano)
      window.addEventListener('keydown', manejarTeclas)
      renderer.domElement.addEventListener('dblclick', alDobleClic)

      // Bucle ligero: solo renderiza cuando la cámara cambia (damping)
      const animar = () => {
        frameId = requestAnimationFrame(animar)
        if (controls!.update()) render()
      }
      animar()

      return () => {
        if (frameId !== null) cancelAnimationFrame(frameId)
        window.removeEventListener('resize', ajustarTamano)
        window.removeEventListener('keydown', manejarTeclas)
        renderer?.domElement.removeEventListener('dblclick', alDobleClic)
        observador?.disconnect()
        controls?.dispose()
        if (groupActual) scene.remove(groupActual)
        if (renderer?.domElement.parentElement === container) {
          container.removeChild(renderer.domElement)
        }
        renderer?.dispose()
      }
    } catch (errorWebGL) {
      console.error('Error inicializando WebGL:', errorWebGL)
      setError('No se pudo inicializar el visor 3D (WebGL no disponible en este entorno).')
    }
  }, [modeloActual?.dxfTexto])

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0a0a0d] p-6">
        <EmptyState
          acento="rosa"
          icon={<AlertTriangle />}
          titulo="Visor no disponible"
          descripcion={`${error} El visor requiere WebGL; en un entorno sin GPU este panel quedará vacío.`}
        />
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-[#0a0a0d]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Estado vacío sobre el lienzo */}
      {!modeloActual?.dxfTexto && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <EmptyState
            acento="cian"
            icon={<Boxes />}
            titulo="Lienzo vacío"
            descripcion="Pídele a la Terminal IA crear un modelo, o importá un archivo .dxf para previsualizarlo aquí."
          />
        </div>
      )}

      {/* Pistas de navegación (siempre visibles) */}
      <div
        className={`pointer-events-none absolute left-3 top-3 z-10 transition-opacity duration-200 ${
          ayudaVisible ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10
                     bg-zinc-900/70 py-1.5 pl-3 pr-1.5 text-[10.5px] text-zinc-400 backdrop-blur-md"
        >
          <MousePointer2 className="h-3 w-3 text-cyan-300/80" />
          <span>
            Arrastrar <span className="text-zinc-600">orbita</span> · Rueda{' '}
            <span className="text-zinc-600">zoom</span> · Clic der.{' '}
            <span className="text-zinc-600">desplaza</span>
          </span>
          <button
            type="button"
            title="Ver todos los atajos"
            onClick={() => setAyudaVisible((v) => !v)}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10
                       bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Indicador de vista actual */}
      <div className="pointer-events-none absolute bottom-3 right-4 z-10 hidden text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600 sm:block">
        vista {nombreVista}
      </div>

      {/* Tarjeta de atajos */}
      {ayudaVisible && (
        <Panel className="animar-entrada absolute right-3 top-3 z-20 w-[290px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
              Atajos del visor
            </h3>
            <button
              type="button"
              onClick={() => setAyudaVisible(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Cerrar ayuda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Cámara (ratón)
          </p>
          <div className="mb-3 space-y-1">
            <Fila etiqueta="Arrastrar (clic izq.)" teclas={<span className="text-[10.5px] text-zinc-500">orbitar</span>} />
            <Fila etiqueta="Clic derecho" teclas={<span className="text-[10.5px] text-zinc-500">desplazar</span>} />
            <Fila etiqueta="Rueda" teclas={<span className="text-[10.5px] text-zinc-500">zoom</span>} />
            <Fila etiqueta="Doble clic" teclas={<span className="text-[10.5px] text-zinc-500">encuadrar</span>} />
          </div>

          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Teclado
          </p>
          <div className="mb-3 space-y-1">
            <Fila
              etiqueta="Vistas rápidas"
              teclas={
                <>
                  <Tecla>1</Tecla>
                  <Tecla>2</Tecla>
                  <Tecla>3</Tecla>
                  <Tecla>4</Tecla>
                </>
              }
            />
            <Fila etiqueta="Encuadrar" teclas={<Tecla>F</Tecla>} />
            <Fila etiqueta="Restablecer vista" teclas={<Tecla>R</Tecla>} />
            <Fila etiqueta="Cuadrícula" teclas={<Tecla>G</Tecla>} />
            <Fila
              etiqueta="Zoom"
              teclas={
                <>
                  <Tecla>+</Tecla>
                  <Tecla>−</Tecla>
                </>
              }
            />
            <Fila
              etiqueta="Desplazar vista"
              teclas={
                <>
                  <Tecla>←</Tecla>
                  <Tecla>↑</Tecla>
                  <Tecla>→</Tecla>
                  <Tecla>↓</Tecla>
                </>
              }
            />
          </div>

          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Ventana
          </p>
          <div className="space-y-1">
            <Fila etiqueta="Salir de pantalla completa" teclas={<Tecla>Esc</Tecla>} />
          </div>

          <p className="mt-3 text-[10.5px] leading-relaxed text-zinc-600">
            Vistas rápidas: <span className="text-zinc-400">1</span> Frontal ·{' '}
            <span className="text-zinc-400">2</span> Superior · <span className="text-zinc-400">3</span>{' '}
            Lateral · <span className="text-zinc-400">4</span> Isométrica
          </p>
        </Panel>
      )}
    </div>
  )
}

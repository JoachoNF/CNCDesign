# Arquitectura de CNCDesign

Mapa de módulos y decisiones estructurales. Todas las rutas son relativas a la raíz del repositorio.

## Vista general

```
Renderer (React + Zustand + Tailwind)  ── window.apiCAD ──  Main (Electron, CommonJS)
   visor · terminal · paneles                                 ventana · diálogos · config
                 │
                 ▼
        Núcleo puro (Node, sin DOM)
        src/cad/*  ·  src/ai/*
```

- El **renderer** es una SPA React compilada por Vite (`dist/index.html` + `dist/assets`). En desarrollo se sirve desde `http://localhost:5123` (puerto estricto).
- El **main** se compila aparte a CommonJS (`tsc -p tsconfig.build.json`) y vive en `dist/electron/main.js`.
- El **núcleo** (`src/cad`, `src/ai`) no depende del DOM ni de Electron y puede ejecutarse con Node directamente (por eso `tsc` también emite `dist/src/...`).

## Mapa de módulos

### electron/ (proceso principal)

| Archivo | Responsabilidad |
|---|---|
| `electron/main.ts` | Ventana, carga de Vite (dev) o `dist/index.html` (prod), IPC, `config-ia.json` en `app.getPath('userData')`, pantalla completa, utilidad de capturas `CAPTURA_UI` |
| `electron/preload.ts` | Puente `contextBridge` → `window.apiCAD` con las APIs `cad`, `ventana` e `ia` |
| `electron/ipc/canales.ts` | **Contrato documental** de todos los canales IPC (nombres y tipos). El runtime usa los nombres literales en main/preload; este archivo mantiene el mapa completo |

### src/cad/ (núcleo CAD puro)

| Función | Firma | Notas |
|---|---|---|
| `parsearDXF` | `(textoDXF) → EntidadNormalizada[]` | Parser propio por grupos de código DXF |
| `extraerCabecera` | `(textoDXF) → Record<string,string>` | Variables de la sección HEADER |
| `escribirDXF` | `(entidades, {unidades?, nombreDibujo?, versionACAD?}) → string` | DXF ASCII; por defecto `AC1027` (R2013) y mm |
| `primitivasADXF` | `(modelo: ModeloParametrico) → string` | Primitivas paramétricas (placa, agujeros, etc.) |
| `ejemploPlacaConAgujeros` | `() → string` | DXF de ejemplo para pruebas |
| `validarDXF` | `(textoDXF) → ResultadoValidacion` | Reglas CNC: contorno cerrado, unidades, espesores mínimos |
| `trasladar` | `(entidades, dx, dy, dz=0)` | Transformaciones **puras**: devuelven una lista nueva |
| `rotar` | `(entidades, grados, centro?)` | Centro por defecto: centro de la caja envolvente |
| `escalar` | `(entidades, factor, centro?)` | ídem |
| `espejar` | `(entidades, 'x' \| 'y', centro?)` | ídem |
| `caja` | `(entidades) → Caja2D` | Caja envolvente 2D |
| `entidadesParaEdicion` | `(textoDXF) → EntidadEditable[] \| null` | Normaliza lo que devuelve el parser para el editor; `null` si no se puede parsear |
| `entidadesADXF` | `(entidades) → string` | Vuelve a generar el texto DXF desde entidades editables |

**Invariantes críticos del ciclo de edición** (descubiertos empíricamente):

- El parser entrega los ángulos de `ARC` en **radianes**; el escritor los espera en **grados**. La conversión ocurre en `edicion.ts`.
- El radio de `CIRCLE`/`ARC` se conserva en `datos.radio` de la entidad editable.
- Los `TEXT` conservan `texto` y `alto` en `datos`; la rotación (si existe) también se convierte de radianes a grados.
- Si `entidadesParaEdicion` devuelve `null`, las herramientas de edición no deben aplicarse.

**Mapeo de entidades del parser** (verificado empíricamente):

| Entidad DXF | Campos que produce el parser |
|---|---|
| `LINE` | `vertices` (puntos) |
| `CIRCLE` | `center`, `radius` |
| `ARC` | `center`, `radius`, `startAngle`, `endAngle` (radianes) |
| `TEXT` | `startPoint`, `textHeight`, `text` |
| `LWPOLYLINE` / `POLYLINE` | `vertices` |

### src/ai/ (router y proveedores)

| Archivo | Responsabilidad |
|---|---|
| `src/ai/router.ts` | `CADRouter` (singleton `cadRouter`): clasifica la tarea, elige proveedor, ejecuta con fallback y extrae el bloque `dxf` de la respuesta |
| `src/ai/providers/base.ts` | Interfaz común de proveedor (`disponible()`, `generar()`…) |
| `src/ai/providers/anthropic.ts` | Claude (SDK `@anthropic-ai/sdk`) |
| `src/ai/providers/openai.ts` | GPT (SDK `openai`) |
| `src/ai/providers/ollama.ts` | Ollama local vía HTTP (`/api/chat`) |
| `src/ai/prompts/*.md` | System prompts de **referencia** (el router construye el prompt inline con `buildSystemPrompt()`; estos archivos documentan la intención de producto) |

Firma principal del router:

```ts
cadRouter.generar({
  prompt: string,
  modeloActual?: string,       // texto DXF del modelo vigente (para editar)
  tipo?: TipoTarea,            // 'crear' | 'editar' | 'imagen' | 'corregir' | 'desconocido'
  proveedorPreferido?: string, // 'auto' | 'anthropic' | 'openai' | 'ollama'
  ollamaModelo?: string,       // p. ej. 'qwen2.5-coder:7b'
}): Promise<RespuestaRouter>   // { ok, dxf?, modeloIA?, tareaDetectada?, proveedorUsado?, errores? }
```

`recargarProveedores()` reconstruye los proveedores leyendo `process.env` (se llama tras guardar claves en el modal de configuración).

### src/renderer/ (UI)

| Archivo | Responsabilidad |
|---|---|
| `components/App.tsx` | Layout: vistas `dividida` / `fullVisor` / `fullTerminal`, cabecera, `Esc` para salir de pantalla completa |
| `components/Viewer3D.tsx` | Escena Three.js + `dxf-render`; OrbitControls, vistas rápidas 1-4, cuadrícula, encuadre, tarjeta de atajos |
| `components/TerminalIA.tsx` | Chat, integración con el router y botones «Aplicar al visor» / «Exportar .dxf»; envía `tipo: 'desconocido'` para que el router clasifique por sí mismo |
| `components/SelectorModeloIA.tsx` | Selector de proveedor + lista en vivo de modelos Ollama |
| `components/ModalConfigIA.tsx` | Configuración de claves API y URL de Ollama |
| `components/HerramientasEdicion.tsx` | Controles de mover/rotar/escalar/espejar + deshacer; se ocultan si no hay modelo |
| `components/Toolbar.tsx` | Acciones flotantes del visor (limpiar, importar, exportar) |
| `components/OrderPanel.tsx` | Historial de pedidos con estado y modelo usado |
| `components/useImportarDXF.ts` | Hook del diálogo de importación |
| `components/ui.tsx` | Sistema de diseño (Button, Badge, Panel, Segmented…) basado en CVA |
| `store/modelStore.ts` | Estado global Zustand |

## Estado global (Zustand)

- **Persistido** (`localStorage`, clave `cnc-design-storage`, vía `partialize`): `pedidos`, `historial`, `proveedorIA`, `ollamaModelo`.
- **En memoria**: `modeloActual` (a propósito: el visor arranca vacío), `pilaDeshacer` (máx. 15 textos DXF), `modalConfigIA`, `capaSeleccionada`.
- `aplicarEdicion(dxfTexto, entidades?)` empuja el DXF anterior a `pilaDeshacer` y sube la `version` del modelo (v1 → v2 → …); `deshacerEdicion()` restaura el último texto guardado.

## Flujo de una petición de IA

1. `TerminalIA` arma el contexto con el prompt, el `dxfTexto` del modelo actual y la preferencia del selector de modelo.
2. `cadRouter.generar()` clasifica la tarea (`clasificarTarea`) y resuelve el proveedor (preferido o por defecto).
3. Se ejecuta con fallback en cascada; el texto DXF se extrae del primer bloque `dxf` de la respuesta.
4. El renderer muestra el resultado; «Aplicar al visor» actualiza el modelo y `OrderPanel` registra el pedido.
5. «Exportar .dxf» abre el diálogo nativo de guardado (IPC `cad:exportar`).

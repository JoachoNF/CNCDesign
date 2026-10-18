import { useModelStore } from '../store/modelStore'

/**
 * Hook que abre el diálogo de importación de .dxf y carga el archivo
 * en el visor como modelo actual.
 */
export function useImportarDXF() {
  const { setModelo } = useModelStore()

  return async function importarDXF() {
    const resultado = await window.apiCAD?.importar()
    if (!resultado?.ok || !resultado.texto) return null

    const texto: string = resultado.texto
    const nombreArchivo =
      String(resultado.path || '')
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.dxf$/i, '') || 'modelo-importado'

    const es3d = /\b3DFACE\b|\b3DSOLID\b/i.test(texto)
    const coincidenciaUnidades = texto.match(/\$INSUNITS\s*\r?\n\s*70\s*\r?\n\s*(\d+)/)
    const unidades = coincidenciaUnidades?.[1] === '1' ? 'pulgadas' : 'mm'

    setModelo({
      id: crypto.randomUUID(),
      nombre: nombreArchivo,
      tipo: es3d ? '3d' : '2d',
      unidades,
      entidades: [],
      dxfTexto: texto,
      ultimaModificacion: new Date(),
      version: 1,
    })

    return texto
  }
}

/**
 * parser.ts — Lectura y normalización de archivos .dxf
 *
 * Utiliza dxf-render/parser (parser-only, zero deps de Three.js)
 * para extraer entidades y convertirlas a nuestro esquema interno.
 */
import { parseDxf, type DxfData } from 'dxf-render/parser'

export type EntidadNormalizada = {
  id: string
  tipo: string
  capa: string
  color?: number
  puntos: number[][]
  datos?: Record<string, any>
}

function generarId() {
  return crypto.randomUUID()
}

export function parsearDXF(textoDXF: string): EntidadNormalizada[] {
  const dxf: DxfData = parseDxf(textoDXF)
  const entidades: EntidadNormalizada[] = []

  for (const ent of dxf.entities) {
    const puntos: number[][] = []
    let tipo = ent.type

    // Extraer puntos según tipo de entidad
    if ('startPoint' in ent && ent.startPoint) {
      const p = ent.startPoint as any
      puntos.push([p.x || 0, p.y || 0, p.z || 0])
    }
    if ('endPoint' in ent && ent.endPoint) {
      const p = ent.endPoint as any
      puntos.push([p.x || 0, p.y || 0, p.z || 0])
    }
    if ('center' in ent && ent.center) {
      const p = ent.center as any
      puntos.push([p.x || 0, p.y || 0, p.z || 0])
    }
    if ('vertices' in ent && ent.vertices) {
      for (const v of ent.vertices as any[]) {
        puntos.push([v.x || 0, v.y || 0, v.z || 0])
      }
    }
    if ('points' in ent && ent.points) {
      for (const p of ent.points as any[]) {
        puntos.push([p.x || 0, p.y || 0, p.z || 0])
      }
    }

    // 3DFACE / SOLID: 4 puntos
    if ('v0' in ent || 'v1' in ent || 'v2' in ent || 'v3' in ent) {
      for (const key of ['v0', 'v1', 'v2', 'v3']) {
        const v = (ent as any)[key]
        if (v) puntos.push([v.x || 0, v.y || 0, v.z || 0])
      }
    }

    entidades.push({
      id: generarId(),
      tipo,
      capa: (ent as any).layer || '0',
      color: (ent as any).color,
      puntos,
      datos: ent as Record<string, any>,
    })
  }

  return entidades
}

export function extraerCabecera(textoDXF: string): Record<string, string> {
  const cabecera: Record<string, string> = {}
  const lineas = textoDXF.split(/\r?\n/)
  for (let i = 0; i < lineas.length; i += 2) {
    const codigo = lineas[i]?.trim()
    const valor = lineas[i + 1]?.trim()
    if (codigo !== undefined && valor !== undefined) {
      cabecera[codigo] = valor
    }
  }
  return cabecera
}

/**
 * generator.ts — Traducción de instrucciones de IA a geometría DXF
 *
 * Convierte una representación paramétrica (JSON generada por la IA)
 * en entidades DXF normalizadas. Soporta primitivas 2D y 3D.
 */

import { escribirDXF } from './writer'

export type ParamPrimitive =
  | { tipo: 'rectangulo'; x: number; y: number; w: number; h: number; capa?: string }
  | { tipo: 'circulo'; cx: number; cy: number; r: number; capa?: string }
  | { tipo: 'linea'; x1: number; y1: number; x2: number; y2: number; capa?: string }
  | { tipo: 'poligono'; puntos: number[][]; capa?: string }
  | { tipo: 'placa'; w: number; h: number; espesor?: number; capa?: string }
  | { tipo: 'agujero'; cx: number; cy: number; d: number; capa?: string }

export interface ModeloParametrico {
  nombre: string
  unidades: 'mm' | 'pulgadas'
  primitivas: ParamPrimitive[]
}

/**
 * Convierte primitivas paramétricas en entidades DXF (líneas, círculos, 3DFACE)
 */
export function primitivasADXF(modelo: ModeloParametrico): string {
  const entidades: Array<{
    tipo: string
    capa: string
    puntos: number[][]
    datos?: Record<string, any>
    color?: number
  }> = []

  const capaBase = '0'

  for (const prim of modelo.primitivas) {
    const capa = prim.capa || capaBase

    switch (prim.tipo) {
      case 'rectangulo': {
        const { x, y, w, h } = prim
        entidades.push({
          tipo: 'LWPOLYLINE',
          capa,
          puntos: [
            [x, y, 0],
            [x + w, y, 0],
            [x + w, y + h, 0],
            [x, y + h, 0],
            [x, y, 0],
          ],
        })
        break
      }

      case 'circulo': {
        const { cx, cy, r } = prim
        entidades.push({
          tipo: 'CIRCLE',
          capa,
          puntos: [[cx, cy, 0], [cx + r, cy, 0]],
          datos: { radio: r },
        })
        break
      }

      case 'linea': {
        const { x1, y1, x2, y2 } = prim
        entidades.push({
          tipo: 'LINE',
          capa,
          puntos: [[x1, y1, 0], [x2, y2, 0]],
        })
        break
      }

      case 'poligono': {
        entidades.push({
          tipo: 'LWPOLYLINE',
          capa,
          puntos: prim.puntos.map((p) => [p[0], p[1], p[2] || 0]),
        })
        break
      }

      case 'placa': {
        const { w, h, espesor = 3 } = prim
        // Placa como rectángulo 2D + espesor como nota
        entidades.push({
          tipo: 'LWPOLYLINE',
          capa,
          puntos: [
            [0, 0, 0],
            [w, 0, 0],
            [w, h, 0],
            [0, h, 0],
            [0, 0, 0],
          ],
          datos: { espesor, tipoSolido: 'placa' },
        })
        // Texto con espesor
        entidades.push({
          tipo: 'TEXT',
          capa: 'NOTAS',
          puntos: [[w / 2, h / 2, 0]],
          datos: { texto: `Espesor: ${espesor} mm`, alto: 2.5 },
        })
        break
      }

      case 'agujero': {
        const { cx, cy, d } = prim
        const r = d / 2
        entidades.push({
          tipo: 'CIRCLE',
          capa,
          puntos: [[cx, cy, 0], [cx + r, cy, 0]],
          datos: { radio: r, tipo: 'agujero', diametro: d },
        })
        break
      }
    }
  }

  return escribirDXF(entidades, {
    unidades: modelo.unidades,
    nombreDibujo: modelo.nombre,
  })
}

/**
 * Genera un DXF de ejemplo "placa con agujeros" (útil para probar)
 */
export function ejemploPlacaConAgujeros(): string {
  return primitivasADXF({
    nombre: 'placa_ejemplo',
    unidades: 'mm',
    primitivas: [
      { tipo: 'placa', w: 100, h: 60, espesor: 3, capa: 'CONTORNO' },
      { tipo: 'agujero', cx: 10, cy: 10, d: 8, capa: 'AGUJEROS' },
      { tipo: 'agujero', cx: 90, cy: 10, d: 8, capa: 'AGUJEROS' },
      { tipo: 'agujero', cx: 10, cy: 50, d: 8, capa: 'AGUJEROS' },
      { tipo: 'agujero', cx: 90, cy: 50, d: 8, capa: 'AGUJEROS' },
    ],
  })
}

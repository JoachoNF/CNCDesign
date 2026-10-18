/**
 * edicion.ts — Ciclo completo de edición: texto DXF → entidades → transformar → texto DXF
 *
 * Normaliza las entidades que devuelve el parser al esquema que entiende
 * el escritor (radios, ángulos en grados, textos) para poder aplicar
 * transformaciones y volver a serializar. Solo se usa en el renderer.
 */

import { parsearDXF } from './parser'
import { escribirDXF } from './writer'
import type { EntidadEditable } from './transformaciones'

const RAD_A_GRADOS = 180 / Math.PI

/** Convierte texto DXF en entidades editables, o null si no es interpretable */
export function entidadesParaEdicion(textoDXF: string): EntidadEditable[] | null {
  try {
    const normalizadas = parsearDXF(textoDXF)

    return normalizadas.map((ent) => {
      const raw = (ent.datos || {}) as Record<string, any>
      const base: EntidadEditable = {
        tipo: ent.tipo,
        capa: ent.capa || '0',
        color: ent.color,
        puntos: ent.puntos,
        datos: {},
      }

      switch (ent.tipo) {
        case 'CIRCLE':
          base.datos = { radio: raw.radius ?? radioDesdeSegundoPunto(base.puntos) }
          break

        case 'ARC':
          base.datos = {
            radio: raw.radius ?? radioDesdeSegundoPunto(base.puntos) ?? 10,
            // El parser entrega ángulos en radianes; el DXF los usa en grados
            anguloInicio: (raw.startAngle ?? 0) * RAD_A_GRADOS,
            anguloFin: (raw.endAngle ?? Math.PI * 2) * RAD_A_GRADOS,
          }
          break

        case 'TEXT': {
          base.datos = {
            texto: raw.text ?? raw.value ?? '',
            alto: raw.textHeight ?? raw.height ?? 2.5,
          }
          if (raw.rotation) base.datos.rotacion = raw.rotation * RAD_A_GRADOS
          break
        }

        default:
          // LINE, LWPOLYLINE, POLYLINE, 3DFACE, SOLID… ya vienen en `puntos`
          break
      }

      return base
    })
  } catch (error) {
    console.error('[Edición] No se pudo interpretar el DXF para edición:', error)
    return null
  }
}

function radioDesdeSegundoPunto(puntos: number[][]): number | undefined {
  if (!puntos[0] || !puntos[1]) return undefined
  const dx = puntos[1][0] - puntos[0][0]
  const dy = puntos[1][1] - puntos[0][1]
  return Math.sqrt(dx * dx + dy * dy)
}

/** Serializa entidades editadas de vuelta a texto DXF */
export function entidadesADXF(
  entidades: EntidadEditable[],
  opciones: { unidades?: 'mm' | 'pulgadas'; nombreDibujo?: string } = {}
): string {
  return escribirDXF(entidades, opciones)
}

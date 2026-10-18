/**
 * writer.ts — Generación de texto .dxf a partir de entidades normalizadas
 *
 * Produce un DXF ASCII válido (R2010) compatible con la mayoría de CAM/CNC.
 */

export interface OpcionesWriter {
  unidades?: 'mm' | 'pulgadas'
  nombreDibujo?: string
  versionACAD?: 'AC1027' | 'AC1032' // R2013 / R2018
}

export function escribirDXF(
  entidades: Array<{
    tipo: string
    capa: string
    puntos: number[][]
    datos?: Record<string, any>
    color?: number
  }>,
  opciones: OpcionesWriter = {}
): string {
  const { unidades = 'mm', versionACAD = 'AC1027' } = opciones
  const lineas: string[] = []

  function grupo(codigo: string, valor: string | number) {
    lineas.push(codigo)
    lineas.push(String(valor))
  }

  // --- HEADER ---
  grupo('0', 'SECTION')
  grupo('2', 'HEADER')
  grupo('9', '$ACADVER')
  grupo('1', versionACAD)
  grupo('9', '$INSUNITS')
  grupo('70', unidades === 'mm' ? 4 : 6) // 4 = mm, 6 = inches
  grupo('0', 'ENDSEC')

  // --- TABLES ---
  grupo('0', 'SECTION')
  grupo('2', 'TABLES')
  grupo('0', 'TABLE')
  grupo('2', 'LAYER')
  grupo('70', '1')
  grupo('0', 'LAYER')
  grupo('2', '0')
  grupo('70', '0')
  grupo('62', '7')
  grupo('0', 'ENDTAB')
  grupo('0', 'ENDSEC')

  // --- BLOCKS ---
  grupo('0', 'SECTION')
  grupo('2', 'BLOCKS')
  grupo('0', 'ENDSEC')

  // --- ENTITIES ---
  grupo('0', 'SECTION')
  grupo('2', 'ENTITIES')

  for (const ent of entidades) {
    grupo('0', ent.tipo)
    grupo('8', ent.capa)
    if (ent.color !== undefined) grupo('62', ent.color)

    switch (ent.tipo) {
      case 'LINE':
        if (ent.puntos[0]) {
          grupo('10', ent.puntos[0][0])
          grupo('20', ent.puntos[0][1])
          grupo('30', ent.puntos[0][2] || 0)
        }
        if (ent.puntos[1]) {
          grupo('11', ent.puntos[1][0])
          grupo('21', ent.puntos[1][1])
          grupo('31', ent.puntos[1][2] || 0)
        }
        break

      case 'CIRCLE':
        if (ent.puntos[0]) {
          grupo('10', ent.puntos[0][0])
          grupo('20', ent.puntos[0][1])
          grupo('30', ent.puntos[0][2] || 0)
        }
        if (ent.datos?.radio !== undefined) {
          grupo('40', ent.datos.radio)
        } else if (ent.puntos[1]) {
          // radio = distancia centro a punto
          const dx = ent.puntos[1][0] - ent.puntos[0][0]
          const dy = ent.puntos[1][1] - ent.puntos[0][1]
          grupo('40', Math.sqrt(dx * dx + dy * dy))
        }
        break

      case 'ARC':
        if (ent.puntos[0]) {
          grupo('10', ent.puntos[0][0])
          grupo('20', ent.puntos[0][1])
          grupo('30', ent.puntos[0][2] || 0)
        }
        grupo('40', ent.datos?.radio || 10)
        grupo('50', ent.datos?.anguloInicio || 0)
        grupo('51', ent.datos?.anguloFin || 360)
        break

      case 'LWPOLYLINE':
      case 'POLYLINE':
        grupo('90', ent.puntos.length)
        for (const p of ent.puntos) {
          grupo('10', p[0])
          grupo('20', p[1])
          grupo('30', p[2] || 0)
        }
        break

      case '3DFACE':
        for (let i = 0; i < 4; i++) {
          const p = ent.puntos[i]
          if (p) {
            grupo(`1${i}`, p[0])
            grupo(`2${i}`, p[1])
            grupo(`3${i}`, p[2] || 0)
          }
        }
        break

      case 'TEXT':
        if (ent.puntos[0]) {
          grupo('10', ent.puntos[0][0])
          grupo('20', ent.puntos[0][1])
          grupo('30', ent.puntos[0][2] || 0)
        }
        grupo('40', ent.datos?.alto || 2.5)
        if (ent.datos?.rotacion) grupo('50', ent.datos.rotacion)
        grupo('1', ent.datos?.texto || '')
        break

      case 'SOLID':
        for (let i = 0; i < 4; i++) {
          const p = ent.puntos[i]
          if (p) {
            grupo(`1${i}`, p[0])
            grupo(`2${i}`, p[1])
            grupo(`3${i}`, p[2] || 0)
          }
        }
        break

      default:
        // Entidad genérica: escribir puntos conocidos
        for (let i = 0; i < Math.min(ent.puntos.length, 4); i++) {
          const p = ent.puntos[i]
          if (p) {
            grupo(`1${i}`, p[0])
            grupo(`2${i}`, p[1])
            grupo(`3${i}`, p[2] || 0)
          }
        }
        break
    }
  }

  grupo('0', 'ENDSEC')
  grupo('0', 'EOF')

  return lineas.join('\n')
}

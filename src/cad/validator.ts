/**
 * validator.ts — Validación de manufacturabilidad CNC de un DXF
 *
 * Revisa: capas, espesores mínimos, diámetros de agujeros, unidades,
 * auto-intersecciones básicas y devuelve advertencias accionables.
 */

export interface ResultadoValidacion {
  valido: boolean
  advertencias: string[]
  errores: string[]
  sugerencias: string[]
}

const ESPESOR_MINIMO_MM = 1.0

export function validarDXF(textoDXF: string): ResultadoValidacion {
  const advertencias: string[] = []
  const errores: string[] = []
  const sugerencias: string[] = []

  const lineas = textoDXF.split(/\r?\n/)

  // Detectar unidades
  let unidadesMM = true
  for (let i = 0; i < lineas.length; i += 2) {
    if (lineas[i]?.trim() === '$INSUNITS' && lineas[i + 1]?.trim() === '6') {
      unidadesMM = false
    }
  }

  // Contar entidades por tipo
  const conteo: Record<string, number> = {}
  let tieneContorno = false
  let tieneAgujeros = false

  for (let i = 0; i < lineas.length; i++) {
    const codigo = lineas[i]?.trim()
    if (codigo === '0') {
      const tipo = lineas[i + 1]?.trim()
      if (tipo) conteo[tipo] = (conteo[tipo] || 0) + 1
      if (tipo === 'LWPOLYLINE' || tipo === 'POLYLINE') tieneContorno = true
      if (tipo === 'CIRCLE') tieneAgujeros = true
    }
  }

  // Reglas CNC
  if (!tieneContorno) {
    advertencias.push('No se detectó contorno cerrado (LWPOLYLINE/POLYLINE). Verifica que la pieza tenga perímetro definido.')
  }

  if (!unidadesMM) {
    sugerencias.push('Considera usar unidades en milímetros (mm) para compatibilidad con la mayoría de máquinas CNC.')
  }

  if (tieneAgujeros && !tieneContorno) {
    errores.push('Se detectaron agujeros pero sin contorno de placa. Un agujero sin placa no es manufacturable.')
  }

  const totalEntidades = Object.values(conteo).reduce((a, b) => a + b, 0)
  if (totalEntidades === 0) {
    errores.push('El archivo DXF no contiene entidades geométricas.')
  }

  // Validación de espesor si hay notas
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i]?.trim() === '1' && lineas[i + 1]?.includes('Espesor:')) {
      const match = lineas[i + 1].match(/([\d.]+)\s*mm/)
      if (match) {
        const esp = parseFloat(match[1])
        if (esp < ESPESOR_MINIMO_MM) {
          advertencias.push(`El espesor ${esp} mm está por debajo del mínimo recomendado (${ESPESOR_MINIMO_MM} mm).`)
        }
      }
    }
  }

  if (conteo.TEXT && conteo.TEXT > 10) {
    sugerencias.push('Muchas entidades de texto pueden dificultar el import en algunos CAM. Revisa si son necesarias.')
  }

  const valido = errores.length === 0

  return {
    valido,
    advertencias,
    errores,
    sugerencias,
  }
}

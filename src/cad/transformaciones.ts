/**
 * transformaciones.ts — Operaciones geométricas 2D sobre entidades DXF
 *
 * Funciones puras (sin dependencias externas) que devuelven NUEVAS listas
 * de entidades. Las usan las herramientas de edición del visor.
 */

export interface EntidadEditable {
  tipo: string
  capa: string
  color?: number
  puntos: number[][]
  datos?: Record<string, any>
}

export interface Caja2D {
  minX: number
  minY: number
  maxX: number
  maxY: number
  /** Centro horizontal de la caja */
  cx: number
  /** Centro vertical de la caja */
  cy: number
}

/** Caja envolvente 2D (plano XY) de todas las entidades */
export function caja(entidades: EntidadEditable[]): Caja2D {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const ent of entidades) {
    for (const p of ent.puntos) {
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue
      minX = Math.min(minX, p[0])
      minY = Math.min(minY, p[1])
      maxX = Math.max(maxX, p[0])
      maxY = Math.max(maxY, p[1])
    }
  }

  // Sin puntos válidos: caja unidad centrada en el origen
  if (!Number.isFinite(minX)) {
    minX = minY = -1
    maxX = maxY = 1
  }

  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

/** Copia profunda de las entidades (para no mutar el original) */
function clonar(entidades: EntidadEditable[]): EntidadEditable[] {
  return entidades.map((e) => ({
    ...e,
    puntos: e.puntos.map((p) => [p[0], p[1], p[2] ?? 0]),
    datos: e.datos ? { ...e.datos } : undefined,
  }))
}

function mod360(angulo: number): number {
  return ((angulo % 360) + 360) % 360
}

const DEG = Math.PI / 180

/** Traslada todas las entidades (desplazamiento dx, dy, dz en mm) */
export function trasladar(
  entidades: EntidadEditable[],
  dx: number,
  dy: number,
  dz = 0
): EntidadEditable[] {
  const salida = clonar(entidades)
  for (const ent of salida) {
    for (const p of ent.puntos) {
      p[0] += dx
      p[1] += dy
      p[2] = (p[2] || 0) + dz
    }
  }
  return salida
}

/** Rota en el plano XY (grados, sentido antihorario) alrededor de un centro */
export function rotar(
  entidades: EntidadEditable[],
  grados: number,
  centro?: { x: number; y: number }
): EntidadEditable[] {
  const bbox = caja(entidades)
  const c = centro ?? { x: bbox.cx, y: bbox.cy }
  const theta = grados * DEG
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)

  const salida = clonar(entidades)
  for (const ent of salida) {
    for (const p of ent.puntos) {
      const x = p[0] - c.x
      const y = p[1] - c.y
      p[0] = c.x + x * cos - y * sin
      p[1] = c.y + x * sin + y * cos
    }
    // Los ángulos de arco son absolutos: se desplazan con la rotación
    if (ent.tipo === 'ARC' && ent.datos) {
      ent.datos.anguloInicio = mod360((ent.datos.anguloInicio ?? 0) + grados)
      ent.datos.anguloFin = mod360((ent.datos.anguloFin ?? 360) + grados)
    }
    // Los textos conservan su orientación relativa
    if (ent.tipo === 'TEXT' && ent.datos) {
      ent.datos.rotacion = mod360((ent.datos.rotacion ?? 0) + grados)
    }
  }
  return salida
}

/** Escala uniformemente (factor) alrededor de un centro */
export function escalar(
  entidades: EntidadEditable[],
  factor: number,
  centro?: { x: number; y: number }
): EntidadEditable[] {
  const bbox = caja(entidades)
  const c = centro ?? { x: bbox.cx, y: bbox.cy }

  const salida = clonar(entidades)
  for (const ent of salida) {
    for (const p of ent.puntos) {
      p[0] = c.x + (p[0] - c.x) * factor
      p[1] = c.y + (p[1] - c.y) * factor
    }
    if (ent.datos?.radio !== undefined) ent.datos.radio *= factor
    if (ent.datos?.alto !== undefined) ent.datos.alto *= factor
  }
  return salida
}

/**
 * Espeja respecto a un eje:
 *  - eje 'x' → voltea horizontalmente (izq↔der), refleja la coordenada X
 *  - eje 'y' → voltea verticalmente (arriba↔abajo), refleja la coordenada Y
 */
export function espejar(
  entidades: EntidadEditable[],
  eje: 'x' | 'y',
  centro?: { x: number; y: number }
): EntidadEditable[] {
  const bbox = caja(entidades)
  const c = centro ?? { x: bbox.cx, y: bbox.cy }

  const salida = clonar(entidades)
  for (const ent of salida) {
    for (const p of ent.puntos) {
      if (eje === 'x') p[0] = 2 * c.x - p[0]
      else p[1] = 2 * c.y - p[1]
    }

    if (ent.tipo === 'ARC' && ent.datos) {
      const inicio = ent.datos.anguloInicio ?? 0
      const fin = ent.datos.anguloFin ?? 360
      if (eje === 'x') {
        ent.datos.anguloInicio = mod360(180 - fin)
        ent.datos.anguloFin = mod360(180 - inicio)
      } else {
        ent.datos.anguloInicio = mod360(-fin)
        ent.datos.anguloFin = mod360(-inicio)
      }
    }

    if (ent.tipo === 'TEXT' && ent.datos?.rotacion) {
      ent.datos.rotacion = mod360(-ent.datos.rotacion)
    }
  }
  return salida
}

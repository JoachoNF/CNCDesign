/**
 * interpretador.ts — Intérprete local de instrucciones de modelado en lenguaje natural
 *
 * Sustituye al antiguo "modo demo" que devolvía siempre una placa de ejemplo.
 * Traduce la petición del usuario (en español) a entidades DXF reales y, si hay
 * un modelo cargado, aplica la modificación sobre ESE archivo (el "destino").
 *
 * Es código puro de Node: NO importa `dxf-render/parser` (solo-ESM) para que
 * pueda ejecutarse desde el proceso principal de Electron (CommonJS).
 */

import { escribirDXF } from './writer'
import { validarDXF } from './validator'
import { caja, trasladar, rotar, espejar, type EntidadEditable } from './transformaciones'

// ===================== LECTURA PURA DE DXF (ENTITIES) =====================

/** Lee un DXF ASCII y devuelve sus entidades en el esquema del escritor local. */
export function leerEntidadesDXF(texto: string): EntidadEditable[] {
  const lineas = texto.split(/\r?\n/)
  const pares: Array<[string, string]> = []
  for (let i = 0; i + 1 < lineas.length; i += 2) {
    pares.push([lineas[i].trim(), lineas[i + 1]])
  }

  let inicio = -1
  let fin = pares.length
  for (let i = 0; i < pares.length - 1; i++) {
    if (
      pares[i][0] === '0' &&
      pares[i][1] === 'SECTION' &&
      pares[i + 1][0] === '2' &&
      pares[i + 1][1] === 'ENTITIES'
    ) {
      inicio = i + 2
      break
    }
  }
  if (inicio < 0) return []
  for (let i = inicio; i < pares.length - 1; i++) {
    if (pares[i][0] === '0' && pares[i][1] === 'ENDSEC') {
      fin = i
      break
    }
  }

  const salida: EntidadEditable[] = []
  let i = inicio
  while (i < fin) {
    if (pares[i][0] !== '0') {
      i++
      continue
    }
    const tipo = pares[i][1].toUpperCase()
    if (tipo === 'ENDSEC') break

    let j = i + 1
    while (j < fin && pares[j][0] !== '0') j++

    const campos: Record<string, string[]> = {}
    for (let k = i + 1; k < j; k++) {
      const codigo = pares[k][0]
      ;(campos[codigo] ||= []).push(pares[k][1])
    }

    const capa = campos['8']?.[0] || '0'
    const color = campos['62']?.[0] !== undefined ? parseInt(campos['62'][0], 10) : undefined
    const val = (codigo: string, indice = 0) => campos[codigo]?.[indice]
    const numero = (codigo: string, indice = 0, defecto = 0) => {
      const v = val(codigo, indice)
      const n = v === undefined ? NaN : parseFloat(v)
      return Number.isFinite(n) ? n : defecto
    }

    const entidad: EntidadEditable = { tipo, capa, puntos: [], datos: {} }

    switch (tipo) {
      case 'LINE':
        entidad.puntos = [
          [numero('10'), numero('20'), numero('30')],
          [numero('11'), numero('21'), numero('31')],
        ]
        break

      case 'CIRCLE':
      case 'ARC': {
        const cx = numero('10')
        const cy = numero('20')
        const radio = numero('40', 0, 10)
        entidad.puntos = [
          [cx, cy, numero('30')],
          [cx + radio, cy, numero('30')],
        ]
        entidad.datos = { radio }
        if (tipo === 'ARC') {
          entidad.datos.anguloInicio = numero('50')
          entidad.datos.anguloFin = numero('51', 0, 360)
        }
        break
      }

      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const xs = campos['10'] || []
        const ys = campos['20'] || []
        const zs = campos['30'] || []
        for (let k = 0; k < xs.length; k++) {
          entidad.puntos.push([parseFloat(xs[k]) || 0, parseFloat(ys[k]) || 0, parseFloat(zs[k]) || 0])
        }
        // POLYLINE clásico: los vértices vienen como entidades VERTEX posteriores
        if (tipo === 'POLYLINE') {
          while (j < fin && pares[j][0] === '0' && pares[j][1].toUpperCase() === 'VERTEX') {
            let k = j + 1
            const vc: Record<string, string[]> = {}
            while (k < fin && pares[k][0] !== '0') {
              ;(vc[pares[k][0]] ||= []).push(pares[k][1])
              k++
            }
            entidad.puntos.push([
              parseFloat(vc['10']?.[0] || '0') || 0,
              parseFloat(vc['20']?.[0] || '0') || 0,
              parseFloat(vc['30']?.[0] || '0') || 0,
            ])
            j = k
            if (j < fin && pares[j][0] === '0' && pares[j][1].toUpperCase() === 'SEQEND') {
              let m = j + 1
              while (m < fin && pares[m][0] !== '0') m++
              j = m
              break
            }
          }
        }
        break
      }

      case 'TEXT':
        entidad.puntos = [[numero('10'), numero('20'), numero('30')]]
        entidad.datos = {
          texto: val('1') || '',
          alto: numero('40', 0, 2.5),
          rotacion: numero('50'),
        }
        break

      case '3DFACE':
      case 'SOLID': {
        for (let k = 0; k < 4; k++) {
          if (val(`1${k}`) !== undefined) {
            entidad.puntos.push([numero(`1${k}`), numero(`2${k}`), numero(`3${k}`)])
          }
        }
        break
      }

      default:
        if (val('10') !== undefined) entidad.puntos.push([numero('10'), numero('20'), numero('30')])
        break
    }

    if (color !== undefined) entidad.color = color
    salida.push(entidad)
    i = j
  }

  return salida
}

// ===================== UTILIDADES DE TEXTO =====================

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[×x](?=\s*\d)/g, ' por ')
    .replace(/(\d),(\d)/g, '$1.$2')
}

const NUM = '(\\d+(?:\\.\\d+)?)'

function primerNumero(texto: string, expresion: RegExp): number | undefined {
  const m = texto.match(expresion)
  if (!m) return undefined
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : undefined
}

const PALABRAS_NUMERO: Record<string, number> = {
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  doce: 12,
}

// ===================== ESPECIFICACIÓN DE LA PIEZA =====================

type Forma = 'rectangulo' | 'cuadrado' | 'circulo' | 'poligono' | 'triangulo' | 'linea' | 'texto'
type PatronAgujeros = 'esquinas' | 'circulo' | 'centro' | 'hilera' | 'cuadricula'

interface Especificacion {
  forma: Forma
  ancho: number
  alto: number
  lados: number
  espesor: number
  agujeros: number
  diametroAgujero: number
  patron: PatronAgujeros
  margen: number
  texto: string
}

function detectarForma(t: string): Forma {
  if (/\b(circulo|disco|redondo|circular|aro|rondana)\b/.test(t)) return 'circulo'
  if (/\b(triangulo)\b/.test(t)) return 'triangulo'
  if (/\b(hexagono|octagono|pentagono|poligono)\b/.test(t)) return 'poligono'
  if (/\b(cuadrado|cuadrada)\b/.test(t)) return 'cuadrado'
  if (/\b(linea|segmento|trazo)\b/.test(t) && !/\b(placa|rectangulo|lineal)\b/.test(t)) return 'linea'
  if (/\b(texto|etiqueta|rotulo|letrero)\b/.test(t)) return 'texto'
  return 'rectangulo'
}

function interpretarEspecificacion(prompt: string): Especificacion {
  const t = normalizar(prompt)
  const forma = detectarForma(t)

  const espec: Especificacion = {
    forma,
    ancho: 100,
    alto: 60,
    lados: 6,
    espesor: 3,
    agujeros: 0,
    diametroAgujero: 8,
    patron: 'esquinas',
    margen: 10,
    texto: 'CNCDesign',
  }

  // Medidas principales: "100 x 60", "100 por 60", "100×60"
  const medidas = t.match(new RegExp(`${NUM}\\s*(?:por|x)\\.?\\s*${NUM}`))
  const medidaSimple = primerNumero(t, new RegExp(`\\bde\\s+${NUM}`))
  if (medidas) {
    espec.ancho = parseFloat(medidas[1])
    espec.alto = parseFloat(medidas[2])
  } else if ((forma === 'poligono' || forma === 'triangulo' || forma === 'linea') && medidaSimple !== undefined) {
    espec.ancho = espec.alto = medidaSimple
  } else {
    const ancho = primerNumero(t, new RegExp(`(?:ancho|largo|base|horizontal)\\s*(?:de|en)?\\s*${NUM}`))
    const alto = primerNumero(t, new RegExp(`(?:alto|altura|vertical)\\s*(?:de|en)?\\s*${NUM}`))
    if (ancho !== undefined) espec.ancho = ancho
    if (alto !== undefined) espec.alto = alto
    if (ancho !== undefined && alto === undefined && /\b(cuadrado|cuadrada)\b/.test(t)) {
      espec.alto = ancho
    }
  }

  // Círculos: diámetro / radio o "círculo de 80"
  if (forma === 'circulo') {
    const diametro =
      primerNumero(t, new RegExp(`(?:diametro|diam\\.?|o)\\s*(?:de|=)?\\s*${NUM}`)) ??
      primerNumero(t, new RegExp(`\\bde\\s+${NUM}`))
    const radio = primerNumero(t, new RegExp(`radio\\s*(?:de|=)?\\s*${NUM}`))
    if (radio !== undefined) {
      espec.ancho = espec.alto = radio * 2
    } else if (diametro !== undefined) {
      espec.ancho = espec.alto = diametro
    }
    espec.alto = espec.ancho
  }

  // Polígonos regulares: número de lados y longitud del lado
  if (forma === 'poligono' || forma === 'triangulo') {
    if (forma === 'triangulo') espec.lados = 3
    else {
      const lados =
        primerNumero(t, new RegExp(`(?:de\\s+)?${NUM}\\s*lados?`)) ??
        primerNumero(t, new RegExp(`lados?\\s*(?:de|:|=)?\\s*${NUM}`))
      if (lados && lados >= 3 && lados <= 24) espec.lados = Math.round(lados)
    }
    const lado =
      primerNumero(t, new RegExp(`lado\\s*(?:de|=)?\\s*${NUM}`)) ??
      primerNumero(t, new RegExp(`${NUM}\\s*(?:mm\\s*)?(?:por|de)\\s*lado`))
    if (lado !== undefined) {
      const circunradio = lado / (2 * Math.sin(Math.PI / espec.lados))
      espec.ancho = espec.alto = circunradio * 2
    }
  }

  if (forma === 'cuadrado') {
    const lado =
      primerNumero(t, new RegExp(`lado\\s*(?:de|=)?\\s*${NUM}`)) ??
      primerNumero(t, new RegExp(`${NUM}\\s*(?:mm\\s*)?(?:por|de)\\s*lado`)) ??
      medidaSimple
    if (lado !== undefined) espec.ancho = espec.alto = lado
    else if (medidas) espec.alto = espec.ancho
  }

  if (forma === 'linea' && medidaSimple !== undefined) {
    espec.ancho = medidaSimple
  }

  // Agujeros: cantidad (dígito o palabra) y diámetro
  const cantidadDigito = primerNumero(t, new RegExp(`${NUM}\\s*agujeros?`))
  let cantidad = cantidadDigito
  if (cantidad === undefined) {
    for (const [palabra, valor] of Object.entries(PALABRAS_NUMERO)) {
      if (new RegExp(`\\b${palabra}\\s+agujeros?\\b`).test(t)) {
        cantidad = valor
        break
      }
    }
  }
  if (/\bagujeros?\b/.test(t)) espec.agujeros = cantidad ?? 4

  const diametroAgujero =
    primerNumero(t, new RegExp(`agujeros?\\s+(?:de|del|de diametro|de un diametro de)\\s*${NUM}`)) ??
    primerNumero(t, new RegExp(`${NUM}\\s*mm\\s+(?:de\\s+)?(?:diametro|agujeros?)`))
  if (diametroAgujero !== undefined) espec.diametroAgujero = diametroAgujero

  const espesor = primerNumero(t, new RegExp(`espesor\\s*(?:de|,)?\\s*${NUM}`))
  if (espesor !== undefined) espec.espesor = espesor

  const margen = primerNumero(t, new RegExp(`(?:margen|borde)\\s*(?:de|:)?\\s*${NUM}`))
  if (margen !== undefined) espec.margen = margen

  // Patrón de distribución
  if (/\b(centro|central)\b/.test(t)) espec.patron = 'centro'
  else if (/\b(circulo|circular|ronda|corona)\b/.test(t) && /\bagujer/.test(t)) espec.patron = 'circulo'
  else if (/\b(hilera|linea|lineal|fila)\b/.test(t)) espec.patron = 'hilera'
  else if (/\b(cuadricula|grid|rejilla)\b/.test(t)) espec.patron = 'cuadricula'
  else if (/\besquina/.test(t)) espec.patron = 'esquinas'

  if (espec.agujeros === 1 && espec.patron !== 'centro') espec.patron = 'centro'

  // Texto a grabar
  const texto = prompt.match(/(?:texto|etiqueta|rotulo|dice|poner)\s*["'“]?([^"“”']{2,40})["'”]?/i)
  if (texto) espec.texto = texto[1].trim()

  return espec
}

// ===================== CONSTRUCCIÓN DE ENTIDADES =====================

function entidad(tipo: string, capa: string, puntos: number[][], datos?: Record<string, any>): EntidadEditable {
  return { tipo, capa, puntos, datos }
}

/** Formatea medidas sin arrastrar decimales de cálculos trigonométricos. */
function fmt(numero: number): string {
  return String(Number(numero.toFixed(2)))
}

function poligonoRegular(lados: number, radio: number, capa: string): EntidadEditable {
  const puntos: number[][] = []
  for (let i = 0; i <= lados; i++) {
    const angulo = (i / lados) * Math.PI * 2 - Math.PI / 2
    puntos.push([radio * Math.cos(angulo), radio * Math.sin(angulo), 0])
  }
  return entidad('LWPOLYLINE', capa, puntos)
}

function contorno(espec: Especificacion): EntidadEditable {
  const { ancho, alto, margen } = espec
  switch (espec.forma) {
    case 'circulo': {
      const radio = ancho / 2
      return entidad('CIRCLE', 'CONTORNO', [[0, 0, 0], [radio, 0, 0]], { radio, tipoSolido: 'disco' })
    }
    case 'poligono':
    case 'triangulo':
      return poligonoRegular(espec.lados, ancho / 2, 'CONTORNO')
    case 'linea':
      return entidad('LINE', 'CONTORNO', [[-ancho / 2, 0, 0], [ancho / 2, 0, 0]])
    default: {
      const x = -ancho / 2
      const y = -alto / 2
      return entidad('LWPOLYLINE', 'CONTORNO', [
        [x, y, 0],
        [x + ancho, y, 0],
        [x + ancho, y + alto, 0],
        [x, y + alto, 0],
        [x, y, 0],
      ])
    }
  }
}

function posicionesAgujeros(espec: Especificacion): Array<[number, number]> {
  const { ancho, alto, margen, agujeros, patron } = espec
  const mx = ancho / 2 - margen
  const my = alto / 2 - margen
  const puntos: Array<[number, number]> = []

  switch (patron) {
    case 'centro':
      puntos.push([0, 0])
      break
    case 'esquinas':
      puntos.push([-mx, -my], [mx, -my], [mx, my], [-mx, my])
      if (agujeros > 4) {
        const extras = agujeros - 4
        for (let i = 0; i < extras; i++) puntos.push([-mx + ((i + 1) * (2 * mx)) / (extras + 1), 0])
      }
      break
    case 'hilera':
      for (let i = 0; i < agujeros; i++) {
        puntos.push([-mx + (i * 2 * mx) / Math.max(agujeros - 1, 1), 0])
      }
      break
    case 'cuadricula': {
      const columnas = Math.ceil(Math.sqrt(agujeros))
      const filas = Math.ceil(agujeros / columnas)
      for (let f = 0; f < filas; f++) {
        for (let c = 0; c < columnas && puntos.length < agujeros; c++) {
          puntos.push([
            -mx + (c * 2 * mx) / Math.max(columnas - 1, 1),
            -my + (f * 2 * my) / Math.max(filas - 1, 1),
          ])
        }
      }
      break
    }
    case 'circulo':
    default: {
      const radio = Math.min(mx, my)
      for (let i = 0; i < agujeros; i++) {
        const angulo = (i / agujeros) * Math.PI * 2
        puntos.push([radio * Math.cos(angulo), radio * Math.sin(angulo)])
      }
      break
    }
  }

  return puntos.slice(0, Math.max(agujeros, puntos.length))
}

function entidadesAgujeros(espec: Especificacion): EntidadEditable[] {
  const radio = espec.diametroAgujero / 2
  return posicionesAgujeros(espec)
    .slice(0, espec.agujeros)
    .map(([x, y]) =>
      entidad('CIRCLE', 'AGUJEROS', [[x, y, 0], [x + radio, y, 0]], {
        radio,
        tipo: 'agujero',
        diametro: espec.diametroAgujero,
      })
    )
}

function notaEspesor(espec: Especificacion): EntidadEditable {
  return entidad('TEXT', 'NOTAS', [[-espec.ancho / 2, -espec.alto / 2 - 8, 0]], {
    texto: `${espec.forma === 'circulo' ? 'Disco' : 'Pieza'} ${fmt(espec.ancho)} x ${fmt(espec.alto)} mm · Espesor: ${espec.espesor} mm`,
    alto: 2.5,
  })
}

function notaTexto(espec: Especificacion): EntidadEditable {
  return entidad('TEXT', 'NOTAS', [[0, espec.alto / 2 + 6, 0]], {
    texto: espec.texto,
    alto: Math.max(2.5, espec.alto / 12),
  })
}

function serializar(entidades: EntidadEditable[], nombre: string): string {
  return escribirDXF(entidades, { unidades: 'mm', nombreDibujo: nombre })
}

/** Crea un modelo nuevo a partir de la instrucción. */
function crearModelo(prompt: string): { dxf: string; descripcion: string; advertencias: string[] } {
  const espec = interpretarEspecificacion(prompt)
  const entidades: EntidadEditable[] = [contorno(espec)]

  if (espec.forma !== 'linea' && espec.forma !== 'texto') {
    entidades.push(notaEspesor(espec))
  }
  if (espec.agujeros > 0) entidades.push(...entidadesAgujeros(espec))
  if (espec.forma === 'texto') entidades.push(notaTexto(espec))

  const nombres: Record<Forma, string> = {
    rectangulo: 'rectangulo',
    cuadrado: 'cuadrado',
    circulo: 'circulo',
    poligono: `poligono-${espec.lados}lados`,
    triangulo: 'triangulo',
    linea: 'linea',
    texto: 'texto',
  }

  const partes = [`${nombres[espec.forma]} de ${fmt(espec.ancho)} x ${fmt(espec.alto)} mm`]
  if (espec.agujeros > 0) {
    partes.push(`${espec.agujeros} agujero(s) de Ø${espec.diametroAgujero} mm en ${espec.patron}`)
  }
  if (espec.forma === 'poligono' || espec.forma === 'triangulo') {
    const lado = 2 * (espec.ancho / 2) * Math.sin(Math.PI / espec.lados)
    partes.push(`${espec.lados} lados de ${lado.toFixed(1)} mm`)
  }
  const descripcion = partes.join(' · ')

  const validacion = validarDXF(serializar(entidades, 'modelo-local'))
  // Un CIRCLE es un contorno cerrado por sí mismo: el validador genérico solo
  // busca LWPOLYLINE, así que se descarta ese aviso cuando la forma es circular.
  const advertencias = [...validacion.advertencias, ...validacion.sugerencias].filter(
    (a) => !(espec.forma === 'circulo' && a.includes('No se detectó contorno cerrado'))
  )
  return {
    dxf: serializar(entidades, 'modelo-local'),
    descripcion,
    advertencias: advertencias.slice(0, 3),
  }
}

/** Determina si un círculo del DXF es un agujero (y no el contorno). */
function esAgujero(ent: EntidadEditable, bbox: ReturnType<typeof caja>): boolean {
  if (ent.tipo !== 'CIRCLE') return false
  if (/agujer/i.test(ent.capa)) return true
  if (ent.datos?.tipo === 'agujero') return true
  const radio = ent.datos?.radio ?? 10
  const maxLado = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, 1)
  return radio <= maxLado * 0.2 && !/contorno/i.test(ent.capa)
}

function esContorno(ent: EntidadEditable): boolean {
  return (
    ent.tipo === 'LWPOLYLINE' ||
    ent.tipo === 'POLYLINE' ||
    (ent.tipo === 'CIRCLE' && /contorno/i.test(ent.capa))
  )
}

function redimensionar(entidades: EntidadEditable[], ancho: number, alto: number): EntidadEditable[] {
  const b = caja(entidades)
  const sx = ancho / Math.max(b.maxX - b.minX, 1e-6)
  const sy = alto / Math.max(b.maxY - b.minY, 1e-6)
  return entidades.map((e) => ({
    ...e,
    puntos: e.puntos.map((p) => [b.cx + (p[0] - b.cx) * sx, b.cy + (p[1] - b.cy) * sy, p[2] ?? 0]),
    datos:
      e.datos?.radio !== undefined
        ? { ...e.datos, radio: e.datos.radio * Math.min(sx, sy) }
        : e.datos,
  }))
}

/**
 * Aplica la instrucción sobre el DXF destino (modelo actual).
 * Devuelve null cuando no se reconoce ninguna operación de edición.
 */
function modificarModelo(
  prompt: string,
  dxfActual: string
): { dxf: string; descripcion: string; advertencias: string[] } | null {
  const t = normalizar(prompt)
  const entidades = leerEntidadesDXF(dxfActual)
  if (entidades.length === 0) return null
  const bbox = caja(entidades)
  const espec = interpretarEspecificacion(prompt)
  let resultado: EntidadEditable[] = entidades
  let descripcion = ''

  const gradosDetectados = primerNumero(t, new RegExp(`${NUM}\\s*grados?`))

  if (/\b(quitar|eliminar|borrar|sacar|suprimir)\b/.test(t) && /\bagujer/.test(t)) {
    resultado = entidades.filter((e) => !esAgujero(e, bbox))
    descripcion = 'Se eliminaron los agujeros del modelo destino'
  } else if (/\b(anadir|agregar|poner|hacer|taladrar)\b/.test(t) && /\bagujer/.test(t)) {
    // Si ya hay agujeros, los nuevos van en hilera para no solaparse con los existentes
    const yaHayAgujeros = entidades.some((e) => esAgujero(e, bbox))
    const nuevos = entidadesAgujeros(yaHayAgujeros ? { ...espec, patron: 'hilera' } : espec)
    resultado = [...entidades, ...nuevos]
    descripcion = `Se añadieron ${nuevos.length} agujero(s) de Ø${espec.diametroAgujero} mm (${espec.patron})`
  } else if (/\b(rotar|girar)\b/.test(t)) {
    const grados = gradosDetectados ?? 90
    resultado = rotar(entidades, grados)
    descripcion = `Se rotó el modelo ${grados}°`
  } else if (/\b(espejar|reflejar)\b/.test(t)) {
    const eje = /vertical|\by\b/.test(t) ? 'y' : 'x'
    resultado = espejar(entidades, eje)
    descripcion = `Se aplicó un espejo respecto al eje ${eje}`
  } else if (/\b(mover|desplazar|trasladar)\b/.test(t)) {
    const nums = [...t.matchAll(new RegExp(NUM, 'g'))].map((m) => parseFloat(m[1]))
    const dx = nums[0] ?? 0
    const dy = nums[1] ?? 0
    resultado = trasladar(entidades, dx, dy)
    descripcion = `Se desplazó el modelo (${dx}, ${dy}) mm`
  } else if (/\b(cambiar|modificar|convertir|hacer|redimensionar|agrandar|reducir)\b/.test(t) && /\b(forma|circulo|cuadrado|triangulo|hexagono|poligono)\b/.test(t)) {
    const especContorno = { ...espec, agujeros: 0 }
    resultado = [...entidades.filter((e) => !esContorno(e) && !esAgujero(e, bbox)), contorno(especContorno)]
    descripcion = `Se cambió la forma del contorno a ${espec.forma} de ${fmt(espec.ancho)} x ${fmt(espec.alto)} mm`
  } else if (/\b(cambiar|modificar|ajustar|hacer de|redimensionar|agrandar|reducir|tamaño|medidas?)\b/.test(t)) {
    if (medidasDetectadas(prompt)) {
      resultado = redimensionar(entidades, espec.ancho, espec.alto)
      descripcion = `Se redimensionó el modelo destino a ${fmt(espec.ancho)} x ${fmt(espec.alto)} mm`
    } else {
      return null
    }
  } else {
    return null
  }

  const dxf = serializar(resultado, 'modelo-editado')
  const validacion = validarDXF(dxf)
  return {
    dxf,
    descripcion,
    advertencias: [...validacion.advertencias, ...validacion.sugerencias].slice(0, 3),
  }
}

function medidasDetectadas(prompt: string): boolean {
  const t = normalizar(prompt)
  return (
    new RegExp(`${NUM}\\s*(?:por|x)\\.?\\s*${NUM}`).test(t) ||
    /\b(ancho|alto|altura|largo|medidas?|tamaño)\b/.test(t)
  )
}

/**
 * Punto de entrada usado por el router cuando no hay proveedor de IA disponible.
 * Siempre devuelve geometría acorde a la instrucción (nunca la placa de ejemplo).
 */
export function resolverConsultaLocal(
  prompt: string,
  modeloActual?: string,
  tarea?: string
): { dxf: string; descripcion: string; advertencias: string[]; modo: 'crear' | 'editar' } {
  const t = normalizar(prompt)
  const pareceEdicion =
    tarea === 'editar' ||
    /\b(modifica|modificar|edita|editar|cambia|cambiar|anade|anadir|poner|agrega|agregar|quita|quitar|elimina|eliminar|rota|rotar|gira|girar|mueve|mover|espeja|espejar|redimensiona|redimensionar)\b/.test(t)

  if (modeloActual && pareceEdicion) {
    const editado = modificarModelo(prompt, modeloActual)
    if (editado) return { ...editado, modo: 'editar' }
  }

  const creado = crearModelo(prompt)
  const advertencias = [...creado.advertencias]
  if (modeloActual && pareceEdicion) {
    advertencias.unshift('No se reconoció la operación de edición; se generó un modelo nuevo a partir de la instrucción.')
  }
  return { ...creado, advertencias, modo: 'crear' }
}

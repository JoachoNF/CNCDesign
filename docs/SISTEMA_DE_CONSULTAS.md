# Sistema de consultas de modelado

La Terminal IA ya **no depende de claves externas** para funcionar. Si no hay
API keys ni Ollama disponibles, el router utiliza el **intérprete local**
(`src/cad/interpretador.ts`), que traduce la instrucción en español a entidades
DXF reales y aplica los cambios sobre el **modelo destino** (el archivo cargado
en el visor). Se eliminó el antiguo fallback que devolvía siempre la placa de
ejemplo con agujeros.

## Flujo

1. `TerminalIA` envía el prompt **junto con el `dxfTexto` del modelo actual**.
2. El router clasifica la tarea y prueba los proveedores configurados.
3. Si ninguno responde (o no hay ninguno), llama a `resolverConsultaLocal()`.
4. El intérprete genera/edita el DXF, lo valida y lo devuelve con una
   descripción de lo realizado.
5. La app **aplica el resultado al visor automáticamente** (opción
   «Auto-aplicar» en la Terminal IA, activada por defecto). El DXF anterior se
   guarda en la pila de deshacer.

## Crear geometría (ejemplos)

| Consulta | Resultado |
|---|---|
| `placa de 100x60 mm con 4 agujeros de 8 mm en las esquinas` | Rectángulo 100×60 + 4 taladros |
| `círculo de 80 mm de diámetro` | Disco Ø80 |
| `cuadrado de 45 mm por lado` | Cuadrado 45×45 |
| `triángulo de lado 50 mm` | Triángulo equilátero |
| `hexágono de 60 mm con un agujero en el centro` | Polígono regular + taladro central |
| `línea de 120 mm` | Segmento |
| `texto "CNCDesign"` (con forma) | Rotulo grabado en la pieza |

Patrones de agujeros admitidos: **esquinas**, **en círculo**, **en el centro**,
**en hilera** y **en cuadrícula**. Se reconocen medidas con `x`, `×`, `por`,
`diámetro`, `radio`, `lado`, `espesor` y `margen`, con coma o punto decimal.

## Modificar el archivo destino

El intérprete conserva las entidades del modelo cargado y aplica solo la
operación pedida:

| Consulta | Operación |
|---|---|
| `añadir 2 agujeros de 6 mm` | Añade taladros (en hilera si ya hay otros, para no solaparlos) |
| `quitar los agujeros` | Elimina las entidades `CIRCLE` de la capa `AGUJEROS` |
| `rotar 90 grados` | Rota toda la geometría |
| `espejar respecto al eje y` | Refleja la geometría |
| `mover 10, 5 mm` | Traslada la geometría |
| `cambiar el tamaño a 200x100 mm` | Redimensiona contorno y taladros |
| `convertir en círculo de 80 mm` | Sustituye el contorno, conservando los agujeros |

Cada cambio incrementa la versión del modelo (`v1 → v2 → …`) y se puede
deshacer con el botón del visor.

## Notas técnicas

- El módulo es **puro** (CommonJS): no importa `dxf-render/parser` (solo-ESM),
  por lo que puede ejecutarse en el proceso principal de Electron.
- Lee el DXF destino con un lector propio de pares código/valor, aplica
  transformaciones puras de `src/cad/transformaciones.ts` y serializa con
  `escribirDXF`.
- Las advertencias de manufacturabilidad se muestran en la terminal.

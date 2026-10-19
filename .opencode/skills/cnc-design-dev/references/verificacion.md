# Verificación

## 1. Compilación estática (siempre)

```bash
./node_modules/.bin/tsc -p tsconfig.build.json   # compila main + núcleo a dist/
./node_modules/.bin/tsc --noEmit                 # typecheck completo
./node_modules/.bin/vite build                   # bundle del renderer
```

O todo junto con la skill: `bash scripts/verificar.sh <ruta-al-repo>`.

## 2. Capturas automatizadas (verificación visual)

El proceso principal incluye un runner que carga la UI, espera, captura y cierra la app:

```bash
CAPTURA_UI=/tmp/opencode/ui.png npm run dev
```

| Variable | Efecto |
|---|---|
| `CAPTURA_UI` | Ruta del PNG a guardar (activa el modo captura y el cierre automático) |
| `CAPTURA_UI_DXF` | Ruta de un `.dxf` a cargar antes de capturar |
| `CAPTURA_UI_VISTA` | `dividida` \| `fullVisor` \| `fullTerminal` |
| `CAPTURA_UI_JS` | JavaScript a ejecutar antes de la captura (solo desarrollo) |

En headless:

```bash
xvfb-run -a env CAPTURA_UI=/tmp/opencode/ui.png npm run dev
```

…y revisa el PNG. Este es el **mecanismo principal de verificación de UI** del proyecto (no hay tests E2E).

### Trucos de verificación

- **Sembrar un modelo**: `CAPTURA_UI_DXF=demo.dxf` carga un archivo real; o desde JS, escribir el estado esperado en `localStorage` y forzar `location.reload()` dentro de `CAPTURA_UI_JS` (el runner espera lo suficiente).
- **Generar un DXF de ejemplo sin UI**:
  ```bash
  node -e "const g=require('./dist/src/cad/generator'); require('fs').writeFileSync('/tmp/demo.dxf', g.ejemploPlacaConAgujeros())"
  ```
- **Interactuar como usuario**: `CAPTURA_UI_JS` puede hacer clic en elementos por selector (`document.querySelectorAll('button')[n].click()`) antes de la captura.

## 3. Hook de desarrollo `window.__CNC`

Con `NODE_ENV=development` el renderer expone:

```js
window.__CNC = { edicion, transformaciones, store }   // módulos + store Zustand
```

Ejemplos de uso desde `CAPTURA_UI_JS` o la consola:

```js
window.__CNC.store.getState().modeloActual.version
window.__CNC.transformaciones.rotar(window.__CNC.edicion.entidadesParaEdicion(dxf), 90)
```

## 4. Verificar la capa IA sin claves

Se puede simular Ollama con un servidor HTTP mínimo escuchando en `localhost:11434`, de modo que el router lo detecte como proveedor disponible:

~~~~bash
node -e "
const http=require('http');
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'modelo-elegido:3b'}]}));return}
  let b='';req.on('data',c=>b+=c);
  req.on('end',()=>res.end(JSON.stringify({message:{content:'listo'}})));
}).listen(11434)"
~~~~

Con eso se verifican la clasificación de tareas, la preferencia de proveedor (`modelo-elegido:3b` debe aparecer en `modeloIA`) y los fallbacks, sin gastar tokens.

# Configuración de IA

## Precedencia de claves

1. **Modal de la app** (icono ⚙ en la Terminal IA) → se guarda en `config-ia.json` dentro de `app.getPath('userData')` (en Linux, típicamente `~/.config/cnc-design/config-ia.json`).
   - Campos: `anthropicApiKey`, `openaiApiKey`, `ollamaUrl`.
2. **Variables de entorno** (`.env` o entorno del sistema): se leen al arrancar la app.
3. Al guardar desde el modal, el main actualiza `process.env` y llama a `cadRouter.recargarProveedores()` → efecto inmediato, sin reiniciar.

## Variables de entorno

| Variable | Defecto | Efecto |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Habilita Claude |
| `OPENAI_API_KEY` | — | Habilita GPT |
| `OLLAMA_URL` | `http://localhost:11434` | Servidor Ollama |
| `OLLAMA_MODEL` | `qwen2.5-coder:7b` | Modelo por defecto de Ollama |

`.env.example` documenta el formato; `.env` está en `.gitignore` y **nunca** se commitea.

## Enrutamiento por tarea

El router clasifica por palabras clave (`clasificarTarea`); la terminal envía `tipo: 'desconocido'` para que la clasificación sea siempre del router.

| Tarea | Preferido | Fallbacks |
|---|---|---|
| crear | Anthropic | OpenAI → Ollama |
| editar | OpenAI | Anthropic → Ollama |
| imagen | Anthropic | OpenAI → Ollama |
| corregir | OpenAI | Anthropic → Ollama |

- Si el usuario fija un proveedor en el selector (`proveedorPreferido ≠ 'auto'`), ese se intenta primero; si no está disponible, continúa la cascada.
- Un proveedor está «disponible» si tiene clave (Anthropic/OpenAI) o si responde (Ollama). Ollama es además el último recurso siempre.

## Detalles de Ollama (verificados empíricamente)

- Los parámetros de generación van **dentro de `options`** (`temperature`, `num_predict`); a nivel raíz se ignoran silenciosamente.
- Se envía `keep_alive: '5m'` para no descargar el modelo entre peticiones.
- Timeout del cliente: **15 minutos** (en CPU, un 7B recién cargado puede tardar ~5 min).
- El selector lista los modelos instalados con `GET /api/tags` (IPC `cad:modelos-ollama`).
- `OLLAMA_MODEL` fija el modelo si el usuario no elige otro en el selector.

## Probar el router sin claves ni GPU

Simula Ollama con un HTTP mínimo (ver también `verificacion.md`), ajusta el selector o el entorno, y comprueba `proveedorUsado` / `modeloIA` en la respuesta:

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

Durante el desarrollo, `window.__CNC` permite invocar el router y el store directamente desde la consola o `CAPTURA_UI_JS`.

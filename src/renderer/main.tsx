/**
 * main.tsx — Punto de entrada del renderer (React + Vite)
 *
 * Monta la aplicación y, SOLO en desarrollo, expone `window.__CNC` con los
 * módulos de edición/transformaciones y el store global, para poder
 * inspeccionarlos desde la consola o desde las capturas automatizadas
 * (variable CAPTURA_UI_JS). El gate usa `process.env.NODE_ENV` porque el
 * código compartido se compila a CommonJS (import.meta no está disponible).
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './components/App'
import '@fontsource-variable/inter'
import '../index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Herramientas de inspección para pruebas automatizadas (solo desarrollo)
if (process.env.NODE_ENV === 'development') {
  void Promise.all([
    import('../cad/edicion'),
    import('../cad/transformaciones'),
    import('./store/modelStore'),
  ]).then(([edicion, transformaciones, store]) => {
    ;(window as any).__CNC = { edicion, transformaciones, store }
  })
}

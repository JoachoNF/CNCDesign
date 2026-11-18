import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // Rutas relativas para que la app empaquetada (file://) cargue bien los assets
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cad': path.resolve(__dirname, './src/cad'),
      '@ai': path.resolve(__dirname, './src/ai'),
      // dxf-render importa FXAAPass de three/addons, que puede no existir
      // en la versión instalada de three. Se redirige a un stub local.
      'three/addons/postprocessing/FXAAPass.js': path.resolve(
        __dirname,
        './src/renderer/components/stubs/FXAAPass.stub.js'
      ),
    },
  },
  build: {
    // Los módulos `three/addons/*` deben quedar empaquetados: si se marcan como
    // externos, el bundle de producción (que se carga por file://) deja
    // specifiers desnudos y el renderer falla con "Failed to resolve module
    // specifier three/addons/...". El alias del stub de FXAAPass cubre el único
    // addon ausente en la versión instalada de three.
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Code-splitting: separar three.js del bundle principal para reducir el inicial y mejorar cacheo
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  server: {
    port: 5123,
    strictPort: true,
  },
})

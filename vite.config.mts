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
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: (id) => /three\/addons\//.test(id),
    },
  },
  server: {
    port: 5123,
    strictPort: true,
  },
})

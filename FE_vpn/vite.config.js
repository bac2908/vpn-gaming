import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// https://vite.dev/config/
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/machines': 'http://localhost:8000',
      '/payments': 'http://localhost:8000',
      '/subscriptions': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  build: {
    // Output to 'dist' for Docker, or backend static folder for local dev
    outDir: globalThis.process?.env?.DOCKER_BUILD ? 'dist' : path.resolve(__dirname, '../BE_vpn/app/static'),
    emptyOutDir: true,
  },
})

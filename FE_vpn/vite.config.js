import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// https://vite.dev/config/
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  build: {
    // Output to 'dist' for Docker, or backend static folder for local dev
    outDir: globalThis.process?.env?.DOCKER_BUILD ? 'dist' : path.resolve(__dirname, '../BE_vpn/app/static'),
    emptyOutDir: true,
  },
})

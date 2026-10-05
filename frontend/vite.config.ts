import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'version-service-worker',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8')
            .replaceAll('__BUILD_ID__', randomUUID()),
        })
      },
    },
  ],
  server: {
    port: 5173,
  },
})

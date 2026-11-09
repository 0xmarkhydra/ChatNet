import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { chatCopyImageDevProxy } from './dev/chatCopyImageProxy'

export default defineConfig({
  // Ignore nested frontend/output snapshots when discovering app dependencies.
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { entries: ['index.html'] },
  plugins: [
    react(),
    chatCopyImageDevProxy(),
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
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: process.env.CHATNET_API_PROXY_TARGET ? {
      '/api': { target: process.env.CHATNET_API_PROXY_TARGET, changeOrigin: true, secure: true },
    } : process.env.VITE_API_URL?.startsWith('https://') ? {
      '/api': { target: process.env.VITE_API_URL, changeOrigin: true },
    } : undefined,
  },
})

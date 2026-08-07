import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Local `/api/auth/line` so `npm run dev` works without `vercel dev`. */
function lineAuthDevPlugin(env) {
  return {
    name: 'bounce-line-auth-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/auth/line') return next()
        for (const [k, v] of Object.entries(env)) {
          if (v != null && process.env[k] == null) process.env[k] = v
        }
        try {
          const mod = await import(pathToFileURL(path.join(rootDir, 'api/_lib/lineExchange.js')).href)
          await mod.handleLineExchange(req, res)
        } catch (e) {
          console.error('[line-auth-dev]', e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'unknown', detail: e?.message || 'dev api failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), lineAuthDevPlugin(env)],
    build: {
      // the firebase vendor chunk is legitimately ~700 kB and split out on
      // purpose; raise the warning threshold so the build output stays clean
      chunkSizeWarningLimit: 750,
      rollupOptions: {
        output: {
          manualChunks: {
            // split Firebase into its own cached chunk so app-code updates
            // don't force users to re-download the (large, stable) SDK
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            // React runtime rarely changes either — keep it separate
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  }
})

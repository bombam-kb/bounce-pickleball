import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Serve the staff entry at /admin during `vite` / `vite preview`. */
function adminHtmlPlugin() {
  const rewrite = (req) => {
    const raw = req.url || ''
    const url = raw.split('?')[0]
    if (url === '/admin' || url === '/admin/' || (url.startsWith('/admin/') && !url.includes('.'))) {
      req.url = '/admin.html' + (raw.includes('?') ? `?${raw.split('?').slice(1).join('?')}` : '')
    }
  }
  return {
    name: 'bounce-admin-html',
    configureServer(server) {
      server.middlewares.use((req, res, next) => { rewrite(req); next() })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => { rewrite(req); next() })
    },
  }
}

/** Local `/api/*` so `npm run dev` works without `vercel dev`. */
function localApiPlugin(env) {
  const routes = {
    '/api/auth/line': { file: 'api/_lib/lineExchange.js', fn: 'handleLineExchange' },
    '/api/bookings/pay': { file: 'api/_lib/bookingPay.js', fn: 'handleBookingPay' },
    '/api/admin/slip': { file: 'api/_lib/slipView.js', fn: 'handleSlipView' },
    '/api/slots/taken': { file: 'api/_lib/slotsTaken.js', fn: 'handleSlotsTaken' },
  }
  return {
    name: 'bounce-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        const route = routes[url]
        if (!route) return next()
        for (const [k, v] of Object.entries(env)) {
          if (v != null && process.env[k] == null) process.env[k] = v
        }
        try {
          const href = pathToFileURL(path.join(rootDir, route.file)).href + `?t=${Date.now()}`
          const mod = await import(href)
          await mod[route.fn](req, res)
        } catch (e) {
          console.error(`[local-api] ${url}`, e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'unknown' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [adminHtmlPlugin(), react(), localApiPlugin(env)],
    build: {
      // the firebase vendor chunk is legitimately ~700 kB and split out on
      // purpose; raise the warning threshold so the build output stays clean
      chunkSizeWarningLimit: 750,
      rollupOptions: {
        input: {
          main: path.join(rootDir, 'index.html'),
          admin: path.join(rootDir, 'admin.html'),
        },
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

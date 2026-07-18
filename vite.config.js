import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
})

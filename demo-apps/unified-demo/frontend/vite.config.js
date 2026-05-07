import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    allowedHosts: ['cms-test.securedapp.io', 'localhost'],
    proxy: {
      '/api': 'http://localhost:5050',
    },
  },
  preview: {
    allowedHosts: ['cms-test.securedapp.io', 'localhost'],
    // Same as dev: so `npm run build && npm run preview` can reach the demo API on :5050
    proxy: {
      '/api': 'http://localhost:5050',
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // api-url.ts is shared with older Next-oriented modules; replace its env
  // expression at build time so Vite browser code never reads an undefined
  // Node.js process object.
  define: {
    'process.env.NEXT_PUBLIC_API_URL': JSON.stringify(
      process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || '',
    ),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})

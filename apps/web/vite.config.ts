/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Single-origin tunneling (e.g. ngrok): the web app proxies the gateway,
    // so only port 5173 needs exposing. Client must run with VITE_API_URL=""
    // so api.ts issues relative URLs.
    proxy: {
      '/api': 'http://localhost:8787',
      '/stories': 'http://localhost:8787',
    },
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
})

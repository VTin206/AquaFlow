/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    include: ['tests/**/*.test.mjs'],
  },
  build: {
    // Phần lõi Ant Design dùng chung cho mọi trang (~580 kB, ~190 kB gzip); các trang đã được tách riêng bằng lazy().
    chunkSizeWarningLimit: 700,
  },
})

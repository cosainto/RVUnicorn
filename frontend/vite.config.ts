import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      'ideal-renewal-production.up.railway.app',
      'www.rvunicorn.com',
      'rvunicorn.com',
      '.railway.app'
    ],
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '4173')
  }
})

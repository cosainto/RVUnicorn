import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React framework
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Map-related libraries (only loaded on map pages)
          'vendor-maps': ['@googlemaps/markerclusterer', 'd3-geo', 'react-simple-maps'],
          // Calendar libraries
          'vendor-calendar': ['react-big-calendar', 'react-calendar', 'date-fns'],
          // Real-time communication
          'vendor-socket': ['socket.io-client'],
        }
      }
    }
  },
  server: {
    proxy: {
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Express serves Backend/public in production. Building directly here keeps
    // the frontend and API on the same origin and avoids a separate host.
    outDir: '../Backend/public',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/health': 'http://localhost:5000'
    }
  }
});
